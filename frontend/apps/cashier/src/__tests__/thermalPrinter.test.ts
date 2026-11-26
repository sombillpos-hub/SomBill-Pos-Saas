import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReceiptData } from '../features/receiptModel';
import {
  columnsForPaper,
  encodeCashDrawerKick,
  encodeEposXml,
  encodeReceiptWithOptions,
  encodeTestPage,
} from '../services/escpos';
import { thermalPrinter } from '../services/thermalPrinter';

const sampleReceipt = (): ReceiptData => ({
  kind: 'receipt',
  restaurant: {
    name: 'Hargeisa Grill',
    address: 'Road 1',
    phone: '+252 63',
    currency: 'USD',
    timezone: 'Africa/Mogadishu',
    tax_label: 'VAT',
    receipt_header: null,
    receipt_footer: 'Mahadsanid!',
  },
  order: {
    order_number: 101,
    order_type: 'dine_in',
    subtotal: 15,
    discount_amount: 0,
    tax_amount: 1.5,
    total: 16.5,
    amount_paid: 16.5,
    amount_refunded: 0,
    tax_rate: 0.1,
    tax_inclusive: false,
    created_at: '2026-11-26T06:00:00Z',
  },
  items: [{ product_name: 'Suqaar & Canjeero', quantity: 1, unit_price: 15, line_total: 15, is_voided: false }],
  payments: [
    {
      kind: 'payment',
      status: 'succeeded',
      method: 'cash',
      amount: 16.5,
      reference: null,
      transaction_number: 12,
      amount_received: 20,
      change_given: 3.5,
      created_at: '2026-11-26T06:05:00Z',
    },
  ],
  receiptNumber: 88,
  cashierName: 'Amina Cashier',
  tableNumber: 3,
  printedAt: new Date('2026-11-26T06:05:00Z'),
});

describe('universal ESC/POS thermal printer encoding', () => {
  it('maps 80mm to 48 columns and 58mm to 32 columns', () => {
    expect(columnsForPaper(80)).toBe(48);
    expect(columnsForPaper(58)).toBe(32);
  });

  it('encodes 58mm receipt with full cut, beep, cash drawer kick and 2 copies', () => {
    const bytes = [...encodeReceiptWithOptions(sampleReceipt(), {
      paperWidth: 58,
      cut: 'full',
      copies: 2,
      beep: true,
      openDrawer: true,
    })];
    const ascii = String.fromCharCode(...bytes.filter((b) => b >= 0x20 && b <= 0x7e));
    expect(ascii).toContain('COPY 2');
    // Ends with ESC B 2 2 (beep) + ESC p 0 25 250 (drawer kick)
    expect(bytes.slice(-9)).toEqual([0x1b, 0x42, 0x02, 0x02, 0x1b, 0x70, 0x00, 0x19, 0xfa]);
  });

  it('omits cut command when cut=none (tear-bar 58mm printers)', () => {
    const bytes = [...encodeReceiptWithOptions(sampleReceipt(), { paperWidth: 58, cut: 'none' })];
    // GS V (0x1d 0x56) should not appear
    const hasCut = bytes.some((b, i) => b === 0x1d && bytes[i + 1] === 0x56);
    expect(hasCut).toBe(false);
  });

  it('builds cash drawer kick pulse and self-test ticket', () => {
    expect([...encodeCashDrawerKick(0)]).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    const testBytes = [...encodeTestPage('Hargeisa Grill', { paperWidth: 80, cut: 'partial' })];
    const ascii = String.fromCharCode(...testBytes.filter((b) => b >= 0x20 && b <= 0x7e));
    expect(ascii).toContain('THERMAL PRINTER TEST');
    expect(ascii).toContain('Hardware connection OK!');
    expect(testBytes.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it('generates valid Epson ePOS-Print XML with drawer pulse', () => {
    const xml = encodeEposXml(sampleReceipt(), { paperWidth: 80, cut: 'partial', openDrawer: true });
    expect(xml).toContain('xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"');
    expect(xml).toContain('Suqaar &amp; Canjeero');
    expect(xml).toContain('<cut type="feed"/>');
    expect(xml).toContain('<pulse drawer="drawer_1" time="pulse_100"/>');
  });
});

describe('ThermalPrinterManager hardware transports', () => {
  beforeEach(async () => {
    localStorage.clear();
    await thermalPrinter.disconnect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('connects to a WebUSB printer, discovers bulk OUT endpoint and prints chunked ESC/POS', async () => {
    const transferOut = vi.fn().mockResolvedValue({ status: 'ok' });
    const mockDevice = {
      productName: 'XP-80C Thermal',
      manufacturerName: 'Xprinter',
      opened: false,
      configuration: null,
      configurations: [
        {
          configurationValue: 1,
          interfaces: [
            {
              interfaceNumber: 0,
              alternates: [{ interfaceClass: 7, endpoints: [{ endpointNumber: 1, direction: 'out', type: 'bulk' }] }],
            },
          ],
        },
      ],
      open: vi.fn().mockImplementation(async () => {
        mockDevice.opened = true;
      }),
      close: vi.fn().mockResolvedValue(undefined),
      selectConfiguration: vi.fn().mockResolvedValue(undefined),
      claimInterface: vi.fn().mockResolvedValue(undefined),
      releaseInterface: vi.fn().mockResolvedValue(undefined),
      transferOut,
    };

    Object.defineProperty(navigator, 'usb', {
      configurable: true,
      value: { requestDevice: vi.fn().mockResolvedValue(mockDevice), getDevices: vi.fn().mockResolvedValue([]) },
    });

    await thermalPrinter.connectUsb();
    expect(thermalPrinter.isDirectHardwareReady()).toBe(true);
    expect(thermalPrinter.getSnapshot().deviceName).toBe('Xprinter XP-80C Thermal');

    await thermalPrinter.printReceiptDirect(sampleReceipt());
    expect(transferOut).toHaveBeenCalled();
    expect(transferOut.mock.calls[0]?.[0]).toBe(1);
  });

  it('sends raw ESC/POS bytes to the local LAN TCP:9100 print bridge', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    vi.stubGlobal('fetch', fetchMock);

    thermalPrinter.configureNetwork({
      networkProtocol: 'bridge',
      networkHost: '192.168.1.200',
      networkPort: 9100,
      bridgeUrl: 'http://localhost:9191/print',
    });

    expect(thermalPrinter.isDirectHardwareReady()).toBe(true);
    await thermalPrinter.printReceiptDirect(sampleReceipt());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:9191/print?host=192.168.1.200&port=9100');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(Uint8Array);
  });
});
