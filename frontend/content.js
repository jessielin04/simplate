// Injected into walmart.com pages by the extension.
// Waits for a "simplate_atc" message, then polls for and clicks Add to Cart,
// then selects the preferred fulfillment method (delivery or pickup).

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'simplate_atc') return;

  const fulfillment = msg.fulfillment || 'delivery';

  pollAndClick()
    .then(async (success) => {
      if (success) {
        await sleep(1500);
        await selectFulfillment(fulfillment);
      }
      sendResponse({ success });
    })
    .catch(() => sendResponse({ success: false }));

  return true;
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function selectFulfillment(preference) {
  // Walmart shows a fulfillment modal after ATC with "Delivery" and "Pickup" options.
  // Try preferred first, fall back to the other.
  const preferred = preference === 'delivery' ? 'delivery' : 'pickup';
  const fallback  = preference === 'delivery' ? 'pickup'   : 'delivery';

  const picked = await tryPickFulfillment(preferred);
  if (!picked) await tryPickFulfillment(fallback);
}

async function tryPickFulfillment(type) {
  const keyword = type === 'delivery' ? 'delivery' : 'pickup';

  // Wait briefly for modal to appear
  await sleep(500);

  // Cast a wide net — Walmart uses various element types for fulfillment options
  const candidates = [
    ...document.querySelectorAll(
      'button, [role="radio"], [role="tab"], [role="option"], label, [data-automation-id], [aria-label]'
    ),
  ];

  // DEBUG: log all candidates so you can inspect them in DevTools
  // Open the Walmart tab and check the Console tab after triggering ATC.
  // Once you find the right elements, you can remove these console.log lines.
  console.log('[simplate] tryPickFulfillment — looking for:', keyword);
  console.log('[simplate] fulfillment candidates:', candidates.map(el => ({
    tag: el.tagName,
    role: el.getAttribute('role'),
    automationId: el.getAttribute('data-automation-id'),
    ariaLabel: el.getAttribute('aria-label'),
    text: el.textContent.trim().slice(0, 80),
    visible: isVisible(el),
  })));

  for (const el of candidates) {
    // Check textContent of the element itself
    const text = el.textContent.trim().toLowerCase();
    // Also check aria-label (some Walmart buttons label via aria instead of text)
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    // Also check data-automation-id
    const automationId = (el.getAttribute('data-automation-id') || '').toLowerCase();

    const matches =
      (text.includes(keyword) || ariaLabel.includes(keyword) || automationId.includes(keyword)) &&
      !el.disabled &&
      isVisible(el);

    if (matches) {
      console.log('[simplate] clicking fulfillment element:', el);
      el.click();
      return true;
    }
  }

  console.log('[simplate] no fulfillment match found for:', keyword);
  return false;
}

function pollAndClick(maxWaitMs = 12000, intervalMs = 400) {
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