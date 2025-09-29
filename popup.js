// Popup script for Toastmasters Timer Monitor
document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const usbStatusDiv = document.getElementById('usbStatus');
  const testButton = document.getElementById('testButton');
  const reloadButton = document.getElementById('reloadButton');
  const connectUsbButton = document.getElementById('connectUsb');
  const disconnectUsbButton = document.getElementById('disconnectUsb');

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

  // USB Connect button
  connectUsbButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        files: ['webusb.js']
      }, () => {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: connectToUSB
        });
      });
    });
  });

  // USB Disconnect button
  disconnectUsbButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: disconnectFromUSB
      });
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

// Function to connect to USB device
function connectToUSB() {
  console.log('Attempting to connect to USB device...');
  
  if (!WebUSBManager.isSupported()) {
    alert('WebUSB is not supported in this browser');
    return;
  }

  // Create global USB manager instance
  window.usbManager = new WebUSBManager({
    debug: true,
    timeout: 5000,
    filters: [
      // Add your device filters here, examples:
      // { vendorId: 0x2341 },  // Arduino
      // { vendorId: 0x1234, productId: 0x5678 },  // Custom device
    ]
  });

  window.usbManager.connect()
    .then(() => {
      console.log('USB device connected successfully');
      const deviceInfo = window.usbManager.getDeviceInfo();
      console.log('Device info:', deviceInfo);
      
      // Update timer monitor to send data to USB
      if (window.timerMonitor) {
        window.timerMonitor.enableUSBSync(window.usbManager);
      }
      
      alert('USB device connected! Check console for details.');
    })
    .catch(error => {
      console.error('USB connection failed:', error);
      alert(`USB connection failed: ${error.message}`);
    });
}

// Function to disconnect from USB device
function disconnectFromUSB() {
  console.log('Disconnecting from USB device...');
  
  if (window.usbManager) {
    window.usbManager.disconnect()
      .then(() => {
        console.log('USB device disconnected');
        
        // Disable USB sync in timer monitor
        if (window.timerMonitor) {
          window.timerMonitor.disableUSBSync();
        }
        
        window.usbManager = null;
        alert('USB device disconnected');
      })
      .catch(error => {
        console.error('USB disconnect error:', error);
        alert(`Disconnect failed: ${error.message}`);
      });
  } else {
    alert('No USB device connected');
  }
}
