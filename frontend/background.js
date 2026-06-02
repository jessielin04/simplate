//Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});
//ACT Process: is msg a cart request? 
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'simplate_start_atc') return;
  // New payload: items = [{ url, name, quantity }]. Fall back to legacy fields.
  let items = Array.isArray(msg.items) ? msg.items : null;
  if (!items) {
    const { urls = [], itemNames = [], quantity = 1 } = msg;
    items = urls.map((url, i) => ({ url, name: itemNames[i] || url, quantity }));
  }
  const fulfillment = msg.fulfillment || 'delivery';
  if (items.length === 0) {
    sendResponse({ done: true, added: 0, failed: [] });
    return true;
  }
  //cart process, open cart tab when done 
  addItemsSequentially(items, fulfillment).then(({ added, failed }) => {
    openOrReloadCart();
    sendResponse({ done: true, added, failed });
  });

  return true;
});
//products are added one at a time (Walmart's cart handles one product reliably)
async function addItemsSequentially(items, fulfillment) {
  let added = 0;          // total units successfully added across all products
  const failed = []; // { name, reason }
  //opens real browser window minimized bcs Walmart throttles JS in hidden/inactive tabs
  let atcWindow;
  try {
    atcWindow = await chrome.windows.create({ url: items[0].url, type: 'normal', state: 'minimized' });
  } catch (e) {
    console.error('[simplate] could not create ATC window:', e);
    return { added: 0, failed: items.map(it => ({ name: it.name, reason: 'Could not open window' })) };
  }
  const tab = atcWindow.tabs[0];
  let firstLoad = true;
  //for each product: navigate once, add to cart once, then ask content.js to
  //bump Walmart's native on-page quantity stepper up to the requested count.
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const wantQty = Math.max(1, Math.min(parseInt(it.quantity) || 1, 20));

    if (!firstLoad) {
      await chrome.tabs.update(tab.id, { url: it.url });
    }
    firstLoad = false;

    await waitForTabLoad(tab.id);
    await sleep(3500);
    await waitForContentScript(tab.id);

    const result = await sendATCMessage(tab.id, fulfillment, wantQty);
    if (result.success) {
      // content.js reports how many units it actually reached (1..wantQty).
      const units = result.units || 1;
      added += units;
      await sleep(2500);
    } else {
      failed.push({ name: it.name, reason: result.reason || 'Unknown error' });
      await sleep(1500);
    }
  }

  await sleep(1500);
  try { await chrome.windows.remove(atcWindow.id); } catch (_) {}
  return { added, failed };
}

function waitForContentScript(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    function attempt() {
      chrome.tabs.sendMessage(tabId, { type: 'simplate_ping' }, (response) => {
        if (chrome.runtime.lastError) {
          if (Date.now() - start < timeoutMs) {
            setTimeout(attempt, 400);
          } else {
            resolve(false);
          }
        } else {
          resolve(true);
        }
      });
    }
    attempt();
  });
}

// Returns { success, reason, units }
async function sendATCMessage(tabId, fulfillment, quantity = 1) {
  const payload = { type: 'simplate_atc', fulfillment, quantity };
  try {
    const response = await chrome.tabs.sendMessage(tabId, payload);
    return response || { success: false, reason: 'No response' };
  } catch (e) {
    await sleep(1500);
    try {
      const response = await chrome.tabs.sendMessage(tabId, payload);
      return response || { success: false, reason: 'No response' };
    } catch (_) {
      return { success: false, reason: 'Could not reach content script' };
    }
  }
}

function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    chrome.tabs.get(tabId, (tab) => {
      if (tab?.status === 'complete') return resolve();
      function listener(id, info) {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Find an existing Walmart cart tab and reload it, or open a new one.
async function openOrReloadCart() {
  const cartUrl = 'https://www.walmart.com/cart';
  const tabs = await chrome.tabs.query({ url: 'https://www.walmart.com/cart*' });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true, url: cartUrl });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: cartUrl });
  }
}