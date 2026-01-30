import machine
import neopixel
import sys
import time

# Configuration
PIN_NUM = 6
NUM_LEDS = 64
BRIGHTNESS_FACTOR = 0.02  # Adjust brightness (0.0 to 1.0)

# Setup NeoPixel
np = neopixel.NeoPixel(machine.Pin(PIN_NUM), NUM_LEDS)

# Setup Onboard LED for status (Pin 25 is standard for Pico)
try:
    led = machine.Pin(25, machine.Pin.OUT)
except Exception:
    led = None
    print("PICO: Onboard LED not found (Pin 25)")

# Try to create a poller for non-blocking stdin reads
have_poll = False
try:
    import uselect as select
    poll_obj = select.poll()
    try:
        poll_obj.register(sys.stdin, select.POLLIN)
        have_poll = True
    except Exception:
        have_poll = False
except Exception:
    have_poll = False


def safe_flush():
    """Flush stdout if available, otherwise ignore safely."""
    try:
        if hasattr(sys, 'stdout') and hasattr(sys.stdout, 'flush'):
            sys.stdout.flush()
        else:
            # Fallback: attempt a no-op write
            try:
                sys.stdout.write('')
            except Exception:
                pass
    except Exception:
        # Ultimately ignore flush errors on constrained ports
        pass


def set_color(r, g, b):
    # Apply brightness scaling
    r = int(r * BRIGHTNESS_FACTOR)
    g = int(g * BRIGHTNESS_FACTOR)
    b = int(b * BRIGHTNESS_FACTOR)

    for i in range(NUM_LEDS):
        np[i] = (r, g, b)
    print(f"PICO: Setting color to R:{r} G:{g} B:{b}")
    safe_flush()
    np.write()


print("PICO: main.py starting — heartbeat + non-blocking serial reads")
safe_flush()

# Buffer for incoming data when reading from serial
buffer = ""
heartbeat_counter = 0
heartbeat_interval = 1.0  # seconds

while True:
    # Toggle onboard LED as a heartbeat (so we don't rely on incoming serial)
    heartbeat_counter += 1
    if led is not None:
        try:
            # Use value() read/set to avoid depending on toggle() method
            led.value(not led.value())
        except Exception:
            pass

    # Non-blocking check for serial input if possible
    line = None
    if have_poll:
        try:
            events = poll_obj.poll(10)  # 10ms
            if events:
                # read a single line (non-blocking since poll indicated data)
                raw = sys.stdin.readline()
                if raw:
                    line = raw.replace('\r', '').replace('\n', '').strip()
        except Exception:
            # If polling fails, fall back to no-read mode
            have_poll = False

    # Process a received line (format expected: R,G,B)
    if line:
        print(f"PICO: Received LINE -> {line}")
        safe_flush()
        try:
            parts = line.split(',')
            if len(parts) == 3:
                r = int(parts[0])
                g = int(parts[1])
                b = int(parts[2])
                set_color(r, g, b)
                # Indicate receipt by briefly toggling the LED
                if led is not None:
                    try:
                        led.value(1)
                        time.sleep(0.05)
                        led.value(0)
                    except Exception:
                        pass
        except ValueError:
            print("PICO: Received non-RGB line")
            safe_flush()
        except Exception as e:
            print("PICO: Error processing line:", e)
            safe_flush()

    # Print a periodic heartbeat so the browser-side reader sees output
    #print("PICO: heartbeat")
    safe_flush()
    time.sleep(heartbeat_interval)