/**
 * Universal Hardware Thermal Printer Manager for SomBill Cashier POS.
 *
 * Supports connecting and printing directly to ANY thermal printer hardware:
 *   1. USB Direct (WebUSB — Epson, Star, Xprinter, Rongta, BIXOLON, Sunmi, Gprinter, Hoin, POS-58/80)
 *   2. USB-Serial / COM / RS-232 (Web Serial — CP2102, CH340, FTDI, Prolific, BT-SPP COM ports)
 *   3. Bluetooth BLE (Web Bluetooth — portable 58mm/80mm thermal printers)
 *   4. Network / LAN / Wi-Fi (TCP:9100 via local print bridge OR Epson ePOS-Print HTTP XML)
 *   5. System / OS Driver (Browser 80mm / 58mm print fallback — works on every device)
 */
import type { ReceiptData } from '../features/receiptModel';
import {
  encodeCashDrawerKick,
  encodeEposXml,
  encodeReceiptWithOptions,
  encodeTestPage,
  type CutMode,
  type PaperWidthMm,
} from './escpos';

export type PrinterTransport = 'browser' | 'usb' | 'serial' | 'bluetooth' | 'network';
export type NetworkProtocol = 'bridge' | 'epos';
export type SerialBaudRate = 9600 | 19200 | 38400 | 57600 | 115200;

export interface PrinterSettings {
  transport: PrinterTransport;
  paperWidth: PaperWidthMm;
  cut: CutMode;
  copies: 1 | 2;
  openDrawerOnCash: boolean;
  beepOnPrint: boolean;
  autoPrintOnPay: boolean;
  serialBaudRate: SerialBaudRate;
  networkProtocol: NetworkProtocol;
  /** Local print bridge URL, e.g. http://localhost:9191/print */
  bridgeUrl: string;
  /** Thermal printer LAN IP address, e.g. 192.168.1.100 */
  networkHost: string;
  /** Thermal printer TCP port (usually 9100 for raw ESC/POS or 80 for ePOS). */
  networkPort: number;
}

export interface PrinterCapabilities {
  usb: boolean;
  serial: boolean;
  bluetooth: boolean;
  network: boolean;
  browser: boolean;
}

export interface PrinterSnapshot {
  settings: PrinterSettings;
  connected: boolean;
  deviceName: string | null;
  lastError: string | null;
  busy: boolean;
  capabilities: PrinterCapabilities;
}

const STORAGE_KEY = 'sombill.cashier.printer.v1';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  transport: 'browser',
  paperWidth: 80,
  cut: 'partial',
  copies: 1,
  openDrawerOnCash: false,
  beepOnPrint: false,
  autoPrintOnPay: false,
  serialBaudRate: 9600,
  networkProtocol: 'bridge',
  bridgeUrl: 'http://localhost:9191/print',
  networkHost: '192.168.1.100',
  networkPort: 9100,
};

// Standard BLE GATT service UUIDs used by 58mm/80mm Bluetooth thermal printers
const BLE_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic thermal printer (Xprinter, Rongta, Munbyn, Goojprt)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Microchip transparent UART (MTP-2/3, Hoin)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Star / Epson / Rongta BLE
  '0000ff00-0000-1000-8000-00805f9b34fb', // Common Chinese POS-58/80 BLE
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / transparent BLE serial
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
  '0000af30-0000-1000-8000-00805f9b34fb', // Sunmi / Gprinter BLE
];

// Minimal DOM interfaces for WebUSB, Web Serial, and Web Bluetooth (strict TS without extra @types deps)
interface UsbEndpointLike {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
}
interface UsbAlternateLike {
  interfaceClass: number;
  endpoints: UsbEndpointLike[];
}
interface UsbInterfaceLike {
  interfaceNumber: number;
  alternates: UsbAlternateLike[];
}
interface UsbConfigurationLike {
  configurationValue: number;
  interfaces: UsbInterfaceLike[];
}
interface UsbDeviceLike {
  productName?: string;
  manufacturerName?: string;
  opened: boolean;
  configuration: UsbConfigurationLike | null;
  configurations: UsbConfigurationLike[];
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (n: number) => Promise<void>;
  claimInterface: (n: number) => Promise<void>;
  releaseInterface: (n: number) => Promise<void>;
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<{ status: string }>;
}

