function extractPageContent() {
    // Get the main content
    const mainContent = document.body.innerText;
    
    // Get the page title
    const pageTitle = document.title;
    
    // Get current URL
    const currentUrl = window.location.href;
    
    // Get any meta description
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    
    // Get headings for structure
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => h.innerText)
        .join('\n');
    
    // Combine all content with structure
    const structuredContent = `
Current URL: ${currentUrl}
Page Title: ${pageTitle}
Meta Description: ${metaDescription}

Main Headings:
${headings}

Page Content:
${mainContent}
    `.trim();
    
    return { content: structuredContent, url: currentUrl };
}

var loadFunction = window.onload;
window.onload = function(event) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'popupOpened') {
            const { content, url } = extractPageContent();
            chrome.runtime.sendMessage({
                message: content,
                url: url
            });
            console.log('Popup opened, content extracted from:', url);
        }
    });
    if (loadFunction) loadFunction(event);
};


