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

  // Use active:true so Walmart doesn't throttle JS — same as before.
  // The only change from the working version: we open in a NEW WINDOW
  // so the user's current window keeps focus. The ATC window is minimized
  // so it runs off-screen but stays active within its own window context.
  let atcWindow;
  try {
    atcWindow = await chrome.windows.create({ url: urls[0], type: 'normal', state: 'minimized' });
  } catch (e) {
    console.error('[simplate] could not create ATC window:', e);
    return 0;
  }
  const tab = atcWindow.tabs[0];

  for (let i = 0; i < urls.length; i++) {
    if (i > 0) {
      await chrome.tabs.update(tab.id, { url: urls[i] });
    }

    await waitForTabLoad(tab.id);

    // Same timing as the working version
    await sleep(3500);

    await waitForContentScript(tab.id);

    const success = await sendATCMessage(tab.id, fulfillment);
    if (success) {
      added++;
      await sleep(3000);
    } else {
      await sleep(1500);
    }
  }

  // Extra buffer so the last cart mutation commits before closing
  await sleep(1500);

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