interface SerialPortLike {
  open: (opts: { baudRate: number; dataBits?: number; stopBits?: number; parity?: 'none' | 'even' | 'odd' }) => Promise<void>;
  close: () => Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}

interface BleCharacteristicLike {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValueWithResponse?: (data: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>;
  writeValue?: (data: BufferSource) => Promise<void>;
}
interface BleServiceLike {
  getCharacteristics: () => Promise<BleCharacteristicLike[]>;
}
interface BleGattLike {
  connected: boolean;
  connect: () => Promise<BleGattLike>;
  disconnect: () => void;
  getPrimaryServices: () => Promise<BleServiceLike[]>;
}
interface BleDeviceLike {
  name?: string;
  gatt?: BleGattLike;
  addEventListener?: (type: string, listener: () => void) => void;
}

type ExtendedNavigator = Navigator & {
  usb?: {
    requestDevice: (opts: { filters: Array<{ classCode?: number; vendorId?: number }> }) => Promise<UsbDeviceLike>;
    getDevices: () => Promise<UsbDeviceLike[]>;
  };
  serial?: {
    requestPort: () => Promise<SerialPortLike>;
    getPorts: () => Promise<SerialPortLike[]>;
  };
  bluetooth?: {
    requestDevice: (opts: { acceptAllDevices?: boolean; optionalServices?: string[] }) => Promise<BleDeviceLike>;
  };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function detectPrinterCapabilities(): PrinterCapabilities {
  const nav = typeof navigator !== 'undefined' ? (navigator as ExtendedNavigator) : undefined;
  return {
    usb: Boolean(nav?.usb),
    serial: Boolean(nav?.serial),
    bluetooth: Boolean(nav?.bluetooth),
    network: typeof fetch === 'function',
    browser: typeof window !== 'undefined',
  };
}

function loadSettings(): PrinterSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_PRINTER_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PrinterSettings>;
    return { ...DEFAULT_PRINTER_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_PRINTER_SETTINGS };
  }
}

function saveSettings(s: PrinterSettings) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore storage quota errors */
  }
}

class ThermalPrinterManager {
  private settings: PrinterSettings = loadSettings();
  private usbDevice: UsbDeviceLike | null = null;
  private usbInterface: number | null = null;
  private usbEndpointOut: number | null = null;
  private serialPort: SerialPortLike | null = null;
  private serialOpen = false;
  private bleDevice: BleDeviceLike | null = null;
  private bleChar: BleCharacteristicLike | null = null;
  private deviceName: string | null = null;
  private lastError: string | null = null;
  private busy = false;
  private listeners = new Set<() => void>();
  private snapshot: PrinterSnapshot;

  constructor() {
    this.snapshot = this.buildSnapshot();
    if (this.settings.transport === 'network' && this.settings.networkHost.trim()) {
      this.deviceName = `${this.settings.networkHost}:${this.settings.networkPort}`;
      this.snapshot = this.buildSnapshot();
    }
  }

  private buildSnapshot(): PrinterSnapshot {
    const connected =
      this.settings.transport === 'browser'
        ? true
        : this.settings.transport === 'usb'
          ? Boolean(this.usbDevice && this.usbEndpointOut !== null)
          : this.settings.transport === 'serial'
            ? Boolean(this.serialPort)
            : this.settings.transport === 'bluetooth'
              ? Boolean(this.bleDevice?.gatt?.connected && this.bleChar)
              : Boolean(this.settings.networkHost.trim());
    return {
      settings: this.settings,
      connected,
      deviceName:
        this.settings.transport === 'browser'
          ? `System Driver (${this.settings.paperWidth}mm)`
          : this.settings.transport === 'network'
            ? this.settings.networkHost.trim()
              ? `LAN ${this.settings.networkHost}:${this.settings.networkPort}`
              : null
            : this.deviceName,
      lastError: this.lastError,
      busy: this.busy,
      capabilities: detectPrinterCapabilities(),
    };
  }

