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


@bp.route("/cart", methods=["POST"])
def cart_endpoint():
    body = request.get_json()
    items = body.get("items", [])

    if not items:
        return jsonify({"error": "items array is required"}), 400

    items_param = ",".join(
        f"{item['itemId']}:{item.get('quantity', 1)}" for item in items
    )
    cart_url = f"https://www.walmart.com/cart/AddItemsToCart?items={items_param}"
    return jsonify({"cart_url": cart_url})