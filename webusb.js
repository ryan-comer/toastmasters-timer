/**
 * WebUSB Manager Class
 * Provides a simple interface for connecting to and communicating with USB devices
 * using the WebUSB API in Chrome extensions.
 */
class WebUSBManager {
  constructor(options = {}) {
    this.device = null;
    this.isConnected = false;
    this.configuration = 1;
    this.interface = 0;
    this.endpoint = {
      in: 1,
      out: 2
    };
    
    // Configuration options
    this.options = {
      vendorId: options.vendorId || null,
      productId: options.productId || null,
      filters: options.filters || [],
      timeout: options.timeout || 5000,
      debug: options.debug || false,
      ...options
    };
    
    this.log('WebUSB Manager initialized', this.options);
  }

  /**
   * Request permission and connect to a USB device
   * @param {Object} filters - Optional filters for device selection
   * @returns {Promise<boolean>} - Connection success status
   */
  async connect(filters = null) {
    try {
      this.log('Requesting USB device...');
      
      // Use provided filters or default options
      const deviceFilters = filters || this.options.filters;
      
      // If no filters provided, create basic filter from vendor/product IDs
      if (deviceFilters.length === 0 && (this.options.vendorId || this.options.productId)) {
        const filter = {};
        if (this.options.vendorId) filter.vendorId = this.options.vendorId;
        if (this.options.productId) filter.productId = this.options.productId;
        deviceFilters.push(filter);
      }

      // Request device from user
      this.device = await navigator.usb.requestDevice({
        filters: deviceFilters
      });

      this.log('Device selected:', this.device);

      // Open the device
      await this.device.open();
      this.log('Device opened');

      // Select configuration
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(this.configuration);
        this.log(`Configuration ${this.configuration} selected`);
      }

      // Claim interface
      await this.device.claimInterface(this.interface);
      this.log(`Interface ${this.interface} claimed`);

      this.isConnected = true;
      this.log('Successfully connected to device');
      return true;

    } catch (error) {
      this.log('Connection failed:', error);
      this.isConnected = false;
      throw new Error(`Failed to connect to USB device: ${error.message}`);
    }
  }

  /**
   * Disconnect from the USB device
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.device && this.isConnected) {
        await this.device.releaseInterface(this.interface);
        await this.device.close();
        this.log('Device disconnected');
      }
      
      this.device = null;
      this.isConnected = false;
    } catch (error) {
      this.log('Disconnect error:', error);
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  }

  /**
   * Write data to the USB device
   * @param {Uint8Array|Array|string} data - Data to write
   * @param {number} endpoint - Optional endpoint number (defaults to out endpoint)
   * @returns {Promise<USBOutTransferResult>}
   */
  async write(data, endpoint = null) {
    if (!this.isConnected || !this.device) {
      throw new Error('Device not connected');
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

      const ep = endpoint || this.endpoint.out;
      this.log(`Writing ${buffer.length} bytes to endpoint ${ep}:`, Array.from(buffer));

      const result = await this.device.transferOut(ep, buffer);
      this.log('Write result:', result);
      
      return result;
    } catch (error) {
      this.log('Write error:', error);
      throw new Error(`Failed to write data: ${error.message}`);
    }
  }

  /**
   * Read data from the USB device
   * @param {number} length - Number of bytes to read
   * @param {number} endpoint - Optional endpoint number (defaults to in endpoint)
   * @returns {Promise<Uint8Array>} - Data received from device
   */
  async read(length = 64, endpoint = null) {
    if (!this.isConnected || !this.device) {
      throw new Error('Device not connected');
    }

    try {
      const ep = endpoint || this.endpoint.in;
      this.log(`Reading ${length} bytes from endpoint ${ep}`);

      const result = await this.device.transferIn(ep, length);
      
      if (result.status === 'ok' && result.data) {
        const data = new Uint8Array(result.data.buffer);
        this.log('Read result:', Array.from(data));
        return data;
      } else {
        throw new Error(`Read failed with status: ${result.status}`);
      }
    } catch (error) {
      this.log('Read error:', error);
      throw new Error(`Failed to read data: ${error.message}`);
    }
  }

  /**
   * Read data as a string (UTF-8 decoded)
   * @param {number} length - Number of bytes to read
   * @param {number} endpoint - Optional endpoint number
   * @returns {Promise<string>} - String data from device
   */
  async readString(length = 64, endpoint = null) {
    const data = await this.read(length, endpoint);
    return new TextDecoder().decode(data).replace(/\0+$/, ''); // Remove null terminators
  }

  /**
   * Write string data to device
   * @param {string} text - Text to write
   * @param {number} endpoint - Optional endpoint number
   * @returns {Promise<USBOutTransferResult>}
   */
  async writeString(text, endpoint = null) {
    return await this.write(text, endpoint);
  }

  /**
   * Send a command and wait for response
   * @param {Uint8Array|Array|string} command - Command to send
   * @param {number} responseLength - Expected response length
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
   * Get device information
   * @returns {Object} - Device information object
   */
  getDeviceInfo() {
    if (!this.device) {
      return null;
    }

    return {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      productName: this.device.productName,
      manufacturerName: this.device.manufacturerName,
      serialNumber: this.device.serialNumber,
      usbVersionMajor: this.device.usbVersionMajor,
      usbVersionMinor: this.device.usbVersionMinor,
      usbVersionSubminor: this.device.usbVersionSubminor,
      deviceClass: this.device.deviceClass,
      deviceSubclass: this.device.deviceSubclass,
      deviceProtocol: this.device.deviceProtocol,
      configurations: this.device.configurations?.map(config => ({
        configurationValue: config.configurationValue,
        configurationName: config.configurationName,
        interfaces: config.interfaces?.map(iface => ({
          interfaceNumber: iface.interfaceNumber,
          alternates: iface.alternates?.map(alt => ({
            alternateSetting: alt.alternateSetting,
            interfaceClass: alt.interfaceClass,
            interfaceSubclass: alt.interfaceSubclass,
            interfaceProtocol: alt.interfaceProtocol,
            endpoints: alt.endpoints?.map(ep => ({
              endpointNumber: ep.endpointNumber,
              direction: ep.direction,
              type: ep.type,
              packetSize: ep.packetSize
            }))
          }))
        }))
      }))
    };
  }

  /**
   * Set endpoint numbers for communication
   * @param {number} inEndpoint - IN endpoint number
   * @param {number} outEndpoint - OUT endpoint number
   */
  setEndpoints(inEndpoint, outEndpoint) {
    this.endpoint.in = inEndpoint;
    this.endpoint.out = outEndpoint;
    this.log(`Endpoints set - IN: ${inEndpoint}, OUT: ${outEndpoint}`);
  }

  /**
   * Set interface and configuration numbers
   * @param {number} interfaceNumber - Interface number to use
   * @param {number} configurationNumber - Configuration number to use
   */
  setInterface(interfaceNumber, configurationNumber = 1) {
    this.interface = interfaceNumber;
    this.configuration = configurationNumber;
    this.log(`Interface set - Interface: ${interfaceNumber}, Configuration: ${configurationNumber}`);
  }

  /**
   * Check if WebUSB is supported
   * @returns {boolean} - WebUSB support status
   */
  static isSupported() {
    return 'usb' in navigator;
  }

  /**
   * Get list of already paired devices
   * @returns {Promise<Array>} - Array of paired devices
   */
  static async getPairedDevices() {
    if (!WebUSBManager.isSupported()) {
      throw new Error('WebUSB not supported');
    }
    
    return await navigator.usb.getDevices();
  }

  /**
   * Internal logging function
   * @param {...any} args - Arguments to log
   */
  log(...args) {
    if (this.options.debug) {
      console.log('[WebUSB]', ...args);
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebUSBManager;
} else if (typeof window !== 'undefined') {
  window.WebUSBManager = WebUSBManager;
}