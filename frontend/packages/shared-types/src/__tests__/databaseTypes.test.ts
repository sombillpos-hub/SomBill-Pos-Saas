import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Database, Enums, Tables } from '../database.types';
import type {
  AppRole,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  Profile,
  Restaurant,
  TableStatusRow,
} from '../types';

describe('generated Supabase Database schema parity', () => {
  it('derives enums 1:1 from Database["public"]["Enums"]', () => {
    expectTypeOf<AppRole>().toEqualTypeOf<Enums<'app_role'>>();
    expectTypeOf<OrderStatus>().toEqualTypeOf<Enums<'order_status'>>();
    expectTypeOf<PaymentMethod>().toEqualTypeOf<Enums<'payment_method'>>();
  });

  it('includes every SQL column added across migrations 000001..000008', () => {
    expectTypeOf<Restaurant['organization_id']>().toEqualTypeOf<string | null>();
    expectTypeOf<Restaurant['order_seq']>().toEqualTypeOf<number>();
    expectTypeOf<Restaurant['po_seq']>().toEqualTypeOf<number>();
    expectTypeOf<Restaurant['txn_seq']>().toEqualTypeOf<number>();
    expectTypeOf<Restaurant['receipt_seq']>().toEqualTypeOf<number>();
    expectTypeOf<Profile['created_at']>().toEqualTypeOf<string>();
    expectTypeOf<Profile['updated_at']>().toEqualTypeOf<string>();
    expectTypeOf<Order['bill_requested_by']>().toEqualTypeOf<string | null>();
    expectTypeOf<Order['bill_acknowledged_at']>().toEqualTypeOf<string | null>();
    expectTypeOf<OrderItem['created_by']>().toEqualTypeOf<string | null>();
    expectTypeOf<OrderItem['updated_at']>().toEqualTypeOf<string>();
    expectTypeOf<Payment['transaction_number']>().toEqualTypeOf<number | null>();
    expectTypeOf<Payment['request_key']>().toEqualTypeOf<string | null>();
    expectTypeOf<Tables<'orders'>>().toEqualTypeOf<Order>();
    expectTypeOf<TableStatusRow['id']>().toEqualTypeOf<string>();
    expectTypeOf<keyof Database['public']['Tables']>().not.toBeNever();
    expect(true).toBe(true);
  });
});
