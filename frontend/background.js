//Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});
//ACT Process: is msg a cart request? 
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'simplate_start_atc') return;
  //walmart product URLs to add 
  const { urls, fulfillment = 'delivery', itemNames = [] } = msg;
  if (!urls || urls.length === 0) {
    sendResponse({ done: true, added: 0, failed: [] });
    return true;
  }
  //cart process, open cart tab when done 
  addItemsSequentially(urls, itemNames, fulfillment).then(({ added, failed }) => {
    openOrReloadCart();
    sendResponse({ done: true, added, failed });
  });

  return true;
});
//products are added one aat a time (due to Walmart's cart only being able to handle one product at a time reliably)
async function addItemsSequentially(urls, itemNames, fulfillment) {
  let added = 0;
  const failed = []; // { name, reason }
  //opens real brower window minimized bcs Walmart throttles JS in hidden/inactive tabs
  let atcWindow;
  try {
    atcWindow = await chrome.windows.create({ url: urls[0], type: 'normal', state: 'minimized' });
  } catch (e) {
    console.error('[simplate] could not create ATC window:', e);
    return { added: 0, failed: itemNames.map(n => ({ name: n, reason: 'Could not open window' })) };
  }
  const tab = atcWindow.tabs[0];
  //for each product: nav window to product URL, wait to fully load, wait extra for Walmart to render ): confirm content.js is ready, then add to cart
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) {
      await chrome.tabs.update(tab.id, { url: urls[i] });
    }

    await waitForTabLoad(tab.id);
    await sleep(3500);
    await waitForContentScript(tab.id);

    const result = await sendATCMessage(tab.id, fulfillment);
    if (result.success) {
      added++;
      await sleep(3000);
    } else {
      failed.push({ name: itemNames[i] || urls[i], reason: result.reason || 'Unknown error' });
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

// Returns { success, reason } instead of just boolean
async function sendATCMessage(tabId, fulfillment) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'simplate_atc', fulfillment });
    return response || { success: false, reason: 'No response' };
  } catch (e) {
    await sleep(1500);
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'simplate_atc', fulfillment });
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