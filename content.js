// Toastmasters Timer Monitor Content Script
console.log('Toastmasters Timer Monitor extension loaded');

class TimerMonitor {
  constructor() {
    this.lastTimerValue = null;
    this.lastColorValue = null;
    
    // Track time and color elements separately for robustness
    this.timeElement = null;
    this.colorElement = null;
    
    this.observers = [];
    this.intervalId = null;
    this.onTimerChangeCallback = null;
    
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.findTimerElements());
    } else {
      this.findTimerElements();
    }
  }

  findTimerElements() {
    // 1. Look for the specific Toastmasters elements based on the known HTML structure
    // HTML: <div id="timergrid" ...><div id="timeDiv">01:07</div>...</div>
    const timeDiv = document.getElementById('timeDiv');
    const timerGrid = document.getElementById('timergrid');

    if (timeDiv) {
      this.timeElement = timeDiv;
      // If timergrid exists, use it for color. Otherwise fallback to timeDiv (and traverse up later)
      this.colorElement = timerGrid || timeDiv; 
      
      console.log('Toastmasters timer elements found:', { 
        time: this.timeElement, 
        color: this.colorElement 
      });
      
      this.startMonitoring();
      return;
    }
    
    // 2. Fallback: Try to find any element that looks like a timer
    console.log('Standard timer elements (timeDiv) not found, attempting generic search...');
    this.findGenericTimerElement();
  }

  findGenericTimerElement() {
    // Common selectors for timer displays
    const timerSelectors = [
      '[class*="timer"]',
      '[id*="timer"]',
      '.countdown',
      '.clock'
    ];

    for (const selector of timerSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (this.isTimeFormat(element.textContent)) {
          this.timeElement = element;
          this.colorElement = element;
          console.log('Generic timer element found:', element);
          this.startMonitoring();
          return;
        }
      }
    }
    
    // If still not found, monitor document for future additions
    this.monitorDocumentForTimer();
  }

  monitorDocumentForTimer() {
    console.log('Monitoring document for timer appearance...');
    const docObserver = new MutationObserver(() => {
      const timeDiv = document.getElementById('timeDiv');
      if (timeDiv) {
        docObserver.disconnect();
        this.findTimerElements();
      }
    });
    
    docObserver.observe(document.body, { childList: true, subtree: true });
    this.observers.push(docObserver);
  }

  startMonitoring() {
    this.stopMonitoring(); // Clear existing observers/intervals

    if (!this.timeElement) {
      console.log('No timer element to monitor');
      return;
    }

    // Initial values
    this.lastTimerValue = this.getTimerValue();
    this.lastColorValue = this.getTimerColor();
    console.log('Initial state:', { time: this.lastTimerValue, color: this.lastColorValue });

    // 1. Observe Time Element for text changes
    const timeObserver = new MutationObserver(() => this.check());
    timeObserver.observe(this.timeElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
    this.observers.push(timeObserver);

    // 2. Observe Color Element for attribute changes (style/class)
    if (this.colorElement) {
      const colorObserver = new MutationObserver(() => this.check());
      colorObserver.observe(this.colorElement, {
        attributes: true,
        attributeFilter: ['style', 'class', 'background']
      });
      this.observers.push(colorObserver);
    }

    // 3. Polling fallback (robustness)
    // Checks every 200ms to ensure we catch changes even if MutationObserver misses something
    // or if the element is replaced entirely
    this.intervalId = setInterval(() => {
      // Check if elements are still valid/connected
      if (!this.timeElement.isConnected) {
        console.log('Timer element disconnected, rescanning...');
        this.stopMonitoring();
        this.findTimerElements();
        return;
      }
      
      // Also check if the ID 'timeDiv' has moved to a new element (React/Framework re-renders)
      if (this.timeElement.id === 'timeDiv') {
        const currentEl = document.getElementById('timeDiv');
        if (currentEl && currentEl !== this.timeElement) {
          console.log('timeDiv element replaced, re-binding...');
          this.stopMonitoring();
          this.findTimerElements();
          return;
        }
      }

      this.check();
    }, 200);
  }

  stopMonitoring() {
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getTimerValue() {
    if (!this.timeElement) return '';
    return (this.timeElement.textContent || this.timeElement.innerText || '').trim();
  }

  getTimerColor() {
    if (!this.colorElement) return 'rgb(0, 0, 0)';
    
    // If we have the specific timergrid, check it directly
    // The HTML uses inline style="background: rgb(...)" which getComputedStyle handles well
    const style = window.getComputedStyle(this.colorElement);
    let bg = style.backgroundColor;

    // If the specific element doesn't have a background, traverse up
    // (Useful if colorElement is just timeDiv and we need to find the container)
    if ((!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && this.colorElement !== document.body) {
      let el = this.colorElement.parentElement;
      while (el) {
        const parentStyle = window.getComputedStyle(el);
        const parentBg = parentStyle.backgroundColor;
        if (parentBg && parentBg !== 'rgba(0, 0, 0, 0)' && parentBg !== 'transparent') {
          return parentBg;
        }
        el = el.parentElement;
      }
    }
    
    return bg || 'rgb(0, 0, 0)';
  }

  check() {
    const time = this.getTimerValue();
    const color = this.getTimerColor();

    if (time !== this.lastTimerValue || color !== this.lastColorValue) {
      console.log(`Timer Update: ${time} [${color}]`);
      
      if (this.onTimerChangeCallback) {
        this.onTimerChangeCallback(time, color);
      }
      
      this.lastTimerValue = time;
      this.lastColorValue = color;
    }
  }
  
  setTimerChangeCallback(callback) {
    this.onTimerChangeCallback = callback;
    // Send immediate update if we have data
    if (callback && this.lastTimerValue) {
      callback(this.lastTimerValue, this.lastColorValue || this.getTimerColor());
    }
  }

  isTimeFormat(text) {
    if (!text) return false;
    return /^\d{1,2}:\d{2}/.test(text.trim());
  }
  
  destroy() {
    this.stopMonitoring();
    this.onTimerChangeCallback = null;
  }
}

// Initialize
const timerMonitor = new TimerMonitor();

// Cleanup
window.addEventListener('beforeunload', () => {
  timerMonitor.destroy();
});

// Expose for debugging/popup
window.timerMonitor = timerMonitor;
