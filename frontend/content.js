// Injected into walmart.com pages by the extension.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'simplate_ping') {
    sendResponse({ ready: true });
    return true;
  }

  if (msg.type !== 'simplate_atc') return;

  const fulfillment = msg.fulfillment || 'delivery';
  const wantQty = Math.max(1, Math.min(parseInt(msg.quantity) || 1, 20));

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
        // First add succeeded (1 unit in cart). Bump the native on-page
        // quantity stepper up to the requested count.
        let units = 1;
        if (wantQty > 1) {
          units = await increaseQuantityTo(wantQty);
        }
        sendResponse({ success: true, units });
      } else {
        // Check again after timeout — might have rendered an OOS / 404 message
        const reason = getUnavailableReason() || 'Button not found — item may be unavailable';
        sendResponse({ success: false, reason });
      }
    })
    .catch(() => sendResponse({ success: false, reason: 'Unexpected error' }));

  return true;
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// After the item is in the cart, Walmart shows a "− <n> added +" stepper in
// the buy box. Click its "+" until we reach wantQty. Returns units reached.
async function increaseQuantityTo(wantQty) {
  let current = readQuantityValue();
  let units = current || 1;
  let safety = wantQty + 4; // guard against runaway loops
  while (units < wantQty && safety-- > 0) {
    const incBtn = findQuantityIncrementButton();
    if (!incBtn) break; // stepper not present (e.g. by-weight item) — stop
    incBtn.click();
    await sleep(1200);
    const next = readQuantityValue();
    if (next && next > units) {
      units = next;
    } else {
      // Value didn't change — assume one increment still landed, but don't spin.
      units = Math.min(units + 1, wantQty);
    }
  }
  return units;
}

// Read the current quantity shown in the buy-box stepper, if any.
function readQuantityValue() {
  const scope = mainProductScope() || document;
  // Common patterns: an input[type=number], or text like "3 added" / "Qty 3".
  const input = scope.querySelector('input[type="number"], input[aria-label*="quantity" i]');
  if (input && input.value && !isNaN(parseInt(input.value))) return parseInt(input.value);

  const labelEl = [...scope.querySelectorAll('[data-automation-id*="quantity" i], [aria-label*="quantity" i], button, span, div')]
    .find(el => /\b(\d+)\s*(added|in cart)\b/i.test(el.textContent || ''));
  if (labelEl) {
    const m = (labelEl.textContent || '').match(/\b(\d+)\s*(added|in cart)\b/i);
    if (m) return parseInt(m[1]);
  }
  return null;
}

// Find the "+" increment control of the buy-box quantity stepper.
function findQuantityIncrementButton() {
  const scope = mainProductScope() || document;
  const candidates = [
    '[data-automation-id="increment-quantity"]',
    'button[aria-label*="Increase quantity" i]',
    'button[aria-label*="increase" i]',
    'button[aria-label*="add one" i]',
    'button[data-testid*="increment" i]',
  ];
  for (const sel of candidates) {
    const btn = scope.querySelector(sel);
    if (btn && !btn.disabled && isVisible(btn) && !isInDisallowedRegion(btn)) return btn;
  }
  // Fallback: a small "+" button inside the buy box that isn't the ATC button.
  const plus = [...scope.querySelectorAll('button, [role="button"]')].find(b =>
    !b.disabled && isVisible(b) && !isInDisallowedRegion(b) &&
    (b.textContent.trim() === '+' || (b.getAttribute('aria-label') || '').toLowerCase().includes('increase'))
  );
  return plus || null;
}

// Detect common Walmart unavailability states before wasting time polling.
function getUnavailableReason() {
  const bodyText = document.body.innerText;

  // 404 / dead product page (e.g. a stale or bad /ip/ link). The page title
  // and an h1 read "We couldn't find this page".
  const notFoundSignals = [
    "we couldn't find this page",
    'we couldn’t find this page',
    'page not found',
  ];
  const heading = (document.querySelector('h1')?.textContent || '').toLowerCase();
  const title = (document.title || '').toLowerCase();
  for (const sig of notFoundSignals) {
    if (heading.includes(sig) || title.includes(sig) || bodyText.toLowerCase().includes(sig)) {
      return 'Product page not found';
    }
  }

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

// Containers that indicate a button belongs to the MAIN product, not a
// recommendation tile. We positively scope to these when possible.
function mainProductScope() {
  const scopeSelectors = [
    '[data-testid="add-to-cart-section"]',
    '[data-testid="buy-box"]',
    '[data-testid="buybox"]',
    '#buybox',
    '[data-testid="fulfillment-add-to-cart-section"]',
    '[data-testid="pdp-buy-box"]',
    'section[aria-label*="buy" i]',
  ];
  for (const sel of scopeSelectors) {
    const scope = document.querySelector(sel);
    if (scope) return scope;
  }
  return null;
}

// Reject buttons that live inside any recommendation / carousel / add-on /
// list context. Uses a broad positive set of "this is NOT the main product"
// signals rather than a small blocklist (Walmart renames testids often).
function isInDisallowedRegion(el) {
  const bad = [
    'carousel', 'similar', 'recommend', 'sponsored', 'frequently',
    'buy-it-again', 'buyitagain', 'add-on', 'addon', 'related', 'also-bought',
    'also-viewed', 'compare', 'tile', 'product-grid', 'search-result',
    'item-stack', 'cross-sell', 'crosssell', 'upsell', 'you-might',
  ];
  // Walk up the ancestor chain checking testid / automation-id / class hints.
  let node = el;
  while (node && node !== document.body) {
    const testid = (node.getAttribute && (node.getAttribute('data-testid') || '')).toLowerCase();
    const autoid = (node.getAttribute && (node.getAttribute('data-automation-id') || '')).toLowerCase();
    const cls = (node.className && typeof node.className === 'string' ? node.className : '').toLowerCase();
    const hay = `${testid} ${autoid} ${cls}`;
    if (bad.some(b => hay.includes(b))) return true;
    node = node.parentElement;
  }
  return false;
}

function findATCButton() {
  // 1) Primary, specific selectors — but each must NOT be inside a reco region.
  const selectors = [
    '[data-automation-id="add-to-cart-btn"]',
    '[data-tl-id="ProductPrimaryCTA-cta_add_to_cart_button"]',
    'button[data-testid="add-to-cart-btn"]',
    'button.prod-ProductCTA--primary',
    '[data-automation="add-to-cart"]',
  ];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn && !btn.disabled && isVisible(btn) && !isInDisallowedRegion(btn)) return btn;
  }

  // 2) Scope to the main buy box and take the ATC button inside it.
  const scope = mainProductScope();
  if (scope) {
    const scoped = [...scope.querySelectorAll('button, [role="button"]')].find(b =>
      !b.disabled && isVisible(b) &&
      (b.textContent.trim().toLowerCase() === 'add to cart' ||
       (b.getAttribute('aria-label') || '').toLowerCase().includes('add to cart'))
    );
    if (scoped && !isInDisallowedRegion(scoped)) return scoped;
  }

  // 3) Last-resort fallback: among all exact "Add to cart" buttons that are NOT
  // in a reco region, choose the one highest on the page (smallest top offset).
  // The main product CTA sits in the hero, above any "frequently bought" rows.
  const candidates = [...document.querySelectorAll('button, [role="button"]')]
    .filter(b =>
      !b.disabled && isVisible(b) &&
      b.textContent.trim().toLowerCase() === 'add to cart' &&
      !isInDisallowedRegion(b)
    )
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

  return candidates[0] || null;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
}