// ESC/POS encoder for 80mm and 58mm thermal printers (Epson/Star/Xprinter/Rongta/Sunmi compatible).
// Supports paper widths (80mm = 48 cols, 58mm = 32 cols), auto-cut, cash drawer kick, buzzer, copies,
// test page, and Epson ePOS-Print XML for LAN printers.
import { receiptText, type ReceiptData } from '../features/receiptModel';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type PaperWidthMm = 80 | 58;
export type CutMode = 'partial' | 'full' | 'none';

export interface EscPosOptions {
  /** Thermal roll width: 80mm (48 cols) or 58mm (32 cols). Defaults to 80. */
  paperWidth?: PaperWidthMm;
  /** Auto-cutter command after printing. Defaults to 'partial'. */
  cut?: CutMode;
  /** Send cash drawer kick pulse (RJ-11 Pin 2) after printing. Defaults to false. */
  openDrawer?: boolean;
  /** Sound built-in printer buzzer (ESC B) after printing. Defaults to false. */
  beep?: boolean;
  /** Number of copies to print (1–3). Defaults to 1. */
  copies?: number;
  /** Blank lines to feed before cut. Defaults to 3. */
  feedLines?: number;
}

export function columnsForPaper(paperWidth: PaperWidthMm = 80): number {
  return paperWidth === 58 ? 32 : 48;
}

/** Printers expect single-byte text; non-ASCII characters are replaced. */
export function toAsciiBytes(s: string): number[] {
  return [...s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')].map((c) => {
    const code = c.charCodeAt(0);
    return code >= 0x20 && code <= 0x7e ? code : 0x3f;
  });
}

/** Cash drawer kick pulse: ESC p m t1 t2 (Pin 2 = 0, Pin 5 = 1). */
export function encodeCashDrawerKick(pin: 0 | 1 = 0): Uint8Array {
  return new Uint8Array([ESC, 0x70, pin, 0x19, 0xfa]);
}

/** Default 80mm (48-col) receipt encoding — preserved for backward compatibility. */
export function encodeReceipt(d: ReceiptData, width = 48): Uint8Array {
  const out: number[] = [ESC, 0x40]; // initialise
  for (const line of receiptText(d, width)) {
    out.push(ESC, 0x61, line.align === 'center' ? 1 : 0); // align
    out.push(ESC, 0x45, line.bold ? 1 : 0); // bold
    out.push(GS, 0x21, line.big ? 0x11 : 0x00); // double width+height
    out.push(...toAsciiBytes(line.big ? line.text.slice(0, Math.floor(width / 2)) : line.text), LF);
  }
  out.push(ESC, 0x61, 0, GS, 0x21, 0, ESC, 0x45, 0, LF, LF, LF);
  out.push(GS, 0x56, 0x42, 0x00); // feed and partial cut
  return new Uint8Array(out);
}

/** Configurable ESC/POS receipt encoder supporting 80mm/58mm, cut modes, copies, beep & cash drawer. */
export function encodeReceiptWithOptions(d: ReceiptData, opts: EscPosOptions = {}): Uint8Array {
  const width = columnsForPaper(opts.paperWidth ?? 80);
  const cut = opts.cut ?? 'partial';
  const copies = Math.min(3, Math.max(1, Math.floor(opts.copies ?? 1)));
  const feedLines = Math.min(8, Math.max(1, Math.floor(opts.feedLines ?? 3)));
  const lines = receiptText(d, width);
  const out: number[] = [];

  for (let copy = 0; copy < copies; copy++) {
    out.push(ESC, 0x40); // initialise
    if (copy > 0) {
      out.push(ESC, 0x61, 1, ESC, 0x45, 1, ...toAsciiBytes(`--- COPY ${copy + 1} ---`), LF);
    }
    for (const line of lines) {
      out.push(ESC, 0x61, line.align === 'center' ? 1 : 0);
      out.push(ESC, 0x45, line.bold ? 1 : 0);
      out.push(GS, 0x21, line.big ? 0x11 : 0x00);
      out.push(...toAsciiBytes(line.big ? line.text.slice(0, Math.floor(width / 2)) : line.text), LF);
    }
    out.push(ESC, 0x61, 0, GS, 0x21, 0, ESC, 0x45, 0);
    for (let i = 0; i < feedLines; i++) out.push(LF);
    if (cut === 'partial') out.push(GS, 0x56, 0x42, 0x00);
    else if (cut === 'full') out.push(GS, 0x56, 0x41, 0x00);
  }

  if (opts.beep) out.push(ESC, 0x42, 0x02, 0x02);
  if (opts.openDrawer) out.push(...encodeCashDrawerKick(0));

  return new Uint8Array(out);
}

