import machine
import neopixel
import select
import sys
import time

# Configuration
PIN_NUM = 4
NUM_LEDS = 64
BRIGHTNESS_FACTOR = 0.1  # Adjust brightness (0.0 to 1.0)

# Setup NeoPixel
np = neopixel.NeoPixel(machine.Pin(PIN_NUM), NUM_LEDS)

# Setup Onboard LED for status (Pin 25 is standard for Pico, use "LED" for Pico W)
try:
    led = machine.Pin("LED", machine.Pin.OUT)
except:
    led = machine.Pin(25, machine.Pin.OUT)

# Setup Poll for stdin
poll_obj = select.poll()
poll_obj.register(sys.stdin, select.POLLIN)

def set_color(r, g, b):
    # Apply brightness scaling
    r = int(r * BRIGHTNESS_FACTOR)
    g = int(g * BRIGHTNESS_FACTOR)
    b = int(b * BRIGHTNESS_FACTOR)
    
    for i in range(NUM_LEDS):
        np[i] = (r, g, b)
    np.write()

print("Ready to receive RGB values (format: R,G,B)")

# Buffer for incoming data
buffer = ""

while True:
    # Check if data is available
    poll_results = poll_obj.poll(10) # 10ms timeout
    
    if poll_results:
        # Read character by character to handle potential fragmentation
        char = sys.stdin.read(1)
        if char:
            if char == '\n':
                # Process the complete line
                try:
                    # Remove whitespace
                    line = buffer.strip()
                    if line:
                        parts = line.split(',')
                        if len(parts) == 3:
                            r = int(parts[0])
                            g = int(parts[1])
                            b = int(parts[2])
                            set_color(r, g, b)
                            # Blink onboard LED to indicate receipt
                            led.toggle()
                except ValueError:
                    pass # Ignore parse errors
                except Exception as e:
                    pass # Ignore other errors
                
                # Reset buffer
                buffer = ""
            else:
                buffer += char
