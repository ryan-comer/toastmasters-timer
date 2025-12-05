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

  // Serial (formerly USB) Connect button
  connectUsbButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Inject the WebSerialManager script instead of webusb.js
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        files: ['webserial.js']   // <-- make sure this file defines WebSerialManager
      }, () => {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: connectToUSB   // still called connectToUSB for compatibility
        });
      });
    });
  });

  // Serial (formerly USB) Disconnect button
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

// Function to connect to Serial device (using WebSerialManager)
function connectToUSB() {
  console.log('Attempting to connect to Serial device (WebSerial)...');
  
  if (!window.WebSerialManager || !WebSerialManager.isSupported()) {
    alert('Web Serial is not supported or not enabled in this browser');
    return;
  }

  // Create global Serial manager instance
  const manager = new WebSerialManager({
    debug: true,
    timeout: 5000,
    filters: [
      // Add your device filters here, examples (Web Serial uses usbVendorId / usbProductId):
      // { usbVendorId: 0x2341 },                    // Arduino
      // { usbVendorId: 0x1234, usbProductId: 0x5678 } // Custom device
    ],
    // Adjust baudRate/etc to match your device
    baudRate: 115200
  });

  // For compatibility with existing code:
  window.serialManager = manager;
  window.usbManager = manager;

  manager.connect()
    .then(() => {
      console.log('Serial device connected successfully');
      const deviceInfo = manager.getDeviceInfo();
      console.log('Device info:', deviceInfo);
      
      // Update timer monitor to send data to serial device
      if (window.timerMonitor && typeof window.timerMonitor.setTimerChangeCallback === 'function') {
        window.timerMonitor.setTimerChangeCallback(async (timerValue, colorValue) => {
          if (manager && manager.isConnected) {
            try {
              // Parse color value (rgb(r, g, b) or rgba(r, g, b, a))
              let color = '0,0,0';
              if (colorValue) {
                const rgbMatch = colorValue.match(/\d+/g);
                if (rgbMatch && rgbMatch.length >= 3) {
                  color = `${rgbMatch[0]},${rgbMatch[1]},${rgbMatch[2]}`;
                }
              }
              
              const message = `${color}\n`;
              await manager.writeString(message);
              
              console.log('Sent to USB/Serial:', message.trim());
            } catch (error) {
              console.error('USB/Serial send error:', error);
            }
          }
        });
      }
      
      alert('Serial device connected! Check console for details.');
    })
    .catch(error => {
      console.error('Serial connection failed:', error);
      alert(`Serial connection failed: ${error.message}`);
    });
}

// Function to disconnect from Serial device
function disconnectFromUSB() {
  console.log('Disconnecting from Serial device...');

  const manager = window.serialManager || window.usbManager;
  
  if (manager) {
    manager.disconnect()
      .then(() => {
        console.log('Serial device disconnected');
        
        // Disable USB/Serial sync in timer monitor
        if (window.timerMonitor && typeof window.timerMonitor.setTimerChangeCallback === 'function') {
          window.timerMonitor.setTimerChangeCallback(null);
        }
        
        window.serialManager = null;
        window.usbManager = null;
        alert('Serial device disconnected');
      })
      .catch(error => {
        console.error('Serial disconnect error:', error);
        alert(`Disconnect failed: ${error.message}`);
      });
  } else {
    alert('No Serial device connected');
  }
}
