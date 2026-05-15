// Injected into walmart.com pages by the extension.
// Waits for a "simplate_atc" message, then polls for and clicks Add to Cart.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'simplate_atc') return;

  pollAndClick()
    .then(success => sendResponse({ success }))
    .catch(() => sendResponse({ success: false }));

  return true; // keep channel open for async sendResponse
});

function pollAndClick(maxWaitMs = 10000, intervalMs = 400) {
  return new Promise((resolve) => {
    const start = Date.now();

    const timer = setInterval(() => {
      const btn = findATCButton();
      if (btn) {
        clearInterval(timer);
        btn.click();
        resolve(true);
        return;
      }
      if (Date.now() - start >= maxWaitMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, intervalMs);
  });
}

function findATCButton() {
  // Ordered from most specific/reliable to broadest fallback
  const selectors = [
    // Current Walmart product page (2024–2025)
    '[data-automation-id="add-to-cart-btn"]',
    '[data-tl-id="ProductPrimaryCTA-cta_add_to_cart_button"]',
    'button[data-testid="add-to-cart-btn"]',
    // Older / alternate layouts
    'button.prod-ProductCTA--primary',
    '[data-automation="add-to-cart"]',
    // Aria label fallbacks
    'button[aria-label*="Add to cart" i]',
  ];

  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn && !btn.disabled && isVisible(btn)) return btn;
  }

  // Last resort: any enabled button whose text is exactly "Add to cart"
  for (const btn of document.querySelectorAll('button')) {
    if (
      !btn.disabled &&
      isVisible(btn) &&
      btn.textContent.trim().toLowerCase() === 'add to cart'
    ) {
      return btn;
    }
  }

  return null;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
}