// Global variables
let isBlocking = false;
let allowedUrl = "";
let pomodoroState = "idle"; // idle, working, break
let workDuration = 25; // default 25 minutes
let breakDuration = 5; // default 5 minutes
let timerEndTime = 0;
let remainingTime = 0;
let enableEducationalCheck = true; // Enable educational content checking by default
let educationalCache = {}; // Cache for analyzed URLs

// Initialize default settings if not already set
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['workDuration', 'breakDuration', 'enableEducationalCheck'], (result) => {
    if (!result.workDuration) {
      chrome.storage.local.set({ workDuration: 25 });
    }
    if (!result.breakDuration) {
      chrome.storage.local.set({ breakDuration: 5 });
    }
    if (result.enableEducationalCheck === undefined) {
      chrome.storage.local.set({ enableEducationalCheck: true });
    }
  });
});

// Load saved settings
chrome.storage.local.get(['workDuration', 'breakDuration', 'enableEducationalCheck'], (result) => {
  if (result.workDuration) workDuration = result.workDuration;
  if (result.breakDuration) breakDuration = result.breakDuration;
  if (result.enableEducationalCheck !== undefined) enableEducationalCheck = result.enableEducationalCheck;
});

// Listen for changes in settings
chrome.storage.onChanged.addListener((changes) => {
  if (changes.workDuration) {
    workDuration = changes.workDuration.newValue;
  }
  if (changes.breakDuration) {
    breakDuration = changes.breakDuration.newValue;
  }
  if (changes.enableEducationalCheck) {
    enableEducationalCheck = changes.enableEducationalCheck.newValue;
  }
});

// Block website function
async function updateBlockingState(enabled) {
  isBlocking = enabled;
  
  if (isBlocking) {
    // Get the current active tab's URL
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const url = new URL(tabs[0].url);
      allowedUrl = url.hostname;
      
      // Update badge to indicate blocking is active
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    }
  } else {
    // Clear the allowed URL when disabling
    allowedUrl = "";
    
    // Update badge to indicate blocking is inactive
    chrome.action.setBadgeText({ text: "" });
  }
  
  // Broadcast state to all components
  broadcastState();
}

// Check if a URL should be blocked
function shouldBlockUrl(url) {
  if (!isBlocking) return false;
  
  try {
    // Parse the URL
    const parsedUrl = new URL(url);
    
    // Special cases - allow extension pages and Chrome internal pages
    if (parsedUrl.protocol === "chrome-extension:" || 
        parsedUrl.protocol === "chrome:") {
      return false;
    }
    
    // Block if not matching the allowed hostname
    return parsedUrl.hostname !== allowedUrl;
  } catch (e) {
    // If URL parsing fails, default to not blocking
    console.error("Error parsing URL:", e);
    return false;
  }
}

// Block navigation to other sites
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  // Ignore frame navigations (we'll handle those separately)
  if (details.frameId !== 0) return;
  
  if (shouldBlockUrl(details.url)) {
    // If educational content checking is enabled and we're in working mode
    if (enableEducationalCheck && pomodoroState === "working") {
      // Instead of blocking completely, check if it's educational content
      handlePotentialEducationalUrl(details.tabId, details.url);
    } else {
      // Traditional blocking behavior
      chrome.tabs.update(details.tabId, { url: "chrome://newtab" });
      
      // Send notification
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.svg",
        title: "BlockAll Extension",
        message: `Navigation to ${new URL(details.url).hostname} was blocked. Stay focused!`,
        priority: 2
      });
    }
  }
});

