import { useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ReceiptView } from '../components/ReceiptView';
import { useReceiptData } from '../hooks/useReceiptData';
import type { DocKind } from '../features/receiptModel';

/**
 * Stand-alone 80mm print page: /cashier-print/:kind/:id
 * Sizes the printed page to the receipt (80mm × content height, no margins),
 * which is what continuous thermal paper needs.
 */
export default function PrintPage() {
  const { kind = 'receipt', id = '' } = useParams();
  const [params] = useSearchParams();
  const q = useReceiptData(kind as DocKind, id);
  const ref = useRef<HTMLDivElement>(null);
  const printed = useRef(false);

  useLayoutEffect(() => {
    if (!q.data || !ref.current) return;
    const mm = Math.ceil((ref.current.scrollHeight * 25.4) / 96) + 2;
    let style = document.getElementById('sombill-page-size') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'sombill-page-size';
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: 80mm ${mm}mm; margin: 0; } html, body { width: 80mm; margin: 0 !important; padding: 0 !important; background: #fff !important; }`;
    document.body.dataset.receiptHeightMm = String(mm);
  }, [q.data]);

  useEffect(() => {
    if (!q.data || params.get('autoprint') !== '1' || printed.current) return;
    printed.current = true;
    const after = () => window.parent?.postMessage('sombill-printed', window.location.origin);
    window.addEventListener('afterprint', after, { once: true });
    // let the logo load before printing
    setTimeout(() => {
      window.print();
    }, 300);
  }, [q.data, params]);

  if (q.loading) return <p className="p-4 font-mono text-sm">Preparing…</p>;
  if (q.error || !q.data) return <p className="p-4 font-mono text-sm">Could not load this document. {q.error}</p>;
  return (
    <div ref={ref} className="w-[80mm] bg-white">
      <ReceiptView d={q.data} />
    </div>
  );
}
