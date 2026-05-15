from flask import Blueprint, request, jsonify
from llm import chat
from scraper import search_ingredient
import json

bp = Blueprint("api", __name__)


@bp.route("/chat", methods=["POST"])
def chat_endpoint():
    body = request.get_json()
    messages = body.get("messages", [])
    restrictions = body.get("dietary_restrictions", [])
    goals = body.get("health_goals", [])

    if not messages:
        return jsonify({"error": "messages array is required"}), 400

    try:
        reply = chat(messages, restrictions, goals)

        recipe = None
        try:
            raw = reply.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            recipe = json.loads(raw)
        except Exception:
            pass

        return jsonify({"reply": reply, "recipe": recipe})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/search", methods=["GET"])
def search_endpoint():
    ingredient = request.args.get("ingredient", "").strip()
    if not ingredient:
        return jsonify({"error": "ingredient query param is required"}), 400

    try:
        results = search_ingredient(ingredient)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/debug-scraper", methods=["GET"])
def debug_scraper():
    import httpx
    from config import SCRAPER_API_KEY
    ingredient = request.args.get("q", "chicken breast")
    resp = httpx.get(
        "https://api.scraperapi.com/structured/walmart/search",
        params={"api_key": SCRAPER_API_KEY, "query": ingredient},
        timeout=30,
    )
    return jsonify({"status": resp.status_code, "body": resp.json()})


@bp.route("/debug-playwright", methods=["GET"])
def debug_playwright():
    """Uses Playwright to dump raw structure so we can verify the JSON path."""
    import asyncio
    from playwright.async_api import async_playwright

    ingredient = request.args.get("q", "chicken breast")
    url = f"https://www.walmart.com/search?q={ingredient.replace(' ', '+')}&affinityOverride=default"

    async def _run():
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800},
                locale="en-US",
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            try:
                await page.wait_for_function(
                    "document.getElementById('__NEXT_DATA__') !== null",
                    timeout=10000
                )
                raw = await page.evaluate("document.getElementById('__NEXT_DATA__').textContent")
                await browser.close()
                return {"raw": raw, "error": None}
            except Exception as e:
                html = await page.content()
                await browser.close()
                return {"raw": None, "error": str(e), "html_snippet": html[:3000]}

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(_run())
    finally:
        loop.close()

    if result["error"]:
        return jsonify({"error": result["error"], "html_snippet": result.get("html_snippet")})

    try:
        data = json.loads(result["raw"])
        # Try to walk the expected path
        search_result = data["props"]["pageProps"]["initialData"]["searchResult"]
        stacks = search_result.get("itemStacks", [])
        if not stacks:
            return jsonify({"error": "itemStacks is empty", "searchResult_keys": list(search_result.keys())})
        items = stacks[0].get("items", [])
        if not items:
            return jsonify({"error": "items array is empty", "stack_keys": list(stacks[0].keys())})
        first = items[0]
        return jsonify({
            "success": True,
            "item_count": len(items),
            "first_item_keys": list(first.keys()),
            "name": first.get("name"),
            "priceInfo": first.get("priceInfo"),
            "canonicalUrl": first.get("canonicalUrl"),
            "usItemId": first.get("usItemId"),
        })
    except KeyError as e:
        # Path broke — show what keys exist at each level
        try:
            props = data.get("props", {})
            page_props = props.get("pageProps", {})
            initial_data = page_props.get("initialData", {})
            return jsonify({
                "error": f"KeyError: {e}",
                "props_keys": list(props.keys()),
                "pageProps_keys": list(page_props.keys()),
                "initialData_keys": list(initial_data.keys()),
            })
        except Exception as e2:
            return jsonify({"error": str(e2), "raw_snippet": result["raw"][:2000]})


@bp.route("/debug-raw", methods=["GET"])
def debug_raw():
    """Returns raw priceInfo for first result — paste output to diagnose price field."""
    import httpx
    from parsel import Selector

    ingredient = request.args.get("q", "peanut butter")
    url = f"https://www.walmart.com/search?q={ingredient.replace(' ', '+')}&affinityOverride=default"
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
    }
    resp = None
    try:
        with httpx.Client(http2=True, timeout=10) as client:
            resp = client.get(url, headers=headers)
        sel = Selector(text=resp.text)
        raw = sel.xpath('//script[@id="__NEXT_DATA__"]/text()').get()
        if not raw:
            return jsonify({
                "error": "no __NEXT_DATA__ found — likely bot-blocked",
                "status_code": resp.status_code,
                "final_url": str(resp.url),
                "html_snippet": resp.text[:2000],
            })
        data = json.loads(raw)
        items = data["props"]["pageProps"]["initialData"]["searchResult"]["itemStacks"][0]["items"]
        first = items[0]
        return jsonify({
            "name": first.get("name"),
            "priceInfo": first.get("priceInfo"),
            "price": first.get("price"),
            "all_keys": list(first.keys()),
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "status_code": resp.status_code if resp else None,
            "html_snippet": resp.text[:2000] if resp else None,
        })