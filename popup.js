// Popup script for Toastmasters Timer Monitor
document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const testButton = document.getElementById('testButton');
  const reloadButton = document.getElementById('reloadButton');

  // Check if current tab is the timer page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('toastmasters.org') && 
        currentTab.url.includes('timer')) {
      statusDiv.textContent = 'Active on timer page';
      statusDiv.className = 'status active';
    } else {
      statusDiv.textContent = 'Navigate to timer page';
      statusDiv.className = 'status inactive';
    }
  });

  // Test button - inject a test script
  testButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: testExtension
      });
    });
  });

  // Reload button
  reloadButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.reload(tabs[0].id);
    });
  });
});

// Function to inject for testing
function testExtension() {
  console.log('Toastmasters Timer Monitor - Test triggered');
  
  // Log current timer monitor status
  if (window.timerMonitor) {
    console.log('Timer monitor is active:', window.timerMonitor);
    console.log('Current timer element:', window.timerMonitor.timerElement);
    console.log('Last timer value:', window.timerMonitor.lastTimerValue);
  } else {
    console.log('Timer monitor not found - extension may not be loaded');
  }
  
  // Search for potential timer elements
  const timeElements = [];
  const allElements = document.querySelectorAll('*');
  
  allElements.forEach(element => {
    const text = element.textContent || element.innerText || '';
    if (/\d{1,2}:\d{2}/.test(text.trim())) {
      timeElements.push({
        element: element,
        text: text.trim(),
        tagName: element.tagName,
        className: element.className,
        id: element.id
      });
    }
  });
  
  console.log('Found potential timer elements:', timeElements);
  
  alert('Test completed - check console for details');
}