/** Self-test ticket for verifying hardware thermal printer alignment, boldness, and auto-cut. */
export function encodeTestPage(
  restaurantName: string,
  opts: Pick<EscPosOptions, 'paperWidth' | 'cut' | 'beep'> = {},
): Uint8Array {
  const paperWidth = opts.paperWidth ?? 80;
  const width = columnsForPaper(paperWidth);
  const cut = opts.cut ?? 'partial';
  const rule = '-'.repeat(width);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const out: number[] = [
    ESC,
    0x40,
    ESC,
    0x61,
    1,
    ESC,
    0x45,
    1,
    GS,
    0x21,
    0x11,
    ...toAsciiBytes(restaurantName.slice(0, Math.floor(width / 2)) || 'SomBill POS'),
    LF,
    GS,
    0x21,
    0x00,
    ...toAsciiBytes('THERMAL PRINTER TEST'),
    LF,
    ESC,
    0x45,
    0,
    ESC,
    0x61,
    0,
    ...toAsciiBytes(rule),
    LF,
    ...toAsciiBytes(`Paper width : ${paperWidth}mm (${width} cols)`),
    LF,
    ...toAsciiBytes(`Auto-cut    : ${cut}`),
    LF,
    ...toAsciiBytes(`Timestamp   : ${now}`),
    LF,
    ...toAsciiBytes(rule),
    LF,
    ESC,
    0x61,
    1,
    ESC,
    0x45,
    1,
    ...toAsciiBytes('Hardware connection OK!'),
    LF,
    ESC,
    0x45,
    0,
    ...toAsciiBytes('SomBill POS · Direct Thermal Print'),
    LF,
    ESC,
    0x61,
    0,
    LF,
    LF,
    LF,
  ];
  if (cut === 'partial') out.push(GS, 0x56, 0x42, 0x00);
  else if (cut === 'full') out.push(GS, 0x56, 0x41, 0x00);
  if (opts.beep) out.push(ESC, 0x42, 0x02, 0x02);
  return new Uint8Array(out);
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Epson ePOS-Print XML envelope for LAN/Wi-Fi printers supporting /cgi-bin/epos/service.cgi. */
export function encodeEposXml(d: ReceiptData, opts: EscPosOptions = {}): string {
  const width = columnsForPaper(opts.paperWidth ?? 80);
  const cut = opts.cut ?? 'partial';
  const lines = receiptText(d, width);
  const body: string[] = [];
  for (const line of lines) {
    const align = line.align === 'center' ? 'center' : 'left';
    const text = escapeXml(line.big ? line.text.slice(0, Math.floor(width / 2)) : line.text);
    body.push(
      `<text align="${align}" em="${line.bold ? 'true' : 'false'}" width="${line.big ? '2' : '1'}" height="${line.big ? '2' : '1'}">${text}&#10;</text>`,
    );
  }
  body.push('<feed line="3"/>');
  if (cut !== 'none') body.push('<cut type="feed"/>');
  if (opts.openDrawer) body.push('<pulse drawer="drawer_1" time="pulse_100"/>');
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">',
    '<s:Body>',
    '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">',
    ...body,
    '</epos-print>',
    '</s:Body>',
    '</s:Envelope>',
  ].join('');
}

/** Web Serial (Chrome/Edge, USB-serial thermal printers). Returns false if unsupported or cancelled. */
export async function sendToSerialPrinter(bytes: Uint8Array, baudRate = 9600): Promise<boolean> {
  const nav = navigator as Navigator & {
    serial?: {
      requestPort: () => Promise<{
        open: (o: { baudRate: number }) => Promise<void>;
        writable: WritableStream<Uint8Array> | null;
        close: () => Promise<void>;
      }>;
    };
  };
  if (!nav.serial) return false;
  const port = await nav.serial.requestPort();
  await port.open({ baudRate });
  if (!port.writable) {
    await port.close();
    throw new Error('Serial port is not writable.');
  }
  const writer = port.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
    await port.close();
  }
  return true;
}

export function downloadEscPos(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