  private emit() {
    this.snapshot = this.buildSnapshot();
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PrinterSnapshot => this.snapshot;

  updateSettings(patch: Partial<PrinterSettings>) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.lastError = null;
    this.emit();
  }

  /** Attempt silent auto-reconnect to previously authorized USB or Serial thermal printer. */
  async tryAutoReconnect(): Promise<boolean> {
    const nav = typeof navigator !== 'undefined' ? (navigator as ExtendedNavigator) : undefined;
    if (!nav) return false;
    try {
      if (this.settings.transport === 'usb' && nav.usb && !this.usbDevice) {
        const [first] = await nav.usb.getDevices();
        if (first) {
          await this.attachUsbDevice(first);
          return true;
        }
      }
      if (this.settings.transport === 'serial' && nav.serial && !this.serialPort) {
        const [first] = await nav.serial.getPorts();
        if (first) {
          this.serialPort = first;
          this.deviceName = 'USB/Serial Printer';
          this.emit();
          return true;
        }
      }
    } catch {
      /* silent — user can reconnect manually */
    }
    return false;
  }

  private async attachUsbDevice(device: UsbDeviceLike) {
    if (!device.opened) await device.open();
    const firstCfg = device.configurations[0];
    if (!device.configuration && firstCfg) {
      await device.selectConfiguration(firstCfg.configurationValue);
    }
    const cfg = device.configuration ?? firstCfg;
    if (!cfg) throw new Error('USB device has no active configuration.');

    // Prefer USB Printer Class (0x07), then fall back to any bulk OUT endpoint
    let foundIface: number | null = null;
    let foundEp: number | null = null;
    for (const preferPrinterClass of [true, false]) {
      for (const iface of cfg.interfaces) {
        for (const alt of iface.alternates) {
          if (preferPrinterClass && alt.interfaceClass !== 7) continue;
          const outEp = alt.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk');
          if (outEp) {
            foundIface = iface.interfaceNumber;
            foundEp = outEp.endpointNumber;
            break;
          }
        }
        if (foundEp !== null) break;
      }
      if (foundEp !== null) break;
    }
    if (foundIface === null || foundEp === null) {
      await device.close();
      throw new Error('No bulk OUT endpoint found on this USB device. Make sure it is a thermal receipt printer.');
    }
    await device.claimInterface(foundIface);
    this.usbDevice = device;
    this.usbInterface = foundIface;
    this.usbEndpointOut = foundEp;
    this.deviceName = [device.manufacturerName, device.productName].filter(Boolean).join(' ') || 'USB Thermal Printer';
    this.settings = { ...this.settings, transport: 'usb' };
    saveSettings(this.settings);
    this.lastError = null;
    this.emit();
  }

