import { useMemo, useState, type ReactNode } from 'react';
import { Download, Printer } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { fetchAll, supabase } from '@sombill/api-client/supabase';
import { presetRange, rangeToIso, type DateRange } from '@sombill/shared-utils/dates';
import {
  byPaymentMethod,
  cashierPerformance,
  categoryPerformance,
  expenseByCategory,
  inventoryValuation,
  productPerformance,
  profitEstimate,
  salesSeries,
  summarize,
  tablePerformance,
  waiterPerformance,
} from '@sombill/shared-utils/reports';
import {
  fetchCategories,
  fetchExpensesInRange,
  fetchInventory,
  fetchItemsForOrdersInRange,
  fetchOrdersInRange,
  fetchPaymentsInRange,
  fetchProducts,
  fetchTables,
} from '@sombill/api-client/queries';
import { downloadCsv, type CsvValue } from '@sombill/shared-utils/csv';
import {
  formatDateTime,
  formatMoney,
  formatQty,
  MOVEMENT_LABEL,
  PAYMENT_METHOD_LABEL,
} from '@sombill/shared-utils/format';
import type { StockMovement } from '@sombill/shared-types/types';
import { Card, ErrorState, PageHeader, StatCard, TableSkeleton, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { DateRangeFilter } from '@sombill/shared-ui/ui/Filters';
import { BarChart, ShareBars } from '@sombill/manager/components/BarChart';
import { Button } from '@sombill/shared-ui/ui/Button';

const REPORTS = [
  ['daily', 'Daily sales'],
  ['weekly', 'Weekly sales'],
  ['monthly', 'Monthly sales'],
  ['custom', 'Custom date range'],
  ['products', 'Product performance'],
  ['categories', 'Category performance'],
  ['cashiers', 'Cashier performance'],
  ['waiters', 'Waiter performance'],
  ['tables', 'Table performance'],
  ['methods', 'Payment methods'],
  ['refunds', 'Refunds'],
  ['expenses', 'Expenses'],
  ['inventory', 'Inventory'],
  ['movements', 'Stock movements'],
  ['profit', 'Profit estimate'],
] as const;
type ReportId = (typeof REPORTS)[number][0];

interface Built {
  cards: Array<{ label: string; value: ReactNode; sub?: string; tone?: 'navy' | 'red' | 'orange' | 'green' }>;
  chart?: ReactNode;
  headers: string[];
  rows: CsvValue[][];
  align?: Array<'left' | 'right'>;
  note?: string;
}

export default function ReportsPage() {
  const r = useRestaurant();
  const tz = r.timezone;
  const staff = useStaffDirectory(r.id);
  const [report, setReport] = useState<ReportId>('daily');
  const [range, setRange] = useState<DateRange>(() => presetRange('last7', tz));
  const money = (n: number) => formatMoney(n, r.currency);

  const pick = (id: ReportId) => {
    setReport(id);
    if (id === 'daily') setRange(presetRange('last7', tz));
    if (id === 'weekly' || id === 'monthly') setRange(presetRange('last30', tz));
  };

  const q = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(range, tz);
    const [orders, payments, items, expenses, products, categories, inventory, tables, movements] = await Promise.all([
      fetchOrdersInRange(r.id, fromIso, toIso),
      fetchPaymentsInRange(r.id, fromIso, toIso),
      fetchItemsForOrdersInRange(r.id, fromIso, toIso),
      fetchExpensesInRange(r.id, range.from, range.to),
      fetchProducts(r.id),
      fetchCategories(r.id),
      fetchInventory(r.id),
      fetchTables(r.id),
      fetchAll<StockMovement>((a, b) =>
        supabase
          .from('stock_movements')
          .select('*')
          .eq('restaurant_id', r.id)
          .gte('created_at', fromIso)
          .lt('created_at', toIso)
          .order('created_at', { ascending: false })
          .range(a, b),
      ),
    ]);
    return { orders, payments, items, expenses, products, categories, inventory, tables, movements };
  }, [r.id, range.from, range.to, tz]);

  const built = useMemo<Built | null>(() => {
    const d = q.data;
    if (!d) return null;
    const s = summarize(d.orders, d.payments);
    const salesCards: Built['cards'] = [
      { label: 'Gross sales', value: money(s.grossSales), sub: `${s.totalOrders - s.cancelledOrders} orders` },
      { label: 'Collected', value: money(s.collected), tone: 'green', sub: 'Successful payments' },
      { label: 'Refunds', value: money(s.refunds), tone: 'orange' },
      { label: 'Outstanding', value: money(s.outstanding), tone: 'red', sub: 'Unpaid balances' },
    ];
    const itemName = (id: string) => d.inventory.find((i) => i.id === id);
    switch (report) {
      case 'daily':
      case 'weekly':
      case 'monthly':
      case 'custom': {
        const bucket = report === 'weekly' ? 'week' : report === 'monthly' ? 'month' : 'day';
        const series = salesSeries(d.orders, d.payments, range, tz, bucket);
        return {
          cards: [
            ...salesCards,
            { label: 'Average order', value: money(s.avgOrderValue) },
            { label: 'Cancelled orders', value: s.cancelledOrders, tone: 'red' },
            { label: `${r.tax_label} in sales`, value: money(s.taxCollected) },
            { label: 'Discounts', value: money(s.discounts) },
          ],
          chart: (
            <BarChart
              data={series.map((p) => ({
                label: bucket === 'month' ? p.key : p.key.slice(5),
                values: [p.sales, p.collected],
              }))}
              format={money}
              series={[
                { name: 'Gross sales', color: '#dc2626' },
                { name: 'Collected (net)', color: '#f97316' },
              ]}
            />
          ),
          headers: [
            bucket === 'week' ? 'Week starting' : bucket === 'month' ? 'Month' : 'Date',
            'Orders',
            'Gross sales',
            'Collected (net of refunds)',
          ],
          rows: series.map((p) => [p.key, p.orders, p.sales.toFixed(2), p.collected.toFixed(2)]),
          align: ['left', 'right', 'right', 'right'],
        };
      }
      case 'products': {
        const perf = productPerformance(d.items, d.products, d.categories);
        return {
          cards: [
            { label: 'Products sold', value: perf.length },
            { label: 'Units sold', value: formatQty(perf.reduce((a, p) => a + p.quantity, 0)) },
            { label: 'Item revenue', value: money(perf.reduce((a, p) => a + p.revenue, 0)), tone: 'green' },
          ],
          chart: <ShareBars format={money} rows={perf.slice(0, 8).map((p) => ({ label: p.name, value: p.revenue }))} />,
          headers: ['Product', 'Category', 'Qty sold', 'Revenue', 'Cost', 'Gross profit', 'Margin %'],
          rows: perf.map((p) => [
            p.name,
            p.category,
            p.quantity,
            p.revenue.toFixed(2),
            p.cost?.toFixed(2) ?? 'n/a',
            p.profit?.toFixed(2) ?? 'n/a',
            p.margin ?? 'n/a',
          ]),
          align: ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
          note: 'Item revenue is before order-level discounts and tax. Cost uses the product cost price captured at the time of sale; "n/a" means cost was missing.',
        };
      }
      case 'categories': {
        const perf = categoryPerformance(productPerformance(d.items, d.products, d.categories));
        return {
          cards: [{ label: 'Categories with sales', value: perf.length }],
          chart: <ShareBars format={money} rows={perf.map((c) => ({ label: c.category, value: c.revenue }))} />,
          headers: ['Category', 'Qty sold', 'Revenue', 'Share %'],
          rows: perf.map((c) => [c.category, c.quantity, c.revenue.toFixed(2), c.share]),
          align: ['left', 'right', 'right', 'right'],
        };
      }
      case 'cashiers': {
        const perf = cashierPerformance(d.payments);
        return {
          cards: [
            { label: 'Cashiers active', value: perf.length },
            { label: 'Collected', value: money(s.collected), tone: 'green' },
          ],
          chart: (
            <ShareBars format={money} rows={perf.map((c) => ({ label: staff.nameOf(c.user_id), value: c.net }))} />
          ),
          headers: ['Cashier', 'Payments', 'Collected', 'Refunds', 'Net'],
          rows: perf.map((c) => [
            staff.nameOf(c.user_id),
            c.payments,
            c.collected.toFixed(2),
            c.refunds.toFixed(2),
            c.net.toFixed(2),
          ]),
          align: ['left', 'right', 'right', 'right', 'right'],
        };
      }
      case 'waiters': {
        const perf = waiterPerformance(d.orders);
        return {
          cards: [
            { label: 'Waiters active', value: perf.length },
            { label: 'Gross sales', value: money(s.grossSales) },
          ],
          chart: (
            <ShareBars format={money} rows={perf.map((w) => ({ label: staff.nameOf(w.user_id), value: w.sales }))} />
          ),
          headers: ['Waiter', 'Orders', 'Sales', 'Average order', 'Cancelled'],
          rows: perf.map((w) => [staff.nameOf(w.user_id), w.orders, w.sales.toFixed(2), w.avg.toFixed(2), w.cancelled]),
          align: ['left', 'right', 'right', 'right', 'right'],
        };
      }
      case 'tables': {
        const perf = tablePerformance(d.orders);
        const label = (id: string) => {
          const t = d.tables.find((x) => x.id === id);
          return t ? `Table ${t.table_number}${t.name ? ` · ${t.name}` : ''}` : '—';
        };
        return {
          cards: [
            { label: 'Tables used', value: perf.length },
            { label: 'Dine-in sales', value: money(perf.reduce((a, t) => a + t.sales, 0)) },
          ],
          chart: (
            <ShareBars
              format={money}
              rows={perf.slice(0, 10).map((t) => ({ label: label(t.table_id), value: t.sales }))}
            />
          ),
          headers: ['Table', 'Orders', 'Sales', 'Average order', 'Guests'],
          rows: perf.map((t) => [label(t.table_id), t.orders, t.sales.toFixed(2), t.avg.toFixed(2), t.guests]),
          align: ['left', 'right', 'right', 'right', 'right'],
        };
      }
      case 'methods': {
        const m = byPaymentMethod(d.payments);
        return {
          cards: salesCards.slice(1, 3),
          chart: (
            <ShareBars format={money} rows={m.map((x) => ({ label: PAYMENT_METHOD_LABEL[x.method], value: x.net }))} />
          ),
          headers: ['Method', 'Payments', 'Collected', 'Refunds', 'Net'],
          rows: m.map((x) => [
            PAYMENT_METHOD_LABEL[x.method],
            x.payments,
            x.collected.toFixed(2),
            x.refunds.toFixed(2),
            x.net.toFixed(2),
          ]),
          align: ['left', 'right', 'right', 'right', 'right'],
        };
      }
      case 'refunds': {
        const refunds = d.payments.filter((p) => p.kind === 'refund' && p.status === 'succeeded');
        const orderNo = (id: string) => d.orders.find((o) => o.id === id)?.order_number ?? '(earlier order)';
        return {
          cards: [
            { label: 'Refunds', value: refunds.length, tone: 'orange' },
            { label: 'Refunded amount', value: money(s.refunds), tone: 'red' },
          ],
          headers: ['Date', 'Order #', 'Method', 'Amount', 'Reason', 'By'],
          rows: refunds.map((p) => [
            formatDateTime(p.created_at, tz),
            orderNo(p.order_id),
            PAYMENT_METHOD_LABEL[p.method],
            p.amount.toFixed(2),
            p.notes,
            staff.nameOf(p.cashier_id),
          ]),
          align: ['left', 'left', 'left', 'right', 'left', 'left'],
        };
      }
      case 'expenses': {
        const cats = expenseByCategory(d.expenses);
        const approved = d.expenses.filter((e) => e.status === 'approved');
        return {
          cards: [
            { label: 'Approved expenses', value: money(cats.reduce((a, c) => a + c.amount, 0)), tone: 'red' },
            {
              label: 'Pending approval',
              value: money(d.expenses.filter((e) => e.status === 'pending').reduce((a, e) => a + e.amount, 0)),
              tone: 'orange',
            },
          ],
          chart: <ShareBars format={money} rows={cats.map((c) => ({ label: c.category, value: c.amount }))} />,
          headers: ['Date', 'Category', 'Description', 'Method', 'Reference', 'Amount'],
          rows: approved.map((e) => [
            e.expense_date,
            e.category,
            e.description,
            PAYMENT_METHOD_LABEL[e.payment_method],
            e.reference_number,
            e.amount.toFixed(2),
          ]),
          align: ['left', 'left', 'left', 'left', 'left', 'right'],
          note: 'Only approved, non-archived expenses are included.',
        };
      }
      case 'inventory': {
        const v = inventoryValuation(d.inventory);
        const active = d.inventory.filter((i) => !i.archived_at);
        return {
          cards: [
            { label: 'Valuation (current)', value: money(v.value) },
            { label: 'Low stock', value: v.lowStock.length, tone: 'orange' },
            { label: 'Out of stock', value: v.outOfStock, tone: 'red' },
          ],
          headers: ['Item', 'Category', 'On hand', 'Unit', 'Minimum', 'Unit cost', 'Value', 'Status'],
          rows: active.map((i) => [
            i.name,
            i.category,
            i.quantity,
            i.unit,
            i.min_stock,
            i.unit_cost.toFixed(4),
            (Math.max(i.quantity, 0) * i.unit_cost).toFixed(2),
            i.quantity <= 0 ? 'Out of stock' : i.min_stock > 0 && i.quantity <= i.min_stock ? 'Low' : 'OK',
          ]),
          align: ['left', 'left', 'right', 'left', 'right', 'right', 'right', 'left'],
          note: 'Inventory figures are a live snapshot and are not affected by the date filter.',
        };
      }
      case 'movements': {
        const byType = new Map<string, number>();
        for (const m of d.movements) byType.set(m.movement_type, (byType.get(m.movement_type) ?? 0) + 1);
        return {
          cards: [
            { label: 'Movements', value: d.movements.length },
            ...[...byType.entries()]
              .slice(0, 3)
              .map(([t, n]) => ({ label: MOVEMENT_LABEL[t as keyof typeof MOVEMENT_LABEL], value: n })),
          ],
          headers: ['Date', 'Item', 'Type', 'Change', 'Balance after', 'Unit cost', 'Reason', 'By'],
          rows: d.movements.map((m) => [
            formatDateTime(m.created_at, tz),
            itemName(m.inventory_item_id)?.name,
            MOVEMENT_LABEL[m.movement_type],
            m.quantity_change,
            m.quantity_after,
            m.unit_cost,
            m.reason,
            staff.nameOf(m.created_by),
          ]),
          align: ['left', 'left', 'left', 'right', 'right', 'right', 'left', 'left'],
        };
      }
      case 'profit': {
        const p = profitEstimate(d.orders, d.items, s.refunds, d.expenses);
        return {
          cards: [
            { label: 'Net sales (excl. tax)', value: money(p.netSalesExTax) },
            {
              label: 'Cost of goods',
              value: money(p.costOfGoods),
              tone: 'orange',
              sub: `Cost known for ${p.costCoveragePct}% of item revenue`,
            },
            {
              label: 'Gross profit (estimate)',
              value: p.grossProfit === null ? 'Not available' : money(p.grossProfit),
              tone: 'green',
            },
            {
              label: 'Net profit (estimate)',
              value: p.netProfit === null ? 'Not available' : money(p.netProfit),
              tone: p.netProfit !== null && p.netProfit < 0 ? 'red' : 'navy',
            },
          ],
          headers: ['Line', 'Amount'],
          rows: [
            ['Net sales excl. tax', p.netSalesExTax.toFixed(2)],
            ['− Refunds', p.refunds.toFixed(2)],
            ['− Cost of goods sold (known costs)', p.costOfGoods.toFixed(2)],
            ['= Gross profit', p.grossProfit?.toFixed(2) ?? 'n/a'],
            ['− Approved expenses', p.expenses.toFixed(2)],
            ['= Net profit', p.netProfit?.toFixed(2) ?? 'n/a'],
          ],
          align: ['left', 'right'],
          note:
            p.grossProfit === null
              ? 'ESTIMATE UNAVAILABLE: no sold items have a cost price. Add cost prices to products to enable profit estimates.'
              : `ESTIMATE. ${p.complete ? 'All sold items had cost prices.' : `Only ${p.costCoveragePct}% of item revenue has a known cost, so cost of goods is understated and profit overstated.`} Supplier payments are not included.`,
        };
      }
    }
  }, [q.data, report, range, staff.nameOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = REPORTS.find(([id]) => id === report)?.[1] ?? '';
  return (
    <div>
      <PageHeader
        eyebrow="Finance & Insights · Analytics"
        title="Reports & Analytics"
        description="All figures are calculated from recorded orders, payments, expenses and stock movements."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Printer className="h-4 w-4" />}
              onClick={() => window.print()}
              disabled={!built}
            >
              Print
            </Button>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              disabled={!built?.rows.length}
              onClick={() =>
                built && downloadCsv(`${report}_report_${range.from}_${range.to}`, built.headers, built.rows)
              }
            >
              Export CSV
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="no-print card h-fit p-2" aria-label="Reports">
          {REPORTS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              aria-current={report === id ? 'page' : undefined}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${report === id ? 'bg-brand-red text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-brand-navy">{title}</h2>
              <p className="text-xs text-slate-500">
                {r.name} · {range.from} to {range.to} ({tz})
              </p>
            </div>
            <div className="no-print">
              <DateRangeFilter value={range} onChange={setRange} timeZone={tz} />
            </div>
          </div>
          {q.error ? (
            <div className="card">
              <ErrorState message={q.error} onRetry={q.reload} />
            </div>
          ) : !built ? (
            <div className="card">
              <TableSkeleton />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {built.cards.map((c) => (
                  <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} tone={c.tone} />
                ))}
              </div>
              {built.note && (
                <p
                  className={`rounded-lg p-3 text-sm ${built.note.startsWith('ESTIMATE') ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-600'}`}
                >
                  {built.note}
                </p>
              )}
              {built.chart && <Card title="Chart">{built.chart}</Card>}
              <Card title="Details" bodyClassName="p-0">
                {!built.rows.length ? (
                  <EmptyState title="No records for this period" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50/70">
                        <tr>
                          {built.headers.map((h, i) => (
                            <th key={h} className={`th ${built.align?.[i] === 'right' ? 'text-right' : ''}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {built.rows.slice(0, 500).map((row, i) => (
                          <tr key={i}>
                            {row.map((c, j) => (
                              <td
                                key={j}
                                className={`td ${built.align?.[j] === 'right' ? 'text-right tabular-nums' : ''}`}
                              >
                                {c === null || c === undefined || c === '' ? '—' : String(c)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {built.rows.length > 500 && (
                      <p className="p-3 text-center text-xs text-slate-500">
                        Showing first 500 of {built.rows.length} rows. Export CSV for the full report.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
