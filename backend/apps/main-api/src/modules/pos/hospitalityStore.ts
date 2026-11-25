import { randomUUID } from 'node:crypto';
import { realtimeChannel } from '../../websocket/index.js';

export type EntityRecord = Record<string, unknown> & {
  id: string;
  created_at: string;
  updated_at: string;
};

export interface DemoRequestLead extends EntityRecord {
  name: string;
  business: string;
  city: string;
  phone: string;
  status: 'new' | 'contacted' | 'scheduled';
}

export interface ContactLead extends EntityRecord {
  name: string;
  email: string;
  phone?: string;
  message: string;
  status: 'new' | 'replied';
}

export interface NewsletterSubscriber extends EntityRecord {
  email: string;
}

const DEFAULT_BRANCH = 'dev-restaurant-001';
const nowIso = () => new Date().toISOString();
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function seedCollections() {
  const categories: EntityRecord[] = [
    {
      id: 'cat-1',
      branch_id: DEFAULT_BRANCH,
      name: 'Somali Specialties',
      description: 'Traditional Hargeisa mains & spiced rice platters',
      display_order: 1,
      is_active: true,
      created_at: minsAgo(1440),
      updated_at: minsAgo(60),
    },
    {
      id: 'cat-2',
      branch_id: DEFAULT_BRANCH,
      name: 'Grill & BBQ',
      description: 'Charcoal-grilled goat, camel & Red Sea fish',
      display_order: 2,
      is_active: true,
      created_at: minsAgo(1440),
      updated_at: minsAgo(60),
    },
    {
      id: 'cat-3',
      branch_id: DEFAULT_BRANCH,
      name: 'Fresh Juices & Shaah',
      description: 'Cold-pressed juices, spiced Somali shaah & Qawa',
      display_order: 3,
      is_active: true,
      created_at: minsAgo(1440),
      updated_at: minsAgo(60),
    },
  ];

  const products: EntityRecord[] = [
    {
      id: 'prod-1',
      branch_id: DEFAULT_BRANCH,
      category_id: 'cat-1',
      name: 'Bariis Iskukaris & Goat',
      sku: 'SOM-001',
      price: 12.5,
      cost_price: 5.2,
      is_available: true,
      tax_exempt: false,
      created_at: minsAgo(1440),
      updated_at: minsAgo(30),
    },
    {
      id: 'prod-2',
      branch_id: DEFAULT_BRANCH,
      category_id: 'cat-2',
      name: 'Hargeisa Camel Suqaar',
      sku: 'SOM-002',
      price: 14.0,
      cost_price: 6.1,
      is_available: true,
      tax_exempt: false,
      created_at: minsAgo(1440),
      updated_at: minsAgo(30),
    },
    {
      id: 'prod-3',
      branch_id: DEFAULT_BRANCH,
      category_id: 'cat-2',
      name: 'Berbera Grilled Snapper',
      sku: 'SOM-003',
      price: 16.5,
      cost_price: 7.4,
      is_available: true,
      tax_exempt: false,
      created_at: minsAgo(1440),
      updated_at: minsAgo(30),
    },
    {
      id: 'prod-4',
      branch_id: DEFAULT_BRANCH,
      category_id: 'cat-3',
      name: 'Fresh Mango & Ginger Juice',
      sku: 'SOM-004',
      price: 3.5,
      cost_price: 1.1,
      is_available: true,
      tax_exempt: false,
      created_at: minsAgo(1440),
      updated_at: minsAgo(30),
    },
    {
      id: 'prod-5',
      branch_id: DEFAULT_BRANCH,
      category_id: 'cat-3',
      name: 'Spiced Somali Shaah (Pot)',
      sku: 'SOM-005',
      price: 4.0,
      cost_price: 0.9,
      is_available: true,
      tax_exempt: false,
      created_at: minsAgo(1440),
      updated_at: minsAgo(30),
    },
  ];

  const tables: EntityRecord[] = [
    {
      id: 'tbl-1',
      branch_id: DEFAULT_BRANCH,
      table_number: 'T1',
      section: 'Main Hall',
      capacity: 4,
      status: 'available',
      created_at: minsAgo(1440),
      updated_at: minsAgo(15),
    },
    {
      id: 'tbl-2',
      branch_id: DEFAULT_BRANCH,
      table_number: 'T2',
      section: 'Main Hall',
      capacity: 4,
      status: 'occupied',
      created_at: minsAgo(1440),
      updated_at: minsAgo(12),
    },
    {
      id: 'tbl-3',
      branch_id: DEFAULT_BRANCH,
      table_number: 'T3',
      section: 'VIP Lounge',
      capacity: 6,
      status: 'bill_requested',
      created_at: minsAgo(1440),
      updated_at: minsAgo(8),
    },
    {
      id: 'tbl-4',
      branch_id: DEFAULT_BRANCH,
      table_number: 'T4',
      section: 'Terrace',
      capacity: 2,
      status: 'available',
      created_at: minsAgo(1440),
      updated_at: minsAgo(25),
    },
  ];

  const orders: EntityRecord[] = [
    {
      id: 'ord-1001',
      branch_id: DEFAULT_BRANCH,
      order_number: 1044,
      order_type: 'dine_in',
      table_id: 'tbl-2',
      status: 'preparing',
      payment_status: 'unpaid',
      subtotal: 26.5,
      tax_amount: 1.33,
      discount_amount: 0,
      total: 27.83,
      amount_paid: 0,
      items: [
        { id: 'oi-1', product_id: 'prod-1', product_name: 'Bariis Iskukaris & Goat', quantity: 1, unit_price: 12.5 },
        { id: 'oi-2', product_id: 'prod-2', product_name: 'Hargeisa Camel Suqaar', quantity: 1, unit_price: 14.0 },
      ],
      created_at: minsAgo(22),
      updated_at: minsAgo(10),
    },
    {
      id: 'ord-1002',
      branch_id: DEFAULT_BRANCH,
      order_number: 1045,
      order_type: 'dine_in',
      table_id: 'tbl-3',
      status: 'ready',
      payment_status: 'unpaid',
      subtotal: 20.0,
      tax_amount: 1.0,
      discount_amount: 0,
      total: 21.0,
      amount_paid: 0,
      bill_requested_at: minsAgo(5),
      items: [
        { id: 'oi-3', product_id: 'prod-3', product_name: 'Berbera Grilled Snapper', quantity: 1, unit_price: 16.5 },
        { id: 'oi-4', product_id: 'prod-4', product_name: 'Fresh Mango & Ginger Juice', quantity: 1, unit_price: 3.5 },
      ],
      created_at: minsAgo(35),
      updated_at: minsAgo(5),
    },
  ];

  const payments: EntityRecord[] = [
    {
      id: 'pay-1001',
      branch_id: DEFAULT_BRANCH,
      order_id: 'ord-1000',
      method: 'zaad',
      amount: 42.5,
      status: 'completed',
      verification_status: 'verified',
      reference: 'ZAAD-994821',
      created_at: minsAgo(90),
      updated_at: minsAgo(88),
    },
  ];

  const shifts: EntityRecord[] = [
    {
      id: 'sh-1001',
      branch_id: DEFAULT_BRANCH,
      cashier_name: 'Hodan Ali',
      status: 'open',
      opening_cash: 150,
      opened_at: minsAgo(180),
      closed_at: null,
      created_at: minsAgo(180),
      updated_at: minsAgo(180),
    },
  ];

  const inventory: EntityRecord[] = [
    {
      id: 'inv-1',
      branch_id: DEFAULT_BRANCH,
      name: 'Basmati Rice (Sella)',
      sku: 'ING-001',
      unit: 'kg',
      quantity: 48,
      min_stock: 20,
      unit_cost: 1.85,
      created_at: minsAgo(2880),
      updated_at: minsAgo(60),
    },
    {
      id: 'inv-2',
      branch_id: DEFAULT_BRANCH,
      name: 'Fresh Goat Meat',
      sku: 'ING-002',
      unit: 'kg',
      quantity: 6.5,
      min_stock: 12,
      unit_cost: 8.5,
      created_at: minsAgo(2880),
      updated_at: minsAgo(30),
    },
  ];

  const suppliers: EntityRecord[] = [
    {
      id: 'sup-1',
      branch_id: DEFAULT_BRANCH,
      name: 'Hargeisa Livestock & Meats',
      phone: '+252 63 4412001',
      email: 'supply@hargeisameats.so',
      created_at: minsAgo(5000),
      updated_at: minsAgo(200),
    },
  ];

  const purchaseOrders: EntityRecord[] = [
    {
      id: 'po-1001',
      branch_id: DEFAULT_BRANCH,
      supplier_id: 'sup-1',
      po_number: 'PO-2026-001',
      status: 'ordered',
      total: 420.0,
      created_at: minsAgo(360),
      updated_at: minsAgo(360),
    },
  ];

  const expenses: EntityRecord[] = [
    {
      id: 'exp-1001',
      branch_id: DEFAULT_BRANCH,
      category: 'Utilities',
      description: 'Monthly electricity & generator fuel',
      amount: 185.0,
      payment_method: 'zaad',
      created_at: minsAgo(720),
      updated_at: minsAgo(720),
    },
  ];

  const customers: EntityRecord[] = [
    {
      id: 'cust-1',
      branch_id: DEFAULT_BRANCH,
      name: 'Faysal Jama',
      phone: '+252 63 4429100',
      email: 'faysal@example.so',
      visits: 14,
      total_spent: 382.5,
      created_at: minsAgo(5000),
      updated_at: minsAgo(120),
    },
  ];

  const notifications: EntityRecord[] = [
    {
      id: 'notif-1',
      branch_id: DEFAULT_BRANCH,
      type: 'order_ready',
      title: 'Order #1045 is ready for Table T3',
      read_at: null,
      created_at: minsAgo(5),
      updated_at: minsAgo(5),
    },
  ];

  const auditLogs: EntityRecord[] = [
    {
      id: 'aud-1',
      branch_id: DEFAULT_BRANCH,
      action: 'shift.open',
      entity_type: 'cashier_shift',
      entity_id: 'sh-1001',
      reason: 'Morning shift opened with $150 float',
      review_status: 'pending',
      created_at: minsAgo(180),
      updated_at: minsAgo(180),
    },
  ];

  return {
    categories,
    products,
    tables,
    orders,
    payments,
    shifts,
    inventory,
    suppliers,
    purchaseOrders,
    expenses,
    customers,
    notifications,
    auditLogs,
  };
}