  async connectUsb(): Promise<void> {
    const nav = navigator as ExtendedNavigator;
    if (!nav.usb) throw new Error('WebUSB is not supported in this browser. Use Chrome or Edge.');
    this.busy = true;
    this.lastError = null;
    this.emit();
    try {
      await this.disconnectHardwareOnly();
      // Empty filter allows selecting ANY USB thermal printer brand (Epson, Star, Xprinter, Rongta, Sunmi, generic)
      const device = await nav.usb.requestDevice({ filters: [] });
      await this.attachUsbDevice(device);
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  async connectSerial(baudRate?: SerialBaudRate): Promise<void> {
    const nav = navigator as ExtendedNavigator;
    if (!nav.serial) throw new Error('Web Serial is not supported in this browser. Use Chrome or Edge.');
    const rate = baudRate ?? this.settings.serialBaudRate;
    this.busy = true;
    this.lastError = null;
    this.emit();
    try {
      await this.disconnectHardwareOnly();
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: rate });
      this.serialPort = port;
      this.serialOpen = true;
      const info = port.getInfo?.();
      this.deviceName = info?.usbVendorId
        ? `Serial Printer (${info.usbVendorId.toString(16).toUpperCase()} · ${rate} baud)`
        : `Serial Printer (${rate} baud)`;
      this.settings = { ...this.settings, transport: 'serial', serialBaudRate: rate };
      saveSettings(this.settings);
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  async connectBluetooth(): Promise<void> {
    const nav = navigator as ExtendedNavigator;
    if (!nav.bluetooth) throw new Error('Web Bluetooth is not supported in this browser. Use Chrome or Edge.');
    this.busy = true;
    this.lastError = null;
    this.emit();
    try {
      await this.disconnectHardwareOnly();
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_PRINTER_SERVICES,
      });
      if (!device.gatt) throw new Error('Bluetooth device does not support GATT.');
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let writableChar: BleCharacteristicLike | null = null;
      for (const svc of services) {
        try {
          const chars = await svc.getCharacteristics();
          const match = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
          if (match) {
            writableChar = match;
            break;
          }
        } catch {
          /* skip unreadable service */
        }
      }
      if (!writableChar) {
        server.disconnect();
        throw new Error('No writable thermal print characteristic found on this Bluetooth device.');
      }
      device.addEventListener?.('gattserverdisconnected', () => {
        this.bleChar = null;
        this.emit();
      });
      this.bleDevice = device;
      this.bleChar = writableChar;
      this.deviceName = device.name || 'Bluetooth Thermal Printer';
      this.settings = { ...this.settings, transport: 'bluetooth' };
      saveSettings(this.settings);
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  configureNetwork(cfg: { networkProtocol: NetworkProtocol; networkHost: string; networkPort: number; bridgeUrl: string }) {
    this.settings = {
      ...this.settings,
      transport: 'network',
      networkProtocol: cfg.networkProtocol,
      networkHost: cfg.networkHost.trim(),
      networkPort: cfg.networkPort,
      bridgeUrl: cfg.bridgeUrl.trim() || DEFAULT_PRINTER_SETTINGS.bridgeUrl,
    };
    saveSettings(this.settings);
    this.lastError = null;
    this.emit();
  }

  useBrowserDriver() {
    this.settings = { ...this.settings, transport: 'browser' };
    saveSettings(this.settings);
    this.lastError = null;
    this.emit();
  }

  private async disconnectHardwareOnly() {
    if (this.usbDevice) {
      try {
        if (this.usbInterface !== null) await this.usbDevice.releaseInterface(this.usbInterface);
        if (this.usbDevice.opened) await this.usbDevice.close();
      } catch {
        /* ignore close errors */
      }
      this.usbDevice = null;
      this.usbInterface = null;
      this.usbEndpointOut = null;
    }
    if (this.serialPort) {
      try {
        if (this.serialOpen) await this.serialPort.close();
      } catch {
        /* ignore */
      }
      this.serialPort = null;
      this.serialOpen = false;
    }
    if (this.bleDevice) {
      try {
        if (this.bleDevice.gatt?.connected) this.bleDevice.gatt.disconnect();
      } catch {
        /* ignore */
      }
      this.bleDevice = null;
      this.bleChar = null;
    }
    this.deviceName = null;
  }

  async disconnect(): Promise<void> {
    await this.disconnectHardwareOnly();
    this.settings = { ...this.settings, transport: 'browser' };
    saveSettings(this.settings);
    this.lastError = null;
    this.emit();
  }

  /** Sends raw ESC/POS bytes to the currently connected hardware transport. */
  async printRaw(bytes: Uint8Array): Promise<void> {
    this.busy = true;
    this.lastError = null;
    this.emit();
    try {
      const t = this.settings.transport;
      if (t === 'usb') {
        if (!this.usbDevice || this.usbEndpointOut === null) {
          throw new Error('USB printer is not connected. Open Printer Setup to connect.');
        }
        if (!this.usbDevice.opened) await this.attachUsbDevice(this.usbDevice);
        const CHUNK = 512;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const slice = bytes.slice(i, i + CHUNK);
          const res = await this.usbDevice.transferOut(this.usbEndpointOut, slice);
          if (res.status !== 'ok') throw new Error(`USB transfer status: ${res.status}`);
        }
      } else if (t === 'serial') {
        if (!this.serialPort) {
          throw new Error('Serial printer is not connected. Open Printer Setup to connect.');
        }
        if (!this.serialOpen) {
          await this.serialPort.open({ baudRate: this.settings.serialBaudRate });
          this.serialOpen = true;
        }
        if (!this.serialPort.writable) throw new Error('Serial port is not writable.');
        const writer = this.serialPort.writable.getWriter();
        try {
          const CHUNK = 256;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            await writer.write(bytes.slice(i, i + CHUNK));
          }
        } finally {
          writer.releaseLock();
        }
      } else if (t === 'bluetooth') {
        if (!this.bleDevice?.gatt?.connected || !this.bleChar) {
          throw new Error('Bluetooth printer is not connected. Open Printer Setup to connect.');
        }
        // BLE MTU is typically 20–128 bytes; 100-byte chunks with 15ms pacing prevents buffer overrun.
        const CHUNK = 100;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const slice = bytes.slice(i, i + CHUNK);
          if (this.bleChar.properties.writeWithoutResponse && this.bleChar.writeValueWithoutResponse) {
            await this.bleChar.writeValueWithoutResponse(slice);
          } else if (this.bleChar.writeValueWithResponse) {
            await this.bleChar.writeValueWithResponse(slice);
          } else if (this.bleChar.writeValue) {
            await this.bleChar.writeValue(slice);
          } else {
            throw new Error('Bluetooth characteristic does not support writing.');
          }
          if (i + CHUNK < bytes.length) await sleep(15);
        }
      } else if (t === 'network') {
        await this.sendToNetworkBridge(bytes);
      } else {
        throw new Error('No direct hardware printer is selected.');
      }
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  private async sendToNetworkBridge(bytes: Uint8Array) {
    const { bridgeUrl, networkHost, networkPort } = this.settings;
    if (!networkHost.trim()) throw new Error('Enter the LAN printer IP address first.');
    const url = new URL(bridgeUrl || DEFAULT_PRINTER_SETTINGS.bridgeUrl);
    url.searchParams.set('host', networkHost.trim());
    url.searchParams.set('port', String(networkPort || 9100));
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes as BodyInit,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`LAN Print Bridge error (${res.status}): ${detail || res.statusText}`);
    }
  }

  private async sendEposXml(d: ReceiptData, openDrawer: boolean) {
    const { networkHost, networkPort } = this.settings;
    if (!networkHost.trim()) throw new Error('Enter the LAN printer IP address first.');
    const portPart = networkPort && networkPort !== 80 ? `:${networkPort}` : '';
    const url = `http://${networkHost.trim()}${portPart}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
    const xml = encodeEposXml(d, {
      paperWidth: this.settings.paperWidth,
      cut: this.settings.cut,
      openDrawer,
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xml,
    });
    if (!res.ok) throw new Error(`ePOS printer HTTP ${res.status}`);
  }

  /** Returns true if a direct hardware printer is configured and ready to print without a browser dialog. */
  isDirectHardwareReady(): boolean {
    const snap = this.getSnapshot();
    return snap.settings.transport !== 'browser' && snap.connected;
  }

  /** Prints a receipt directly to the connected hardware thermal printer. */
  async printReceiptDirect(d: ReceiptData): Promise<void> {
    const hasCash = d.payments.some((p) => p.method === 'cash' && p.status !== 'failed');
    const openDrawer = this.settings.openDrawerOnCash && hasCash;
    if (this.settings.transport === 'network' && this.settings.networkProtocol === 'epos') {
      this.busy = true;
      this.lastError = null;
      this.emit();
      try {
        await this.sendEposXml(d, openDrawer);
      } catch (e) {
        this.lastError = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        this.busy = false;
        this.emit();
      }
      return;
    }
    const bytes = encodeReceiptWithOptions(d, {
      paperWidth: this.settings.paperWidth,
      cut: this.settings.cut,
      copies: this.settings.copies,
      beep: this.settings.beepOnPrint,
      openDrawer,
    });
    await this.printRaw(bytes);
  }

  async printTestPage(restaurantName: string): Promise<void> {
    const bytes = encodeTestPage(restaurantName, {
      paperWidth: this.settings.paperWidth,
      cut: this.settings.cut,
      beep: this.settings.beepOnPrint,
    });
    await this.printRaw(bytes);
  }

  async openCashDrawer(): Promise<void> {
    await this.printRaw(encodeCashDrawerKick(0));
  }
}

export const thermalPrinter = new ThermalPrinterManager();
