// Toastmasters Timer Monitor Content Script
console.log('Toastmasters Timer Monitor extension loaded');

class TimerMonitor {
  constructor() {
    this.lastTimerValue = null;
    this.timerElement = null;
    this.observer = null;
    this.usbSerial = null;     // was usbManager
    this.usbEnabled = false;
    this.init();
  }

  init() {
    // Wait for the page to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.findTimerElement());
    } else {
      this.findTimerElement();
    }
  }

  findTimerElement() {
    // Directly target known timer ID
    const el = document.getElementById('timeDiv');
    if (el) {
      this.timerElement = el;
      console.log('Timer element found by ID timeDiv:', el);
      this.startMonitoring();
      return;
    }
    
    // Common selectors for timer displays
    const timerSelectors = [
      '[class*="timer"]',
      '[id*="timer"]',
      '[class*="time"]',
      '[id*="time"]',
      '.countdown',
      '.clock',
      '[data-timer]',
      '[data-time]',
      // More specific patterns
      'div:contains(":")',
      'span:contains(":")',
      // Look for elements with time patterns (MM:SS format)
      '*[textContent*=":"]'
    ];

    // Try to find timer element using various methods
    for (const selector of timerSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent || element.innerText;
          if (this.isTimeFormat(text)) {
            this.timerElement = element;
            console.log('Timer element found:', element);
            console.log('Timer selector:', selector);
            this.startMonitoring();
            return;
          }
        }
      } catch (e) {
        // Skip invalid selectors
        continue;
      }
    }

    // If no timer found, try a more comprehensive search
    this.searchAllElements();
  }

  searchAllElements() {
    console.log('Performing comprehensive search for timer elements...');
    
    // Get all text nodes and elements
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            return this.isTimeFormat(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const timeNodes = [];
    let node;
    while (node = walker.nextNode()) {
      timeNodes.push(node.parentElement);
    }

    if (timeNodes.length > 0) {
      this.timerElement = timeNodes[0]; // Use the first found time element
      console.log('Timer element found via comprehensive search:', this.timerElement);
      this.startMonitoring();
    } else {
      console.log('No timer element found. Monitoring all text changes...');
      this.monitorAllChanges();
    }
  }

  isTimeFormat(text) {
    if (!text) return false;
    
    // Check for various time formats
    const timePatterns = [
      /^\d{1,2}:\d{2}$/,           // MM:SS or M:SS
      /^\d{1,2}:\d{2}:\d{2}$/,     // HH:MM:SS or H:MM:SS
      /^\d{1,2}:\d{2}\.\d+$/,      // MM:SS.ms
      /^\d+\.\d+$/,                // Seconds with decimal
      /^\d+:\d{2}$/                // Basic minute:second format
    ];

    return timePatterns.some(pattern => pattern.test(text.trim()));
  }

  startMonitoring() {
    if (!this.timerElement) {
      console.log('No timer element to monitor');
      return;
    }

    // Get initial value
    this.lastTimerValue = this.getTimerValue();
    console.log('Initial timer value:', this.lastTimerValue);

    // Set up mutation observer to watch for changes
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          this.checkForTimeChange();
        }
      });
    });

    // Start observing
    this.observer.observe(this.timerElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false
    });

    // Also check periodically in case changes aren't captured by mutation observer
    this.intervalId = setInterval(() => {
      this.checkForTimeChange();
    }, 100); // Check every 100ms

    console.log('Timer monitoring started');
  }

  monitorAllChanges() {
    // Fallback: monitor all changes in the document
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          this.checkAllElementsForTime();
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('Monitoring all document changes for timer updates');
  }

  checkAllElementsForTime() {
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const text = element.textContent || element.innerText;
      if (this.isTimeFormat(text) && text !== this.lastTimerValue) {
        console.log('Timer value changed:', {
          previous: this.lastTimerValue,
          current: text,
          element: element,
          timestamp: new Date().toISOString()
        });
        this.lastTimerValue = text;
      }
    }
  }

  getTimerValue() {
    if (!this.timerElement) return null;
    return (this.timerElement.textContent || this.timerElement.innerText || '').trim();
  }

  checkForTimeChange() {
    const currentValue = this.getTimerValue();
    
    if (currentValue && currentValue !== this.lastTimerValue) {
      console.log('Timer value changed:', {
        previous: this.lastTimerValue,
        current: currentValue,
        element: this.timerElement,
        timestamp: new Date().toISOString()
      });
      
      // Send to USB/Serial device if connected
      this.sendToUSB(currentValue);
      
      this.lastTimerValue = currentValue;
    }
  }

  // Enable USB/Serial synchronization
  enableUSBSync(usbSerial) {
    this.usbSerial = usbSerial;   // was this.usbManager
    this.usbEnabled = true;
    console.log('USB/Serial sync enabled');
    
    // Send current timer value immediately
    if (this.lastTimerValue) {
      this.sendToUSB(this.lastTimerValue);
    }
  }

  // Disable USB/Serial synchronization
  disableUSBSync() {
    this.usbSerial = null;        // was this.usbManager
    this.usbEnabled = false;
    console.log('USB/Serial sync disabled');
  }

  // Send timer value to USB/Serial device
  async sendToUSB(timerValue) {
    if (!this.usbEnabled || !this.usbSerial || !this.usbSerial.isConnected) {
      return;
    }

    try {
      const message = `TIMER:${timerValue}\n`;
      await this.usbSerial.writeString(message);
      console.log('Sent to USB/Serial:', message.trim());
    } catch (error) {
      console.error('USB/Serial send error:', error);
      // Optionally disable on error
      // this.disableUSBSync();
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.disableUSBSync();
  }
}

// Initialize the timer monitor
const timerMonitor = new TimerMonitor();

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
  timerMonitor.destroy();
});

// Also expose to window for debugging
window.timerMonitor = timerMonitor;
