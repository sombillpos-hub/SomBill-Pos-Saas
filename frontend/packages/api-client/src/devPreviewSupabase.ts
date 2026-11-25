/**
 * In-memory dev-preview Supabase adapter.
 * Only active in local development (DEV && MODE !== 'test') when VITE_SUPABASE_URL is unset or still a placeholder.
 * Populates realistic SomBill hospitality data so every dashboard, chart, table, and form is immediately interactive.
 */

const RID = 'dev-restaurant-001';
const ORG_ID = 'dev-org-001';
const UID_ADMIN = 'dev-user-001';
const UID_CASHIER = 'dev-user-002';
const UID_WAITER_1 = 'dev-user-003';
const UID_WAITER_2 = 'dev-user-004';
const UID_KITCHEN = 'dev-user-005';

const isoOffset = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
const dayOffset = (daysAgo: number, hour = 13) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
};
const dateOnly = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

type Row = Record<string, unknown>;

function createSeedStore(): Record<string, Row[]> {
  const categories: Row[] = [
    {
      id: 'cat-1',
      restaurant_id: RID,
      name: 'Somali Specialties',
      description: 'Traditional Hargeisa mains & rice platters',
      image_url: null,
      display_order: 1,
      is_active: true,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(5),
    },
    {
      id: 'cat-2',
      restaurant_id: RID,
      name: 'Grill & BBQ',
      description: 'Charcoal-grilled goat, camel & Red Sea fish',
      image_url: null,
      display_order: 2,
      is_active: true,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(5),
    },
    {
      id: 'cat-3',
      restaurant_id: RID,
      name: 'Breakfast',
      description: 'Fresh canjeero, malawax & spiced liver',
      image_url: null,
      display_order: 3,
      is_active: true,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(5),
    },
    {
      id: 'cat-4',
      restaurant_id: RID,
      name: 'Fresh Juices',
      description: 'Cold-pressed seasonal fruit blends',
      image_url: null,
      display_order: 4,
      is_active: true,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(5),
    },
    {
      id: 'cat-5',
      restaurant_id: RID,
      name: 'Hot Drinks',
      description: 'Spiced Somali shaah & Qawa coffee',
      image_url: null,
      display_order: 5,
      is_active: true,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(5),
    },
  ];

  const inventory_items: Row[] = [
    {
      id: 'inv-1',
      restaurant_id: RID,
      name: 'Basmati Rice (Sella)',
      sku: 'ING-001',
      category: 'Dry Goods',
      unit: 'kg',
      quantity: 48,
      min_stock: 20,
      unit_cost: 1.85,
      supplier_id: 'sup-3',
      archived_at: null,
      created_at: dayOffset(40),
      updated_at: isoOffset(45),
    },
    {
      id: 'inv-2',
      restaurant_id: RID,
      name: 'Fresh Goat Meat',
      sku: 'ING-002',
      category: 'Meat',
      unit: 'kg',
      quantity: 6.5,
      min_stock: 12,
      unit_cost: 8.5,
      supplier_id: 'sup-1',
      archived_at: null,
      created_at: dayOffset(40),
      updated_at: isoOffset(30),
    },
    {
      id: 'inv-3',
      restaurant_id: RID,
      name: 'Camel Tenderloin',
      sku: 'ING-003',
      category: 'Meat',
      unit: 'kg',
      quantity: 14,
      min_stock: 10,
      unit_cost: 9.2,
      supplier_id: 'sup-1',
      archived_at: null,
      created_at: dayOffset(40),
      updated_at: isoOffset(90),
    },
    {
      id: 'inv-4',
      restaurant_id: RID,
      name: 'Red Sea Snapper',
      sku: 'ING-004',
      category: 'Seafood',
      unit: 'kg',
      quantity: 2.5,
      min_stock: 8,
      unit_cost: 11.0,
      supplier_id: 'sup-2',
      archived_at: null,
      created_at: dayOffset(40),
      updated_at: isoOffset(60),
    },
    {
      id: 'inv-5',
      restaurant_id: RID,
      name: 'Xawaash Spice Blend',
      sku: 'ING-005',
      category: 'Spices',
      unit: 'kg',
      quantity: 9,
      min_stock: 4,
      unit_cost: 6.0,
      supplier_id: 'sup-3',
      archived_at: null,
      created_at: dayOffset(40),
      updated_at: dayOffset(2),
    },
    {
      id: 'inv-6',
      restaurant_id: RID,
      name: 'Fresh Ripe Mangoes',
      sku: 'ING-006',
      category: 'Produce',
      unit: 'kg',
      quantity: 4,
      min_stock: 10,
      unit_cost: 2.1,
      supplier_id: 'sup-4',
      archived_at: null,
      created_at: dayOffset(40),
      updated_at: isoOffset(20),
    },
    {
      id: 'inv-7',
      restaurant_id: RID,
      name: 'Camel Milk (Fresh)',
      sku: 'ING-007',
      category: 'Dairy',
      unit: 'L',
      quantity: 18,
      min_stock: 8,
      unit_cost: 1.6,
      supplier_id: 'sup-4',
      archived_at: null,
      created_at: dayOffset(40),
      updated_at: isoOffset(120),
    },
    {
      id: 'inv-8',
      restaurant_id: RID,
      name: 'Takeaway Meal Boxes',
      sku: 'PKG-001',
      category: 'Packaging',
      unit: 'pcs',
      quantity: 240,
      min_stock: 100,
      unit_cost: 0.22,
      supplier_id: 'sup-3',
      archived_at: null,
      created_at: dayOffset(40),
      updated_at: dayOffset(1),
    },
  ];

  const products: Row[] = [
    {
      id: 'prod-1',
      restaurant_id: RID,
      category_id: 'cat-1',
      name: 'Bariis Isku-Karis & Hilib Ari',
      description: 'Fragrant spiced basmati rice with slow-roasted tender goat meat & bisbaas',
      sku: 'MAIN-001',
      barcode: '6291001',
      image_url: null,
      price: 11.5,
      cost_price: 4.8,
      tax_category: 'standard',
      is_available: true,
      track_stock: true,
      inventory_item_id: 'inv-2',
      preparation_station: 'kitchen',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(2),
    },
    {
      id: 'prod-2',
      restaurant_id: RID,
      category_id: 'cat-2',
      name: 'Hilib Ari Solan (Grilled Goat)',
      description: 'Charcoal-grilled goat ribs served with fresh salad and flatbread',
      sku: 'GRL-002',
      barcode: '6291002',
      image_url: null,
      price: 13.0,
      cost_price: 5.5,
      tax_category: 'standard',
      is_available: true,
      track_stock: true,
      inventory_item_id: 'inv-2',
      preparation_station: 'grill',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(2),
    },
    {
      id: 'prod-3',
      restaurant_id: RID,
      category_id: 'cat-2',
      name: 'Camel Steak Platter',
      description: 'Marinated camel tenderloin seared with garlic, herbs & roasted potatoes',
      sku: 'GRL-003',
      barcode: '6291003',
      image_url: null,
      price: 14.5,
      cost_price: 6.1,
      tax_category: 'standard',
      is_available: true,
      track_stock: true,
      inventory_item_id: 'inv-3',
      preparation_station: 'grill',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(1),
    },
    {
      id: 'prod-4',
      restaurant_id: RID,
      category_id: 'cat-2',
      name: 'Kalluun Shilan (Berbera Snapper)',
      description: 'Whole grilled Red Sea snapper with lemon, coriander & spiced rice',
      sku: 'SEA-004',
      barcode: '6291004',
      image_url: null,
      price: 16.0,
      cost_price: 7.2,
      tax_category: 'standard',
      is_available: true,
      track_stock: true,
      inventory_item_id: 'inv-4',
      preparation_station: 'grill',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(3),
    },
    {
      id: 'prod-5',
      restaurant_id: RID,
      category_id: 'cat-1',
      name: 'Suqaar & Sabaayad',
      description: 'Diced spiced beef sautéed with peppers and flaky layered flatbread',
      sku: 'MAIN-005',
      barcode: '6291005',
      image_url: null,
      price: 8.5,
      cost_price: 3.4,
      tax_category: 'standard',
      is_available: true,
      track_stock: false,
      inventory_item_id: null,
      preparation_station: 'kitchen',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(4),
    },
    {
      id: 'prod-6',
      restaurant_id: RID,
      category_id: 'cat-3',
      name: 'Beer & Canjeero',
      description: 'Pan-seared spiced goat liver with 2 fresh sourdough canjeero',
      sku: 'BRK-006',
      barcode: '6291006',
      image_url: null,
      price: 7.0,
      cost_price: 2.8,
      tax_category: 'standard',
      is_available: true,
      track_stock: false,
      inventory_item_id: null,
      preparation_station: 'kitchen',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(4),
    },
    {
      id: 'prod-7',
      restaurant_id: RID,
      category_id: 'cat-4',
      name: 'Fresh Mango & Lime Jug',
      description: 'Chilled pure mango blended with fresh lime',
      sku: 'BEV-007',
      barcode: '6291007',
      image_url: null,
      price: 3.5,
      cost_price: 0.9,
      tax_category: 'standard',
      is_available: true,
      track_stock: true,
      inventory_item_id: 'inv-6',
      preparation_station: 'bar',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(1),
    },
    {
      id: 'prod-8',
      restaurant_id: RID,
      category_id: 'cat-5',
      name: 'Camel Milk Spiced Shaah',
      description: 'Cardamom, cinnamon & clove Somali tea with fresh camel milk',
      sku: 'HOT-008',
      barcode: '6291008',
      image_url: null,
      price: 2.0,
      cost_price: 0.45,
      tax_category: 'standard',
      is_available: true,
      track_stock: true,
      inventory_item_id: 'inv-7',
      preparation_station: 'bar',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(1),
    },
    {
      id: 'prod-9',
      restaurant_id: RID,
      category_id: 'cat-1',
      name: 'Sambusa Trio (Beef)',
      description: 'Crispy golden pastries with house green bisbaas',
      sku: 'STR-009',
      barcode: '6291009',
      image_url: null,
      price: 4.0,
      cost_price: 1.2,
      tax_category: 'standard',
      is_available: true,
      track_stock: false,
      inventory_item_id: null,
      preparation_station: 'kitchen',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(4),
    },
    {
      id: 'prod-10',
      restaurant_id: RID,
      category_id: 'cat-3',
      name: 'Malawax & Sidr Honey',
      description: 'Sweet cardamom crepes drizzled with local Somali honey',
      sku: 'BRK-010',
      barcode: '6291010',
      image_url: null,
      price: 5.0,
      cost_price: 1.6,
      tax_category: 'standard',
      is_available: false,
      track_stock: false,
      inventory_item_id: null,
      preparation_station: 'bakery',
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(4),
    },
  ];

  const restaurant_tables: Row[] = [
    {
      id: 'tbl-1',
      restaurant_id: RID,
      table_number: 1,
      name: 'Window Booth',
      capacity: 4,
      section: 'Main Dining',
      floor: 'Ground Floor',
      pos_x: 0,
      pos_y: 0,
      shape: 'square',
      needs_cleaning: false,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
    {
      id: 'tbl-2',
      restaurant_id: RID,
      table_number: 2,
      name: 'Center Table',
      capacity: 4,
      section: 'Main Dining',
      floor: 'Ground Floor',
      pos_x: 3,
      pos_y: 0,
      shape: 'square',
      needs_cleaning: false,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
    {
      id: 'tbl-3',
      restaurant_id: RID,
      table_number: 3,
      name: 'Family Round',
      capacity: 6,
      section: 'Main Dining',
      floor: 'Ground Floor',
      pos_x: 6,
      pos_y: 0,
      shape: 'round',
      needs_cleaning: false,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
    {
      id: 'tbl-4',
      restaurant_id: RID,
      table_number: 4,
      name: 'VIP Majlis 1',
      capacity: 8,
      section: 'VIP Majlis',
      floor: 'Ground Floor',
      pos_x: 9,
      pos_y: 0,
      shape: 'rectangle',
      needs_cleaning: false,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
    {
      id: 'tbl-5',
      restaurant_id: RID,
      table_number: 5,
      name: 'Patio Lounge',
      capacity: 4,
      section: 'Terrace',
      floor: 'Terrace',
      pos_x: 0,
      pos_y: 0,
      shape: 'round',
      needs_cleaning: false,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
    {
      id: 'tbl-6',
      restaurant_id: RID,
      table_number: 6,
      name: 'Sunset Corner',
      capacity: 6,
      section: 'Terrace',
      floor: 'Terrace',
      pos_x: 4,
      pos_y: 0,
      shape: 'rectangle',
      needs_cleaning: false,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
    {
      id: 'tbl-7',
      restaurant_id: RID,
      table_number: 7,
      name: 'VIP Majlis 2',
      capacity: 10,
      section: 'VIP Majlis',
      floor: 'Ground Floor',
      pos_x: 0,
      pos_y: 2,
      shape: 'rectangle',
      needs_cleaning: false,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
    {
      id: 'tbl-8',
      restaurant_id: RID,
      table_number: 8,
      name: 'Quick Counter',
      capacity: 2,
      section: 'Main Dining',
      floor: 'Ground Floor',
      pos_x: 4,
      pos_y: 2,
      shape: 'square',
      needs_cleaning: false,
      archived_at: null,
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
  ];

  const customers: Row[] = [
    {
      id: 'cust-1',
      restaurant_id: RID,
      name: 'Jama Mohamed',
      phone: '+252 63 4112233',
      email: 'jama@hargeisa.so',
      address: 'Jigjiga Yar, Hargeisa',
      notes: 'Prefers VIP Majlis 1',
      archived_at: null,
      created_at: dayOffset(35),
      updated_at: dayOffset(1),
    },
    {
      id: 'cust-2',
      restaurant_id: RID,
      name: 'Amina Ismail',
      phone: '+252 63 4556677',
      email: 'amina.i@telesom.so',
      address: '26 June District',
      notes: 'Corporate lunch account',
      archived_at: null,
      created_at: dayOffset(28),
      updated_at: dayOffset(2),
    },
    {
      id: 'cust-3',
      restaurant_id: RID,
      name: 'Khadar Muse',
      phone: '+252 63 4889900',
      email: null,
      address: 'Shaab Area, Hargeisa',
      notes: 'Regular weekend family dinner',
      archived_at: null,
      created_at: dayOffset(20),
      updated_at: dayOffset(3),
    },
    {
      id: 'cust-4',
      restaurant_id: RID,
      name: 'Sahra Abdi',
      phone: '+252 63 4223344',
      email: 'sahra@dahabshiil.com',
      address: 'Presidential Road',
      notes: null,
      archived_at: null,
      created_at: dayOffset(12),
      updated_at: dayOffset(1),
    },
  ];

  const profiles: Row[] = [
    {
      id: UID_ADMIN,
      full_name: 'Ahmed Hassan',
      email: 'admin@sombill.com',
      phone: '+252 63 4408910',
      avatar_url: null,
      last_login_at: isoOffset(5),
      created_at: dayOffset(90),
      updated_at: isoOffset(5),
    },
    {
      id: UID_CASHIER,
      full_name: 'Hodan Ali',
      email: 'hodan@sombill.com',
      phone: '+252 63 4408911',
      avatar_url: null,
      last_login_at: isoOffset(18),
      created_at: dayOffset(80),
      updated_at: isoOffset(18),
    },
    {
      id: UID_WAITER_1,
      full_name: 'Abdi Yusuf',
      email: 'abdi@sombill.com',
      phone: '+252 63 4408912',
      avatar_url: null,
      last_login_at: isoOffset(22),
      created_at: dayOffset(75),
      updated_at: isoOffset(22),
    },
    {
      id: UID_WAITER_2,
      full_name: 'Fartun Omar',
      email: 'fartun@sombill.com',
      phone: '+252 63 4408913',
      avatar_url: null,
      last_login_at: isoOffset(40),
      created_at: dayOffset(60),
      updated_at: isoOffset(40),
    },
    {
      id: UID_KITCHEN,
      full_name: 'Mohamed Farah',
      email: 'kitchen@sombill.com',
      phone: '+252 63 4408914',
      avatar_url: null,
      last_login_at: isoOffset(50),
      created_at: dayOffset(60),
      updated_at: isoOffset(50),
    },
  ];

  const restaurant_members: Row[] = [
    {
      id: 'mem-1',
      restaurant_id: RID,
      user_id: UID_ADMIN,
      role: 'manager',
      status: 'active',
      created_at: dayOffset(90),
      updated_at: dayOffset(1),
    },
    {
      id: 'mem-2',
      restaurant_id: RID,
      user_id: UID_CASHIER,
      role: 'cashier',
      status: 'active',
      created_at: dayOffset(80),
      updated_at: dayOffset(1),
    },
    {
      id: 'mem-3',
      restaurant_id: RID,
      user_id: UID_WAITER_1,
      role: 'waiter',
      status: 'active',
      created_at: dayOffset(75),
      updated_at: dayOffset(1),
    },
    {
      id: 'mem-4',
      restaurant_id: RID,
      user_id: UID_WAITER_2,
      role: 'waiter',
      status: 'active',
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
    {
      id: 'mem-5',
      restaurant_id: RID,
      user_id: UID_KITCHEN,
      role: 'kitchen',
      status: 'active',
      created_at: dayOffset(60),
      updated_at: dayOffset(1),
    },
  ];

  const orders: Row[] = [
    // Today's live orders
    {
      id: 'ord-101',
      restaurant_id: RID,
      order_number: 1041,
      order_type: 'dine_in',
      table_id: 'tbl-1',
      customer_id: 'cust-1',
      waiter_id: UID_WAITER_1,
      cashier_id: UID_CASHIER,
      status: 'completed',
      payment_status: 'paid',
      subtotal: 42.0,
      discount_amount: 0,
      tax_amount: 2.1,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 44.1,
      amount_paid: 44.1,
      amount_refunded: 0,
      guest_count: 3,
      notes: null,
      bill_requested_at: isoOffset(160),
      bill_acknowledged_by: UID_CASHIER,
      cancel_reason: null,
      created_at: isoOffset(195),
      updated_at: isoOffset(140),
    },
    {
      id: 'ord-102',
      restaurant_id: RID,
      order_number: 1042,
      order_type: 'dine_in',
      table_id: 'tbl-4',
      customer_id: 'cust-2',
      waiter_id: UID_WAITER_1,
      cashier_id: UID_CASHIER,
      status: 'completed',
      payment_status: 'paid',
      subtotal: 68.5,
      discount_amount: 3.5,
      tax_amount: 3.25,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 68.25,
      amount_paid: 68.25,
      amount_refunded: 0,
      guest_count: 5,
      notes: 'VIP corporate lunch',
      bill_requested_at: isoOffset(115),
      bill_acknowledged_by: UID_CASHIER,
      cancel_reason: null,
      created_at: isoOffset(150),
      updated_at: isoOffset(105),
    },
    {
      id: 'ord-103',
      restaurant_id: RID,
      order_number: 1043,
      order_type: 'takeaway',
      table_id: null,
      customer_id: null,
      waiter_id: UID_CASHIER,
      cashier_id: UID_CASHIER,
      status: 'completed',
      payment_status: 'paid',
      subtotal: 24.5,
      discount_amount: 0,
      tax_amount: 1.23,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 25.73,
      amount_paid: 25.73,
      amount_refunded: 0,
      guest_count: 1,
      notes: 'Extra bisbaas',
      bill_requested_at: null,
      bill_acknowledged_by: null,
      cancel_reason: null,
      created_at: isoOffset(110),
      updated_at: isoOffset(95),
    },
    {
      id: 'ord-104',
      restaurant_id: RID,
      order_number: 1044,
      order_type: 'dine_in',
      table_id: 'tbl-2',
      customer_id: 'cust-3',
      waiter_id: UID_ADMIN,
      cashier_id: null,
      status: 'served',
      payment_status: 'unpaid',
      subtotal: 35.0,
      discount_amount: 0,
      tax_amount: 1.75,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 36.75,
      amount_paid: 0,
      amount_refunded: 0,
      guest_count: 3,
      notes: null,
      bill_requested_at: isoOffset(12),
      bill_acknowledged_by: null,
      cancel_reason: null,
      created_at: isoOffset(55),
      updated_at: isoOffset(12),
    },
    {
      id: 'ord-105',
      restaurant_id: RID,
      order_number: 1045,
      order_type: 'dine_in',
      table_id: 'tbl-3',
      customer_id: null,
      waiter_id: UID_ADMIN,
      cashier_id: null,
      status: 'preparing',
      payment_status: 'unpaid',
      subtotal: 49.0,
      discount_amount: 0,
      tax_amount: 2.45,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 51.45,
      amount_paid: 0,
      amount_refunded: 0,
      guest_count: 4,
      notes: 'Well done grill',
      bill_requested_at: null,
      bill_acknowledged_by: null,
      cancel_reason: null,
      created_at: isoOffset(25),
      updated_at: isoOffset(10),
    },
    {
      id: 'ord-106',
      restaurant_id: RID,
      order_number: 1046,
      order_type: 'dine_in',
      table_id: 'tbl-5',
      customer_id: 'cust-4',
      waiter_id: UID_ADMIN,
      cashier_id: UID_CASHIER,
      status: 'ready',
      payment_status: 'partial',
      subtotal: 32.0,
      discount_amount: 0,
      tax_amount: 1.6,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 33.6,
      amount_paid: 20.0,
      amount_refunded: 0,
      guest_count: 2,
      notes: null,
      bill_requested_at: isoOffset(8),
      bill_acknowledged_by: UID_CASHIER,
      cancel_reason: null,
      created_at: isoOffset(35),
      updated_at: isoOffset(8),
    },
    {
      id: 'ord-107',
      restaurant_id: RID,
      order_number: 1047,
      order_type: 'delivery',
      table_id: null,
      customer_id: 'cust-1',
      waiter_id: UID_CASHIER,
      cashier_id: UID_CASHIER,
      status: 'completed',
      payment_status: 'refunded',
      subtotal: 16.0,
      discount_amount: 0,
      tax_amount: 0.8,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 16.8,
      amount_paid: 16.8,
      amount_refunded: 8.0,
      guest_count: 1,
      notes: 'Partial refund for late delivery',
      bill_requested_at: null,
      bill_acknowledged_by: null,
      cancel_reason: null,
      created_at: isoOffset(210),
      updated_at: isoOffset(165),
    },
    // Historical orders for 7-day trend chart
    {
      id: 'ord-201',
      restaurant_id: RID,
      order_number: 1038,
      order_type: 'dine_in',
      table_id: 'tbl-4',
      customer_id: 'cust-2',
      waiter_id: UID_WAITER_1,
      cashier_id: UID_CASHIER,
      status: 'completed',
      payment_status: 'paid',
      subtotal: 120.0,
      discount_amount: 5.0,
      tax_amount: 5.75,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 120.75,
      amount_paid: 120.75,
      amount_refunded: 0,
      guest_count: 6,
      notes: null,
      bill_requested_at: null,
      bill_acknowledged_by: null,
      cancel_reason: null,
      created_at: dayOffset(1, 14),
      updated_at: dayOffset(1, 15),
    },
    {
      id: 'ord-202',
      restaurant_id: RID,
      order_number: 1035,
      order_type: 'dine_in',
      table_id: 'tbl-3',
      customer_id: 'cust-3',
      waiter_id: UID_WAITER_2,
      cashier_id: UID_CASHIER,
      status: 'completed',
      payment_status: 'paid',
      subtotal: 95.0,
      discount_amount: 0,
      tax_amount: 4.75,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 99.75,
      amount_paid: 99.75,
      amount_refunded: 0,
      guest_count: 5,
      notes: null,
      bill_requested_at: null,
      bill_acknowledged_by: null,
      cancel_reason: null,
      created_at: dayOffset(2, 13),
      updated_at: dayOffset(2, 14),
    },
    {
      id: 'ord-203',
      restaurant_id: RID,
      order_number: 1031,
      order_type: 'dine_in',
      table_id: 'tbl-1',
      customer_id: null,
      waiter_id: UID_WAITER_1,
      cashier_id: UID_CASHIER,
      status: 'completed',
      payment_status: 'paid',
      subtotal: 142.0,
      discount_amount: 0,
      tax_amount: 7.1,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 149.1,
      amount_paid: 149.1,
      amount_refunded: 0,
      guest_count: 7,
      notes: null,
      bill_requested_at: null,
      bill_acknowledged_by: null,
      cancel_reason: null,
      created_at: dayOffset(3, 19),
      updated_at: dayOffset(3, 20),
    },
    {
      id: 'ord-204',
      restaurant_id: RID,
      order_number: 1028,
      order_type: 'takeaway',
      table_id: null,
      customer_id: 'cust-4',
      waiter_id: UID_CASHIER,
      cashier_id: UID_CASHIER,
      status: 'completed',
      payment_status: 'paid',
      subtotal: 84.0,
      discount_amount: 0,
      tax_amount: 4.2,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 88.2,
      amount_paid: 88.2,
      amount_refunded: 0,
      guest_count: 3,
      notes: null,
      bill_requested_at: null,
      bill_acknowledged_by: null,
      cancel_reason: null,
      created_at: dayOffset(4, 15),
      updated_at: dayOffset(4, 16),
    },
    {
      id: 'ord-205',
      restaurant_id: RID,
      order_number: 1024,
      order_type: 'dine_in',
      table_id: 'tbl-7',
      customer_id: 'cust-1',
      waiter_id: UID_WAITER_2,
      cashier_id: UID_CASHIER,
      status: 'completed',
      payment_status: 'paid',
      subtotal: 165.0,
      discount_amount: 10.0,
      tax_amount: 7.75,
      tax_rate: 0.05,
      tax_inclusive: false,
      total: 162.75,
      amount_paid: 162.75,
      amount_refunded: 0,
      guest_count: 8,
      notes: null,
      bill_requested_at: null,
      bill_acknowledged_by: null,
      cancel_reason: null,
      created_at: dayOffset(5, 20),
      updated_at: dayOffset(5, 21),
    },
  ];

  const order_items: Row[] = [
    {
      id: 'oi-1',
      restaurant_id: RID,
      order_id: 'ord-101',
      product_id: 'prod-1',
      product_name: 'Bariis Isku-Karis & Hilib Ari',
      quantity: 2,
      unit_price: 11.5,
      line_total: 23.0,
      is_voided: false,
      notes: null,
      created_at: isoOffset(195),
    },
    {
      id: 'oi-2',
      restaurant_id: RID,
      order_id: 'ord-101',
      product_id: 'prod-3',
      product_name: 'Camel Steak Platter',
      quantity: 1,
      unit_price: 14.5,
      line_total: 14.5,
      is_voided: false,
      notes: null,
      created_at: isoOffset(195),
    },
    {
      id: 'oi-3',
      restaurant_id: RID,
      order_id: 'ord-101',
      product_id: 'prod-8',
      product_name: 'Camel Milk Spiced Shaah',
      quantity: 2,
      unit_price: 2.0,
      line_total: 4.0,
      is_voided: false,
      notes: null,
      created_at: isoOffset(195),
    },
    {
      id: 'oi-4',
      restaurant_id: RID,
      order_id: 'ord-102',
      product_id: 'prod-2',
      product_name: 'Hilib Ari Solan (Grilled Goat)',
      quantity: 3,
      unit_price: 13.0,
      line_total: 39.0,
      is_voided: false,
      notes: null,
      created_at: isoOffset(150),
    },
    {
      id: 'oi-5',
      restaurant_id: RID,
      order_id: 'ord-102',
      product_id: 'prod-4',
      product_name: 'Kalluun Shilan (Berbera Snapper)',
      quantity: 1,
      unit_price: 16.0,
      line_total: 16.0,
      is_voided: false,
      notes: null,
      created_at: isoOffset(150),
    },
    {
      id: 'oi-6',
      restaurant_id: RID,
      order_id: 'ord-102',
      product_id: 'prod-7',
      product_name: 'Fresh Mango & Lime Jug',
      quantity: 3,
      unit_price: 3.5,
      line_total: 10.5,
      is_voided: false,
      notes: null,
      created_at: isoOffset(150),
    },
    {
      id: 'oi-7',
      restaurant_id: RID,
      order_id: 'ord-103',
      product_id: 'prod-1',
      product_name: 'Bariis Isku-Karis & Hilib Ari',
      quantity: 2,
      unit_price: 11.5,
      line_total: 23.0,
      is_voided: false,
      notes: 'Extra bisbaas',
      created_at: isoOffset(110),
    },
    {
      id: 'oi-8',
      restaurant_id: RID,
      order_id: 'ord-104',
      product_id: 'prod-3',
      product_name: 'Camel Steak Platter',
      quantity: 2,
      unit_price: 14.5,
      line_total: 29.0,
      is_voided: false,
      notes: null,
      created_at: isoOffset(55),
    },
    {
      id: 'oi-9',
      restaurant_id: RID,
      order_id: 'ord-104',
      product_id: 'prod-8',
      product_name: 'Camel Milk Spiced Shaah',
      quantity: 3,
      unit_price: 2.0,
      line_total: 6.0,
      is_voided: false,
      notes: null,
      created_at: isoOffset(55),
    },
    {
      id: 'oi-10',
      restaurant_id: RID,
      order_id: 'ord-105',
      product_id: 'prod-2',
      product_name: 'Hilib Ari Solan (Grilled Goat)',
      quantity: 2,
      unit_price: 13.0,
      line_total: 26.0,
      is_voided: false,
      notes: 'Well done',
      created_at: isoOffset(25),
    },
    {
      id: 'oi-11',
      restaurant_id: RID,
      order_id: 'ord-105',
      product_id: 'prod-1',
      product_name: 'Bariis Isku-Karis & Hilib Ari',
      quantity: 2,
      unit_price: 11.5,
      line_total: 23.0,
      is_voided: false,
      notes: null,
      created_at: isoOffset(25),
    },
    {
      id: 'oi-12',
      restaurant_id: RID,
      order_id: 'ord-106',
      product_id: 'prod-4',
      product_name: 'Kalluun Shilan (Berbera Snapper)',
      quantity: 2,
      unit_price: 16.0,
      line_total: 32.0,
      is_voided: false,
      notes: null,
      created_at: isoOffset(35),
    },
  ];

  const payments: Row[] = [
    {
      id: 'pay-1',
      restaurant_id: RID,
      order_id: 'ord-101',
      transaction_number: 5001,
      kind: 'payment',
      method: 'zaad',
      status: 'succeeded',
      verification_status: 'verified',
      amount: 44.1,
      reference: 'ZD-884210',
      cashier_id: UID_CASHIER,
      amount_received: null,
      change_given: null,
      created_at: isoOffset(140),
    },
    {
      id: 'pay-2',
      restaurant_id: RID,
      order_id: 'ord-102',
      transaction_number: 5002,
      kind: 'payment',
      method: 'card',
      status: 'succeeded',
      verification_status: 'not_required',
      amount: 68.25,
      reference: 'VISA-4921',
      cashier_id: UID_CASHIER,
      amount_received: null,
      change_given: null,
      created_at: isoOffset(105),
    },
    {
      id: 'pay-3',
      restaurant_id: RID,
      order_id: 'ord-103',
      transaction_number: 5003,
      kind: 'payment',
      method: 'cash',
      status: 'succeeded',
      verification_status: 'not_required',
      amount: 25.73,
      reference: null,
      cashier_id: UID_CASHIER,
      amount_received: 30.0,
      change_given: 4.27,
      created_at: isoOffset(95),
    },
    {
      id: 'pay-4',
      restaurant_id: RID,
      order_id: 'ord-106',
      transaction_number: 5004,
      kind: 'payment',
      method: 'evc_plus',
      status: 'succeeded',
      verification_status: 'verified',
      amount: 20.0,
      reference: 'EVC-773019',
      cashier_id: UID_CASHIER,
      amount_received: null,
      change_given: null,
      created_at: isoOffset(8),
    },
    {
      id: 'pay-5',
      restaurant_id: RID,
      order_id: 'ord-107',
      transaction_number: 5005,
      kind: 'payment',
      method: 'zaad',
      status: 'succeeded',
      verification_status: 'verified',
      amount: 16.8,
      reference: 'ZD-884102',
      cashier_id: UID_CASHIER,
      amount_received: null,
      change_given: null,
      created_at: isoOffset(180),
    },
    {
      id: 'pay-6',
      restaurant_id: RID,
      order_id: 'ord-107',
      transaction_number: 5006,
      kind: 'refund',
      method: 'zaad',
      status: 'succeeded',
      verification_status: 'not_required',
      amount: 8.0,
      reference: 'RF-1047',
      cashier_id: UID_ADMIN,
      amount_received: null,
      change_given: null,
      created_at: isoOffset(165),
    },
    {
      id: 'pay-7',
      restaurant_id: RID,
      order_id: 'ord-201',
      transaction_number: 4990,
      kind: 'payment',
      method: 'zaad',
      status: 'succeeded',
      verification_status: 'verified',
      amount: 120.75,
      reference: 'ZD-883901',
      cashier_id: UID_CASHIER,
      amount_received: null,
      change_given: null,
      created_at: dayOffset(1, 15),
    },
    {
      id: 'pay-8',
      restaurant_id: RID,
      order_id: 'ord-202',
      transaction_number: 4985,
      kind: 'payment',
      method: 'cash',
      status: 'succeeded',
      verification_status: 'not_required',
      amount: 99.75,
      reference: null,
      cashier_id: UID_CASHIER,
      amount_received: 100.0,
      change_given: 0.25,
      created_at: dayOffset(2, 14),
    },
    {
      id: 'pay-9',
      restaurant_id: RID,
      order_id: 'ord-203',
      transaction_number: 4980,
      kind: 'payment',
      method: 'card',
      status: 'succeeded',
      verification_status: 'not_required',
      amount: 149.1,
      reference: 'MC-8821',
      cashier_id: UID_CASHIER,
      amount_received: null,
      change_given: null,
      created_at: dayOffset(3, 20),
    },
    {
      id: 'pay-10',
      restaurant_id: RID,
      order_id: 'ord-204',
      transaction_number: 4974,
      kind: 'payment',
      method: 'evc_plus',
      status: 'succeeded',
      verification_status: 'verified',
      amount: 88.2,
      reference: 'EVC-772104',
      cashier_id: UID_CASHIER,
      amount_received: null,
      change_given: null,
      created_at: dayOffset(4, 16),
    },
    {
      id: 'pay-11',
      restaurant_id: RID,
      order_id: 'ord-205',
      transaction_number: 4969,
      kind: 'payment',
      method: 'zaad',
      status: 'succeeded',
      verification_status: 'verified',
      amount: 162.75,
      reference: 'ZD-882011',
      cashier_id: UID_CASHIER,
      amount_received: null,
      change_given: null,
      created_at: dayOffset(5, 21),
    },
  ];

  const suppliers: Row[] = [
    {
      id: 'sup-1',
      restaurant_id: RID,
      name: 'Hargeisa Fresh Meats',
      contact_person: 'Ismail Warsame',
      phone: '+252 63 4011220',
      email: 'orders@hargeisameats.so',
      address: 'Livestock Market Rd, Hargeisa',
      notes: 'Daily 6 AM delivery',
      is_active: true,
      archived_at: null,
      created_at: dayOffset(80),
      updated_at: dayOffset(2),
    },
    {
      id: 'sup-2',
      restaurant_id: RID,
      name: 'Berbera Seafood Co.',
      contact_person: 'Naima Duale',
      phone: '+252 63 4022331',
      email: 'supply@berberaseafood.so',
      address: 'Port Road, Berbera',
      notes: 'Chilled Red Sea catch',
      is_active: true,
      archived_at: null,
      created_at: dayOffset(70),
      updated_at: dayOffset(3),
    },
    {
      id: 'sup-3',
      restaurant_id: RID,
      name: 'Red Sea Wholesale Spices',
      contact_person: 'Saeed Nur',
      phone: '+252 63 4033442',
      email: 'sales@redseaspices.so',
      address: 'Waaheen Commercial Ave',
      notes: 'Bulk rice, oil & spices',
      is_active: true,
      archived_at: null,
      created_at: dayOffset(70),
      updated_at: dayOffset(4),
    },
    {
      id: 'sup-4',
      restaurant_id: RID,
      name: 'Horn Dairy & Produce',
      contact_person: 'Halima Farah',
      phone: '+252 63 4044553',
      email: 'halima@horndairy.so',
      address: 'Arabsiyo Farm Road',
      notes: 'Fresh camel milk & mangoes',
      is_active: true,
      archived_at: null,
      created_at: dayOffset(50),
      updated_at: dayOffset(1),
    },
  ];

  const purchase_orders: Row[] = [
    {
      id: 'po-1',
      restaurant_id: RID,
      po_number: 201,
      supplier_id: 'sup-1',
      status: 'ordered',
      expected_date: dateOnly(-1),
      notes: 'Weekend restock for goat & camel cuts',
      total: 245.0,
      amount_paid: 100.0,
      created_by: UID_ADMIN,
      created_at: dayOffset(1, 9),
      updated_at: dayOffset(1, 9),
    },
    {
      id: 'po-2',
      restaurant_id: RID,
      po_number: 200,
      supplier_id: 'sup-3',
      status: 'received',
      expected_date: dateOnly(3),
      notes: 'Monthly basmati rice & packaging',
      total: 310.0,
      amount_paid: 310.0,
      created_by: UID_ADMIN,
      created_at: dayOffset(5, 10),
      updated_at: dayOffset(3, 11),
    },
    {
      id: 'po-3',
      restaurant_id: RID,
      po_number: 202,
      supplier_id: 'sup-2',
      status: 'draft',
      expected_date: dateOnly(-2),
      notes: 'Fresh snapper order',
      total: 132.0,
      amount_paid: 0,
      created_by: UID_ADMIN,
      created_at: isoOffset(90),
      updated_at: isoOffset(90),
    },
  ];

  const purchase_order_items: Row[] = [
    {
      id: 'poi-1',
      restaurant_id: RID,
      purchase_order_id: 'po-1',
      inventory_item_id: 'inv-2',
      quantity_ordered: 20,
      quantity_received: 0,
      unit_cost: 8.5,
    },
    {
      id: 'poi-2',
      restaurant_id: RID,
      purchase_order_id: 'po-1',
      inventory_item_id: 'inv-3',
      quantity_ordered: 8,
      quantity_received: 0,
      unit_cost: 9.2,
    },
    {
      id: 'poi-3',
      restaurant_id: RID,
      purchase_order_id: 'po-2',
      inventory_item_id: 'inv-1',
      quantity_ordered: 100,
      quantity_received: 100,
      unit_cost: 1.85,
    },
    {
      id: 'poi-4',
      restaurant_id: RID,
      purchase_order_id: 'po-2',
      inventory_item_id: 'inv-8',
      quantity_ordered: 500,
      quantity_received: 500,
      unit_cost: 0.22,
    },
    {
      id: 'poi-5',
      restaurant_id: RID,
      purchase_order_id: 'po-3',
      inventory_item_id: 'inv-4',
      quantity_ordered: 12,
      quantity_received: 0,
      unit_cost: 11.0,
    },
  ];

  const expenses: Row[] = [
    {
      id: 'exp-1',
      restaurant_id: RID,
      expense_date: dateOnly(0),
      category: 'Utilities',
      description: 'Sompower monthly electricity bill',
      amount: 185.0,
      payment_method: 'zaad',
      reference_number: 'SP-99201',
      supplier_id: null,
      status: 'approved',
      attachment_path: null,
      created_by: UID_ADMIN,
      approved_by: UID_ADMIN,
      approved_at: isoOffset(180),
      rejection_reason: null,
      archived_at: null,
      created_at: isoOffset(200),
      updated_at: isoOffset(180),
    },
    {
      id: 'exp-2',
      restaurant_id: RID,
      expense_date: dateOnly(1),
      category: 'Supplies',
      description: 'Charcoal & kitchen gas cylinders',
      amount: 74.0,
      payment_method: 'cash',
      reference_number: 'GAS-412',
      supplier_id: null,
      status: 'approved',
      attachment_path: null,
      created_by: UID_ADMIN,
      approved_by: UID_ADMIN,
      approved_at: dayOffset(1, 12),
      rejection_reason: null,
      archived_at: null,
      created_at: dayOffset(1, 11),
      updated_at: dayOffset(1, 12),
    },
    {
      id: 'exp-3',
      restaurant_id: RID,
      expense_date: dateOnly(2),
      category: 'Maintenance',
      description: 'Grill exhaust fan servicing',
      amount: 55.0,
      payment_method: 'evc_plus',
      reference_number: 'MNT-108',
      supplier_id: null,
      status: 'pending',
      attachment_path: null,
      created_by: UID_CASHIER,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      archived_at: null,
      created_at: dayOffset(2, 16),
      updated_at: dayOffset(2, 16),
    },
    {
      id: 'exp-4',
      restaurant_id: RID,
      expense_date: dateOnly(5),
      category: 'Rent',
      description: 'Main branch monthly premises rent',
      amount: 850.0,
      payment_method: 'bank_transfer',
      reference_number: 'RENT-NOV',
      supplier_id: null,
      status: 'approved',
      attachment_path: null,
      created_by: UID_ADMIN,
      approved_by: UID_ADMIN,
      approved_at: dayOffset(5, 9),
      rejection_reason: null,
      archived_at: null,
      created_at: dayOffset(5, 9),
      updated_at: dayOffset(5, 9),
    },
  ];

  const audit_logs: Row[] = [
    {
      id: 1,
      restaurant_id: RID,
      actor_id: UID_CASHIER,
      action: 'create',
      entity_type: 'payments',
      entity_id: 'pay-4',
      old_data: null,
      new_data: { amount: 20.0, method: 'evc_plus' },
      reason: null,
      created_at: isoOffset(8),
    },
    {
      id: 2,
      restaurant_id: RID,
      actor_id: UID_WAITER_1,
      action: 'create',
      entity_type: 'orders',
      entity_id: 'ord-105',
      old_data: null,
      new_data: { order_number: 1045 },
      reason: null,
      created_at: isoOffset(25),
    },
    {
      id: 3,
      restaurant_id: RID,
      actor_id: UID_ADMIN,
      action: 'price_change',
      entity_type: 'products',
      entity_id: 'prod-3',
      old_data: { price: 13.5 },
      new_data: { price: 14.5 },
      reason: 'Updated seasonal tenderloin price',
      created_at: isoOffset(85),
    },
    {
      id: 4,
      restaurant_id: RID,
      actor_id: UID_ADMIN,
      action: 'refund',
      entity_type: 'orders',
      entity_id: 'ord-107',
      old_data: null,
      new_data: { amount: 8.0 },
      reason: 'Late delivery goodwill credit',
      created_at: isoOffset(165),
    },
    {
      id: 5,
      restaurant_id: RID,
      actor_id: UID_ADMIN,
      action: 'create',
      entity_type: 'purchase_orders',
      entity_id: 'po-1',
      old_data: null,
      new_data: { po_number: 201 },
      reason: null,
      created_at: dayOffset(1, 9),
    },
  ];

  const stock_movements: Row[] = [
    {
      id: 'sm-1',
      restaurant_id: RID,
      inventory_item_id: 'inv-2',
      type: 'sale',
      quantity: -2.5,
      unit_cost: 8.5,
      note: 'Order #1042',
      created_by: UID_CASHIER,
      created_at: isoOffset(105),
    },
    {
      id: 'sm-2',
      restaurant_id: RID,
      inventory_item_id: 'inv-1',
      type: 'receive',
      quantity: 100,
      unit_cost: 1.85,
      note: 'PO-200 received',
      created_by: UID_ADMIN,
      created_at: dayOffset(3, 11),
    },
  ];

  const cashier_shifts: Row[] = [
    {
      id: 'sh-1',
      restaurant_id: RID,
      cashier_id: UID_CASHIER,
      opened_at: isoOffset(240),
      closed_at: null,
      opening_cash: 150.0,
      closing_cash: null,
      expected_cash: null,
      variance: null,
      notes: 'Morning shift',
      created_at: isoOffset(240),
    },
  ];

  const notifications: Row[] = [
    {
      id: 'ntf-1',
      restaurant_id: RID,
      user_id: UID_ADMIN,
      order_id: 'ord-106',
      type: 'order_ready',
      title: 'Order #1046 is ready to serve',
      body: 'Table 5 · 2× Kalluun Shilan',
      read_at: null,
      created_at: isoOffset(6),
    },
    {
      id: 'ntf-2',
      restaurant_id: RID,
      user_id: UID_ADMIN,
      order_id: 'ord-104',
      type: 'bill_acknowledged',
      title: 'Bill requested for Table 2',
      body: 'Order #1044 · $36.75',
      read_at: null,
      created_at: isoOffset(12),
    },
  ];

  return {
    categories,
    products,
    product_recipe_items: [],
    restaurant_tables,
    customers,
    profiles,
    restaurant_members,
    orders,
    order_items,
    payments,
    inventory_items,
    stock_movements,
    suppliers,
    purchase_orders,
    purchase_order_items,
    purchase_order_receipts: [],
    expenses,
    audit_logs,
    cashier_shifts,
    cash_movements: [],
    refunds: [],
    receipts: [],
    notifications,
    organizations: [
      {
        id: ORG_ID,
        name: 'SomBill Hospitality Group HQ',
        plan: 'enterprise',
        max_branches: 10,
        max_staff: 100,
        license_status: 'active',
        license_expires_at: null,
        settings: { reporting_currency: 'USD', fx_rates: { SLS: 11800 } },
        created_at: dayOffset(120),
      },
    ],
    restaurants: [
      {
        id: RID,
        organization_id: ORG_ID,
        name: 'SomBill Grand Restaurant & Cafe',
        currency: 'USD',
        timezone: 'Africa/Mogadishu',
        tax_rate: 0.05,
        tax_inclusive: false,
        tax_label: 'VAT',
        address: '150 Independence Ave, Hargeisa',
        phone: '+252 63 4408910',
        email: 'info@sombill.com',
        logo_url: null,
      },
    ],
  };
}

function deriveTableStatus(store: Record<string, Row[]>): Row[] {
  const activeOrders = (store.orders ?? []).filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  return (store.restaurant_tables ?? [])
    .filter((t) => !t.archived_at)
    .map((t) => {
      const o = activeOrders.find((x) => x.table_id === t.id);
      const paidNet = o ? Number(o.amount_paid ?? 0) - Number(o.amount_refunded ?? 0) : 0;
      const status = !o
        ? t.needs_cleaning
          ? 'cleaning'
          : 'available'
        : paidNet > 0
          ? 'payment_pending'
          : o.bill_requested_at
            ? 'bill_requested'
            : 'occupied';
      return {
        ...t,
        order_id: o?.id ?? null,
        order_number: o?.order_number ?? null,
        waiter_id: o?.waiter_id ?? null,
        order_started_at: o?.created_at ?? null,
        order_total: o?.total ?? null,
        balance: o ? Math.max(0, Number(o.total) - paidNet) : 0,
        status,
      };
    });
}

type FilterFn = (row: Row) => boolean;

class PreviewQuery {
  private filters: FilterFn[] = [];
  private ordersBy: Array<{ col: string; asc: boolean }> = [];
  private limitVal: number | null = null;
  private rangeVal: [number, number] | null = null;
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';
  private countMode = false;
  private headOnly = false;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: unknown = null;

  constructor(
    private store: Record<string, Row[]>,
    private table: string,
  ) {}

  select(_cols = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(data: Row | Row[]) {
    this.op = 'insert';
    this.payload = data;
    return this;
  }
  update(data: Row) {
    this.op = 'update';
    this.payload = data;
    return this;
  }
  upsert(data: Row | Row[]) {
    this.op = 'upsert';
    this.payload = data;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  gt(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? '') > String(val));
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? '') >= String(val));
    return this;
  }
  lt(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? '') < String(val));
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col] ?? '') <= String(val));
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (val === null ? r[col] == null : r[col] === val));
    return this;
  }
  not(col: string, op: string, val: unknown) {
    if (op === 'is' && val === null) this.filters.push((r) => r[col] != null);
    else if (op === 'in') {
      const list = String(val)
        .replace(/[()]/g, '')
        .split(',')
        .map((s) => s.trim());
      this.filters.push((r) => !list.includes(String(r[col] ?? '')));
    } else this.filters.push((r) => r[col] !== val);
    return this;
  }
  or(expr: string) {
    const parts = expr.split(',').map((p) => p.trim());
    this.filters.push((r) =>
      parts.some((p) => {
        const m = /^(\w+)\.ilike\.%(.*)%$/.exec(p);
        if (m)
          return String(r[m[1]!] ?? '')
            .toLowerCase()
            .includes((m[2] ?? '').toLowerCase());
        const eq = /^(\w+)\.eq\.(.*)$/.exec(p);
        if (eq) return String(r[eq[1]!] ?? '') === eq[2];
        return true;
      }),
    );
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.ordersBy.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitVal = n;
    return this;
  }
  range(from: number, to: number) {
    this.rangeVal = [from, to];
    return this;
  }
  single() {
    this.singleMode = 'single';
    return this;
  }
  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private exec() {
    const now = new Date().toISOString();
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = this.store[this.table] ?? (this.store[this.table] = []);
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload as Row]).map((r) => ({
        id: (r.id as string) ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        created_at: now,
        updated_at: now,
        ...r,
      }));
      for (const row of rows) {
        const idx = list.findIndex((x) => x.id === row.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...row, updated_at: now };
        else list.unshift(row);
      }
      const data = this.singleMode !== 'none' ? (rows[0] ?? null) : rows;
      return { data, error: null, count: rows.length };
    }
    if (this.op === 'update') {
      const list = this.store[this.table] ?? [];
      const updated: Row[] = [];
      for (let i = 0; i < list.length; i++) {
        if (this.filters.every((f) => f(list[i]!))) {
          list[i] = { ...list[i], ...(this.payload as Row), updated_at: now };
          updated.push(list[i]!);
        }
      }
      const data = this.singleMode !== 'none' ? (updated[0] ?? null) : updated;
      return { data, error: null, count: updated.length };
    }
    if (this.op === 'delete') {
      const list = this.store[this.table] ?? [];
      const kept: Row[] = [];
      const removed: Row[] = [];
      for (const r of list) {
        if (this.filters.every((f) => f(r))) removed.push(r);
        else kept.push(r);
      }
      this.store[this.table] = kept;
      return { data: removed, error: null, count: removed.length };
    }

    const base = this.table === 'table_status_v' ? deriveTableStatus(this.store) : (this.store[this.table] ?? []);
    let rows = base.filter((r) => this.filters.every((f) => f(r)));
    const totalCount = rows.length;
    if (this.ordersBy.length) {
      rows = [...rows].sort((a, b) => {
        for (const o of this.ordersBy) {
          const av = a[o.col] ?? '';
          const bv = b[o.col] ?? '';
          if (av < bv) return o.asc ? -1 : 1;
          if (av > bv) return o.asc ? 1 : -1;
        }
        return 0;
      });
    }
    if (this.rangeVal) rows = rows.slice(this.rangeVal[0], this.rangeVal[1] + 1);
    if (this.limitVal !== null) rows = rows.slice(0, this.limitVal);
    if (this.headOnly) return { data: null, error: null, count: totalCount };
    const data = this.singleMode !== 'none' ? (rows[0] ?? null) : rows;
    return { data, error: null, count: this.countMode ? totalCount : null };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: ReturnType<PreviewQuery['exec']>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.exec()).then(onfulfilled, onrejected);
  }
}

