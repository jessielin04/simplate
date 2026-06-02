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
        item_id = item.get("id")
        name = item.get("name") or item.get("title")
        image = item.get("image") or item.get("thumbnail")
        url = normalize_walmart_url(item.get("url"), item_id)

        # A correct product URL is required — without one, ATC would land on the
        # wrong page and add adjacent/recommended products. Skip if we can't
        # build a canonical /ip/ link.
        if name and url:
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


def normalize_walmart_url(raw_url, item_id=None):
    """Return an absolute canonical Walmart product URL (https://www.walmart.com/ip/...)
    or None if one can't be derived.

    Prefer the scraper's actual product `url` when it's a real /ip/ link — the
    id-constructed form (/ip/<id>) does NOT always resolve and can 404. Only
    fall back to the id form when no usable url is present.
    """
    # 1) Use the provided url if it points at a real product detail page.
    if isinstance(raw_url, str) and raw_url.strip():
        u = raw_url.strip()
        if u.startswith("/"):
            u = "https://www.walmart.com" + u
        if "walmart.com/ip/" in u:
            return u.split("?")[0]  # strip tracking params

    # 2) Fallback: construct from the item id (less reliable, may 404).
    if item_id:
        return f"https://www.walmart.com/ip/{item_id}"

    return None


def clear_cache():
    _cache.clear()