from groq import Groq
import json
import os
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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
    groq_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in messages:
        role = "user" if msg["role"] == "user" else "assistant"
        groq_messages.append({"role": role, "content": msg["content"]})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=groq_messages
    )
    return response.choices[0].message.content