// SomBill AI v2.0 — Page-Aware Quick Chips & Bilingual (EN + Somali) Knowledge Base

export const PAGE_CHIPS = {
  '/': [
    { label: '🚀 Request Demo', query: 'How do I get a free SomBill POS demo?' },
    {
      label: '🍽️ Restaurant POS',
      query: 'What features do you have for restaurants and cafes?',
    },
    {
      label: '🏨 Hotel Management',
      query: 'How does SomBill work for hotels and rooms?',
    },
    {
      label: '💳 Local Payments',
      query: 'Does SomBill support EVC Plus, Zaad, and eDahab?',
    },
    { label: '💰 Pricing Plans', query: 'What are the SomBill pricing plans?' },
  ],
  '/pricing': [
    {
      label: '📋 Plan Features',
      query: 'What is included in each SomBill plan?',
    },
    { label: '🆓 Free Trial', query: 'Do you offer a free trial or demo?' },
    {
      label: '💳 Payment Methods',
      query: 'How can we pay for our subscription?',
    },
    {
      label: '🖥️ Hardware & Printers',
      query: 'What POS hardware and receipt printers work with SomBill?',
    },
  ],
  '/contact': [
    { label: '📞 24/7 Support', query: 'How can I contact SomBill support?' },
    { label: '📍 Office Location', query: 'Where is SomBill located?' },
    {
      label: '⚡ Setup Time',
      query: 'How fast can you set up SomBill for my business?',
    },
  ],
};

export const DEFAULT_CHIPS = [
  { label: '🚀 Free Demo', query: 'How do I get a free SomBill POS demo?' },
  {
    label: '🍽️ POS Features',
    query: 'What features do you have for restaurants and cafes?',
  },
  { label: '💰 Pricing', query: 'What are the SomBill pricing plans?' },
  {
    label: '💳 EVC / Zaad',
    query: 'Does SomBill support EVC Plus, Zaad, and eDahab?',
  },
  { label: '📞 Contact Sales', query: 'How can I contact SomBill support?' },
];

export const WELCOME_MESSAGE = {
  id: 'sombill-welcome-1',
  sender: 'bot',
  timestamp: 'Just now',
  text: `Asc / Welcome! 👋 I am **SomBill AI**, your **Trusted Hospitality Partner** assistant.\n\nAsk me anything in **English** or **Af-Soomaali** about:\n• **Restaurant & Cafe POS** (KOT, KDS, Table & QR Menu)\n• **Hotel PMS & Room Billing** (Guest Folios & Night Audit)\n• **Local Payments** (**Zaad**, **EVC Plus**, **eDahab**, **Sahal** & Cards)\n• **Offline Mode**, **Inventory**, or [Pricing](/pricing) & [Book a Free Demo](/demo)`,
};

