import machine
import neopixel
import sys

# Configuration
PIN_NUM = 6
NUM_LEDS = 64
BRIGHTNESS_FACTOR = 0.02  # Adjust brightness (0.0 to 1.0)

print(f"[Pico] Config: PIN={PIN_NUM}, LEDs={NUM_LEDS}, BRIGHTNESS={BRIGHTNESS_FACTOR}")

# Setup NeoPixel
np = neopixel.NeoPixel(machine.Pin(PIN_NUM), NUM_LEDS)
print(f"[Pico] NeoPixel initialized on GP{PIN_NUM} with {NUM_LEDS} LEDs")

# Setup Onboard LED for status (Pin 25 for Pico, "LED" for Pico W)
led = None
try:
    led = machine.Pin(25, machine.Pin.OUT)
    print("[Pico] Onboard LED initialized on pin 25")
except:
    try:
        led = machine.Pin("LED", machine.Pin.OUT)
        print("[Pico] Onboard LED initialized via 'LED' pin")
    except:
        print("[Pico] WARNING: Onboard LED not found, continuing without it")

def set_color(r, g, b):
    print(f"[Pico] set_color called with raw RGB: ({r}, {g}, {b})")
    # Apply brightness scaling
    r = int(r * BRIGHTNESS_FACTOR)
    g = int(g * BRIGHTNESS_FACTOR)
    b = int(b * BRIGHTNESS_FACTOR)
    print(f"[Pico] After brightness scaling ({BRIGHTNESS_FACTOR}): ({r}, {g}, {b})")
    
    for i in range(NUM_LEDS):
        np[i] = (r, g, b)
    np.write()
    print(f"[Pico] NeoPixel write complete — {NUM_LEDS} LEDs set to ({r}, {g}, {b})")

print("[Pico] Ready to receive RGB values (format: R,G,B)")

while True:
    line = sys.stdin.readline().strip().replace(' ', '')
    if not line:
        continue

    print(f"[Pico] Received raw line ({len(line)} chars): \"{line}\"")

    try:
        parts = line.split(',')
        print(f"[Pico] Split into {len(parts)} parts: {parts}")

        if len(parts) == 3:
            r = int(parts[0])
            g = int(parts[1])
            b = int(parts[2])
            print(f"[Pico] Parsed RGB: R={r} G={g} B={b}")
            set_color(r, g, b)
            if led:
                led.toggle()
                print("[Pico] Onboard LED toggled")
        else:
            print(f"[Pico] WARNING: Expected 3 parts, got {len(parts)} — skipping")
    except ValueError as e:
        print(f"[Pico] ERROR ValueError: {e} — line was: \"{line}\"")
    except Exception as e:
        print(f"[Pico] ERROR Exception: {type(e).__name__}: {e}")