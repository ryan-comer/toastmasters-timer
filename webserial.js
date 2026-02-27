/**
 * WebSerial Manager Class
 * Provides a simple interface for connecting to and communicating with serial devices
 * using the Web Serial API (navigator.serial).
 */
class WebSerialManager {
  constructor(options = {}) {
    this.port = null;
    this.isConnected = false;
    this._readLoopActive = false;
    this._readLoopReader = null;

    const {
      vendorId,
      productId,
      usbVendorId,
      usbProductId,
      filters = [],
      baudRate = 9600,
      dataBits = 8,
      stopBits = 1,
      parity = 'none',
      bufferSize = 255,
      flowControl = 'none',
      timeout = 5000,
      debug = false
    } = options;

    // Configuration options
    this.options = {
      usbVendorId: usbVendorId ?? vendorId ?? null,
      usbProductId: usbProductId ?? productId ?? null,
      filters: [...filters],
      baudRate,
      dataBits,
      stopBits,
      parity,
      bufferSize,
      flowControl,
      timeout,
      debug
    };

    this.log('WebSerial Manager initialized', this.options);
  }

  /**
   * Request permission and connect to a Serial device
   * @param {Object[]} filters - Optional WebSerial filters [{ usbVendorId, usbProductId }]
   * @returns {Promise<boolean>} - Connection success status
   */
  async connect(filters = null) {
    if (!WebSerialManager.isSupported()) {
      throw new Error('Web Serial API not supported in this browser');
    }

    try {
      this.log('Requesting Serial port...');

      const deviceFilters = filters || this.options.filters;

      // If no filters provided, create basic filter from vendor/product IDs
      if (
        deviceFilters.length === 0 &&
        (this.options.usbVendorId || this.options.usbProductId)
      ) {
        const filter = {};
        if (this.options.usbVendorId) filter.usbVendorId = this.options.usbVendorId;
        if (this.options.usbProductId) filter.usbProductId = this.options.usbProductId;
        deviceFilters.push(filter);
      }

      // Request port from user
      this.port = await navigator.serial.requestPort({
        filters: deviceFilters
      });

      this.log('Port selected:', this.port);

      // Open the port with the configured serial settings
      await this.port.open({
        baudRate: this.options.baudRate,
        dataBits: this.options.dataBits,
        stopBits: this.options.stopBits,
        parity: this.options.parity,
        bufferSize: this.options.bufferSize,
        flowControl: this.options.flowControl
      });

      this.log('Port opened with settings:', {
        baudRate: this.options.baudRate,
        dataBits: this.options.dataBits,
        stopBits: this.options.stopBits,
        parity: this.options.parity,
        bufferSize: this.options.bufferSize,
        flowControl: this.options.flowControl
      });

      this.isConnected = true;
      this.log('Successfully connected to serial device');
      return true;
    } catch (error) {
      this.log('Connection failed:', error);
      this.isConnected = false;
      throw new Error(`Failed to connect to serial device: ${error.message}`);
    }
  }

  /**
   * Disconnect from the Serial device
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.port && this.isConnected) {
        // Close readable/writable streams implicitly by closing the port
        await this.port.close();
        this.log('Port disconnected');
      }

      this.port = null;
      this.isConnected = false;
    } catch (error) {
      this.log('Disconnect error:', error);
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  }

  /**
   * Write data to the Serial device
   * @param {Uint8Array|Array|string} data - Data to write
   * @returns {Promise<void>}
   */
  async write(data) {
    if (!this.isConnected || !this.port || !this.port.writable) {
      throw new Error('Device not connected or not writable');
    }

    try {
      // Convert data to Uint8Array if necessary
      let buffer;
      if (typeof data === 'string') {
        buffer = new TextEncoder().encode(data);
      } else if (Array.isArray(data)) {
        buffer = new Uint8Array(data);
      } else if (data instanceof Uint8Array) {
        buffer = data;
      } else {
        throw new Error('Invalid data type. Use string, array, or Uint8Array');
      }

      this.log(`Writing ${buffer.length} bytes:`, Array.from(buffer));

      const writer = this.port.writable.getWriter();
      await writer.write(buffer);
      writer.releaseLock();

      this.log('Write complete');
    } catch (error) {
      this.log('Write error:', error);
      throw new Error(`Failed to write data: ${error.message}`);
    }
  }

