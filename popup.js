// Popup script for Toastmasters Timer Monitor

// Helper: get the active tab and invoke a callback with it
function getActiveTab(callback) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => callback(tabs[0]));
}

// Helper: execute a function in the active tab's context
function executeInActiveTab(fn) {
  getActiveTab((tab) => {
    chrome.scripting.executeScript({ target: {tabId: tab.id}, function: fn });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Status elements
  const timerDot = document.getElementById('timerDot');
  const timerLabel = document.getElementById('timerLabel');
  const serialDot = document.getElementById('serialDot');
  const serialLabel = document.getElementById('serialLabel');

  // Buttons
  const navigateBtn = document.getElementById('navigateBtn');
  const serialToggleBtn = document.getElementById('serialToggleBtn');
  const testButton = document.getElementById('testButton');
  const reloadButton = document.getElementById('reloadButton');

  // Track whether serial is currently connected so the toggle knows what to do
  let serialConnected = false;

  // ── UI helpers ──

  function setTimerActive() {
    timerDot.className = 'status-dot green';
    timerLabel.textContent = 'Timer page active';
    navigateBtn.classList.add('hidden');
    serialToggleBtn.disabled = false;
  }

  function setTimerInactive() {
    timerDot.className = 'status-dot red';
    timerLabel.textContent = 'Not on timer page';
    navigateBtn.classList.remove('hidden');
    serialToggleBtn.disabled = true;
  }

  function setSerialConnected() {
    serialConnected = true;
    serialDot.className = 'status-dot green';
    serialLabel.innerHTML = 'Serial connected<div class="status-detail">Streaming color data to device</div>';
    serialToggleBtn.textContent = 'Disconnect Serial';
    serialToggleBtn.className = 'btn btn-danger';
  }

  function setSerialDisconnected() {
    serialConnected = false;
    serialDot.className = 'status-dot red';
    serialLabel.innerHTML = 'Serial disconnected<div class="status-detail">Connect to stream color data</div>';
    serialToggleBtn.textContent = 'Connect Serial';
    serialToggleBtn.className = 'btn btn-success';
  }

  // ── Initialise state ──

  getActiveTab((currentTab) => {
    const onTimerPage = currentTab.url &&
      currentTab.url.includes('toastmasters.org') &&
      currentTab.url.includes('timer');

    if (onTimerPage) {
      setTimerActive();

      // Check serial connection status
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        function: checkConnectionStatus
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.log('Error checking connection status:', chrome.runtime.lastError);
          return;
        }
        if (results && results[0] && results[0].result) {
          setSerialConnected();
        } else {
          setSerialDisconnected();
        }
      });
    } else {
      setTimerInactive();
      setSerialDisconnected();
    }
  });

  // ── Navigate button ──

  navigateBtn.addEventListener('click', () => {
    const targetUrl = 'https://www.toastmasters.org/my-toastmasters/profile/meeting-tools/timer';
    chrome.tabs.query({url: '*://www.toastmasters.org/my-toastmasters/profile/meeting-tools/timer*'}, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, {active: true});
        chrome.windows.update(tabs[0].windowId, {focused: true});
      } else {
        chrome.tabs.create({url: targetUrl});
      }
    });
  });

  // ── Serial toggle (connect / disconnect) ──

  serialToggleBtn.addEventListener('click', () => {
    if (serialConnected) {
      executeInActiveTab(disconnectFromSerial);
      setSerialDisconnected();
    } else {
      getActiveTab((tab) => {
        chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['webserial.js']
        }, () => {
          chrome.scripting.executeScript({
            target: {tabId: tab.id},
            function: connectToSerial
          });
        });
      });
      // Optimistically update — connectToSerial will alert on failure
      setSerialConnected();
    }
  });

  // ── Utility buttons ──

  testButton.addEventListener('click', () => executeInActiveTab(testExtension));

  reloadButton.addEventListener('click', () => {
    getActiveTab((tab) => chrome.tabs.reload(tab.id));
  });
});

// Function to inject for testing (read-only diagnostics — does not modify callbacks)
function testExtension() {
  console.log('Toastmasters Timer Monitor - Test triggered');
  
  if (window.timerMonitor) {
    console.log('Timer monitor is active');
    console.log('Time element:', window.timerMonitor.timeElement);
    console.log('Color element:', window.timerMonitor.colorElement);
    console.log('Last timer value:', window.timerMonitor.lastTimerValue);
    console.log('Last color value:', window.timerMonitor.lastColorValue);
    console.log('Callback set:', !!window.timerMonitor.onTimerChangeCallback);
  } else {
    console.log('Timer monitor not found - extension may not be loaded');
  }
  
  console.log('Serial connected:', !!(window.serialManager && window.serialManager.isConnected));
  
  alert('Test completed - check console for details');
}

// Function to connect to Serial device (using WebSerialManager)
function connectToSerial() {
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
    baudRate: 9600
  });

  window.serialManager = manager;

  manager.connect()
    .then(() => {
      console.log('[Serial TX] Connected successfully');
      const deviceInfo = manager.getDeviceInfo();
      console.log('[Serial TX] Device info:', deviceInfo);

      // Start background read loop to print Pico debug output
      manager.startReadLoop();
      
      // Update timer monitor to send data to serial device
      if (window.timerMonitor && typeof window.timerMonitor.setTimerChangeCallback === 'function') {
        window.timerMonitor.setTimerChangeCallback(async (timerValue, colorValue) => {
          console.log(`[Serial TX] Timer callback fired — time: "${timerValue}", raw color: "${colorValue}"`);
          
          if (manager && manager.isConnected) {
            try {
              // Parse color value (rgb(r, g, b) or rgba(r, g, b, a))
              let color = '0,0,0';
              if (colorValue) {
                const rgbMatch = colorValue.match(/\d+/g);
                console.log(`[Serial TX] Regex match on colorValue:`, rgbMatch);
                if (rgbMatch && rgbMatch.length >= 3) {
                  color = `${rgbMatch[0]},${rgbMatch[1]},${rgbMatch[2]}`;
                }
              } else {
                console.warn('[Serial TX] colorValue is falsy, sending 0,0,0');
              }
              
              const message = `${color}\n`;
              console.log(`[Serial TX] Sending ${message.length} bytes: "${message.trim()}"`);
              await manager.write(message);
              console.log('[Serial TX] Write complete');
            } catch (error) {
              console.error('[Serial TX] Write error:', error);
            }
          } else {
            console.warn('[Serial TX] Not connected (isConnected=%s), skipping', manager?.isConnected);
          }
        });
      } else {
        console.warn('[Serial TX] timerMonitor not available — callback not set');
      }
      
      alert('Serial device connected! Check console for details.');
    })
    .catch(error => {
      console.error('Serial connection failed:', error);
      alert(`Serial connection failed: ${error.message}`);
    });
}

// Function to disconnect from Serial device
function disconnectFromSerial() {
  console.log('Disconnecting from Serial device...');

  const manager = window.serialManager;
  
  if (manager) {
    manager.stopReadLoop()
      .then(() => manager.disconnect())
      .then(() => {
        console.log('Serial device disconnected');
        
        // Disable Serial sync in timer monitor
        if (window.timerMonitor && typeof window.timerMonitor.setTimerChangeCallback === 'function') {
          window.timerMonitor.setTimerChangeCallback(null);
        }
        
        window.serialManager = null;
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

// Function to check connection status
function checkConnectionStatus() {
  const manager = window.serialManager;
  return !!(manager && manager.isConnected);
}
