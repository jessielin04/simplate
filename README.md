<img src="frontend/assets/onboard_logo.svg" alt="Simplate" width="300" />

# Simplate

An AI-powered Chrome extension that acts as your personal nutrition assistant inside Walmart. It suggests recipes based on your dietary restrictions and health goals, finds the ingredients on Walmart, and adds them to your cart all from a side panel.

---

## What you'll need

- Google Chrome
- Python 3.9+
- A [xAI API key]((https://console.x.ai/home)) (free)
- A [ScraperAPI key](https://www.scraperapi.com) (free tier available)

---

## Setup

### 1. Set up the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install flask flask-cors grok httpx python-dotenv
```

> **Mac:** use `python3 -m venv venv` to create the environment, and `source venv/bin/activate` to activate it (instead of `venv\Scripts\activate`).

> **Optional:** the `/debug-*` developer routes in `routes.py` use `parsel` and `playwright`. You only need these if you're debugging the scraper: `pip install parsel playwright` then `playwright install chromium`. They are not required for normal use.

Create a `.env` file in the `backend/` folder:

```
GROK_API_KEY=your_grok_key_here
SCRAPER_API_KEY=your_scraperapi_key_here
```

### 2. Load the extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `frontend/` folder

You should see the Simplate icon appear in your toolbar.

---

## Running

Every time you want to use Simplate, start the backend first:

```bash
cd backend
venv\Scripts\activate
python main.py
```

> **Mac:** use `source venv/bin/activate` to activate, and `python3 main.py` to run (instead of `venv\Scripts\activate` and `python main.py`).

Then click the Simplate icon in Chrome to open the side panel.

---

## How it works

When you open Simplate, you land on a **profile picker** ("Who's cooking?"). Pick a profile to continue, or add a new one to run through onboarding. Profiles are stored locally on your device (no passwords) and each keeps its own restrictions, goals, list, meals, and saved recipes- like Netflix profiles.

| Tab | What it does |
|-----|-------------|
| **Chat** | Ask for recipe suggestions. The AI tailors them to your dietary restrictions and health goals. Add a recipe's ingredients to your List or save it to a day in Meals. |
| **List** | Ingredients from a recipe. Click any item to pick a Walmart product. Each selected item has its own quantity stepper (−/+), so you can set how many of each to add. Then add them all to your cart. |
| **Meals** | Weekly calendar (Sun–Sat). Save recipes to specific days and meal slots. Each meal has a **Regenerate (✦)** button that asks the AI for a fresh recipe for just that slot, keeping your restrictions and goals in mind. |
| **Saved** | Browse and search your saved recipes, organized by meal type. |
| **Profile** | Set your name, avatar, dietary restrictions, health goals, budget, calories, household size, and fulfillment preference (delivery or pickup). Sign out returns to the profile picker; delete removes the profile. |

---

## Notes

- The backend must be running on `localhost:5000` for chat and ingredient search to work.
- Walmart cart automation opens a minimized browser window — don't close it until the process finishes.
- Ingredient prices are pulled live from Walmart via ScraperAPI. Results may vary by region.
- **Your data is stored locally in Chrome, per device.** Profiles, lists, saved recipes, and the weekly meal plan live in `chrome.storage.local`. They don't sync across computers and there are no passwords.
- **Chat history resets each session** by design; the meal plan covers the current week (Sun–Sat) and resets weekly. Saved recipes persist indefinitely.
- **Quantity per item:** the extension adds each product once, then uses Walmart's on-page quantity stepper to reach the count you set. Some by-weight items (e.g. bananas sold "Each") may not expose a stepper— for those, set the quantity in your Walmart cart after adding.
- Avatar images are [Pixabots](https://pablostanley.gumroad.com/l/pixabots) by Pablo Stanley, free for personal and commercial use.

---

## Troubleshooting

**Extension not appearing**: make sure you selected the `frontend/` folder, not the repo root, when loading unpacked.

**Chat not responding**: confirm the backend is running (`python main.py`) and check that your `GROK_API_KEY` is set in `.env`.

**Chat not responding on Mac (403 error or port in use)**: macOS uses port 5000 for the **AirPlay Receiver**, which collides with the backend. Two fixes:
1. Turn it off: **System Settings → General → AirDrop & Handoff → AirPlay Receiver → Off**, then restart the backend.
2. If you still get a 403, open `backend/main.py` and change `host="127.0.0.1"` to `host="0.0.0.0"`. This is a Mac IPv6-vs-IPv4 routing quirk; Windows is unaffected.

**Ingredient search returns nothing**: check your `SCRAPER_API_KEY` and your ScraperAPI usage limits.

**Cart automation fails**: make sure you're on a Walmart product page and not already in the cart. Try selecting a different product variant.

**An item shows "Unavailable — pick a different product"**: the chosen Walmart product was out of stock, or its product page couldn't be found (occasionally a search result links to a dead page). The item is flagged in your List with a **Try different product →** button; tap it to pick another option, then add to cart again.

**Quantity stays at 1**: some by-weight items don't show Walmart's quantity stepper on the product page. Adjust the count directly in your Walmart cart for those items.
