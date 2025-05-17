// Frame script for educational content detection
document.addEventListener('DOMContentLoaded', () => {
  const contentFrame = document.getElementById('content-frame');
  const loadingIndicator = document.getElementById('loading-indicator');
  const educationalWarning = document.getElementById('educational-warning');
  const closeFrameButton = document.getElementById('close-frame');
  
  // Get URL from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const targetUrl = urlParams.get('url');
  
  // Initially hide the warning
  educationalWarning.classList.add('hidden');
  
  if (targetUrl) {
    // Set the src of the iframe
    contentFrame.src = targetUrl;
    
    // When the iframe loads, capture its content for analysis
    contentFrame.onload = async () => {
      try {
        // Try to access iframe content - this will only work if same-origin
        // For cross-origin content, we'll rely on the URL and metadata only
        let pageContent = '';
        
        try {
          if (contentFrame.contentDocument) {
            const bodyText = contentFrame.contentDocument.body.textContent;
            // Get page title if available
            const pageTitle = contentFrame.contentDocument.title;
            // Combine title and body for analysis, limiting length
            pageContent = (pageTitle + ' - ' + bodyText).substring(0, 1000);
          }
        } catch (e) {
          // Cross-origin access error, use just the URL for analysis
          console.log('Cross-origin frame access error:', e);
          pageContent = targetUrl;
        }
        
        // If we couldn't get content, just use the URL
        if (!pageContent || pageContent.trim() === '') {
          pageContent = targetUrl;
        }
        
        // Analyze the content
        analyzeContent(pageContent, targetUrl);
      } catch (error) {
        console.error('Error analyzing content:', error);
        // Hide loading indicator in case of error
        loadingIndicator.classList.add('hidden');
      }
    };
  } else {
    // No URL provided
    loadingIndicator.classList.add('hidden');
    educationalWarning.classList.remove('hidden');
    document.querySelector('.warning-content h1').textContent = 'Invalid URL';
    document.querySelector('.warning-content p').textContent = 'No URL was provided to analyze.';
  }
  
  // Close button event listener
  closeFrameButton.addEventListener('click', () => {
    // Send message to parent window to close the frame
    window.parent.postMessage({ 
      from: 'blockall-frame',
      action: 'closeFrame' 
    }, '*');
  });
  
  // Function to analyze content using Groq API
  async function analyzeContent(content, url) {
    try {
      // Tell the background script to analyze the content
      chrome.runtime.sendMessage({
        action: 'analyzeContent',
        content,
        url
      }, (response) => {
        // Once analysis is complete, update UI based on result
        loadingIndicator.classList.add('hidden');
        
        if (response && response.isEducational) {
          // If content is educational, hide warning and show the frame
          educationalWarning.classList.add('hidden');
          
          // Notify the parent window that content is educational
          window.parent.postMessage({ 
            from: 'blockall-frame',
            action: 'analyzeComplete',
            isEducational: true
          }, '*');
        } else {
          // If content is not educational, show warning
          educationalWarning.classList.remove('hidden');
          
          // Get specific reason if available
          if (response && response.reason) {
            document.querySelector('.details').textContent = response.reason;
          }
          
          // Notify the parent window that content is not educational
          window.parent.postMessage({ 
            from: 'blockall-frame',
            action: 'analyzeComplete',
            isEducational: false,
            reason: response && response.reason ? response.reason : 'Content not suitable for focused work.'
          }, '*');
        }
      });
    } catch (error) {
      console.error('Error in content analysis:', error);
      loadingIndicator.classList.add('hidden');
      // Show warning with error message
      educationalWarning.classList.remove('hidden');
      document.querySelector('.warning-content h1').textContent = 'Analysis Error';
      document.querySelector('.warning-content p').textContent = 'There was an error analyzing this content.';
      
      // Notify the parent window of the error
      window.parent.postMessage({ 
        from: 'blockall-frame',
        action: 'analyzeComplete',
        isEducational: true,  // Default to allowing on error
        error: true
      }, '*');
    }
  }
});