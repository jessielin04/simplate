import os
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY")

def validate_config():
    if not GROQ_API_KEY:
        raise EnvironmentError("Missing GROQ_API_KEY in .env")
    if not SCRAPER_API_KEY:
        raise EnvironmentError("Missing SCRAPER_API_KEY in .env")
