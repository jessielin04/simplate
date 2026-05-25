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

  // Open a dedicated minimized window for ATC. The tab is "active" within
  // that window (so Walmart runs JS at full speed) but the window is minimized
  // so the user never gets pulled away from what they were doing.
  // We close the window when the loop finishes and open the cart instead.
  const atcWindow = await chrome.windows.create({
    url: urls[0],
    type: 'normal',
    state: 'minimized',
  });
  const tab = atcWindow.tabs[0];

  for (let i = 0; i < urls.length; i++) {
    if (i > 0) {
      await chrome.tabs.update(tab.id, { url: urls[i] });
    }

    await waitForTabLoad(tab.id);

    // Wait for Walmart's React app to hydrate and render the ATC button.
    await sleep(3500);

    // Make sure the content script is actually ready before messaging.
    await waitForContentScript(tab.id);

    const success = await sendATCMessage(tab.id, fulfillment);
    if (success) {
      added++;
      await sleep(3000);
    } else {
      await sleep(1500);
    }
  }

  try { await chrome.windows.remove(atcWindow.id); } catch (_) {}
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

async function sendATCMessage(tabId, fulfillment) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'simplate_atc', fulfillment });
    return response?.success === true;
  } catch (e) {
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