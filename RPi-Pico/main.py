import machine
import neopixel
import sys

# Configuration
PIN_NUM = 6
NUM_LEDS = 64
BRIGHTNESS_FACTOR = 0.02  # Adjust brightness (0.0 to 1.0)

# Setup NeoPixel
np = neopixel.NeoPixel(machine.Pin(PIN_NUM), NUM_LEDS)

# Setup Onboard LED for status (Pin 25 for Pico, "LED" for Pico W)
led = None
try:
    led = machine.Pin(25, machine.Pin.OUT)
except:
    try:
        led = machine.Pin("LED", machine.Pin.OUT)
    except:
        print("Onboard LED not found, continuing without it")

def set_color(r, g, b):
    # Apply brightness scaling
    r = int(r * BRIGHTNESS_FACTOR)
    g = int(g * BRIGHTNESS_FACTOR)
    b = int(b * BRIGHTNESS_FACTOR)
    
    for i in range(NUM_LEDS):
        np[i] = (r, g, b)
    np.write()
    print(f"Color set: R={r} G={g} B={b}")

print("Ready to receive RGB values (format: R,G,B)")

while True:
    line = sys.stdin.readline().strip().replace(' ', '')
    if not line:
        continue

    try:
        parts = line.split(',')
        if len(parts) == 3:
            r = int(parts[0])
            g = int(parts[1])
            b = int(parts[2])
            set_color(r, g, b)
            if led:
                led.toggle()
    except ValueError:
        pass
    except Exception:
        pass