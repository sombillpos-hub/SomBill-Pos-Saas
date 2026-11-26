import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Printer, Settings2 } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { fetchAll, supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { presetRange, rangeToIso, type DateRange } from '@sombill/shared-utils/dates';
import { fetchTables } from '@sombill/api-client/queries';
import { formatDateTime, formatMoney } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Order, Payment, ReceiptRecord } from '@sombill/shared-types/types';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { DateRangeFilter, SearchInput } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { ReceiptView } from '../components/ReceiptView';
import { PrinterSetupModal } from '../components/PrinterSetupModal';
import { useReceiptData } from '../hooks/useReceiptData';
import { useThermalPrinter } from '../hooks/useThermalPrinter';
import { downloadEscPos, encodeReceiptWithOptions } from '../services/escpos';
import { printReceiptFor } from './PaymentProcessingPage';

export default function ReceiptsPage() {
  const r = useRestaurant();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const orderId = params.get('order');
  const [range, setRange] = useState<DateRange>(() => presetRange('today', r.timezone));
  const [search, setSearch] = useState('');
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const printer = useThermalPrinter();
  const q = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(range, r.timezone);
    const paid = await fetchAll<Pick<Payment, 'order_id'>>((a, b) =>
      supabase
        .from('payments')
        .select('order_id')
        .eq('restaurant_id', r.id)
        .eq('kind', 'payment')
        .eq('status', 'succeeded')
        .gte('created_at', fromIso)
        .lt('created_at', toIso)
        .order('id')
        .range(a, b),
    );
    const ids = [...new Set(paid.map((p) => p.order_id))];
    const [orders, receipts, tables] = await Promise.all([
      ids.length
        ? supabase
            .from('orders')
            .select('*')
            .in('id', ids)
            .order('created_at', { ascending: false })
            .then((x) => unwrap(x) as Order[])
        : Promise.resolve([] as Order[]),
      ids.length
        ? supabase
            .from('receipts')
            .select('*')
            .in('order_id', ids)
            .then((x) => unwrap(x) as ReceiptRecord[])
        : Promise.resolve([] as ReceiptRecord[]),
      fetchTables(r.id),
    ]);
    return {
      orders,
      receipts: new Map(receipts.map((x) => [x.order_id, x])),
      tables: new Map(tables.map((t) => [t.id, t.table_number])),
    };
  }, [r.id, range.from, range.to]);
  useRealtime(['payments', 'receipts'], r.id, () => void q.reload());
  const list = useMemo(() => {
    const t = search.trim().toLowerCase().replace(/^#/, '');
    return (q.data?.orders ?? []).filter(
      (o) => !t || String(o.order_number) === t || String(q.data!.receipts.get(o.id)?.receipt_number) === t,
    );
  }, [q.data, search]);

  return (
    <div>
      <PageHeader
        eyebrow={`Ledger & Cash · ${printer.settings.paperWidth}mm Thermal`}
        title="Receipts"
        description="Direct hardware thermal printing (USB, Serial, Bluetooth, LAN) and system driver receipts. Reprints are counted and marked."
        actions={
          <Button
            variant="secondary"
            icon={<Settings2 className="h-4 w-4" />}
            onClick={() => setPrinterModalOpen(true)}
          >
            {printer.deviceName ? `Printer: ${printer.deviceName}` : 'Connect Thermal Printer'}
          </Button>
        }
      />
      {q.error ? (
        <div className="card">
          <ErrorState message={q.error} onRetry={q.reload} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card bodyClassName="p-0">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
              <SearchInput value={search} onChange={setSearch} placeholder="Order # or receipt #" className="md:w-64" />
              <DateRangeFilter value={range} onChange={setRange} timeZone={r.timezone} />
            </div>
            {q.loading && !q.data ? (
              <div className="p-4">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : !list.length ? (
              <EmptyState title="No paid orders in this period" />
            ) : (
              <ul className="divide-y divide-slate-100" aria-label="Paid orders">
                {list.map((o) => {
                  const rc = q.data!.receipts.get(o.id);
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => setParams({ order: o.id })}
                        aria-current={o.id === orderId}
                        className={cn(
                          'flex min-h-[60px] w-full items-center justify-between gap-2 px-4 py-2 text-left',
                          o.id === orderId ? 'bg-orange-50' : 'hover:bg-slate-50',
                        )}
                      >
                        <span>
                          <b>#{o.order_number}</b>{' '}
                          <span className="text-sm text-slate-500">
                            {o.table_id ? `Table ${q.data!.tables.get(o.table_id)}` : o.order_type.replace('_', '-')} ·{' '}
                            {formatDateTime(o.created_at, r.timezone)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          {rc ? (
                            <Badge tone="green">
                              Receipt #{rc.receipt_number}
                              {rc.print_count > 1 ? ` · ${rc.print_count}× printed` : ''}
                            </Badge>
                          ) : (
                            <Badge tone="gray">Not issued</Badge>
                          )}
                          <b className="tabular-nums">{formatMoney(o.total, r.currency)}</b>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title={`Preview (${printer.settings.paperWidth}mm)`} className="h-fit lg:sticky lg:top-20">
            {!orderId ? (
              <p className="text-sm text-slate-500">Select an order to preview its receipt.</p>
            ) : (
              <Preview
                orderId={orderId}
                onPrinted={() => void q.reload()}
                onOpenPrinterSetup={() => setPrinterModalOpen(true)}
                toast={toast}
              />
            )}
          </Card>
        </div>
      )}
      <PrinterSetupModal open={printerModalOpen} onClose={() => setPrinterModalOpen(false)} />
    </div>
  );
}

function Preview({
  orderId,
  onPrinted,
  onOpenPrinterSetup,
  toast,
}: {
  orderId: string;
  onPrinted: () => void;
  onOpenPrinterSetup: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const d = useReceiptData('receipt', orderId);
  const printer = useThermalPrinter();
  const [busy, setBusy] = useState(false);
  const isHw = printer.settings.transport !== 'browser' && printer.connected;
  const ensure = async () => {
    const { data, error } = await supabase.rpc('issue_receipt', { p_order: orderId });
    if (error) {
      toast.error(friendlyError(error));
      return null;
    }
    await d.reload();
    return data as { receipt_id: string; receipt_number: number };
  };
  const print = async () => {
    setBusy(true);
    try {
      await printReceiptFor(orderId, toast);
      await d.reload();
      onPrinted();
    } finally {
      setBusy(false);
    }
  };
  const downloadRaw = async () => {
    const rec = await ensure();
    if (!rec || !d.data) return;
    const bytes = encodeReceiptWithOptions(
      { ...d.data, receiptNumber: rec.receipt_number },
      {
        paperWidth: printer.settings.paperWidth,
        cut: printer.settings.cut,
        copies: printer.settings.copies,
        beep: printer.settings.beepOnPrint,
      },
    );
    downloadEscPos(bytes, `receipt-${rec.receipt_number}.bin`);
  };
  if (d.loading && !d.data) return <Skeleton className="h-96 w-full" />;
  if (!d.data) return <EmptyState title="Receipt unavailable" />;
  return (
    <div className="space-y-3">
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-dashed border-slate-300 bg-slate-100 py-3">
        <div className="shadow-sm">
          <ReceiptView d={d.data} paperWidth={printer.settings.paperWidth} />
        </div>
      </div>
      <Button
        variant="orange"
        className="h-12 w-full"
        icon={<Printer className="h-5 w-5" />}
        loading={busy}
        onClick={() => void print()}
      >
        {isHw
          ? d.data.receiptNumber
            ? `Direct reprint (${printer.settings.transport.toUpperCase()})`
            : `Issue & direct print (${printer.settings.transport.toUpperCase()})`
          : d.data.receiptNumber
            ? 'Reprint receipt'
            : 'Issue & print receipt'}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          className="h-11"
          icon={<Settings2 className="h-4 w-4" />}
          onClick={onOpenPrinterSetup}
        >
          Printer setup
        </Button>
        <Button
          variant="secondary"
          className="h-11"
          icon={<Download className="h-4 w-4" />}
          onClick={() => void downloadRaw()}
        >
          ESC/POS file
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        {isHw
          ? `Connected directly to ${printer.deviceName} (${printer.settings.paperWidth}mm). Printing sends raw ESC/POS straight to the hardware.`
          : `Using System Driver (${printer.settings.paperWidth}mm). Click Printer setup to connect a USB, Serial, Bluetooth, or LAN thermal printer directly.`}
      </p>
    </div>
  );
}
