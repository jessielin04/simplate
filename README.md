# Walmart Health Extension

A Chrome extension that recommends healthy recipes based on your dietary goals and adds ingredients directly to your Walmart cart.

---

## Prerequisites

- Python 3.10+
- Google Chrome
- A [Gemini API key](https://aistudio.google.com/app/apikey) (free)
- A [Walmart Developer API key](https://developer.walmart.com) (free)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-team/walmart-health-extension.git
cd walmart-health-extension
```

### 2. Configure your API keys

```bash
cp .env.example backend/.env
```

Open `backend/.env` and fill in:

```
GEMINI_API_KEY=your_key_here
WALMART_CONSUMER_ID=your_consumer_id_here
WALMART_PRIVATE_KEY=your_base64_private_key_here
WALMART_KEY_VERSION=1
```

### 3. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Start the backend server

```bash
python main.py
```

You should see:
```
✅ Walmart Health backend running at http://localhost:5000
```

Keep this terminal open while using the extension.

### 5. Load the Chrome extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `frontend/` folder from this repo

The extension icon will appear in your toolbar.

---

## Usage

1. Navigate to [walmart.com](https://walmart.com)
2. Click the extension icon
3. Enter your dietary restrictions and health goals
4. Chat with the AI to get recipe suggestions
5. Select products for each ingredient
6. Click **Add to Cart**

---

## Data & Privacy

- All your data stays on your machine — nothing is sent to any team server
- Your API keys are stored locally in your `.env` file and never shared
- Recipe and product selections are saved in your browser's local storage

---

## Troubleshooting

**Backend won't start:** Make sure `backend/.env` exists and has all required keys filled in.

**"Could not find __NEXT_DATA__" error:** Walmart may have changed their page structure or is blocking the request. Try again in a few minutes.

**Extension not connecting:** Make sure the backend server is running at `http://localhost:5000`.