export type CollectionName = keyof ReturnType<typeof seedCollections>;

class HospitalityStore {
  private collections = seedCollections();
  private orderSeq = 1045;
  public demoRequests: DemoRequestLead[] = [];
  public contactLeads: ContactLead[] = [];
  public newsletterSubscribers: NewsletterSubscriber[] = [];

  list(name: CollectionName, branchId?: string): EntityRecord[] {
    const items = this.collections[name];
    if (!branchId) return [...items];
    return items.filter((item) => !item.branch_id || item.branch_id === branchId);
  }

  get(name: CollectionName, id: string): EntityRecord | undefined {
    return this.collections[name].find((item) => item.id === id);
  }

  create(name: CollectionName, data: Record<string, unknown>, eventName?: string): EntityRecord {
    const ts = nowIso();
    const record: EntityRecord = {
      ...data,
      id: typeof data.id === 'string' && data.id ? data.id : randomUUID(),
      branch_id: typeof data.branch_id === 'string' && data.branch_id ? data.branch_id : DEFAULT_BRANCH,
      created_at: ts,
      updated_at: ts,
    };
    if (name === 'orders' && record.order_number === undefined) {
      record.order_number = ++this.orderSeq;
    }
    this.collections[name].unshift(record);
    if (eventName) {
      realtimeChannel.broadcast(String(record.branch_id), eventName, record);
    }
    return record;
  }