export function createDevPreviewSupabase() {
  const store = createSeedStore();

  return {
    from(table: string) {
      return new PreviewQuery(store, table);
    },
    async rpc(fn: string, params: Record<string, unknown> = {}) {
      if (fn === 'sales_summary') {
        const from = String(params.p_from ?? '');
        const to = String(params.p_to ?? '');
        const orders = (store.orders ?? []).filter(
          (o) => (!from || String(o.created_at) >= from) && (!to || String(o.created_at) < to),
        );
        const payments = (store.payments ?? []).filter(
          (p) =>
            p.status === 'succeeded' && (!from || String(p.created_at) >= from) && (!to || String(p.created_at) < to),
        );
        const live = orders.filter((o) => o.status !== 'cancelled');
        const gross = live.reduce((s, o) => s + Number(o.total), 0);
        const outstanding = live.reduce(
          (s, o) => s + Math.max(0, Number(o.total) - (Number(o.amount_paid) - Number(o.amount_refunded))),
          0,
        );
        const collected = payments.filter((p) => p.kind === 'payment').reduce((s, p) => s + Number(p.amount), 0);
        const refunds = payments.filter((p) => p.kind === 'refund').reduce((s, p) => s + Number(p.amount), 0);
        return {
          data: {
            gross_sales: Number(gross.toFixed(2)),
            total_orders: orders.length,
            completed_orders: orders.filter((o) => o.status === 'completed').length,
            cancelled_orders: orders.filter((o) => o.status === 'cancelled').length,
            pending_orders: orders.filter((o) =>
              ['new', 'pending', 'accepted', 'preparing', 'ready', 'served'].includes(String(o.status)),
            ).length,
            outstanding: Number(outstanding.toFixed(2)),
            avg_order_value: live.length ? Number((gross / live.length).toFixed(2)) : 0,
            collected: Number(collected.toFixed(2)),
            refunds: Number(refunds.toFixed(2)),
            net_collected: Number((collected - refunds).toFixed(2)),
          },
          error: null,
        };
      }
      if (fn === 'review_expense') {
        const exp = (store.expenses ?? []).find((e) => e.id === params.p_expense);
        if (exp) {
          exp.status = params.p_approve ? 'approved' : 'rejected';
          exp.rejection_reason = params.p_approve ? null : params.p_reason;
        }
        return { data: null, error: null };
      }
      if (fn === 'adjust_stock') {
        const item = (store.inventory_items ?? []).find((i) => i.id === params.p_item);
        if (item) item.quantity = Number(item.quantity) + Number(params.p_delta ?? 0);
        return { data: null, error: null };
      }
      if (fn === 'cancel_order') {
        const ord = (store.orders ?? []).find((o) => o.id === params.p_order);
        if (ord) {
          ord.status = 'cancelled';
          ord.cancel_reason = params.p_reason ?? null;
        }
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
    channel() {
      const ch = {
        on() {
          return ch;
        },
        subscribe(cb?: (status: string) => void) {
          if (cb) queueMicrotask(() => cb('SUBSCRIBED'));
          return ch;
        },
      };
      return ch;
    },
    removeChannel() {
      return Promise.resolve('ok');
    },
    storage: (() => {
      const uploadedUrls = new Map<string, string>();
      return {
        from() {
          return {
            upload: async (path: string, fileBody: unknown) => {
              if (typeof FileReader !== 'undefined' && fileBody instanceof Blob) {
                const dataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
                  reader.onerror = () => resolve('');
                  reader.readAsDataURL(fileBody);
                });
                if (dataUrl) uploadedUrls.set(path, dataUrl);
              } else if (typeof URL !== 'undefined' && fileBody instanceof Blob) {
                uploadedUrls.set(path, URL.createObjectURL(fileBody));
              }
              return { data: { path }, error: null };
            },
            getPublicUrl: (path: string) => ({
              data: { publicUrl: uploadedUrls.get(path) || '/branding/sombill-logo.jpg' },
            }),
            createSignedUrl: async (path: string) => ({
              data: { signedUrl: uploadedUrls.get(path) || '/branding/sombill-logo.jpg' },
              error: null,
            }),
          };
        },
      };
    })(),
    functions: {
      invoke: async () => ({ data: { ok: true }, error: null }),
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ data: { session: null, user: null }, error: null }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: { user: null }, error: null }),
    },
  };
}
