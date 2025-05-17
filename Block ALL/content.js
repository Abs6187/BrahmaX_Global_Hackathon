// Content script for BlockAll extension
// This script will create and manage the iframe container for allowed websites

let frameContainer = null;
let isFrameOpen = false;
let pendingUrl = null;
let contentAnalysisPending = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openUrlInFrame') {
    // Open URL in frame
    openUrlInFrame(message.url);
    sendResponse({ success: true });
  } else if (message.action === 'closeFrame') {
    // Close the frame
    closeFrame();
    sendResponse({ success: true });
  } else if (message.action === 'checkFrameStatus') {
    // Return current frame status
    sendResponse({ isOpen: isFrameOpen });
  }
  return true;
});

// Listen for messages from the frame
window.addEventListener('message', (event) => {
  // Make sure the message is from our frame
  if (event.data && event.data.from === 'blockall-frame') {
    if (event.data.action === 'closeFrame') {
      closeFrame();
    } else if (event.data.action === 'analyzeComplete') {
      if (!event.data.isEducational) {
        // If content is not educational, close the frame after a short delay
        setTimeout(() => {
          closeFrame();
        }, 500);
      } else {
        contentAnalysisPending = false;
      }
    }
  }
});

// Function to open a URL in the iframe
function openUrlInFrame(url) {
  // If frame doesn't exist, create it
  if (!frameContainer) {
    createFrameContainer();
  }
  
  // If the frame is already open, update the URL
  if (isFrameOpen) {
    const frame = document.getElementById('blockall-frame');
    // Use our custom frame.html which will handle educational content checking
    frame.src = chrome.runtime.getURL('frame.html') + '?url=' + encodeURIComponent(url);
  } else {
    // Otherwise, show the frame and set the URL
    showFrame(url);
  }
  
  // Set the URL display
  document.getElementById('blockall-url-display').innerText = new URL(url).hostname;
  
  // Mark that we're waiting for content analysis
  contentAnalysisPending = true;
}

// Create the frame container
function createFrameContainer() {
  // Create container div
  frameContainer = document.createElement('div');
  frameContainer.id = 'blockall-frame-container';
  frameContainer.classList.add('blockall-hidden');
  
  // Create header
  const header = document.createElement('div');
  header.id = 'blockall-frame-header';
  
  // Educational content badge
  const badge = document.createElement('div');
  badge.id = 'blockall-educational-badge';
  badge.innerHTML = '<span>Educational Content</span>';
  header.appendChild(badge);
  
  // URL display
  const urlDisplay = document.createElement('div');
  urlDisplay.id = 'blockall-url-display';
  header.appendChild(urlDisplay);
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.id = 'blockall-close-frame';
  closeButton.innerHTML = '&times;';
  closeButton.title = 'Close';
  closeButton.addEventListener('click', closeFrame);
  header.appendChild(closeButton);
  
  // Add header to container
  frameContainer.appendChild(header);
  
  // Create iframe
  const frame = document.createElement('iframe');
  frame.id = 'blockall-frame';
  frame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');
  frame.setAttribute('allow', 'autoplay; camera; microphone; fullscreen');
  
  // Add iframe to container
  frameContainer.appendChild(frame);
  
  // Add container to page
  document.body.appendChild(frameContainer);
  
  // Add drag functionality to the header
  makeDraggable(frameContainer, header);
  
  // Add resize functionality
  makeResizable(frameContainer);
}

// Show the frame
function showFrame(url) {
  if (!frameContainer) {
    createFrameContainer();
  }
  
  // Set the frame URL using our custom frame.html which handles content analysis
  const frame = document.getElementById('blockall-frame');
  frame.src = chrome.runtime.getURL('frame.html') + '?url=' + encodeURIComponent(url);
  
  // Show the frame
  frameContainer.classList.remove('blockall-hidden');
  isFrameOpen = true;
  
  // Notify background script that frame is open
  chrome.runtime.sendMessage({ action: 'frameOpened', url });
}

// Close the frame
function closeFrame() {
  if (frameContainer) {
    // Hide the frame
    frameContainer.classList.add('blockall-hidden');
    
    // Reset the iframe source
    const frame = document.getElementById('blockall-frame');
    frame.src = 'about:blank';
    
    isFrameOpen = false;
    
    // Notify background script that frame is closed
    chrome.runtime.sendMessage({ action: 'frameClosed' });
  }
}

// Make an element draggable
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Make an element resizable
function makeResizable(element) {
  const resizer = document.createElement('div');
  resizer.className = 'blockall-resizer';
  element.appendChild(resizer);
  
  resizer.addEventListener('mousedown', initResize, false);
  
  function initResize(e) {
    e.preventDefault();
    window.addEventListener('mousemove', resize, false);
    window.addEventListener('mouseup', stopResize, false);
  }
  
  function resize(e) {
    e.preventDefault();
    // Set new size
    element.style.width = (e.clientX - element.getBoundingClientRect().left) + 'px';
    element.style.height = (e.clientY - element.getBoundingClientRect().top) + 'px';
  }
  
  function stopResize() {
    window.removeEventListener('mousemove', resize, false);
    window.removeEventListener('mouseup', stopResize, false);
  }
}