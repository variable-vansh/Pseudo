// Pseudo — Background Service Worker (Manifest V3)

// Handle toolbar icon click → inject content script + toggle panel
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || tab.url?.startsWith('chrome://')) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (e) {
    // Content script may already be injected, or page blocks injection
  }

  // Brief delay to ensure content script is ready before messaging
  setTimeout(() => {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' }).catch(() => {});
  }, 100);
});

// Relay messages from panel iframe
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'open-keys') {
    chrome.tabs.create({ url: chrome.runtime.getURL('keys.html') });
    sendResponse({ ok: true });
  }
  return true;
});