export const KNOWLEDGE_BASE = [
  {
    id: 'greetings',
    keywords: [
      'hello',
      'hi',
      'hey',
      'asc',
      'salam',
      'salaam',
      'sidee',
      'subax',
      'galab',
      'assalamu',
      'waan ku salaamay',
    ],
    response: `**Assalamu Alaikum & Welcome to SomBill AI!** ✨\n\nI am your **Trusted Hospitality Partner Assistant** (English & Af-Soomaali). Here is how I can help your business today:\n• **Restaurant & Cafe POS** — Fast touch billing, Table maps, KOT & Kitchen Display (KDS)\n• **Hotel & Room Billing** — Front-desk check-in/out & Guest Folio room charges\n• **Inventory & Recipe Costing** — Automatic gram-level stock deduction\n• **Local Mobile Money** — **Zaad**, **EVC Plus**, **eDahab**, **Sahal**, Premier Wallet & Visa\n• **Hybrid Offline Mode** — Zero downtime even if internet drops\n• **Transparent Plans** — Explore [Pricing](/pricing) or [Contact](/contact) to book a free live demo!`,
  },
  {
    id: 'restaurant_pos',
    keywords: [
      'restaurant',
      'cafe',
      'pos',
      'table',
      'kitchen',
      'kot',
      'kds',
      'menu',
      'order',
      'maqaaxi',
      'makhaayad',
      'cunto',
      'dalab',
      'waiter',
      'qr',
      'nfc',
    ],
    response: `**SomBill Restaurant, Cafe & Fast-Food POS** 🍽️\n\nEngineered for high-speed dining rooms, Qawa lounges, and multi-station kitchens:\n• **Touch-Screen Fast Billing:** Complete orders in 3 taps with instant dual-currency (**USD** & **SLSH/SOS**) totals.\n• **Table & Floor Management:** Live visual floor map showing **Available**, **Occupied**, **Billed**, and **VIP Majlis** tables.\n• **Kitchen Order Tickets (KOT) & KDS:** Automatically routes Grill, Mandi Oven, Bakery, and Barista items to dedicated kitchen screens or thermal printers.\n• **Split & Merge Bills:** Split checks by seat, item, or payment method effortlessly.\n• **Waiter PIN & Smart NFC/QR Menu:** Instant waiter login plus tabletop **NFC Tap-to-Order** & **QR Digital Menus**.\n• **Recipe Auto-Deduction:** Every plate sold deducts exact ingredients from stock.\n\nReady to see it live? Visit [Pricing](/pricing) or [Contact](/contact) for a free demo!`,
  },
  {
    id: 'hotel_pms',
    keywords: [
      'hotel',
      'room',
      'booking',
      'reservation',
      'check-in',
      'checkout',
      'guest',
      'folio',
      'hoteel',
      'jiif',
      'qol',
      'pms',
      'resort',
    ],
    response: `**SomBill Hotel PMS & Hospitality Billing** 🏨\n\nUnify your front desk, rooms, rooftop restaurant, and conference halls in one system:\n• **Front-Desk Check-In / Check-Out:** Fast guest registration, ID capture, and group reservation calendar.\n• **Room Status & Housekeeping:** Real-time tracking of **Clean**, **Occupied**, **Dirty**, and **Maintenance** rooms.\n• **Unified Guest Folio:** Link restaurant dining, bedside NFC room-service, laundry, and minibar bills directly to the guest's **Room Bill**.\n• **Multi-Currency Invoicing:** Bill corporate and walk-in guests seamlessly in **USD**, **SLSH**, or **SOS**.\n• **Night Audit Reports:** Automated end-of-day room occupancy, RevPAR, and shift Z-Reports.\n\nExplore our hotel packages on [Pricing](/pricing) or schedule an on-site walkthrough via [Contact](/contact).`,
  },
  {
    id: 'payments_mobile_money',
    keywords: [
      'payment',
      'evc',
      'zaad',
      'edahab',
      'e-dahab',
      'sahal',
      'premier',
      'card',
      'visa',
      'lacag',
      'biil',
      'qaansheeg',
      'ibs',
      'mastercard',
    ],
    response:
      `**Local Mobile Money & Multi-Currency Payments** 💳\n\nSomBill is purpose-built for Somali & East African payment ecosystems:\n• **Native Mobile Money:** Seamless integration with **Zaad**, **EVC Plus**, **eDahab**, **Sahal**, **Premier Wallet**, **IBS**, and **Visa / Mastercard**.\n• **Split Payments:** Let customers pay part **Cash** and part **Mobile Money** (` +
      '`USD` + `SLSH/SOS`' +
      `) on the same receipt.\n• **Multi-Currency Auto-Conversion:** Live daily exchange rate engine calculates exact change in USD and local Shillings automatically.\n• **Instant Digital & Thermal Receipts:** Print 80mm/58mm thermal bills or send instant **SMS & WhatsApp receipts**.\n\nSee how fast checkout works—book a walkthrough on [Contact](/contact) or view [Pricing](/pricing).`,
  },
  {
    id: 'inventory_stock',
    keywords: [
      'inventory',
      'stock',
      'warehouse',
      'recipe',
      'expiry',
      'supplier',
      'bakhaar',
      'alaab',
      'xisaab',
      'wastage',
      'costing',
    ],
    response: `**Real-Time Inventory, Stock & Recipe Control** 📦\n\nStop kitchen leakage and food cost surprises with automated stock governance:\n• **Ingredient-Level Recipe Costing (BOM):** Link every menu dish to exact grams/ml of rice, meat, oil, coffee beans, and packaging.\n• **Real-Time Stock & Low-Stock Alerts:** Instant notifications before critical items run out during peak dinner rush.\n• **Expiry & Wastage Tracking:** Log kitchen spoilage, staff meals, and batch expiry dates with full manager audit trails.\n• **Purchase Orders & Supplier Ledgers:** Track supplier invoices, partial deliveries, and warehouse-to-kitchen transfers.\n\nCheck out our inventory-enabled tiers on [Pricing](/pricing).`,
  },
  {
    id: 'reports_analytics',
    keywords: [
      'report',
      'analytics',
      'profit',
      'sales',
      'owner',
      'mobile app',
      'xisaabaad',
      "faa'iido",
      'warbixin',
      'z-report',
      'vat',
      'tax',
    ],
    response: `**Live Cloud Owner Dashboard & Financial Reports** 📊\n\nMonitor every branch from your phone or laptop anywhere in the world:\n• **Daily Z-Reports & Shift Closing:** Complete cash drawer reconciliation across Morning and Night shifts.\n• **Cashier & Waiter Audit Logs:** Track voids, discounts, price overrides, and cancelled KOT tickets in real time.\n• **Profit & Top-Selling Analytics:** Identify your highest-margin dishes, peak hours, and best-performing staff.\n• **Tax & VAT Ready:** Automated tax ledgers exportable in 1 click to **PDF** and **Excel**.\n\nWant a live tour of the Super Manager Console? Visit [Contact](/contact) or [Pricing](/pricing).`,
  },
  {
    id: 'offline_mode',
    keywords: ['offline', 'internet', 'connection', 'speed', 'cloud', 'khad', 'lan', 'sync'],
    response: `**Hybrid Offline-First Engine (100% Zero Downtime)** ⚡\n\nNever stop serving guests when fiber or mobile data fluctuates:\n• **Works Without Internet:** SomBill continues **billing**, **printing thermal receipts**, and firing **kitchen KOT/KDS tickets** over your local Wi-Fi/LAN router even when external internet drops.\n• **Automatic Cloud Sync:** The moment internet reconnects, all orders, payments, and stock deductions sync securely to the cloud Owner Dashboard with zero data loss.\n\nTest our offline speed in your venue—request a pilot on [Contact](/contact).`,
  },
  {
    id: 'hardware_printers',
    keywords: [
      'hardware',
      'printer',
      'scanner',
      'cash drawer',
      'touchscreen',
      'terminal',
      'makiinad',
      'boono',
      'ipad',
      'android',
      'windows',
    ],
    response: `**Universal POS Hardware & Printer Compatibility** 🖥️\n\nSomBill runs smoothly on your existing devices or our turnkey hardware kits:\n• **Any Operating System:** Works on **Windows POS Touch Terminals**, **Android Tablets**, **iPads**, and **Desktop PCs**.\n• **Thermal Receipt & Kitchen Printers:** Full plug-and-play support for **80mm & 58mm Thermal Printers** (USB, Ethernet LAN, Wi-Fi & Bluetooth).\n• **Peripherals Included:** Connects directly to **Heavy-Duty Cash Drawers**, **Barcode Scanners**, Customer Pole Displays, and **NTAG215 Smart NFC Table Coasters**.\n\nNeed hardware + software bundled? Reach our team at [Contact](/contact) or review [Pricing](/pricing).`,
  },
  {
    id: 'pricing_packages',
    keywords: [
      'price',
      'pricing',
      'cost',
      'plan',
      'subscription',
      'qiimaha',
      'meeqa',
      'lacagta',
      'xirmo',
      'package',
      'tier',
    ],
    response: `**Transparent SomBill Pricing & Packages** 💰\n\nFlexible plans tailored to your venue size (with **20% Annual Discount** & **Free Onboarding**):\n• **Starter ($39/mo billed annually):** Ideal for single **Cafes, Qawa Spots & Small Shops** — 1 POS Terminal, KDS, QR Menu & Zaad/EVC/eDahab integration.\n• **Professional ($89/mo billed annually · Most Popular):** Built for **Restaurants & Lounges** — Up to 4 Terminals, Unlimited KDS, Smart NFC/QR Ordering, Table Map, Recipe Costing & Shift Audits.\n• **Enterprise ($199/mo billed annually):** For **Hotels, Resorts & Multi-Branch Chains** — Unlimited Terminals, Hotel PMS Room Folio Sync, Central HQ Control & 24/7 Priority SLA.\n\nCompare all features and use our interactive cost calculator on [Pricing](/pricing)!`,
  },
  {
    id: 'demo_onboarding',
    keywords: ['demo', 'trial', 'start', 'setup', 'install', 'training', 'bilaash', 'tababar', 'tijaabo', 'onboard'],
    response: `**4-Step Fast Onboarding & Free Live Demo** 🚀\n\nWe get your restaurant, cafe, or hotel running in under 24 hours:\n• **1) Book a Free Live Demo:** Experience Cashier POS, Waiter Floor Map, and Owner Analytics live.\n• **2) Menu & Room Setup (<24 Hours):** Our engineers digitize your full menu, recipes, tables, and rooms for you.\n• **3) Staff Training (On-Site or Remote):** Hands-on training in **Somali & English** for cashiers, waiters, chefs, and managers.\n• **4) Go Live with 24/7 Support:** Launch smoothly with dedicated field & WhatsApp engineers standing by.\n\nClick [Contact](/contact) or [Book Free Demo](/demo) to start your **14-Day Free Trial** today!`,
  },
  {
    id: 'support_contact',
    keywords: [
      'contact',
      'support',
      'help',
      'phone',
      'whatsapp',
      'email',
      'location',
      'caawinaad',
      'la xiriir',
      'telefoon',
      'office',
      'hargeisa',
      'mogadishu',
    ],
    response: `**24/7 SomBill Hospitality Support & Offices** 📞\n\nOur regional hospitality engineers respond in **<2 hours** (and immediately during peak dining rushes):\n• **WhatsApp & Direct Hotline:** **+252 63 440 8910** (24/7 Technical & Sales Desk)\n• **Email:** **support@sombill.com** / **sales@sombill.com**\n• **Regional Hubs:** Headquartered in **Hargeisa** (26 June District, Presidential Rd) with deployment teams in **Berbera**, **Burao**, **Borama**, **Mogadishu**, and **Garowe**.\n\nVisit our [Contact Page](/contact) to send a direct message or schedule an on-site visit!`,
  },
];

export const FALLBACK_RESPONSE = `Thank you for your question! ✨ As **SomBill AI**, I can help you in **English** or **Af-Soomaali** with:\n\n• **Restaurant & Cafe POS** (Fast billing, KOT, KDS, Table & NFC/QR menus)\n• **Hotel PMS & Room Folios** (Check-in/out & room billing)\n• **Local Mobile Money** (**Zaad**, **EVC Plus**, **eDahab**, **Sahal** & Visa)\n• **Inventory, Recipes & Cloud Owner Reports**\n• **Transparent Plans** on [Pricing](/pricing) or booking a **14-Day Free Trial** via [Contact](/contact)\n\nTry clicking one of the quick chips below or tell me about your restaurant or hotel!`;
