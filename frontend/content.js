// Injected into walmart.com pages by the extension.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'simplate_ping') {
    sendResponse({ ready: true });
    return true;
  }

  if (msg.type !== 'simplate_atc') return;

  const fulfillment = msg.fulfillment || 'delivery';

  // Check unavailability BEFORE polling, so we don't wait 15s to find out.
  const unavailableReason = getUnavailableReason();
  if (unavailableReason) {
    sendResponse({ success: false, reason: unavailableReason });
    return true;
  }

  pollAndClick()
    .then(async (success) => {
      if (success) {
        await sleep(2000);
        await selectFulfillment(fulfillment);
        await sleep(1000);
        sendResponse({ success: true });
      } else {
        // Check again after timeout — might have rendered an OOS message
        const reason = getUnavailableReason() || 'Button not found — item may be unavailable';
        sendResponse({ success: false, reason });
      }
    })
    .catch(() => sendResponse({ success: false, reason: 'Unexpected error' }));

  return true;
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Detect common Walmart unavailability states before wasting time polling.
function getUnavailableReason() {
  const bodyText = document.body.innerText;

  const oosPhrases = [
    'out of stock',
    'currently unavailable',
    'not available',
    'sold out',
    'unavailable',
    'this item is no longer available',
    'item is not available',
  ];

  // Check prominent page text (h1, product status elements) first
  const statusEls = [
    ...document.querySelectorAll(
      '[data-automation-id="product-availability"], ' +
      '[data-testid="fulfillment-summary"], ' +
      '.prod-unavailableMsg, ' +
      '[class*="unavailable"], ' +
      '[class*="out-of-stock"]'
    )
  ];

  for (const el of statusEls) {
    const t = el.textContent.trim().toLowerCase();
    for (const phrase of oosPhrases) {
      if (t.includes(phrase)) return 'Out of stock';
    }
  }

  // Broader fallback — only trigger if the ATC button is also absent,
  // to avoid false positives from page text mentioning these words in context.
  const hasATCButton = !!findATCButton();
  if (!hasATCButton) {
    for (const phrase of oosPhrases) {
      if (bodyText.toLowerCase().includes(phrase)) return 'Out of stock';
    }
  }

  return null;
}

async function selectFulfillment(preference) {
  const preferred = preference === 'delivery' ? 'delivery' : 'pickup';
  const fallback  = preference === 'delivery' ? 'pickup'   : 'delivery';
  const picked = await tryPickFulfillment(preferred);
  if (!picked) await tryPickFulfillment(fallback);
}

async function tryPickFulfillment(type) {
  const keyword = type === 'delivery' ? 'delivery' : 'pickup';
  await sleep(500);

  const candidates = [
    ...document.querySelectorAll(
      'button, [role="radio"], [role="tab"], [role="option"], label, [data-automation-id], [aria-label]'
    ),
  ];

  for (const el of candidates) {
    const text = el.textContent.trim().toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const automationId = (el.getAttribute('data-automation-id') || '').toLowerCase();

    const matches =
      (text.includes(keyword) || ariaLabel.includes(keyword) || automationId.includes(keyword)) &&
      !el.disabled &&
      isVisible(el);

    if (matches) {
      el.click();
      return true;
    }
  }

  return false;
}

function pollAndClick(maxWaitMs = 15000, intervalMs = 400) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(async () => {
      const btn = findATCButton();
      if (btn) {
        clearInterval(timer);
        await sleep(800);
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
  const selectors = [
    '[data-automation-id="add-to-cart-btn"]',
    '[data-tl-id="ProductPrimaryCTA-cta_add_to_cart_button"]',
    'button[data-testid="add-to-cart-btn"]',
    'button.prod-ProductCTA--primary',
    '[data-automation="add-to-cart"]',
    'button[aria-label*="Add to cart" i]',
  ];

  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn && !btn.disabled && isVisible(btn)) return btn;
  }

  for (const btn of document.querySelectorAll('button')) {
    if (
      !btn.disabled &&
      isVisible(btn) &&
      btn.textContent.trim().toLowerCase() === 'add to cart' &&
      !btn.closest('[data-testid*="carousel"]') &&
      !btn.closest('[data-testid*="similar"]') &&
      !btn.closest('[data-testid*="recommended"]') &&
      !btn.closest('[data-testid*="sponsored"]') &&
      !btn.closest('[data-testid*="frequently"]')
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