import httpx
from config import SCRAPER_API_KEY

_cache: dict[str, list[dict]] = {}

STRUCTURED_URL = "https://api.scraperapi.com/structured/walmart/search"


def search_ingredient(ingredient: str, max_results: int = 5) -> list[dict]:
    cache_key = ingredient.lower().strip()
    if cache_key in _cache:
        return _cache[cache_key]

    print(f"[scraper] searching Walmart for: {ingredient}")
    try:
        resp = httpx.get(
            STRUCTURED_URL,
            params={"api_key": SCRAPER_API_KEY, "query": ingredient},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[scraper] request failed: {e}")
        return []

    organic = data.get("items", [])
    if not organic:
        print(f"[scraper] no items in response. keys: {list(data.keys())}")
        return []

    results = []
    for item in organic:
        price_raw = item.get("price")
        if price_raw is None:
            continue
        price_val = float(price_raw)
        # Skip bulk/food-service items (over $50 or not sold by Walmart.com)
        if price_val > 50:
            continue

        price = f"${price_val:.2f}"
        url = item.get("url")
        item_id = item.get("id")
        name = item.get("name") or item.get("title")
        image = item.get("image") or item.get("thumbnail")

        if name:
            results.append({
                "id": str(item_id) if item_id else None,
                "name": name,
                "price": price,
                "image": image,
                "url": url,
            })

        if len(results) >= max_results:
            break

    print(f"[scraper] got {len(results)} results for '{ingredient}'")
    _cache[cache_key] = results
    return results


def clear_cache():
    _cache.clear()