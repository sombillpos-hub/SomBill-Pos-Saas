// Minimal ESC/POS encoder for 80mm thermal printers (Epson-compatible command set).
// NOTE: verified by unit tests against the command bytes only — not on a physical printer.
import { receiptText, type ReceiptData } from '../features/receiptModel';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Printers expect single-byte text; non-ASCII characters are replaced. */
export function toAsciiBytes(s: string): number[] {
  return [...s.normalize('NFKD').replace(/[̀-ͯ]/g, '')].map((c) => {
    const code = c.charCodeAt(0);
    return code >= 0x20 && code <= 0x7e ? code : 0x3f;
  });
}

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

/** Web Serial (Chrome/Edge, USB-serial thermal printers). Returns false if unsupported or cancelled. */
export async function sendToSerialPrinter(bytes: Uint8Array): Promise<boolean> {
  const nav = navigator as Navigator & {
    serial?: {
      requestPort: () => Promise<{
        open: (o: { baudRate: number }) => Promise<void>;
        writable: WritableStream<Uint8Array>;
        close: () => Promise<void>;
      }>;
    };
  };
  if (!nav.serial) return false;
  const port = await nav.serial.requestPort();
  await port.open({ baudRate: 9600 });
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
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
