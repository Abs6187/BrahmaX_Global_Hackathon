
function getVisibleText() {
  return document.body.innerText.trim().slice(0, 10000); // limit size
}

chrome.runtime.sendMessage({
  type: "PAGE_TEXT",
  text: getVisibleText()
});