  update(name: CollectionName, id: string, patch: Record<string, unknown>, eventName?: string): EntityRecord | null {
    const idx = this.collections[name].findIndex((item) => item.id === id);
    if (idx === -1) return null;
    const current = this.collections[name][idx]!;
    const updated: EntityRecord = {
      ...current,
      ...patch,
      id,
      created_at: current.created_at,
      updated_at: nowIso(),
    };
    this.collections[name][idx] = updated;
    if (eventName) {
      realtimeChannel.broadcast(String(updated.branch_id ?? '*'), eventName, updated);
    }
    return updated;
  }

  remove(name: CollectionName, id: string, eventName?: string): boolean {
    const idx = this.collections[name].findIndex((item) => item.id === id);
    if (idx === -1) return false;
    const [removed] = this.collections[name].splice(idx, 1);
    if (eventName && removed) {
      realtimeChannel.broadcast(String(removed.branch_id ?? '*'), eventName, { id });
    }
    return true;
  }

  addDemoRequest(input: { name: string; business: string; city: string; phone: string }): DemoRequestLead {
    const ts = nowIso();
    const lead: DemoRequestLead = {
      id: randomUUID(),
      name: input.name,
      business: input.business,
      city: input.city,
      phone: input.phone,
      status: 'new',
      created_at: ts,
      updated_at: ts,
    };
    this.demoRequests.unshift(lead);
    return lead;
  }

  addContactLead(input: { name: string; email: string; phone?: string; message: string }): ContactLead {
    const ts = nowIso();
    const lead: ContactLead = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message,
      status: 'new',
      created_at: ts,
      updated_at: ts,
    };
    this.contactLeads.unshift(lead);
    return lead;
  }

  addNewsletter(email: string): NewsletterSubscriber {
    const existing = this.newsletterSubscribers.find((s) => s.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing;
    const ts = nowIso();
    const sub: NewsletterSubscriber = {
      id: randomUUID(),
      email: email.toLowerCase(),
      created_at: ts,
      updated_at: ts,
    };
    this.newsletterSubscribers.unshift(sub);
    return sub;
  }
}

export const hospitalityStore = new HospitalityStore();
