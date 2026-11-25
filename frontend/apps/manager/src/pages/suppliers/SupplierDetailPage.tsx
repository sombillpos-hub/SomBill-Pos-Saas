import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { supabase, unwrap } from '@sombill/api-client/supabase';
import { formatDate, formatDateTime, formatMoney } from '@sombill/shared-utils/format';
import type { PurchaseOrder, PurchaseOrderItem, Supplier } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, type Column } from '@sombill/shared-ui/ui/DataTable';
import { POStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { Button } from '@sombill/shared-ui/ui/Button';
import { SupplierModal, supplierBalances } from './SuppliersPage';

export default function SupplierDetailPage() {
  const { id = '' } = useParams();
  const r = useRestaurant();
  const navigate = useNavigate();
  const money = (n: number) => formatMoney(n, r.currency);
  const [editing, setEditing] = useState(false);
  const q = useQuery(async () => {
    const supplier = unwrap(
      await supabase.from('suppliers').select('*').eq('id', id).eq('restaurant_id', r.id).maybeSingle(),
    ) as Supplier | null;
    if (!supplier) return null;
    const pos = unwrap(
      await supabase
        .from('purchase_orders')
        .select('*')
        .eq('supplier_id', id)
        .order('created_at', { ascending: false }),
    ) as PurchaseOrder[];
    const lines = pos.length
      ? (unwrap(
          await supabase
            .from('purchase_order_items')
            .select('*')
            .in(
              'purchase_order_id',
              pos.map((p) => p.id),
            ),
        ) as PurchaseOrderItem[])
      : [];
    return {
      supplier,
      pos,
      bal: supplierBalances(pos, lines).get(id) ?? { orders: 0, purchased: 0, paid: 0, balance: 0 },
    };
  }, [id, r.id]);

  if (q.loading && !q.data) return <Skeleton className="h-64 w-full" />;
  if (q.error)
    return (
      <div className="card">
        <ErrorState message={q.error} onRetry={q.reload} />
      </div>
    );
  if (!q.data)
    return (
      <div className="card">
        <EmptyState
          title="Supplier not found"
          action={
            <Link to="/suppliers">
              <Button variant="secondary">Back</Button>
            </Link>
          }
        />
      </div>
    );
  const { supplier: s, pos, bal } = q.data;
  const columns: Column<PurchaseOrder>[] = [
    { key: 'no', header: 'PO', cell: (p) => <b>PO-{p.po_number}</b> },
    { key: 'date', header: 'Created', cell: (p) => formatDateTime(p.created_at, r.timezone) },
    { key: 'exp', header: 'Expected', cell: (p) => formatDate(p.expected_date) },
    { key: 'st', header: 'Status', cell: (p) => <POStatusBadge s={p.status} /> },
    { key: 'total', header: 'Total', align: 'right', cell: (p) => money(p.total) },
    { key: 'paid', header: 'Paid', align: 'right', cell: (p) => money(p.amount_paid) },
  ];
  return (
    <div>
      <div className="mb-2">
        <Link to="/suppliers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-red">
          <ArrowLeft className="h-4 w-4" /> Suppliers
        </Link>
      </div>
      <PageHeader
        title={s.name}
        description={[s.contact_person, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}
        actions={
          <>
            {!s.archived_at && (
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {!s.archived_at && s.is_active && (
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => navigate(`/purchase-orders?new=1&supplier=${s.id}`)}
              >
                New purchase order
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Received value" value={money(bal.purchased)} />
        <StatCard label="Paid to supplier" value={money(bal.paid)} tone="green" />
        <StatCard label="Outstanding balance" value={money(bal.balance)} tone="red" />
      </div>
      {(s.address || s.notes) && (
        <Card className="mt-6" title="Details">
          <p className="text-sm text-slate-600">{s.address}</p>
          {s.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{s.notes}</p>}
        </Card>
      )}
      <Card className="mt-6" title="Purchase history" bodyClassName="p-0">
        <DataTable
          columns={columns}
          rows={pos}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/purchase-orders/${p.id}`)}
          empty={<EmptyState title="No purchase orders yet" />}
        />
      </Card>
      {editing && (
        <SupplierModal
          supplier={s}
          restaurantId={r.id}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await q.reload();
          }}
        />
      )}
    </div>
  );
}
