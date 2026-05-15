import httpx
import json
from parsel import Selector

BASE_HEADERS = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "en-US;en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
}

WALMART_SEARCH_URL = "https://www.walmart.com/search?q={query}&affinityOverride=default"

# Simple in-memory cache to reduce scrape calls
_cache: dict[str, list[dict]] = {}


def search_ingredient(ingredient: str, max_results: int = 5) -> list[dict]:
    """
    Search Walmart for a grocery ingredient.
    Returns a list of product dicts with id, name, price, image, url.
    """
    cache_key = ingredient.lower().strip()
    if cache_key in _cache:
        return _cache[cache_key]

    url = WALMART_SEARCH_URL.format(query=ingredient.replace(" ", "+"))

    try:
        with httpx.Client(http2=True, timeout=10) as client:
            response = client.get(url, headers=BASE_HEADERS)
            response.raise_for_status()
    except httpx.HTTPError as e:
        raise RuntimeError(f"Failed to reach Walmart: {e}")

    sel = Selector(text=response.text)
    raw = sel.xpath('//script[@id="__NEXT_DATA__"]/text()').get()

    if not raw:
        raise RuntimeError("Could not find __NEXT_DATA__ on Walmart page. Site may have changed.")

    data = json.loads(raw)

    try:
        items = (
            data["props"]["pageProps"]["initialData"]["searchResult"]["itemStacks"][0]["items"]
        )
    except (KeyError, IndexError, TypeError):
        return []

    results = []
    for item in items[:max_results]:
        product_id = item.get("usItemId") or item.get("id")
        name = item.get("name")
        price = item.get("priceInfo", {}).get("currentPrice", {}).get("price")
        image = item.get("imageInfo", {}).get("thumbnailUrl")
        canonical_url = item.get("canonicalUrl", "")
        product_url = f"https://www.walmart.com{canonical_url}" if canonical_url else None

        if product_id and name:
            results.append({
                "id": str(product_id),
                "name": name,
                "price": price,
                "image": image,
                "url": product_url,
            })

    _cache[cache_key] = results
    return results


def clear_cache():
    _cache.clear()