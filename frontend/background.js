// Opens side panel on icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ── ATC orchestration ────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'simplate_start_atc') return;

  const { urls, fulfillment = 'delivery' } = msg;
  if (!urls || urls.length === 0) {
    sendResponse({ done: true, added: 0 });
    return true;
  }

  addItemsSequentially(urls, fulfillment).then(added => {
    chrome.tabs.create({ url: 'https://www.walmart.com/cart' });
    sendResponse({ done: true, added });
  });

  return true;
});

async function addItemsSequentially(urls, fulfillment) {
  let added = 0;

  // Keep tab active so Walmart doesn't throttle JS execution in the background.
  // This is the most common reason ATC silently fails — hidden tabs defer rendering.
  const tab = await chrome.tabs.create({ url: urls[0], active: true });

  for (let i = 0; i < urls.length; i++) {
    if (i > 0) {
      await chrome.tabs.update(tab.id, { url: urls[i] });
    }

    await waitForTabLoad(tab.id);

    // Wait for Walmart's React app to hydrate and render the ATC button.
    // 3.5s is more reliable than 2.5s, especially on first product load.
    await sleep(3500);

    // Make sure the content script is actually ready before messaging.
    await waitForContentScript(tab.id);

    const success = await sendATCMessage(tab.id, fulfillment);
    if (success) {
      added++;
      // Give the fulfillment modal time to appear and be dismissed before moving on.
      await sleep(3000);
    } else {
      await sleep(1500);
    }
  }

  try { await chrome.tabs.remove(tab.id); } catch (_) {}
  return added;
}

// Ping the content script until it responds, with a timeout.
function waitForContentScript(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    function attempt() {
      chrome.tabs.sendMessage(tabId, { type: 'simplate_ping' }, (response) => {
        if (chrome.runtime.lastError) {
          if (Date.now() - start < timeoutMs) {
            setTimeout(attempt, 400);
          } else {
            resolve(false); // timed out, proceed anyway
          }
        } else {
          resolve(true);
        }
      });
    }
    attempt();
  });
}

async function sendATCMessage(tabId, fulfillment) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'simplate_atc', fulfillment });
    return response?.success === true;
  } catch (e) {
    // One retry after a short delay
    await sleep(1500);
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'simplate_atc', fulfillment });
      return response?.success === true;
    } catch (_) {
      return false;
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