document.addEventListener('DOMContentLoaded', () => {
  const breakTimerElement = document.getElementById('break-timer');
  const loadingElement = document.getElementById('loading');
  const memeDisplayElement = document.getElementById('meme-display');
  const errorDisplayElement = document.getElementById('error-display');
  const memeTitleElement = document.getElementById('meme-title');
  const memeImgElement = document.getElementById('meme-img');
  const refreshMemeButton = document.getElementById('refresh-meme');

  let breakDuration = 5; // default 5 minutes
  let timerEndTime = 0;
  let timerInterval;

  // Fetch state and settings from background script
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response && response.state) {
      const state = response.state;
      
      // Only proceed if we're in a break state
      if (state.pomodoroState === 'break') {
        breakDuration = state.breakDuration;
        timerEndTime = state.timerEndTime;
        
        // Start timer
        startTimer();
        
        // Load a meme
        loadRandomMeme();
      } else {
        // If we're not in a break, show a message and redirect
        document.body.innerHTML = `
          <div style="text-align: center; padding: 50px;">
            <h2>Not in a break period</h2>
            <p>This page is meant to be viewed during your break time.</p>
            <button id="go-back" style="margin-top: 20px; padding: 8px 16px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Go Back
            </button>
          </div>
        `;
        
        document.getElementById('go-back').addEventListener('click', () => {
          window.close();
        });
      }
    }
  });

  // Event listener for refresh meme button
  refreshMemeButton.addEventListener('click', () => {
    memeDisplayElement.style.display = 'none';
    errorDisplayElement.classList.add('hidden');
    loadingElement.style.display = 'flex';
    loadRandomMeme();
  });

  // Listen for state updates from background script
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'stateUpdate') {
      const state = request.state;
      
      // Update timer if we're in a break
      if (state.pomodoroState === 'break') {
        timerEndTime = state.timerEndTime;
      } else if (state.pomodoroState === 'working' || state.pomodoroState === 'idle') {
        // Break is over, show a message
        clearInterval(timerInterval);
        
        const container = document.querySelector('.container');
        container.innerHTML = `
          <div style="text-align: center; padding: 50px;">
            <h2>Break time is over!</h2>
            <p>Time to get back to work.</p>
            <button id="close-page" style="margin-top: 20px; padding: 8px 16px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Close This Page
            </button>
          </div>
        `;
        
        document.getElementById('close-page').addEventListener('click', () => {
          window.close();
        });
      }
    }
  });

  // Timer function
  function startTimer() {
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
      updateTimerDisplay();
    }, 1000);
  }

  function updateTimerDisplay() {
    const currentTime = Date.now();
    const timeRemaining = Math.max(0, timerEndTime - currentTime);
    
    // Calculate minutes and seconds
    const minutes = Math.floor(timeRemaining / (60 * 1000));
    const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
    
    // Update timer display
    breakTimerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // If timer has reached zero
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
    }
  }

  // Function to load a random meme
  async function loadRandomMeme() {
    try {
      // Using meme APIs - try Reddit first
      const response = await fetch('https://meme-api.com/gimme');
      
      if (!response.ok) {
        throw new Error('Failed to fetch meme');
      }
      
      const data = await response.json();
      
      // Check if the meme is NSFW - if so, try again
      if (data.nsfw) {
        loadRandomMeme();
        return;
      }
      
      // Display the meme
      memeTitleElement.textContent = data.title;
      memeImgElement.src = data.url;
      memeImgElement.alt = data.title;
      
      memeImgElement.onload = () => {
        loadingElement.style.display = 'none';
        memeDisplayElement.style.display = 'block';
      };
      
      memeImgElement.onerror = () => {
        // If image fails to load, try another meme
        loadRandomMeme();
      };
    } catch (error) {
      console.error('Error fetching meme:', error);
      
      // Try alternate meme API
      try {
        const response = await fetch('https://api.imgflip.com/get_memes');
        
        if (!response.ok) {
          throw new Error('Failed to fetch from alternate source');
        }
        
        const data = await response.json();
        
        if (data.success && data.data.memes.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.data.memes.length);
          const meme = data.data.memes[randomIndex];
          
          memeTitleElement.textContent = meme.name;
          memeImgElement.src = meme.url;
          memeImgElement.alt = meme.name;
          
          memeImgElement.onload = () => {
            loadingElement.style.display = 'none';
            memeDisplayElement.style.display = 'block';
          };
          
          memeImgElement.onerror = () => {
            showError();
          };
        } else {
          showError();
        }
      } catch (fallbackError) {
        console.error('Error fetching from alternate source:', fallbackError);
        showError();
      }
    }
  }

  // Show error message
  function showError() {
    loadingElement.style.display = 'none';
    memeDisplayElement.style.display = 'none';
    errorDisplayElement.classList.remove('hidden');
  }

  // Cleanup when page closes
  window.addEventListener('unload', () => {
    clearInterval(timerInterval);
  });
});
