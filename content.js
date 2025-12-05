// Toastmasters Timer Monitor Content Script
console.log('Toastmasters Timer Monitor extension loaded');

class TimerMonitor {
  constructor() {
    this.lastTimerValue = null;
    this.lastColorValue = null;
    this.timerElement = null;
    this.observer = null;
    this.onTimerChangeCallback = null;
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
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // Also check periodically in case changes aren't captured by mutation observer
    this.intervalId = setInterval(() => {
      // Check if element is still connected or replaced
      if (this.timerElement) {
        // If we found it by ID, check if the ID still points to the same element
        if (this.timerElement.id === 'timeDiv') {
          const currentEl = document.getElementById('timeDiv');
          if (currentEl && currentEl !== this.timerElement) {
            console.log('Timer element replaced in DOM (ID match), updating reference...');
            this.updateTimerElement(currentEl);
            return;
          }
        }
        
        // Check if element is disconnected
        if (!this.timerElement.isConnected) {
          console.log('Timer element disconnected, searching again...');
          this.destroy(true); // true = keep callback
          this.timerElement = null;
          this.init(); // Restart search
          return;
        }
      }
      
      this.checkForTimeChange();
    }, 100); // Check every 100ms

    console.log('Timer monitoring started on:', this.timerElement);
  }

  updateTimerElement(newElement) {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.timerElement = newElement;
    
    // Re-attach observer
    this.observer = new MutationObserver((mutations) => {
      this.checkForTimeChange();
    });
    
    this.observer.observe(this.timerElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    console.log('Timer element reference updated:', this.timerElement);
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
      // Skip script and style tags
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') continue;
      
      // Check direct text content only to avoid matching container elements
      const text = Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join('')
        .trim();
        
      if (this.isTimeFormat(text)) {
        console.log('Timer element identified dynamically:', element);
        this.timerElement = element;
        
        // Stop the global observer
        if (this.observer) {
          this.observer.disconnect();
        }
        
        // Switch to focused monitoring
        this.startMonitoring();
        return;
      }
    }
  }

  getTimerValue() {
    if (!this.timerElement) return null;
    
    // Try multiple ways to get the text content
    let text = this.timerElement.textContent || this.timerElement.innerText || '';
    
    // If empty, try checking child nodes specifically
    if (!text.trim()) {
      text = Array.from(this.timerElement.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join('');
    }
    
    return text.trim();
  }

  getTimerColor() {
    if (!this.timerElement) return null;
    
    // Traverse up to find the background color
    let currentElement = this.timerElement;
    while (currentElement) {
      const style = window.getComputedStyle(currentElement);
      const bgColor = style.backgroundColor;
      
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        return bgColor;
      }
      
      currentElement = currentElement.parentElement;
    }
    
    return 'rgb(0, 0, 0)'; // Default to black if nothing found
  }

  checkForTimeChange() {
    const currentValue = this.getTimerValue();
    const currentColor = this.getTimerColor();
    
    if ((currentValue && currentValue !== this.lastTimerValue) || 
        (currentColor && currentColor !== this.lastColorValue)) {
      
      console.log('Timer update:', {
        time: currentValue,
        color: currentColor,
        previousTime: this.lastTimerValue,
        previousColor: this.lastColorValue,
        timestamp: new Date().toISOString()
      });
      
      // Notify callback if registered
      if (this.onTimerChangeCallback) {
        this.onTimerChangeCallback(currentValue, currentColor);
      }
      
      this.lastTimerValue = currentValue;
      this.lastColorValue = currentColor;
    }
  }

  // Register a callback for timer changes
  setTimerChangeCallback(callback) {
    this.onTimerChangeCallback = callback;
    console.log('Timer change callback registered');
    
    // Send current timer value immediately if available
    if (this.lastTimerValue && callback) {
      callback(this.lastTimerValue, this.lastColorValue || this.getTimerColor());
    }
  }

  destroy(keepCallback = false) {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (!keepCallback) {
      this.onTimerChangeCallback = null;
    }
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
