import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, ExternalLink, Printer, QrCode, Users } from 'lucide-react';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';

export interface QrTableTarget {
  id: string;
  table_number: number;
  name?: string | null;
  section?: string;
  floor?: string;
  capacity?: number;
}

export function buildTableMenuUrl(table: QrTableTarget, restaurantName?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const params = new URLSearchParams({ table: String(table.table_number) });
  if (table.name) params.set('name', table.name);
  if (table.section) params.set('section', table.section);
  if (table.floor) params.set('floor', table.floor);
  if (restaurantName) params.set('venue', restaurantName);
  return `${origin}/table-menu/${encodeURIComponent(table.id)}?${params.toString()}`;
}

export function TableQrModal({
  table,
  restaurantName,
  onClose,
}: {
  table: QrTableTarget;
  restaurantName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const url = buildTableMenuUrl(table, restaurantName);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((src) => {
        if (alive) setDataUrl(src);
      })
      .catch(() => {
        if (alive) setDataUrl('');
      });
    return () => {
      alive = false;
    };
  }, [url]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(`Table #${table.table_number} menu link copied.`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const downloadPng = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `SomBill-Table-${table.table_number}-QR.png`;
    a.click();
    toast.success(`Downloaded Table #${table.table_number} QR PNG.`);
  };

  const printCard = () => {
    if (!dataUrl) return;
    const w = window.open('', '_blank', 'width=520,height=720');
    if (!w) return;
    w.document.write(`<!doctype html>
<html>
  <head>
    <title>SomBill · Table #${table.table_number} QR</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; background: #fffaf9; color: #0f172a; }
      .tent { width: 340px; border: 2px solid #dc2626; border-radius: 28px; padding: 28px 24px; text-align: center; background: #fff; box-shadow: 0 20px 48px rgba(15,23,42,0.12); }
      .bar { height: 6px; border-radius: 999px; background: linear-gradient(90deg, #dc2626, #f97316, #fbbf24); margin-bottom: 18px; }
      .venue { font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #c2410c; margin: 0; }
      .table { font-size: 28px; font-weight: 900; margin: 6px 0 4px; }
      .sub { font-size: 13px; color: #64748b; margin: 0 0 18px; }
      .qr { width: 220px; height: 220px; border-radius: 18px; border: 1px solid #e2e8f0; padding: 8px; }
      .cta { margin-top: 16px; font-size: 14px; font-weight: 700; color: #0f172a; }
      .foot { margin-top: 6px; font-size: 11px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="tent">
      <div class="bar"></div>
      <p class="venue">${restaurantName}</p>
      <h1 class="table">Table #${table.table_number}</h1>
      <p class="sub">${[table.name, table.section, table.floor].filter(Boolean).join(' · ') || 'Dining Floor'}</p>
      <img class="qr" src="${dataUrl}" alt="Table ${table.table_number} QR Code" />
      <p class="cta">Scan to view live menu &amp; order</p>
      <p class="foot">Powered by SomBill Hospitality OS</p>
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body>
</html>`);
    w.document.close();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Table #${table.table_number} · QR Code`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex">
            <Button variant="secondary" size="sm" icon={<ExternalLink className="h-4 w-4" />}>
              Open Customer Menu
            </Button>
          </a>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={downloadPng}>
              PNG
            </Button>
            <Button size="sm" icon={<Printer className="h-4 w-4" />} onClick={printCard}>
              Print Table Card
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center">
        {/* Print-ready visual preview tent card */}
        <div className="relative w-full max-w-[310px] overflow-hidden rounded-3xl border border-orange-200/80 bg-gradient-to-b from-white via-[#fffcfa] to-[#fff4ed] p-6 shadow-lg">
          <div
            className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#dc2626] via-[#f97316] to-[#fbbf24]"
            aria-hidden
          />
          <div className="flex items-center justify-center gap-2">
            <img
              src="/branding/sombill-logo.jpg"
              alt="SomBill"
              className="h-7 w-7 rounded-lg object-cover ring-1 ring-red-200"
            />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-orange-700">
              {restaurantName}
            </span>
          </div>

          <h3 className="mt-2.5 text-2xl font-black tracking-tight text-slate-900">Table #{table.table_number}</h3>
          <p className="mt-0.5 flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
            <span>{[table.name, table.section, table.floor].filter(Boolean).join(' · ') || 'Dining Floor'}</span>
            {table.capacity ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                <Users className="h-3 w-3" /> {table.capacity}
              </span>
            ) : null}
          </p>

          <div className="mx-auto mt-4 flex h-[204px] w-[204px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-2.5 shadow-inner">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={`QR Code for Table #${table.table_number}`}
                className="h-full w-full rounded-lg object-contain"
              />
            ) : (
              <QrCode className="h-12 w-12 animate-pulse text-slate-300" />
            )}
          </div>

          <p className="mt-3.5 text-xs font-bold text-slate-800">Scan with phone camera to view menu &amp; order</p>
        </div>

        {/* Direct shareable link box */}
        <div className="mt-4 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-600" title={url}>
            {url}
          </span>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:border-orange-300 hover:text-orange-700"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
