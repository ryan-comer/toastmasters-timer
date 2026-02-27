# Toastmasters Timer Monitor

A Chrome extension that monitors the [Toastmasters online timer](https://www.toastmasters.org/my-toastmasters/profile/meeting-tools/timer) and streams the timer's background color to a serial-connected device (e.g. a Raspberry Pi Pico driving NeoPixel LEDs).

## Features

- **Auto-detects** the timer on the Toastmasters page (`#timeDiv` / `#timergrid`)
- **Monitors color changes** via MutationObserver + 200 ms polling fallback
- **Web Serial integration** — sends RGB values to a microcontroller over serial
- **Popup UI** — shows connection status, quick-navigate to the timer page, connect/disconnect serial, and run diagnostics
- Includes a ready-to-use **Raspberry Pi Pico** MicroPython script for NeoPixel output

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select this repository folder
4. The extension icon will appear in your toolbar

## Usage

### Timer Monitoring

1. Navigate to the Toastmasters timer page (or click the extension icon and use the **Navigate** button)
2. The content script automatically starts observing the timer element
3. Open DevTools (F12 → Console) to see live updates:
   ```
   Timer Update: 01:07 [rgb(0, 128, 0)]
   ```

### Serial Device Connection

1. Click the extension icon to open the popup
2. Click **Connect Serial** and select your device from the browser picker
3. The extension sends the timer's background color as `R,G,B\n` (e.g. `0,128,0\n`) over serial whenever it changes

### Popup Controls

| Button | Action |
|---|---|
| **Connect Serial** | Pair and open a Web Serial connection |
| **Disconnect Serial** | Close the serial connection |
| **Test Extension** | Log diagnostic info to the console (read-only) |
| **Reload** | Reload the active tab |

## Hardware Setup (Raspberry Pi Pico)

The `RPi-Pico/main.py` script runs on a Pico (or Pico W) and drives a NeoPixel strip:

1. Connect a NeoPixel strip data pin to **GP6** (configurable in the script)
2. Copy `RPi-Pico/main.py` to the Pico as `main.py`
3. The Pico reads `R,G,B\n` lines over USB serial and sets all LEDs to that color

Key settings in `main.py`:

| Variable | Default | Description |
|---|---|---|
| `PIN_NUM` | `6` | GPIO pin for NeoPixel data |
| `NUM_LEDS` | `64` | Number of LEDs in the strip |
| `BRIGHTNESS_FACTOR` | `0.02` | Brightness scale (0.0–1.0) |

## Troubleshooting

1. **Extension not detecting the timer** — Make sure you're on the exact Toastmasters timer URL. Click **Test Extension** and check the console.
2. **Serial won't connect** — Ensure no other application has the port open. Chrome must support Web Serial (not available in all browsers).
3. **LEDs not lighting up** — Verify wiring, GPIO pin, and that `main.py` is running. Check the Pico's serial output for "Ready to receive RGB values".

## Technical Details

- **Manifest V3** Chrome extension
- Timer detection: looks for `#timeDiv`, falls back to generic `[class*="timer"]` / `[id*="timer"]` selectors, then watches the DOM for late-loading elements
- Color extraction: reads `background-color` via `getComputedStyle`, traverses parent elements if transparent
- Dual change detection: MutationObserver for immediate response + `setInterval` (200 ms) as a safety net

## WebSerialManager

`webserial.js` exposes a reusable `WebSerialManager` class:

```javascript
const serial = new WebSerialManager({ baudRate: 9600, debug: true });
await serial.connect();
await serial.write('0,128,0\n');
const response = await serial.readString(64);
await serial.disconnect();
```

## Project Structure

| File | Description |
|---|---|
| `manifest.json` | Extension configuration (Manifest V3) |
| `content.js` | Content script — `TimerMonitor` class |
| `popup.html` | Extension popup UI |
| `popup.js` | Popup logic and serial connection management |
| `webserial.js` | Reusable `WebSerialManager` class |
| `RPi-Pico/main.py` | MicroPython NeoPixel driver for Raspberry Pi Pico |
