import { Badge, type Tone } from './Feedback';
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  PO_STATUS_LABEL,
  TABLE_STATUS_LABEL,
} from '@sombill/shared-utils/format';
import type { ExpenseStatus, OrderStatus, PaymentStatus, POStatus, TableStatus } from '@sombill/shared-types/types';

const ORDER_TONE: Record<OrderStatus, Tone> = {
  new: 'blue',
  pending: 'yellow',
  accepted: 'blue',
  preparing: 'orange',
  ready: 'purple',
  served: 'navy',
  completed: 'green',
  cancelled: 'red',
};
const PAY_TONE: Record<PaymentStatus, Tone> = { unpaid: 'red', partial: 'orange', paid: 'green', refunded: 'gray' };
const PO_TONE: Record<POStatus, Tone> = {
  draft: 'gray',
  ordered: 'blue',
  partially_received: 'orange',
  received: 'green',
  cancelled: 'red',
};
export const TABLE_TONE: Record<TableStatus, Tone> = {
  available: 'green',
  occupied: 'orange',
  bill_requested: 'purple',
  payment_pending: 'red',
  cleaning: 'blue',
};
const EXP_TONE: Record<ExpenseStatus, Tone> = { pending: 'yellow', approved: 'green', rejected: 'red' };

export const OrderStatusBadge = ({ s }: { s: OrderStatus }) => (
  <Badge tone={ORDER_TONE[s]}>{ORDER_STATUS_LABEL[s]}</Badge>
);
export const PaymentStatusBadge = ({ s }: { s: PaymentStatus }) => (
  <Badge tone={PAY_TONE[s]}>{PAYMENT_STATUS_LABEL[s]}</Badge>
);
export const POStatusBadge = ({ s }: { s: POStatus }) => <Badge tone={PO_TONE[s]}>{PO_STATUS_LABEL[s]}</Badge>;
export const TableStatusBadge = ({ s }: { s: TableStatus }) => (
  <Badge tone={TABLE_TONE[s]}>{TABLE_STATUS_LABEL[s]}</Badge>
);
const EXP_LABEL: Record<ExpenseStatus, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
export const ExpenseStatusBadge = ({ s }: { s: ExpenseStatus }) => (
  <Badge tone={EXP_TONE[s] ?? 'gray'}>{EXP_LABEL[s] ?? 'Unknown'}</Badge>
);
