<img src="frontend/assets/onboard_logo.svg" alt="Simplate" width="300" />

# Simplate

A Chrome extension that acts as your personal nutrition assistant inside Walmart. It suggests recipes based on your dietary restrictions and health goals, finds the ingredients on Walmart, and adds them to your cart all from a side panel.

---

## What you'll need

- Google Chrome
- Python 3.9+
- A [Groq API key](https://console.groq.com) (free)
- A [ScraperAPI key](https://www.scraperapi.com) (free tier available)

---

## Setup

### 1. Set up the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install flask flask-cors groq httpx python-dotenv
```

> **Mac:** use `source venv/bin/activate` instead of `venv\Scripts\activate`
> **Mac:** use `python3 -m venv venvy` instead of `python -m venv venv`

Create a `.env` file in the `backend/` folder:

```
GROQ_API_KEY=your_groq_key_here
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

> **Mac:** use `source venv/bin/activate` instead of `venv\Scripts\activate`
> **Mac:** use `python3 main.py` instead of `python main.py`

Then click the Simplate icon in Chrome to open the side panel.

---

## How it works

| Tab | What it does |
|-----|-------------|
| **Chat** | Ask for recipe suggestions. The AI tailors them to your dietary restrictions and health goals. |
| **List** | Ingredients from the last recipe. Click any item to pick a Walmart product, then add them all to your cart. |
| **Meals** | Weekly calendar. Save recipes to specific days and meal slots. |
| **Saved** | Browse and search your saved recipes, organized by meal type. |
| **Profile** | Set your name, dietary restrictions, health goals, budget, calories, household size, and fulfillment preference (delivery or pickup). |

---

## Notes

- The backend must be running on `localhost:5000` for chat and ingredient search to work.
- Walmart cart automation opens a minimized browser window — don't close it until the process finishes.
- Ingredient prices are pulled live from Walmart via ScraperAPI. Results may vary by region.
- Avatar images are [Pixabots](https://pablostanley.gumroad.com/l/pixabots) by Pablo Stanley, free for personal and commercial use.

---

## Troubleshooting

**Extension not appearing** — make sure you selected the `frontend/` folder, not the repo root, when loading unpacked.

**Chat not responding** — confirm the backend is running (`python main.py`) and check that your `GROQ_API_KEY` is set in `.env`.

**Ingredient search returns nothing** — check your `SCRAPER_API_KEY` and your ScraperAPI usage limits.

**Cart automation fails** — make sure you're on a Walmart product page and not already in the cart. Try selecting a different product variant.