// Handle potential educational URLs
function handlePotentialEducationalUrl(tabId, url) {
  try {
    // Get the hostname
    const hostname = new URL(url).hostname;
    
    // Send a message to the content script to open the URL in a frame
    chrome.tabs.sendMessage(tabId, {
      action: 'openUrlInFrame',
      url: url
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script might not be loaded yet, inject it
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).then(() => {
          // Try sending the message again after script is injected
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              action: 'openUrlInFrame',
              url: url
            });
          }, 100);
        }).catch(error => {
          console.error('Error injecting content script:', error);
        });
      }
    });
    
    // Cancel the navigation in the main window
    chrome.tabs.update(tabId, { url: "about:blank" });
  } catch (error) {
    console.error('Error handling educational URL:', error);
    // Fall back to standard blocking
    chrome.tabs.update(tabId, { url: "chrome://newtab" });
  }
}

// Pomodoro timer functions
function startPomodoro() {
  pomodoroState = "working";
  const workDurationMs = workDuration * 60 * 1000;
  timerEndTime = Date.now() + workDurationMs;
  remainingTime = workDurationMs;
  
  // Create an alarm to notify when work period ends
  chrome.alarms.clear("pomodoroTimer");
  chrome.alarms.create("pomodoroTimer", { delayInMinutes: workDuration });
  
  // Update UI
  broadcastState();
  
  // Start blocking websites
  updateBlockingState(true);
}

function startBreak() {
  pomodoroState = "break";
  const breakDurationMs = breakDuration * 60 * 1000;
  timerEndTime = Date.now() + breakDurationMs;
  remainingTime = breakDurationMs;
  
  // Create an alarm to notify when break ends
  chrome.alarms.clear("pomodoroTimer");
  chrome.alarms.create("pomodoroTimer", { delayInMinutes: breakDuration });
  
  // Update UI
  broadcastState();
  
  // Show meme page
  chrome.tabs.create({ url: "meme.html" });
  
  // Keep blocking active during break
  updateBlockingState(true);
}

function stopPomodoro() {
  pomodoroState = "idle";
  timerEndTime = 0;
  remainingTime = 0;
  
  // Clear any existing alarms
  chrome.alarms.clear("pomodoroTimer");
  
  // Stop blocking
  updateBlockingState(false);
  
  // Update UI
  broadcastState();
}

// Handle alarm trigger
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pomodoroTimer") {
    if (pomodoroState === "working") {
      // Work period is over, start break
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.svg",
        title: "Time for a break!",
        message: `You've completed ${workDuration} minutes of focused work. Take a ${breakDuration} minute break.`,
        priority: 2
      });
      
      startBreak();
    } else if (pomodoroState === "break") {
      // Break is over, start another work period
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.svg",
        title: "Break is over!",
        message: `Time to get back to work for ${workDuration} minutes.`,
        priority: 2
      });
      
      startPomodoro();
    }
  }
});

// Prevent opening new tabs when blocking is active
chrome.tabs.onCreated.addListener(async (tab) => {
  if (isBlocking && pomodoroState !== "break") {
    // Only allow new tabs if they're from the allowed domain or if they're the extension itself
    if (tab.pendingUrl && shouldBlockUrl(tab.pendingUrl)) {
      await chrome.tabs.remove(tab.id);
      
      // Notification
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.svg",
        title: "BlockAll Extension",
        message: "Opening new tabs is not allowed during focus time.",
        priority: 2
      });
    }
  }
});

// Function to broadcast the current state to all components
function broadcastState() {
  const state = {
    isBlocking,
    allowedUrl,
    pomodoroState,
    workDuration,
    breakDuration,
    timerEndTime,
    remainingTime: remainingTime > 0 ? remainingTime : Math.max(0, timerEndTime - Date.now())
  };
  
  chrome.runtime.sendMessage({ action: "stateUpdate", state });
}

// Update timer info every second if timer is active
setInterval(() => {
  if (pomodoroState !== "idle" && timerEndTime > 0) {
    remainingTime = Math.max(0, timerEndTime - Date.now());
    broadcastState();
  }
}, 1000);

// Get Groq API key 
async function getGroqApiKey() {
  // Chrome extensions can't access environment variables directly
  // So we'll use a placeholder that will be replaced with the actual API key
  // This will come from chrome.storage after user inputs it in settings
  return chrome.runtime.getURL('groq_api.txt')
    .then(url => fetch(url))
    .then(response => response.text())
    .then(key => key.trim())
    .catch(error => {
      console.error('Error getting Groq API key:', error);
      return null;
    });
}

