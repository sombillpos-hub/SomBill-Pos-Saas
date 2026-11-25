import { Printer } from 'lucide-react';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  notes?: string | null;
}

export interface KitchenTicketData {
  restaurantName: string;
  orderNumber?: number | null;
  tableLabel?: string | null;
  waiterName?: string | null;
  orderNotes?: string | null;
  timezone?: string;
  printedAt?: Date;
  items: KitchenTicketItem[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTicketTime(date: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || undefined,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Prints an 80mm thermal Kitchen / Waiter Ticket containing ONLY food item names,
 * quantities, and kitchen notes (no prices, no tax, no totals).
 */
export function printKitchenTicket(data: KitchenTicketData): void {
  const when = formatTicketTime(data.printedAt ?? new Date(), data.timezone);
  const itemsHtml = data.items
    .map(
      (it) => `
      <div class="item">
        <div class="item-row">
          <span class="qty">${escapeHtml(String(Number(it.quantity)))}×</span>
          <span class="name">${escapeHtml(it.name)}</span>
        </div>
        ${it.notes ? `<div class="note">↳ ${escapeHtml(it.notes)}</div>` : ''}
      </div>`,
    )
    .join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kitchen Ticket${data.orderNumber ? ` #${data.orderNumber}` : ''}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0 auto;
      padding: 4mm 3mm;
      width: 72mm;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .title { font-size: 15px; font-weight: 800; margin: 0; }
    .badge { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; margin: 4px 0 0; }
    hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
    .meta { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; }
    .items-head { display: flex; gap: 8px; font-weight: 800; margin-bottom: 4px; text-transform: uppercase; font-size: 11px; }
    .item { margin-bottom: 6px; }
    .item-row { display: flex; gap: 8px; font-size: 13.5px; font-weight: 700; }
    .qty { min-width: 28px; }
    .name { word-break: break-word; flex: 1; }
    .note { padding-left: 36px; font-size: 11.5px; }
    .order-notes { margin-top: 6px; padding: 4px 6px; border: 1px dashed #000; font-size: 11.5px; }
    .footer { margin-top: 8px; font-size: 10px; text-align: center; }
  </style>
</head>
<body>
  <div class="center">
    <p class="title">${escapeHtml(data.restaurantName)}</p>
    <p class="badge">ORDER TICKET · ITEMS ONLY</p>
  </div>
  <hr />
  ${data.orderNumber ? `<div class="meta"><span>Order</span><strong>#${escapeHtml(String(data.orderNumber))}</strong></div>` : ''}
  ${data.tableLabel ? `<div class="meta"><span>Table</span><strong>${escapeHtml(data.tableLabel)}</strong></div>` : ''}
  ${data.waiterName ? `<div class="meta"><span>Waiter</span><span>${escapeHtml(data.waiterName)}</span></div>` : ''}
  <div class="meta"><span>Time</span><span>${escapeHtml(when)}</span></div>
  <hr />
  <div class="items-head"><span class="qty">Qty</span><span>Item</span></div>
  ${itemsHtml}
  ${data.orderNotes ? `<div class="order-notes"><strong>Note:</strong> ${escapeHtml(data.orderNotes)}</div>` : ''}
  <hr />
  <div class="footer">SomBill POS · Food Items Copy</div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }
  }, 150);
}

/** Preview + Print modal for the waiter's food-items-only receipt (no prices). */
export function KitchenTicketModal({ data, onClose }: { data: KitchenTicketData | null; onClose: () => void }) {
  if (!data) return null;
  const when = formatTicketTime(data.printedAt ?? new Date(), data.timezone);
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Food Items Receipt"
      description="Prints dish names and quantities only (no prices)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => printKitchenTicket(data)}>
            Print receipt
          </Button>
        </>
      }
    >
      <div
        className="mx-auto w-full max-w-[290px] rounded-xl border border-dashed border-slate-300 bg-white p-4 font-mono text-xs text-black shadow-sm"
        data-testid="kitchen-ticket-preview"
      >
        <div className="text-center">
          <p className="text-sm font-bold">{data.restaurantName}</p>
          <p className="mt-0.5 text-[11px] font-bold tracking-wider">ORDER TICKET · ITEMS ONLY</p>
        </div>
        <hr className="my-2 border-dashed border-slate-400" />
        <div className="space-y-0.5 text-[11px]">
          {data.orderNumber && (
            <div className="flex justify-between">
              <span>Order</span>
              <b>#{data.orderNumber}</b>
            </div>
          )}
          {data.tableLabel && (
            <div className="flex justify-between">
              <span>Table</span>
              <b>{data.tableLabel}</b>
            </div>
          )}
          {data.waiterName && (
            <div className="flex justify-between">
              <span>Waiter</span>
              <span>{data.waiterName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Time</span>
            <span>{when}</span>
          </div>
        </div>
        <hr className="my-2 border-dashed border-slate-400" />
        <div className="mb-1 flex gap-2 text-[11px] font-bold uppercase">
          <span className="w-8">Qty</span>
          <span>Item</span>
        </div>
        <ul className="space-y-1.5">
          {data.items.map((it, idx) => (
            <li key={idx}>
              <div className="flex gap-2 text-sm font-bold">
                <span className="w-8 shrink-0 tabular-nums">{Number(it.quantity)}×</span>
                <span className="min-w-0 break-words">{it.name}</span>
              </div>
              {it.notes && <p className="pl-10 text-[11px] text-slate-700">↳ {it.notes}</p>}
            </li>
          ))}
        </ul>
        {data.orderNotes && (
          <p className="mt-2 rounded border border-dashed border-slate-400 p-1.5 text-[11px]">
            <b>Note:</b> {data.orderNotes}
          </p>
        )}
        <hr className="my-2 border-dashed border-slate-400" />
        <p className="text-center text-[10px] text-slate-600">SomBill POS · Food Items Copy</p>
      </div>
    </Modal>
  );
}
