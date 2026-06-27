from grok import Grok
import json
import os
from dotenv import load_dotenv

load_dotenv()
client = Grok(api_key=os.getenv("GROK_API_KEY"))

SYSTEM_PROMPT = """You are a healthy meal planning assistant. Your job is to suggest recipes based on the user's dietary restrictions and health goals.

Rules:
- Only suggest recipes that use common grocery ingredients available at major supermarkets like Walmart.
- Avoid specialty, ethnic, or hard-to-find ingredients.
- Keep ingredient lists concise (5–10 ingredients per recipe).
- Always respond in valid JSON with this exact structure:
{
  "recipe_name": "string",
  "description": "string (1-2 sentences)",
  "servings": number,
  "calories_per_serving": number,
  "ingredients": [
    { "name": "string", "quantity": "string (e.g. '2 cups')" }
  ],
  "instructions": ["step 1", "step 2", ...]
}
- Do not include any text outside the JSON object.
"""
def get_recipe(user_preferences: str, dietary_restrictions: list, health_goals: list) -> dict:
    restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "none"
    goals_str = ", ".join(health_goals) if health_goals else "general healthy eating"
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": (
                f"Suggest a recipe for me.\n"
                f"Dietary restrictions: {restrictions_str}\n"
                f"Health goals: {goals_str}\n"
                f"Additional preferences: {user_preferences}"
            )}
        ]
    )
    raw_text = response.choices[0].message.content.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    return json.loads(raw_text)

def chat(messages: list, dietary_restrictions: list, health_goals: list) -> str:
    grok_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in messages:
        role = "user" if msg["role"] == "user" else "assistant"
        grok_messages.append({"role": role, "content": msg["content"]})
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=grok_messages
    )
    return response.choices[0].message.content


def regenerate_meal(
    meal_type: str,
    dietary_restrictions: list,
    health_goals: list,
    exclude: list = None,
) -> dict:
    """Generate a single recipe for one meal slot (e.g. BREAKFAST).

    Uses a higher temperature and an explicit 'avoid these' list so repeated
    calls don't collapse to the same generic recipe (the cause of the
    'always chicken and vegetables' behavior).
    """
    import random

    restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "none"
    goals_str = ", ".join(health_goals) if health_goals else "general healthy eating"
    exclude = exclude or []
    exclude_str = "; ".join(exclude) if exclude else "none"

    slot = (meal_type or "meal").strip().lower()

    # A rotating nudge adds genuine variety across calls without overriding
    # the user's actual restrictions/goals.
    variety_angles = [
        "Lean into a different cuisine than usual.",
        "Use a different primary protein or main ingredient than a typical default.",
        "Make it seasonal and fresh.",
        "Aim for something quick and weeknight-friendly.",
        "Try a comforting, hearty take.",
        "Go for bright, light, and simple.",
    ]
    angle = random.choice(variety_angles)

    user_prompt = (
        f"Suggest exactly ONE {slot} recipe.\n"
        f"Dietary restrictions: {restrictions_str}\n"
        f"Health goals: {goals_str}\n"
        f"Do NOT suggest any of these recipes (already planned): {exclude_str}.\n"
        f"{angle}\n"
        f"Make it clearly different from a generic chicken-and-vegetables dish.\n"
        f"Respond with the JSON object only."
    )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.9,
        top_p=0.95,
        seed=random.randint(1, 1_000_000),
    )

    raw_text = response.choices[0].message.content.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    return json.loads(raw_text)
