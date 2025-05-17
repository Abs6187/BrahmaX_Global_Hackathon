let documentText;
let currentUrl;
let isPinned = false;

document.addEventListener('DOMContentLoaded', function () {
    // Initialize popup controls
    setupPopupControls();
    
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'popupOpened' });
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Process the webpage content to improve context
        documentText = processPageContent(message.message);
        currentUrl = message.url || 'Unknown URL';
        initializeConversation(documentText, currentUrl);
    });

    $(document).on('keypress', function (e) {
        if (e.which == 13) {
            let message = $("#questionInput").val();
            $("#questionInput").val("");
            message = message.replaceAll("<", "&lt;");
            if (message == "") {
                console.log("user attempted to send invalid");
            } else {
                sendUserMessage(message);
                document.getElementById("questionInput").disabled = true;
                askQuestion(message);
                document.getElementById("questionInput").disabled = false;
            }
        }
    });
});

function setupPopupControls() {
    // Pin button functionality
    const pinBtn = document.getElementById('pinBtn');
    pinBtn.addEventListener('click', () => {
        isPinned = !isPinned;
        pinBtn.classList.toggle('active');
        chrome.runtime.sendMessage({ action: 'setPinned', value: isPinned });
    });

    // Minimize button functionality
    const minimizeBtn = document.getElementById('minimizeBtn');
    minimizeBtn.addEventListener('click', () => {
        document.body.classList.toggle('minimized');
        minimizeBtn.querySelector('.material-icons').textContent = 
            document.body.classList.contains('minimized') ? 'expand_less' : 'remove';
    });

    // Close button functionality
    const closeBtn = document.getElementById('closeBtn');
    closeBtn.addEventListener('click', () => {
        if (isPinned) {
            // If pinned, just minimize
            document.body.classList.add('minimized');
            minimizeBtn.querySelector('.material-icons').textContent = 'expand_less';
        } else {
            // If not pinned, close normally
            window.close();
        }
    });

    // Prevent closing when clicking inside popup
    document.body.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function processPageContent(content) {
    if (!content) return "";
    
    // Remove extra whitespace and normalize
    content = content.replace(/\s+/g, ' ').trim();
    
    // Truncate if too long while preserving important parts
    const maxLength = 4000;
    if (content.length > maxLength) {
        // Keep the first and last parts of the content
        const firstPart = content.substring(0, maxLength / 2);
        const lastPart = content.substring(content.length - maxLength / 2);
        content = `${firstPart}\n...[Content truncated]...\n${lastPart}`;
    }
    
    return content;
}

async function initializeConversation(article, url) {
    try {
        const response = await fetch(`http://127.0.0.1:5000/init?article=${encodeURIComponent(article)}&url=${encodeURIComponent(url)}`);
        const data = await response.json();
        console.log(data.message);
        if(data.message === "error") {
            sendModelMessage("The article provided is too long for me to process!");
        } else {
            sendModelMessage(`📄 Analyzing content from: ${url}`);
        }
    } catch (error) {
        console.error('Error initializing conversation:', error);
        sendModelMessage("Error connecting to the server. Please make sure the server is running.");
    }
}

async function askQuestion(question) {
    try {
        const response = await fetch(`http://127.0.0.1:5000/reply?question=${encodeURIComponent(question)}`);
        const data = await response.json();
        sendModelMessage(data.response);
    } catch (error) {
        console.error('Error asking question:', error);
        sendModelMessage("Error connecting to the server. Please make sure the server is running.");
    }
}

function sendUserMessage(message) {
    $("#messageContainer").append(`<div class="userMessage">${message}</div><br><br>`);
    scrollToBottom();
}

function sendModelMessage(message) {
    $("#messageContainer").append(`<div class="modelMessage">${message}</div><br>`);
    scrollToBottom();
}

function scrollToBottom() {
    var container = document.getElementById('messageContainer');
    container.scrollTop = container.scrollHeight;
}