  /**
   * Read data from the Serial device
   * @param {number} length - Number of bytes to read (maximum)
   * @returns {Promise<Uint8Array>} - Data received from device
   */
  async read(length = 64) {
    if (!this.isConnected || !this.port || !this.port.readable) {
      throw new Error('Device not connected or not readable');
    }

    const reader = this.port.readable.getReader();
    try {
      this.log(`Reading up to ${length} bytes from serial port`);

      const chunks = [];
      let total = 0;

      while (total < length) {
        const { value, done } = await reader.read();
        if (done) {
          this.log('Stream closed by device while reading');
          break;
        }
        if (value) {
          const chunk =
            value instanceof Uint8Array ? value : new Uint8Array(value);
          chunks.push(chunk);
          total += chunk.length;
          if (total >= length) break;
        }
      }

      if (chunks.length === 0) {
        this.log('No data received');
        return new Uint8Array(0);
      }

      const result = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      const trimmed =
        total > length ? result.subarray(0, length) : result;

      this.log('Read result:', Array.from(trimmed));
      return trimmed;
    } catch (error) {
      this.log('Read error:', error);
      throw new Error(`Failed to read data: ${error.message}`);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Read data as a string (UTF-8 decoded)
   * @param {number} length - Number of bytes to read
   * @returns {Promise<string>} - String data from device
   */
  async readString(length = 64) {
    const data = await this.read(length);
    return new TextDecoder().decode(data).replace(/\0+$/, ''); // Remove null terminators
  }

  /**
   * Send a command and wait for response
   * @param {Uint8Array|Array|string} command - Command to send
   * @param {number} responseLength - Expected response length (max bytes)
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Uint8Array>} - Response data
   */
  async sendCommand(command, responseLength = 64, timeout = null) {
    const timeoutMs = timeout || this.options.timeout;

    try {
      // Send command
      await this.write(command);

      // Wait for response with timeout
      const responsePromise = this.read(responseLength);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Command timeout')), timeoutMs)
      );

      const response = await Promise.race([responsePromise, timeoutPromise]);
      return response;
    } catch (error) {
      this.log('Send command error:', error);
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  /**
   * Start a background read loop that continuously reads from the serial port
   * and logs received lines to the console. Call stopReadLoop() before disconnect.
   * @param {function} [onLine] - Optional callback invoked with each received line
   */
  startReadLoop(onLine = null) {
    if (this._readLoopActive) return;
    if (!this.isConnected || !this.port || !this.port.readable) {
      this.log('Cannot start read loop — port not readable');
      return;
    }

    this._readLoopActive = true;
    const decoder = new TextDecoder();
    let buffer = '';

    const loop = async () => {
      try {
        while (this._readLoopActive && this.port && this.port.readable) {
          this._readLoopReader = this.port.readable.getReader();
          try {
            while (this._readLoopActive) {
              const { value, done } = await this._readLoopReader.read();
              if (done) break;
              if (value) {
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete trailing data in buffer
                for (const line of lines) {
                  const trimmed = line.replace(/\r$/, '');
                  if (trimmed.length === 0) continue;
                  console.log(`[Serial RX] ${trimmed}`);
                  if (onLine) onLine(trimmed);
                }
              }
            }
          } finally {
            this._readLoopReader.releaseLock();
            this._readLoopReader = null;
          }
        }
      } catch (error) {
        if (this._readLoopActive) {
          this.log('Read loop error:', error);
        }
      }
      this._readLoopActive = false;
      this.log('Read loop stopped');
    };

    loop();
    this.log('Read loop started');
  }

  /**
   * Stop the background read loop
   */
  async stopReadLoop() {
    this._readLoopActive = false;
    if (this._readLoopReader) {
      try {
        await this._readLoopReader.cancel();
      } catch (e) {
        this.log('Error cancelling reader:', e);
      }
      this._readLoopReader = null;
    }
  }

  /**
   * Get device information (limited vs WebUSB)
   * @returns {Object|null} - Device information object
   */
  getDeviceInfo() {
    if (!this.port || typeof this.port.getInfo !== 'function') {
      return null;
    }

    const info = this.port.getInfo();
    return {
      usbVendorId: info.usbVendorId ?? null,
      usbProductId: info.usbProductId ?? null
      // Web Serial doesn't expose as much info as WebUSB
    };
  }

  /**
   * Check if Web Serial is supported
   * @returns {boolean} - Web Serial support status
   */
  static isSupported() {
    return 'serial' in navigator;
  }

  /**
   * Get list of already paired Serial ports
   * @returns {Promise<Array<SerialPort>>} - Array of ports
   */
  static async getPairedDevices() {
    if (!WebSerialManager.isSupported()) {
      throw new Error('Web Serial not supported');
    }

    return await navigator.serial.getPorts();
  }

  /**
   * Internal logging function
   * @param {...any} args - Arguments to log
   */
  log(...args) {
    if (this.options.debug) {
      console.log('[WebSerial]', ...args);
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSerialManager;
} else if (typeof window !== 'undefined') {
  window.WebSerialManager = WebSerialManager;
}
