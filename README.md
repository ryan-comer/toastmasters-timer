# Toastmasters Timer Monitor Chrome Extension

A Chrome extension that monitors the Toastmasters timer webpage and logs time changes to the browser console.

## Features

- Automatically detects timer elements on the Toastmasters timer page
- Monitors for time changes and logs them to console
- **WebUSB integration** - Send timer data to connected microcontrollers
- Flexible detection algorithm that works with various timer formats
- Debug popup for testing and troubleshooting

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this folder
4. The extension should now appear in your extensions list

## Usage

### Basic Timer Monitoring
1. Navigate to the Toastmasters timer page: `https://www.toastmasters.org/my-toastmasters/profile/meeting-tools/timer`
2. Open the browser console (Press F12, then click "Console" tab)
3. The extension will automatically start monitoring the timer
4. Timer changes will be logged to the console with timestamps

### WebUSB Integration
1. Click the extension icon to open the popup
2. Click "Connect USB" to connect to your microcontroller
3. Select your device from the browser's device picker
4. Timer changes will now be sent to your USB device automatically

**USB Message Format:** `TIMER:MM:SS\n` (e.g., `TIMER:05:30\n`)

## Console Output

When the timer changes, you'll see logs like:
```
Timer value changed: {
  previous: "5:00",
  current: "4:59", 
  element: <div class="timer">4:59</div>,
  timestamp: "2025-08-03T10:30:15.123Z"
}
```

## Debugging

- Click the extension icon to open the popup
- Use the "Test Extension" button to check if the extension is working
- Use the "Reload" button to refresh the current page
- Check the console for debug messages

## Timer Detection

The extension uses multiple strategies to find timer elements:
- Searches for common timer CSS classes and IDs
- Looks for elements containing time patterns (MM:SS, HH:MM:SS, etc.)
- Falls back to monitoring all page changes for time format text

## Supported Time Formats

- `MM:SS` (e.g., "5:30")
- `M:SS` (e.g., "5:30") 
- `HH:MM:SS` (e.g., "1:05:30")
- `MM:SS.ms` (e.g., "5:30.5")
- Decimal seconds (e.g., "30.5")

## Troubleshooting

If the extension isn't working:

1. Check that you're on the correct Toastmasters timer page
2. Open the extension popup and click "Test Extension"
3. Check the console for any error messages
4. Try refreshing the page
5. Make sure the timer is visible and active on the page

## Technical Details

- Uses MutationObserver to detect DOM changes
- Polls timer element every 100ms as backup
- Searches for timer elements using multiple CSS selectors
- Compatible with Chrome Manifest V3

## WebUSB Class Usage

The extension includes a comprehensive WebUSB class that you can use independently:

```javascript
// Create WebUSB manager
const usb = new WebUSBManager({
  vendorId: 0x2341,    // Your device vendor ID
  productId: 0x0043,   // Your device product ID
  debug: true
});

// Connect to device
await usb.connect();

// Send string data
await usb.writeString("Hello Device!\n");

// Read response
const response = await usb.readString(64);
console.log("Device response:", response);

// Send binary data
await usb.write(new Uint8Array([0x01, 0x02, 0x03]));

// Disconnect
await usb.disconnect();
```

See `webusb-examples.js` for more detailed usage examples.

## Microcontroller Setup

Your microcontroller should:
1. Implement USB CDC (Serial) communication
2. Listen for messages in format: `TIMER:MM:SS\n`
3. Optionally send acknowledgment responses

**Arduino Example:**
```cpp
void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available()) {
    String message = Serial.readStringUntil('\n');
    if (message.startsWith("TIMER:")) {
      String timerValue = message.substring(6);
      // Process timer value
      Serial.println("ACK");
    }
  }
}
```

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main monitoring script
- `popup.html` - Extension popup interface  
- `popup.js` - Popup functionality
- `webusb.js` - WebUSB communication class
- `webusb-examples.js` - Usage examples
- `README.md` - This file
