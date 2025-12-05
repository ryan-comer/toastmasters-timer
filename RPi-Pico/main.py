import neopixel
import select
import sys
import machine
import time
import os
 
MAX_BUFFER = 16 #max buffer for reading timer values
BRIGHTNESS_FACTOR = 0.02

np = neopixel.NeoPixel(machine.Pin(4), 64)

# Set colors for individual LEDs
np[0] = (255, 0, 0) # Red
np[1] = (0, 128, 0) # Green (half brightness)
np[2] = (0, 0, 64) # Blue (quarter brightness)

led = machine.Pin(25, machine.Pin.OUT) #controls LED
pollObj = select.poll() #instantiate a poll object
pollObj.register(sys.stdin,1) #register stdin for monitoring read

buffer = [MAX_BUFFER]
y = 0
ledBlink = 1

#For things that need to be initialized
def initRPico():
    print("~Rpico Start~")

initRPico()

def blinkLed():
    led.value(not led.value())
    time.sleep(1)
    #ledBlink = not ledBlink
    #led.value(0)
    #time.sleep(1)

import time

def demo(np):
    n = np.n

    # Cycle animation
    for i in range(4 * n):
        for j in range(n):
            np[j] = (0, 0, 0)
        np[i % n] = (int(255*BRIGHTNESS_FACTOR), int(255*BRIGHTNESS_FACTOR), int(255*BRIGHTNESS_FACTOR))
        np.write()
        time.sleep_ms(25)

    # Bounce animation
    for i in range(4 * n):
        for j in range(n):
            np[j] = (0, 0, int(128*BRIGHTNESS_FACTOR))
        if (i // n) % 2 == 0:
            np[i % n] = (0, 0, 0)
        else:
            np[n - 1 - (i % n)] = (0, 0, 0)
        np.write()
        time.sleep_ms(60)

    # Fade in/out animation
    for i in range(0, 4 * 256, 8):
        for j in range(n):
            val = i & 0xff if (i // 256) % 2 == 0 else 255 - (i & 0xff)
            np[j] = (int(val*BRIGHTNESS_FACTOR), 0, 0)
        np.write()

    # Clear LEDs
    for i in range(n):
        np[i] = (0, 0, 0)
    np.write()
 
while True:
    '''
    #Check for data available on stdin
    if pollObj.poll(0):
        #buffer = sys.stdin.read(1) #read one character from stdin
        buffer = sys.stdin.buffer.read() #read entire buffer to stdin
        #buffer = os.read(0, 12) #0 specifies stdin, 12 describes length of buffer
        #if buffer == 'T':
        print("Message: ")
        print(buffer)
        print("Received this many bytes: ")
        print(len(buffer))
        blinkLed()
    '''

    ch = select.select([sys.stdin], [], [], 0).read(1) [^1^]
        if ch == 't':
            print("LED toggled")
        else:
            print("No data available")

    #demo(np)
    

   # time.sleep(0.1)
