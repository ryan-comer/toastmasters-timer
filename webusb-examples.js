/**
 * WebUSB Usage Examples
 * This file demonstrates how to use the WebUSBManager class
 */

// Example 1: Basic connection and communication
async function basicExample() {
  try {
    // Create WebUSB manager instance
    const usb = new WebUSBManager({
      vendorId: 0x2341,    // Arduino vendor ID (example)
      productId: 0x0043,   // Arduino Uno product ID (example)
      debug: true,         // Enable debug logging
      timeout: 5000        // 5 second timeout
    });

    // Check if WebUSB is supported
    if (!WebUSBManager.isSupported()) {
      console.error('WebUSB is not supported in this browser');
      return;
    }

    // Connect to device
    console.log('Connecting to device...');
    await usb.connect();

    // Get device information
    const deviceInfo = usb.getDeviceInfo();
    console.log('Connected to:', deviceInfo);

    // Send a string command
    await usb.writeString('Hello Arduino!\n');

    // Read response
    const response = await usb.readString(64);
    console.log('Device response:', response);

    // Send binary data
    const binaryData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    await usb.write(binaryData);

    // Read binary response
    const binaryResponse = await usb.read(4);
    console.log('Binary response:', Array.from(binaryResponse));

    // Disconnect
    await usb.disconnect();
    console.log('Disconnected successfully');

  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Example 2: Command-response pattern
async function commandResponseExample() {
  const usb = new WebUSBManager({
    debug: true,
    timeout: 3000
  });

  try {
    await usb.connect();

    // Send command and wait for specific response
    const response = await usb.sendCommand('GET_VERSION\n', 32);
    const version = new TextDecoder().decode(response).trim();
    console.log('Device version:', version);

    // Send data request
    const dataResponse = await usb.sendCommand([0xFF, 0x01, 0x00], 16);
    console.log('Data response:', Array.from(dataResponse));

    await usb.disconnect();
  } catch (error) {
    console.error('Command example failed:', error);
  }
}

// Example 3: Custom device configuration
async function customConfigExample() {
  const usb = new WebUSBManager({
    filters: [
      { vendorId: 0x1234, productId: 0x5678 },  // Custom device
      { vendorId: 0x2341 }  // Any Arduino device
    ],
    debug: true
  });

  try {
    await usb.connect();

    // Set custom endpoints if needed
    usb.setEndpoints(0x81, 0x02);  // IN: 0x81, OUT: 0x02

    // Set custom interface
    usb.setInterface(1, 1);  // Interface 1, Configuration 1

    // Your communication code here
    await usb.writeString('CUSTOM_COMMAND\n');
    const result = await usb.readString();
    console.log('Custom device response:', result);

    await usb.disconnect();
  } catch (error) {
    console.error('Custom config example failed:', error);
  }
}

// Example 4: Integration with Chrome extension popup
async function extensionPopupExample() {
  // This would be used in popup.js or content.js
  
  const connectButton = document.getElementById('connectUsb');
  const sendButton = document.getElementById('sendData');
  const statusDiv = document.getElementById('usbStatus');
  
  let usbManager = null;

  connectButton?.addEventListener('click', async () => {
    try {
      usbManager = new WebUSBManager({
        debug: true,
        timeout: 5000
      });

      await usbManager.connect();
      statusDiv.textContent = 'Connected to USB device';
      statusDiv.className = 'status connected';
      
      sendButton.disabled = false;
    } catch (error) {
      statusDiv.textContent = `Connection failed: ${error.message}`;
      statusDiv.className = 'status error';
    }
  });

  sendButton?.addEventListener('click', async () => {
    if (!usbManager || !usbManager.isConnected) {
      alert('Please connect to a device first');
      return;
    }

    try {
      // Send timer data to microcontroller
      const timerData = document.getElementById('timerValue')?.textContent || '00:00';
      await usbManager.writeString(`TIMER:${timerData}\n`);
      
      // Read acknowledgment
      const ack = await usbManager.readString(16);
      console.log('Device acknowledged:', ack);
    } catch (error) {
      console.error('Send failed:', error);
      alert(`Send failed: ${error.message}`);
    }
  });
}

// Example 5: Periodic data sending
class TimerUsbSync {
  constructor() {
    this.usbManager = null;
    this.syncInterval = null;
    this.lastTimerValue = null;
  }

  async connect() {
    this.usbManager = new WebUSBManager({
      vendorId: 0x2341,  // Adjust for your device
      debug: true
    });

    await this.usbManager.connect();
    console.log('USB sync connected');
  }

  startSync(timerElement, intervalMs = 1000) {
    if (!this.usbManager || !this.usbManager.isConnected) {
      throw new Error('USB device not connected');
    }

    this.syncInterval = setInterval(async () => {
      try {
        const currentTime = timerElement.textContent || timerElement.innerText;
        
        // Only send if timer value changed
        if (currentTime !== this.lastTimerValue) {
          await this.usbManager.writeString(`TIME:${currentTime}\n`);
          this.lastTimerValue = currentTime;
          console.log('Sent timer update:', currentTime);
        }
      } catch (error) {
        console.error('Sync error:', error);
      }
    }, intervalMs);
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async disconnect() {
    this.stopSync();
    if (this.usbManager) {
      await this.usbManager.disconnect();
      this.usbManager = null;
    }
  }
}

// Export examples for use
if (typeof window !== 'undefined') {
  window.WebUSBExamples = {
    basicExample,
    commandResponseExample,
    customConfigExample,
    extensionPopupExample,
    TimerUsbSync
  };
}