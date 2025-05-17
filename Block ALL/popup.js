document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.getElementById('status');
  const allowedDomainElement = document.getElementById('allowed-domain');
  const domainTextElement = document.getElementById('domain-text');
  const timerTextElement = document.getElementById('timer-text');
  const timerStateElement = document.getElementById('timer-state');
  const progressElement = document.getElementById('progress');
  const toggleBlockingButton = document.getElementById('toggle-blocking');
  const startPomodoroButton = document.getElementById('start-pomodoro');
  const stopPomodoroButton = document.getElementById('stop-pomodoro');
  const openSettingsButton = document.getElementById('open-settings');
  const eduFilterStatusElement = document.getElementById('edu-filter-status');

  let appState = {
    isBlocking: false,
    allowedUrl: '',
    pomodoroState: 'idle',
    workDuration: 25,
    breakDuration: 5,
    timerEndTime: 0,
    remainingTime: 0,
    enableEducationalCheck: true
  };

  // Initial state fetch
  fetchState();

  // Event Listeners
  toggleBlockingButton.addEventListener('click', toggleBlocking);
  startPomodoroButton.addEventListener('click', startPomodoro);
  stopPomodoroButton.addEventListener('click', stopPomodoro);
  openSettingsButton.addEventListener('click', openSettings);

  // Listen for state updates from background script
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'stateUpdate') {
      updateUI(request.state);
    }
  });

  // Timer update interval (every second)
  const timerInterval = setInterval(updateTimer, 1000);

  // Functions
  function fetchState() {
    chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
      if (response && response.state) {
        updateUI(response.state);
      }
    });
  }

  function updateUI(state) {
    appState = state;

    // Update status display
    if (state.isBlocking) {
      statusElement.textContent = 'Active';
      statusElement.className = 'active';
      toggleBlockingButton.innerHTML = '<i class="fas fa-unlock"></i> Disable Blocking';
      
      // Show allowed domain
      allowedDomainElement.classList.remove('hidden');
      domainTextElement.textContent = state.allowedUrl;
    } else {
      statusElement.textContent = 'Inactive';
      statusElement.className = 'inactive';
      toggleBlockingButton.innerHTML = '<i class="fas fa-lock"></i> Enable Blocking';
      
      // Hide allowed domain
      allowedDomainElement.classList.add('hidden');
    }

    // Update timer display based on pomodoro state
    if (state.pomodoroState !== 'idle') {
      startPomodoroButton.classList.add('hidden');
      stopPomodoroButton.classList.remove('hidden');
      
      // Set timer state text
      timerStateElement.textContent = state.pomodoroState === 'working' ? 'Working' : 'Break';
      
      // Update timer display
      updateTimer();
    } else {
      startPomodoroButton.classList.remove('hidden');
      stopPomodoroButton.classList.add('hidden');
      timerStateElement.textContent = 'Idle';
      timerTextElement.textContent = '00:00';
      progressElement.style.width = '0%';
    }
    
    // Update educational content filter status
    if (state.enableEducationalCheck !== undefined) {
      if (state.enableEducationalCheck) {
        eduFilterStatusElement.textContent = 'Active';
        eduFilterStatusElement.className = 'active';
      } else {
        eduFilterStatusElement.textContent = 'Inactive';
        eduFilterStatusElement.className = 'inactive';
      }
    }
  }

  function updateTimer() {
    if (appState.pomodoroState === 'idle') return;

    const currentTime = Date.now();
    const timeRemaining = Math.max(0, appState.timerEndTime - currentTime);
    
    // Calculate minutes and seconds
    const minutes = Math.floor(timeRemaining / (60 * 1000));
    const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
    
    // Update timer display
    timerTextElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Update progress bar
    const duration = appState.pomodoroState === 'working' 
      ? appState.workDuration * 60 * 1000
      : appState.breakDuration * 60 * 1000;
    
    const progress = 100 - ((timeRemaining / duration) * 100);
    progressElement.style.width = `${progress}%`;
  }

  function toggleBlocking() {
    chrome.runtime.sendMessage({ action: 'toggleBlocking' }, () => {
      fetchState();
    });
  }

  function startPomodoro() {
    chrome.runtime.sendMessage({ action: 'startPomodoro' }, () => {
      fetchState();
    });
  }

  function stopPomodoro() {
    chrome.runtime.sendMessage({ action: 'stopPomodoro' }, () => {
      fetchState();
    });
  }

  function openSettings() {
    chrome.tabs.create({ url: 'settings.html' });
  }

  // Cleanup when popup closes
  window.addEventListener('unload', () => {
    clearInterval(timerInterval);
  });
});
