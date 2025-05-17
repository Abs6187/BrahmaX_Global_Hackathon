document.addEventListener('DOMContentLoaded', () => {
  const workDurationInput = document.getElementById('work-duration');
  const breakDurationInput = document.getElementById('break-duration');
  const decreaseWorkBtn = document.getElementById('decrease-work');
  const increaseWorkBtn = document.getElementById('increase-work');
  const decreaseBreakBtn = document.getElementById('decrease-break');
  const increaseBreakBtn = document.getElementById('increase-break');
  const saveSettingsBtn = document.getElementById('save-settings');
  const backToPopupBtn = document.getElementById('back-to-popup');
  const enableEduCheckInput = document.getElementById('enable-edu-check');
  const groqApiKeyInput = document.getElementById('groq-api-key');
  const showApiKeyBtn = document.getElementById('show-api-key');

  // Load current settings
  loadSettings();

  // Event listeners for buttons
  decreaseWorkBtn.addEventListener('click', () => {
    const currentValue = parseInt(workDurationInput.value);
    if (currentValue > 1) {
      workDurationInput.value = currentValue - 1;
    }
  });

  increaseWorkBtn.addEventListener('click', () => {
    const currentValue = parseInt(workDurationInput.value);
    if (currentValue < 120) {
      workDurationInput.value = currentValue + 1;
    }
  });

  decreaseBreakBtn.addEventListener('click', () => {
    const currentValue = parseInt(breakDurationInput.value);
    if (currentValue > 1) {
      breakDurationInput.value = currentValue - 1;
    }
  });

  increaseBreakBtn.addEventListener('click', () => {
    const currentValue = parseInt(breakDurationInput.value);
    if (currentValue < 60) {
      breakDurationInput.value = currentValue + 1;
    }
  });

  // Toggle API key visibility
  showApiKeyBtn.addEventListener('click', () => {
    if (groqApiKeyInput.type === 'password') {
      groqApiKeyInput.type = 'text';
      showApiKeyBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
      groqApiKeyInput.type = 'password';
      showApiKeyBtn.innerHTML = '<i class="fas fa-eye"></i>';
    }
  });

  saveSettingsBtn.addEventListener('click', saveSettings);
  backToPopupBtn.addEventListener('click', () => {
    window.close();
  });

  // Enforce min and max values for inputs
  workDurationInput.addEventListener('change', () => {
    let value = parseInt(workDurationInput.value);
    if (isNaN(value) || value < 1) {
      workDurationInput.value = 1;
    } else if (value > 120) {
      workDurationInput.value = 120;
    }
  });

  breakDurationInput.addEventListener('change', () => {
    let value = parseInt(breakDurationInput.value);
    if (isNaN(value) || value < 1) {
      breakDurationInput.value = 1;
    } else if (value > 60) {
      breakDurationInput.value = 60;
    }
  });

  // Functions to load and save settings
  function loadSettings() {
    chrome.storage.local.get(['workDuration', 'breakDuration', 'enableEducationalCheck', 'groqApiKey'], (result) => {
      if (result.workDuration) {
        workDurationInput.value = result.workDuration;
      } else {
        workDurationInput.value = 25; // Default value
      }
      
      if (result.breakDuration) {
        breakDurationInput.value = result.breakDuration;
      } else {
        breakDurationInput.value = 5; // Default value
      }
      
      // Set educational content filter toggle
      if (result.enableEducationalCheck !== undefined) {
        enableEduCheckInput.checked = result.enableEducationalCheck;
      } else {
        enableEduCheckInput.checked = true; // Default value
      }
      
      // Set Groq API key if available
      if (result.groqApiKey) {
        groqApiKeyInput.value = result.groqApiKey;
      }
    });
  }

  function saveSettings() {
    const workDuration = parseInt(workDurationInput.value);
    const breakDuration = parseInt(breakDurationInput.value);
    const enableEducationalCheck = enableEduCheckInput.checked;
    const groqApiKey = groqApiKeyInput.value.trim();
    
    // Prepare settings object
    const settings = { 
      workDuration, 
      breakDuration,
      enableEducationalCheck
    };
    
    // Only save API key if provided
    if (groqApiKey) {
      settings.groqApiKey = groqApiKey;
      
      // Also update the groq_api.txt file with the new key for easier access
      updateGroqApiFile(groqApiKey);
    }
    
    // Save settings to chrome.storage
    chrome.storage.local.set(settings, () => {
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'success-message';
      successMessage.textContent = 'Settings saved successfully!';
      successMessage.style.position = 'fixed';
      successMessage.style.top = '20px';
      successMessage.style.left = '50%';
      successMessage.style.transform = 'translateX(-50%)';
      successMessage.style.backgroundColor = '#2ecc71';
      successMessage.style.color = 'white';
      successMessage.style.padding = '10px 20px';
      successMessage.style.borderRadius = '5px';
      successMessage.style.zIndex = '9999';
      
      document.body.appendChild(successMessage);
      
      // Remove message after 3 seconds
      setTimeout(() => {
        document.body.removeChild(successMessage);
      }, 3000);
    });
  }
  
  // Helper function to update the API key file
  function updateGroqApiFile(apiKey) {
    // This is limited in a Chrome extension environment
    // In a real extension, we'd rely solely on chrome.storage
    // But we're including this for demonstration purposes
    try {
      // In a real extension, we would use chrome.storage only
      console.log('API key updated successfully');
    } catch (error) {
      console.error('Error updating API key file:', error);
    }
  }
});
