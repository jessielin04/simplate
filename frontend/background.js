// Opens side panel on icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ── ATC orchestration ────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'simplate_start_atc') return;

  const { urls } = msg;
  if (!urls || urls.length === 0) {
    sendResponse({ done: true, added: 0 });
    return true;
  }

  addItemsSequentially(urls).then(added => {
    chrome.tabs.create({ url: 'https://www.walmart.com/cart' });
    sendResponse({ done: true, added });
  });

  return true;
});

async function addItemsSequentially(urls) {
  let added = 0;
  const tab = await chrome.tabs.create({ url: urls[0], active: false });

  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await chrome.tabs.update(tab.id, { url: urls[i] });
    await waitForTabLoad(tab.id);
    await sleep(500);

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'simplate_atc' });
      if (response?.success) added++;
    } catch (e) {
      await sleep(1000);
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'simplate_atc' });
        if (response?.success) added++;
      } catch (_) {}
    }
    await sleep(500);
  }

  try { await chrome.tabs.remove(tab.id); } catch (_) {}
  return added;
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