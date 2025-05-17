
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PAGE_TEXT") {
    chrome.storage.local.set({ pageText: message.text });
  }
});
