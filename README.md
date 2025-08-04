# Toastmasters Timer Monitor Chrome Extension

A Chrome extension that monitors the Toastmasters timer webpage and logs time changes to the browser console.

## Features

- Automatically detects timer elements on the Toastmasters timer page
- Monitors for time changes and logs them to console
- Flexible detection algorithm that works with various timer formats
- Debug popup for testing and troubleshooting

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this folder
4. The extension should now appear in your extensions list

## Usage

1. Navigate to the Toastmasters timer page: `https://www.toastmasters.org/my-toastmasters/profile/meeting-tools/timer`
2. Open the browser console (Press F12, then click "Console" tab)
3. The extension will automatically start monitoring the timer
4. Timer changes will be logged to the console with timestamps

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

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main monitoring script
- `popup.html` - Extension popup interface  
- `popup.js` - Popup functionality
- `README.md` - This file