// Analyze content using Groq API to determine if it's educational
async function analyzeContentWithGroq(content, url) {
  try {
    // Check cache first
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // If we have a cached result for this hostname, use it
    if (educationalCache[hostname]) {
      return educationalCache[hostname];
    }
    
    // Sanitize the content (limit length to avoid too large requests)
    const sanitizedContent = content.substring(0, 2000);
    
    // Prepare the prompt for Groq
    const prompt = `
      Your task is to determine if the following content is educational or not.
      
      URL: ${url}
      
      Content sample: ${sanitizedContent}
      
      Rules for classification:
      1. Educational content includes tutorials, courses, documentation, academic articles, informative videos, and learning resources.
      2. Non-educational content includes entertainment, social media, games, shopping, and content meant primarily for leisure.
      3. For YouTube, if the content is a tutorial, educational lecture, or educational documentary, classify as educational.
      4. For YouTube, if the content is a music video, entertainment show, or non-educational content, classify as non-educational.
      5. When analyzing, consider the domain name, page title, and content context.
      
      Respond with a JSON object with the following keys:
      - "isEducational": boolean
      - "confidence": number between 0 and 1
      - "reason": brief explanation of your decision
    `;
    
    // Get Groq API key from Chrome storage
    const apiKeyData = await new Promise(resolve => {
      chrome.storage.local.get(['groqApiKey'], result => {
        resolve(result);
      });
    });
    
    // Use the stored API key or check if it's available in environment
    const groqApiKey = apiKeyData.groqApiKey || await getGroqApiKey();
    
    if (!groqApiKey) {
      throw new Error('Groq API key not found. Please add it in the settings.');
    }
    
    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-chat',  // Using Llama model as it's efficient for this task
        messages: [
          { role: 'system', content: 'You are an AI assistant that helps determine if content is educational or not.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1 // Low temperature for more consistent classifications
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const analysisResult = JSON.parse(data.choices[0].message.content);
    
    // Cache the result for this hostname
    educationalCache[hostname] = analysisResult;
    
    return analysisResult;
  } catch (error) {
    console.error('Error analyzing content with Groq:', error);
    // Default to allowing content if there's an error
    return { isEducational: true, confidence: 0, reason: 'Error in analysis, allowing by default' };
  }
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleBlocking") {
    updateBlockingState(!isBlocking);
    sendResponse({ success: true });
  } else if (request.action === "startPomodoro") {
    startPomodoro();
    sendResponse({ success: true });
  } else if (request.action === "stopPomodoro") {
    stopPomodoro();
    sendResponse({ success: true });
  } else if (request.action === "getState") {
    const state = {
      isBlocking,
      allowedUrl,
      pomodoroState,
      workDuration,
      breakDuration,
      timerEndTime,
      remainingTime: remainingTime > 0 ? remainingTime : Math.max(0, timerEndTime - Date.now()),
      enableEducationalCheck
    };
    sendResponse({ state });
  } else if (request.action === "analyzeContent") {
    // Handle content analysis request from frame.js
    analyzeContentWithGroq(request.content, request.url)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('Error in content analysis:', error);
        sendResponse({ isEducational: true, confidence: 0, reason: 'Error in analysis' });
      });
    return true; // Indicate that response will be sent asynchronously
  } else if (request.action === "toggleEducationalCheck") {
    enableEducationalCheck = !enableEducationalCheck;
    chrome.storage.local.set({ enableEducationalCheck });
    sendResponse({ success: true, enabled: enableEducationalCheck });
  } else if (request.action === "frameClosed") {
    // Handle when the educational content frame is closed
    sendResponse({ success: true });
  } else if (request.action === "frameOpened") {
    // Handle when the educational content frame is opened
    sendResponse({ success: true });
  }
  return true;
});
