export type WebsitePageRoute =
  | { type: 'home' }
  | { type: 'pricing' }
  | { type: 'product'; slug: ProductSlug }
  | { type: 'solution'; slug: SolutionSlug }
  | { type: 'resource'; slug: ResourceSlug }
  | { type: 'company'; slug: CompanySlug };

export type ProductSlug =
  | 'restaurant-pos'
  | 'nfc-ordering'
  | 'qr-ordering'
  | 'kds'
  | 'table-management'
  | 'menu-management'
  | 'order-management'
  | 'inventory-management'
  | 'billing-payments'
  | 'tax-financial-reports'
  | 'staff-management'
  | 'multi-branch'
  | 'business-analytics';

export type SolutionSlug = 'restaurants' | 'hotels' | 'cafes' | 'fast-food' | 'fine-dining' | 'food-courts' | 'chains';

export type ResourceSlug =
  'blog' | 'help-center' | 'documentation' | 'video-tutorials' | 'faqs' | 'case-studies' | 'product-updates';

export type CompanySlug = 'about' | 'why-sombill' | 'contact' | 'partners' | 'careers' | 'become-partner';

export interface ProductPageSpec {
  slug: ProductSlug;
  category: 'Front of House' | 'Kitchen & Operations' | 'Finance & Enterprise';
  badge: string;
  badgeSo: string;
  title: string;
  titleSo: string;
  highlightWord: string;
  subtitle: string;
  subtitleSo: string;
  shortDesc: string;
  iconName: string;
  accentColor: string;
  heroMetrics: { label: string; value: string; sub: string }[];
  simulatorType: 'pos-kds' | 'nfc-phone' | 'floor-plan' | 'inventory' | 'tax-finance' | 'multi-branch';
  keyFeatures: {
    title: string;
    desc: string;
    bullet1: string;
    bullet2: string;
    icon: string;
  }[];
  workflowSteps: {
    step: string;
    title: string;
    desc: string;
  }[];
  useCases: {
    venueType: string;
    scenario: string;
    impact: string;
  }[];
  relatedSlugs: ProductSlug[];
  faqs: { q: string; a: string }[];
}

export interface SolutionPageSpec {
  slug: SolutionSlug;
  badge: string;
  title: string;
  titleSo: string;
  subtitle: string;
  shortDesc: string;
  iconName: string;
  heroStat: string;
  heroStatLabel: string;
  challenges: { problem: string; solution: string }[];
  tailoredModules: { title: string; desc: string; slug: ProductSlug }[];
  workflowTitle: string;
  workflowStages: { title: string; detail: string }[];
  recommendedPlan: string;
}

export const PRODUCT_PAGES: Record<ProductSlug, ProductPageSpec> = {
  'restaurant-pos': {
    slug: 'restaurant-pos',
    category: 'Front of House',
    badge: 'Engineered for Horn of Africa Hospitality',
    badgeSo: 'Loogu Talagalay Huteelada & Makhaayadaha Geeska Afrika',
    title: 'Ultra-Fast Touchscreen POS & Real-Time Kitchen Sync',
    titleSo: 'Nidaamka POS-ka Taabashada Degdegga ah & Isku-xidhka Jikada',
    highlightWord: 'Touchscreen POS',
    subtitle:
      'Unify your front-of-house hustle with back-of-house culinary timing. Built natively for offline resilience, dual-currency billing (USD / SLSH), and instant mobile money checkout.',
    subtitleSo:
      'Midowga adeegga miisaska iyo jikada. Waxay u shaqeysaa xitaa marka internetku go’o, iyadoo leh xisaabta USD & SLSH iyo lacag-bixinta ZAAD & e-Dahab.',
    shortDesc: 'Sub-second touch checkout, offline LAN sync, and dual-currency billing.',
    iconName: 'point_of_sale',
    accentColor: '#E11D48',
    heroMetrics: [
      { label: 'Table Turnaround', value: '42% Faster', sub: 'Eliminates handwritten slip delays' },
      { label: 'Offline Uptime', value: '99.98%', sub: 'Zero downtime through internet outages' },
      { label: 'Mobile Money Push', value: '< 1 sec', sub: 'Direct ZAAD & e-Dahab API hook' },
      { label: 'Currency Precision', value: 'USD + SLSH', sub: 'Live central bank or branch rate' },
    ],
    simulatorType: 'pos-kds',
    keyFeatures: [
      {
        title: 'Split-Bill & Mobile Multi-Pay',
        desc: 'Split checks evenly or by individual plate item. Accept Telesom ZAAD, Dahabshiil e-Dahab, local bank cards, and physical US Dollars / Somaliland Shillings simultaneously.',
        bullet1: 'Instant USSD push confirmation to terminal',
        bullet2: 'Mixed tender USD + SLSH automatic change math',
        icon: 'call_split',
      },
      {
        title: 'Visual Floor Plan Management',
        desc: 'Drag-and-drop floor map mirroring your physical dining room. Real-time color codes display seat occupancy, active timers, VIP Majlis seating, and server ownership.',
        bullet1: 'Multi-section zones (Main Hall, Terrace, VIP Majlis)',
        bullet2: '1-tap table transfer and party bill merging',
        icon: 'table_restaurant',
      },
      {
        title: 'Intelligent Ticket Routing',
        desc: 'Split orders in milliseconds. Fresh juices route to the beverage bar, pastries to the cafe counter, and camel steaks or mandi route directly to the main grill display.',
        bullet1: 'Zero paper ticket confusion in busy kitchens',
        bullet2: 'Course-by-course hold and fire controls',
        icon: 'alt_route',
      },
      {
        title: '100% Offline-First Engine',
        desc: 'Internet drops do not stop the rush. Orders print, payments register in local encrypted storage, and auto-sync with the HQ Cloud the second connectivity restores.',
        bullet1: 'Local LAN mesh between POS, Waiter tablets & KDS',
        bullet2: 'Zero-loss transaction ledger guarantee',
        icon: 'wifi_off',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Customer Order',
        desc: 'Guest orders at table or counter. Waitstaff customizes spice level, sides, and modifiers.',
      },
      {
        step: '02',
        title: 'POS One-Touch',
        desc: 'Instant submission with 1-click fire. Prevents re-typing and manual kitchen runs.',
      },
      {
        step: '03',
        title: 'Station Routing',
        desc: 'Bar KDS and Grill KDS flash with color-coded audio chime and prep timers.',
      },
      {
        step: '04',
        title: 'Bump & Serve',
        desc: 'Cook bumps order ready; waitstaff terminal notifies table server for hot delivery.',
      },
      {
        step: '05',
        title: 'Instant Settle',
        desc: 'Scan or push to pay with mobile money or split check. Clean thermal print or SMS receipt.',
      },
    ],
    useCases: [
      {
        venueType: 'High-Volume Grill & Mandi Houses',
        scenario: 'Peak Friday lunch rush with 120+ simultaneous dine-in and takeaway tickets.',
        impact: 'Cuts counter queue times by 60% and eliminates lost kitchen paper slips.',
      },
      {
        venueType: 'Hotel Restaurants & Rooftop Lounges',
        scenario: 'Guests dining across poolside, rooftop, and indoor halls wanting to charge to room folios.',
        impact: 'Seamless room-charge lookup and instant dual-currency settlement.',
      },
      {
        venueType: 'Express Cafés & Qawa Counters',
        scenario: 'Rapid morning Shaah and pastry orders paid in mixed SLSH cash and ZAAD.',
        impact: '3-tap fast checkout with automatic SLSH change calculation.',
      },
    ],
    relatedSlugs: ['kds', 'nfc-ordering', 'billing-payments', 'table-management'],
    faqs: [
      {
        q: 'What happens if our restaurant internet goes down during rush hour?',
        a: 'SomBill POS runs on a local offline-first mesh architecture. Your cashier terminals, waiter handhelds, thermal printers, and Kitchen Display Screens continue communicating over your local Wi-Fi/LAN router without interruption, syncing to the cloud automatically once internet returns.',
      },
      {
        q: 'Can cashiers accept part of a bill in USD cash and the rest via ZAAD?',
        a: 'Yes. The SomBill split-tender engine lets cashiers combine USD notes, Somaliland Shillings, ZAAD, e-Dahab, and Visa cards on a single receipt with zero manual calculator math.',
      },
      {
        q: 'Does it work with our existing thermal receipt printers and cash drawers?',
        a: 'SomBill supports standard ESC/POS thermal printers over Ethernet (LAN), USB, and Bluetooth, including automatic RJ11/RJ12 cash drawer kick triggers.',
      },
    ],
  },
  'nfc-ordering': {
    slug: 'nfc-ordering',
    category: 'Front of House',
    badge: 'Ultra-Fast NFC Tap-to-Order for Somaliland & Horn of Africa',
    badgeSo: 'Dalbashada Taabashada NFC ee Casriga ah',
    title: 'Next-Gen Contactless Dining: Instant Tap & Order',
    titleSo: 'Cunto-dalbashada Casriga ah: Taabo Miiska oo Dalbo',
    highlightWord: 'Contactless Dining',
    subtitle:
      'Empower your guests to tap a handcrafted smart coaster or table puck with their smartphone. No app downloads required. Dual-currency pricing with instant settlement via ZAAD, e-Dahab, or room billing.',
    subtitleSo:
      'Macaamiishu waxay mobilkooda ku taabanayaan miiska iyagoon wax App ah soo dejisan. Qiimaha USD & SLSH iyo lacag-bixinta ZAAD ama e-Dahab.',
    shortDesc: 'Smart NTAG215 table pucks that launch instant bilingual digital menus on tap.',
    iconName: 'contactless',
    accentColor: '#E11D48',
    heroMetrics: [
      { label: 'Average Check Size', value: '+28%', sub: 'Driven by visual dish modifiers & combos' },
      { label: 'PWA Tap Load Time', value: '< 0.8s', sub: 'Zero app store download required' },
      { label: 'Menu Reprint Cost', value: '$0 / yr', sub: 'Instant cloud price & stock updates' },
      { label: 'Table Turn Velocity', value: '+35%', sub: 'Guests order & pay without waiting' },
    ],
    simulatorType: 'nfc-phone',
    keyFeatures: [
      {
        title: 'Zero App Installation (Sub-Second PWA)',
        desc: 'Compatible with all iOS and Android phones via native NFC reader or camera scan. Launches your branded digital menu in under 800 milliseconds.',
        bullet1: 'Works natively on iPhone and Android',
        bullet2: 'Automatic Table # and VIP Zone tagging',
        icon: 'smartphone',
      },
      {
        title: 'Dynamic Upsells & Visual Combos',
        desc: 'Automatically prompts guests with warm sambusas, fresh mango smoothies, or specialty desserts paired with their main selection.',
        bullet1: 'HD food photography & spice-level selectors',
        bullet2: 'Trilingual support: Somali, English, and Arabic',
        icon: 'auto_awesome',
      },
      {
        title: 'Automated ZAAD & e-Dahab Push Prompts',
        desc: 'Customers enter their Telesom or Somtel number and receive an instant USSD PIN confirmation dialog right on their handset.',
        bullet1: 'Self-checkout eliminates 12-minute bill wait',
        bullet2: 'Optional hotel room folio charge verification',
        icon: 'payments',
      },
      {
        title: 'Custom Laser-Engraved Hardware Pucks',
        desc: 'Weatherproof walnut wood, brushed anodized aluminum, and frosted acrylic table tents engineered for Horn of Africa high-traffic venues.',
        bullet1: 'Tamper-resistant encrypted NTAG215 chips',
        bullet2: 'Heat, tea-spill, and UV sunlight resistant',
        icon: 'layers',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Tap or Scan Puck',
        desc: 'Guest taps their smartphone near the table puck or coaster—no app store download needed.',
      },
      {
        step: '02',
        title: 'Browse & Customize',
        desc: 'Explore HD dishes in Somali, English, or Arabic with live USD and SLSH pricing.',
      },
      {
        step: '03',
        title: 'Pay & Fire to KDS',
        desc: 'Settle via ZAAD/e-Dahab or send directly to the kitchen display tagged with the exact table number.',
      },
    ],
    useCases: [
      {
        venueType: 'Hotel In-Room Dining (Bedside Coasters)',
        scenario: 'Guests tap the walnut coaster on their nightstand to order 24/7 room service or breakfast.',
        impact: 'Eliminates busy front-desk phone lines and posts directly to the guest room folio.',
      },
      {
        venueType: 'Rooftop Lounges & Garden Terraces',
        scenario: 'Sprawling outdoor seating where flagging down a waiter during evening rush takes time.',
        impact: 'Guests reorder Shaah, juices, and desserts in 2 taps, boosting table spend by 28%.',
      },
      {
        venueType: 'VIP Majlis & Private Dining Rooms',
        scenario: 'High-privacy dining rooms where guests prefer discreet service and instant bill settlement.',
        impact: 'Includes 1-tap "Call Waiter / Request Bill" alert straight to the server’s terminal.',
      },
    ],
    relatedSlugs: ['qr-ordering', 'restaurant-pos', 'menu-management', 'kds'],
    faqs: [
      {
        q: 'Do diners need to download an application from the App Store or Google Play?',
        a: 'No. SomBill utilizes a lightweight Progressive Web App (PWA). When guests tap the table puck or scan the QR code, the menu opens immediately in Safari or Chrome in under 0.8 seconds.',
      },
      {
        q: 'What happens if a customer’s phone does not have NFC enabled?',
        a: 'Every SomBill smart puck and table tent includes both an embedded NTAG215 NFC chip and a high-contrast laser-engraved QR code so any camera phone can scan it effortlessly.',
      },
      {
        q: 'Can we disable self-payment for certain tables and allow ordering only?',
        a: 'Yes. You can configure each zone to require pre-payment via ZAAD/e-Dahab (ideal for terraces and fast-casual) or allow post-paid tab accumulation for VIP dining.',
      },
    ],
  },
  'qr-ordering': {
    slug: 'qr-ordering',
    category: 'Front of House',
    badge: 'Dynamic QR Table & Takeaway Ordering',
    badgeSo: 'Dalbashada Koodhka QR ee Miiska & Takeaway-ga',
    title: 'Laser-Engraved QR Menus with Live Kitchen & Stock Sync',
    titleSo: 'Liiska Cuntada ee QR oo ku Xidhan Jikada & Kaydka',
    highlightWord: 'QR Menus',
    subtitle:
      'Replace worn-out laminated paper menus with dynamic, multilingual QR ordering stands. Update prices, mark items out-of-stock, and accept mobile money orders from tables or takeaway queues.',
    subtitleSo:
      'Beddel waraaqaha duugoobay oo isticmaal QR casri ah oo isla markiiba beddelaya qiimaha iyo cuntooyinka dhammaaday.',
    shortDesc: 'Instant scan-to-order menus with table-tagging and multilingual support.',
    iconName: 'qr_code_scanner',
    accentColor: '#0284C7',
    heroMetrics: [
      { label: 'Scan-to-Menu Speed', value: '0.6 Sec', sub: 'Optimized for 3G/4G mobile networks' },
      { label: 'Languages Supported', value: '3 Native', sub: 'Somali, English & Arabic switch' },
      { label: 'Order Accuracy', value: '99.9%', sub: 'Guest selects exact modifiers' },
      { label: 'Setup Time', value: '15 Mins', sub: 'Generate & print table QR codes' },
    ],
    simulatorType: 'nfc-phone',
    keyFeatures: [
      {
        title: 'Table-Specific & Zone-Aware QR Codes',
        desc: 'Each table stand carries a unique cryptographic QR token that automatically binds the guest session to Table 04, VIP Majlis, or Poolside Cabana #2.',
        bullet1: 'Prevents spoofed orders from outside the venue',
        bullet2: 'Supports dine-in, counter pickup, and car-side',
        icon: 'pin_drop',
      },
      {
        title: 'Instant Inflation & Exchange Rate Sync',
        desc: 'Adjust your USD-to-SLSH rate once in the manager dashboard and every QR menu across every table updates its Shilling prices in real time.',
        bullet1: 'Zero re-printing costs when prices change',
        bullet2: 'Automatic 86 / Sold-Out item hiding',
        icon: 'currency_exchange',
      },
      {
        title: 'Waiter Call & Bill Request Buttons',
        desc: 'Even when guests prefer ordering with a server, the QR screen provides 1-tap "Call Waiter", "Extra Water/Bisbaas", and "Bring Bill" buttons.',
        bullet1: 'Triggers live audio buzzer on Waiter POS',
        bullet2: 'Tracks server response time SLA',
        icon: 'notifications_active',
      },
      {
        title: 'High-Contrast Custom Table Tents',
        desc: 'Generate print-ready vector QR kits branded with your hotel or restaurant logo, Wi-Fi credentials, and ZAAD merchant instructions.',
        bullet1: 'One-click PDF & SVG badge export',
        bullet2: 'Frosted acrylic & metal stand options',
        icon: 'badge',
      },
    ],
    workflowSteps: [
      { step: '01', title: 'Camera Scan', desc: 'Guest points any smartphone camera at the table QR stand.' },
      { step: '02', title: 'Language & Currency', desc: 'Switches seamlessly between Somali/English and USD/SLSH.' },
      {
        step: '03',
        title: 'Instant Kitchen Ticket',
        desc: 'Order routes to KDS and alerts the assigned table waiter.',
      },
    ],
    useCases: [
      {
        venueType: 'Busy Cafés & University Hangouts',
        scenario: 'Groups of students splitting snacks and iced coffees at peak hours.',
        impact: 'Each guest scans and pays for their own items via ZAAD without tying up the cashier.',
      },
      {
        venueType: 'Beachside & Garden Resorts',
        scenario: 'Long walking distances between outdoor seating and the main kitchen.',
        impact: 'Orders hit the grill immediately while servers focus purely on delivering food.',
      },
    ],
    relatedSlugs: ['nfc-ordering', 'menu-management', 'restaurant-pos', 'kds'],
    faqs: [
      {
        q: 'How do we prevent people outside the restaurant from scanning a saved QR photo?',
        a: 'SomBill QR tokens support rotating session pins, optional geofencing, or pre-payment enforcement so only verified table guests or paid orders reach the kitchen.',
      },
      {
        q: 'Can guests view the QR menu in Somali and English?',
        a: 'Yes, every dish title, description, and allergy tag supports instant toggling between Somali, English, and Arabic.',
      },
    ],
  },
  kds: {
    slug: 'kds',
    category: 'Kitchen & Operations',
    badge: 'Digital Kitchen Engine (KDS)',
    badgeSo: 'Shaashadda Maamulka Jikada (KDS)',
    title: 'Eliminate Paper Kitchen Tickets & Frantic Miscommunication',
    titleSo: 'Jooji Waraaqaha Luma oo Ku Maamul Jikada Shaashad Toos ah',
    highlightWord: 'Kitchen Engine (KDS)',
    subtitle:
      'Organize incoming dine-in, NFC, and takeaway orders by prep station: Grill, Mandi Oven, Barista Tea, Bakery, and Dessert. Color-coded SLA timers keep every shift on schedule.',
    subtitleSo:
      'Kala saar dalabaadka dubista, bariiska, shaaha iyo macmacaanka. Saacadaha midabaysan waxay muujiyaan dalab kasta wakhtiga uu ku jiro.',
    shortDesc: 'Station-routed kitchen screens with prep timers, allergy flags, and bump bars.',
    iconName: 'Soup_Kitchen',
    accentColor: '#EA580C',
    heroMetrics: [
      { label: 'Ticket Routing Latency', value: '14 ms', sub: 'Instant LAN delivery from POS & NFC' },
      { label: 'Prep Time Reduction', value: '-29%', sub: 'Parallel station preparation' },
      { label: 'Missing Dish Errors', value: '0%', sub: 'Item-by-item checkoff & recall' },
      { label: 'Hardware Rating', value: 'IP65', sub: 'Heat & grease resistant touch/bump' },
    ],
    simulatorType: 'pos-kds',
    keyFeatures: [
      {
        title: 'Color-Coded Visual Cook Timers',
        desc: 'Tickets transition automatically from Emerald (Fresh) to Amber (Warning) to Flashing Crimson (Over SLA) so the head chef spots bottlenecks immediately.',
        bullet1: 'Configurable target prep minutes per category',
        bullet2: 'Audible chime alerts for VIP or rush orders',
        icon: 'timer',
      },
      {
        title: 'Multi-Station Split Routing',
        desc: 'When Table 04 orders Grilled Fish, Chicken Biryani, and 2x Shaah Cadays, the Grill screen sees the fish and biryani while the Tea Bar sees only the Shaah.',
        bullet1: 'Master Expo screen consolidates full tray status',
        bullet2: 'Synchronized course firing (Starters -> Mains)',
        icon: 'hub',
      },
      {
        title: 'Allergy & Custom Preparation Alerts',
        desc: 'High-contrast warning banners highlight modifier notes like "NO ONION", "WELL DONE", or "EXTRA BISBAAS" so line cooks never miss a guest request.',
        bullet1: 'Bilingual kitchen ticket labels (Somali / English)',
        bullet2: '1-tap item recall if bumped accidentally',
        icon: 'warning',
      },
      {
        title: 'Instant Server Paging on Bump',
        desc: 'The moment the chef taps "Mark Ready" or hits the tactile 8-key bump bar, the assigned waiter’s POS tablet and floor display flash "Cooked & Ready".',
        bullet1: 'Tracks food dwell time on the hot pass',
        bullet2: 'Supports gloved touch or mechanical bump bars',
        icon: 'notifications_active',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Auto-Split by Station',
        desc: 'Order arrives and splits across Grill, Oven, and Beverage KDS screens.',
      },
      {
        step: '02',
        title: 'Line Cook Prep',
        desc: 'Chefs check off individual items as they plate with live SLA countdowns.',
      },
      {
        step: '03',
        title: 'Expo Bump & Page',
        desc: 'Head chef bumps the completed ticket, paging the floor server immediately.',
      },
    ],
    useCases: [
      {
        venueType: 'Multi-Kitchen Hotels & Banquet Halls',
        scenario: 'Separating main dining kitchen, rooftop barbecue grill, and ground-floor coffee lounge.',
        impact: 'Each kitchen sees only its own items while the Expo supervisor tracks complete table trays.',
      },
      {
        venueType: 'Fast-Casual Shawarma & Burger Joints',
        scenario: 'High-speed assembly line with customer-facing "Order Ready" number screens.',
        impact: 'Bumping a KDS ticket automatically moves the order number to "Ready for Pickup" on the lobby TV.',
      },
    ],
    relatedSlugs: ['restaurant-pos', 'order-management', 'inventory-management', 'table-management'],
    faqs: [
      {
        q: 'Can we use both a Kitchen Display Screen and a backup thermal kitchen printer?',
        a: 'Yes. SomBill allows hybrid routing—for example, using a 21" KDS screen on the main grill line while printing physical sticky labels at the takeaway beverage counter.',
      },
      {
        q: 'How do cooks interact with the screen when their hands are wet or gloved?',
        a: 'You can pair any screen with the SomBill tactile 8-Key Mechanical Kitchen Bump Bar or use capacitive industrial touchscreens.',
      },
    ],
  },
  'table-management': {
    slug: 'table-management',
    category: 'Front of House',
    badge: 'Dynamic Floor & Room Layouts',
    badgeSo: 'Maamulka Miisaska & Qolalka VIP-da',
    title: 'Visual Floor Plan Matrix for Dining Halls, Terraces & VIP Majlis',
    titleSo: 'Khariidadda Tooska ah ee Miisaska, Beerta & Qolalka VIP-da',
    highlightWord: 'Floor Plan Matrix',
    subtitle:
      'Eliminate doorway bottlenecks and server confusion. Track every table’s live status—Available, Occupied, Kitchen Prep, Calling Waiter, or Reserved—with real-time elapsed timers and running bill totals.',
    subtitleSo: 'Si toos ah ula soco miis kasta xaaladdiisa: Banaan, La Fadhiyo, Cunto Sugaya, ama La Ballansaday.',
    shortDesc: 'Real-time floor map with VIP Majlis zones, elapsed timers, and guest call buzzers.',
    iconName: 'table_restaurant',
    accentColor: '#2563EB',
    heroMetrics: [
      { label: 'Seating Capacity Utilization', value: '+31%', sub: 'Faster table turns during peak hours' },
      { label: 'Waiter Response Time', value: '45 Sec', sub: 'Live guest buzzer queue on floor map' },
      { label: 'Dining Zones', value: 'Unlimited', sub: 'Main Hall, Garden, Rooftop, VIP Majlis' },
      { label: 'Bill Merge / Split', value: '1-Tap', sub: 'Move guests or combine family tables' },
    ],
    simulatorType: 'floor-plan',
    keyFeatures: [
      {
        title: 'Live Color-Coded Occupancy States',
        desc: 'At a glance, hosts and managers see which tables are Available (Emerald), Occupied (Crimson), In Kitchen Prep (Amber), or Reserved (Indigo).',
        bullet1: 'Live elapsed seating timer on every occupied tile',
        bullet2: 'Running USD & SLSH bill total visible on the map',
        icon: 'grid_view',
      },
      {
        title: 'Customer Call & Guest Buzzer Queue',
        desc: 'When a guest taps "Call Waiter" or "Request Bill" on their table’s NFC/QR stand, the table tile pulses on the floor map and ranks by wait time.',
        bullet1: 'Prevents neglected tables in private Majlis rooms',
        bullet2: '1-tap "Mark Done / Dhamee" acknowledgement',
        icon: 'Touch_App',
      },
      {
        title: 'Instant Table Merge & Seat Transfer',
        desc: 'When a party of 4 grows to 10 in the Terrace Garden, merge Table 04 and Table 05 in one click or transfer a tab from the lounge to the dining room.',
        bullet1: 'Preserves individual server attribution',
        bullet2: 'Automatically updates KDS delivery destination',
        icon: 'call_merge',
      },
      {
        title: 'VIP Majlis & Reservation Scheduling',
        desc: 'Block VIP rooms for diplomatic dinners, wedding banquets, or Iftar gatherings with deposit tracking and pre-assigned server teams.',
        bullet1: 'SMS/WhatsApp reservation confirmation notes',
        bullet2: 'Minimum-spend and room-hire fee support',
        icon: 'event_seat',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Host Greets & Seats',
        desc: 'Selects an available table matching party size and zone preference.',
      },
      {
        step: '02',
        title: 'Live Service Tracking',
        desc: 'Floor map displays active course status, elapsed time, and guest calls.',
      },
      {
        step: '03',
        title: 'Settle & Sanitize',
        desc: 'Once paid at Cashier POS, table flips to Available for the next party.',
      },
    ],
    useCases: [
      {
        venueType: 'Traditional Somali Family Restaurants with Private Majlis',
        scenario: 'Managing 25+ private curtained family rooms alongside an open main dining hall.',
        impact: 'Waiters see exactly which Majlis room pressed the call buzzer without knocking unnecessarily.',
      },
      {
        venueType: 'Luxury Hotel Dining & Poolside Terraces',
        scenario: 'Coordinating reservations and walk-ins across 4 distinct indoor and outdoor zones.',
        impact: 'Zero double-booked VIP tables and 31% higher evening cover count.',
      },
    ],
    relatedSlugs: ['restaurant-pos', 'nfc-ordering', 'order-management', 'staff-management'],
    faqs: [
      {
        q: 'Can we customize the table numbers and zone names to match our building?',
        a: 'Yes. You can create custom zones such as Main Dining Hall, Terrace Garden, VIP Majlis, Rooftop, or Poolside, and assign exact seat counts to every table.',
      },
      {
        q: 'Does a table automatically become available when the cashier settles the bill?',
        a: 'Yes. The moment the cashier completes payment on Terminal #02, the table state updates across all waiter tablets and manager dashboards in real time.',
      },
    ],
  },
  'menu-management': {
    slug: 'menu-management',
    category: 'Front of House',
    badge: 'Centralized Culinary Catalog',
    badgeSo: 'Maamulka Liiska Cuntada & Qiimaha',
    title: 'Dynamic Menu Engineering with Instant Multi-Channel Sync',
    titleSo: 'Maamulka Liiska Cuntada oo Isla Markiiba Meel Walba ka Muuqda',
    highlightWord: 'Menu Engineering',
    subtitle:
      'Manage dishes, modifiers, combo platters, and day-part menus (Breakfast Canjeero, Lunch Bariis & Mandi, Evening Grill) from one dashboard. Push updates to POS, NFC stands, and QR menus in 2 seconds.',
    subtitleSo:
      'Hal meel ka maamul quraacda, qadada, iyo cashada. Qiimaha aad beddesho isla markiiba wuxuu ka muuqanayaa POS-ka iyo NFC-ga.',
    shortDesc: 'Bilingual dish catalog, modifier groups, 1-click 86 toggles, and SLSH auto-pricing.',
    iconName: 'restaurant_menu',
    accentColor: '#D97706',
    heroMetrics: [
      { label: 'Global Sync Speed', value: '< 2 Sec', sub: 'Updates POS, Waiter, NFC & QR simultaneously' },
      { label: 'Modifier Attach Rate', value: '+34%', sub: 'Guided add-ons & spice prompts' },
      { label: '86 / Sold-Out Errors', value: 'Zero', sub: 'Instant dish availability toggle' },
      { label: 'Dual-Currency Math', value: 'Automated', sub: 'USD base price -> live SLSH conversion' },
    ],
    simulatorType: 'pos-kds',
    keyFeatures: [
      {
        title: '1-Click Availability (Instant "86" Toggle)',
        desc: 'Run out of fresh Berbera Kingfish at 8:30 PM? Toggle it off once and it immediately locks on every waiter tablet, cashier screen, and guest NFC menu.',
        bullet1: 'Prevents awkward waiter apologies after ordering',
        bullet2: 'Optional auto-disable when inventory hits zero',
        icon: 'toggle_on',
      },
      {
        title: 'Rich Modifiers, Portion Sizes & Spice Levels',
        desc: 'Configure mandatory and optional choices: Half/Full Kilo Hilib Ari, Somali Basmati vs. Federation (Bariis & Baasto), Mild or Spicy Bisbaas.',
        bullet1: 'Supports free modifiers and priced add-ons',
        bullet2: 'Prints clearly in kitchen language on KDS',
        icon: 'tune',
      },
      {
        title: 'Day-Part & Ramadan / Iftar Menu Scheduling',
        desc: 'Automatically switch from Morning Breakfast (Beer & Canjeero) to Afternoon Mains at 11:30 AM, or activate special Iftar Buffet platters during Ramadan.',
        bullet1: 'Scheduled time-window activation',
        bullet2: 'Branch-specific regional pricing tiers',
        icon: 'schedule',
      },
      {
        title: 'Dual-Currency Base Pricing',
        desc: 'Anchor your menu prices in USD or SLSH. When the Somaliland Shilling exchange rate fluctuates, update your rate once without editing 200 individual dishes.',
        bullet1: 'Clean rounding rules for SLSH cash notes',
        bullet2: 'Supports tax-inclusive or 4.8% MOF VAT add-on',
        icon: 'payments',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Create Dish & Photo',
        desc: 'Enter English & Somali names, category, prep time, and USD base price.',
      },
      {
        step: '02',
        title: 'Link Recipe & Modifiers',
        desc: 'Attach cooking preferences, sides, and raw ingredient deductions.',
      },
      {
        step: '03',
        title: '1-Click Publish',
        desc: 'Push live to selected branches, POS terminals, and smart tables.',
      },
    ],
    useCases: [
      {
        venueType: 'Multi-Concept Hotel Dining',
        scenario: 'Running separate menus for Poolside Cafe, Main Restaurant, and Room Service from one kitchen.',
        impact: 'Centralizes dish costing while displaying tailored prices per venue zone.',
      },
      {
        venueType: 'Seasonal & Fresh Catch Seafood Restaurants',
        scenario: 'Daily fluctuating catch availability from Berbera port.',
        impact: 'Managers toggle daily specials live from their phone in 10 seconds.',
      },
    ],
    relatedSlugs: ['restaurant-pos', 'nfc-ordering', 'inventory-management', 'multi-branch'],
    faqs: [
      {
        q: 'Can different branches have different prices for the same dish?',
        a: 'Yes. You can maintain a master corporate menu while applying branch-specific price overrides for airport, hotel, or express locations.',
      },
      {
        q: 'Does the menu support Somali, English, and Arabic dish names?',
        a: 'Yes, every item stores multilingual titles and descriptions so guests and kitchen staff each see their preferred language.',
      },
    ],
  },
  'order-management': {
    slug: 'order-management',
    category: 'Kitchen & Operations',
    badge: 'Unified Omnichannel Order Hub',
    badgeSo: 'Xarunta Dhexe ee Maamulka Dalabaadka',
    title: 'Every Dine-In, Takeaway, Room Service & NFC Order in One Stream',
    titleSo: 'Dhammaan Dalabaadka Miiska, Takeaway-ga & Qolalka oo Hal Meel ku Urursan',
    highlightWord: 'Omnichannel Order Hub',
    subtitle:
      'Never lose track of a ticket during the evening rush. Consolidate waiter handheld tickets, self-service NFC/QR orders, counter walk-ins, and hotel room service into a single real-time pipeline.',
    subtitleSo: 'La soco dalab kasta laga bilaabo marka la diro ilaa marka miiska la saaro oo lacagtiisa la bixiyo.',
    shortDesc: 'End-to-end ticket lifecycle from table fire to kitchen prep, hold/resume, and settlement.',
    iconName: 'receipt_long',
    accentColor: '#E11D48',
    heroMetrics: [
      { label: 'Ticket Visibility', value: '100%', sub: 'Live status from Draft to Settled' },
      { label: 'Hold & Resume Speed', value: '1.2 Sec', sub: 'Suspend & recall customer checks' },
      { label: 'Order Channels', value: '5 Unified', sub: 'Dine-In, NFC, QR, Takeaway, Room' },
      { label: 'Void Audit Trail', value: '100% Logged', sub: 'Manager PIN required for cancellations' },
    ],
    simulatorType: 'pos-kds',
    keyFeatures: [
      {
        title: 'Live Ticket Lifecycle Pipeline',
        desc: 'Track every order across clear operational states: Active in Kitchen -> Cooked & Ready -> Served at Table -> Sent to Cashier -> Settled.',
        bullet1: 'Instant filter tabs by order state and dining zone',
        bullet2: 'Search by Table #, Ticket #SB-8924, or server name',
        icon: 'view_kanban',
      },
      {
        title: 'Suspended & Held Orders Queue',
        desc: 'Customer stepped out to the ATM or waiting for a family member to arrive? Put the ticket on Hold with a reason note and resume settlement in 1 click.',
        bullet1: 'Prevents blocked cashier lines during rush',
        bullet2: 'Tracks held duration and responsible staff member',
        icon: 'pause_circle',
      },
      {
        title: 'Granular Split, Merge & Course Control',
        desc: 'Split a 12-guest Majlis banquet bill by individual seats, merge two takeaway parcels, or add a late dessert order to an existing open table ticket.',
        bullet1: 'Zero re-keying of items when splitting bills',
        bullet2: 'Prints itemized sub-receipts for each guest',
        icon: 'call_split',
      },
      {
        title: 'Strict Void & Discount Governance',
        desc: 'Protect your margins from unauthorized giveaways. Any voided item after kitchen fire requires a manager PIN and logs the reason in the shift audit trail.',
        bullet1: 'Tracks kitchen waste vs. pre-cook cancellations',
        bullet2: 'Real-time alert on Super Manager dashboard',
        icon: 'verified_user',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Capture Anywhere',
        desc: 'Order originates from Waiter POS, NFC puck, or Cashier Walk-in.',
      },
      {
        step: '02',
        title: 'Track Preparation',
        desc: 'Live status badges show exact kitchen progress and elapsed minutes.',
      },
      { step: '03', title: 'Close & Archive', desc: 'Settled receipt archives with full payment auth reference.' },
    ],
    useCases: [
      {
        venueType: 'Express Takeaway & Parcel Counters',
        scenario: 'Managing 40+ waiting takeaway customers alongside dine-in tables.',
        impact: 'Dedicated Takeaway # tags and SMS/screen callouts keep parcel handoffs organized.',
      },
      {
        venueType: 'Large Banquet & Wedding Venues',
        scenario: 'Handling complex multi-table group tabs with custom add-ons.',
        impact: 'Batch merge and split tools settle group checks in seconds.',
      },
    ],
    relatedSlugs: ['restaurant-pos', 'kds', 'table-management', 'billing-payments'],
    faqs: [
      {
        q: 'Can a waiter add more items to a table ticket that has already been sent to the kitchen?',
        a: 'Yes. Adding a second round of drinks or desserts appends to the active table ticket (#SB-8924) and fires only the newly added items to the kitchen.',
      },
      {
        q: 'How are voided or cancelled orders tracked?',
        a: 'Every voided item records the timestamp, staff ID, manager approval code, and whether the food was already prepared, preventing cash leakage.',
      },
    ],
  },
  'inventory-management': {
    slug: 'inventory-management',
    category: 'Kitchen & Operations',
    badge: 'Automated Stock & Raw Spices',
    badgeSo: 'Maamulka Kaydka Raashinka & Xawaashka',
    title: 'Real-Time Recipe Depletion & Kitchen Waste Control',
    titleSo: 'Xisaabinta Tooska ah ee Raashinka Ceyriin & Joojinta Khasaaraha',
    highlightWord: 'Recipe Depletion',
    subtitle:
      'Stop guessing why food costs are rising. SomBill automatically deducts exact grams of Basmati rice, camel/goat meat, cooking oil, cardamom, and packaging the second a dish is sold at the POS.',
    subtitleSo:
      'Markasta oo cunto la iibiyo, nidaamku wuxuu si toos ah kaydka uga jarayaa qiyaasta bariiska, hilibka, saliidda iyo xawaashka.',
    shortDesc: 'Ingredient-level recipe costing, low-stock alerts, supplier POs, and variance audits.',
    iconName: 'inventory_2',
    accentColor: '#059669',
    heroMetrics: [
      { label: 'Food Waste Reduction', value: '-24%', sub: 'Catches portion creep & pilferage' },
      { label: 'Stock Deduction', value: 'Real-Time', sub: 'Triggered on every POS & NFC sale' },
      { label: 'Margin Visibility', value: 'Per-Dish', sub: 'Live COGS vs. selling price' },
      { label: 'Low-Stock Alerts', value: 'Automated', sub: 'Reorder thresholds before stockout' },
    ],
    simulatorType: 'inventory',
    keyFeatures: [
      {
        title: 'Bill of Materials (Recipe) Auto-Deduction',
        desc: 'Map every menu item to its exact raw ingredients. Selling 1x Family Mandi Platter automatically deducts 1.2kg goat meat, 600g Basmati rice, and 45ml ghee.',
        bullet1: 'Supports sub-recipes (e.g. house Bisbaas sauce batch)',
        bullet2: 'Tracks unit conversions (Sacks -> Kg -> Grams)',
        icon: 'science',
      },
      {
        title: 'Theoretical vs. Physical Stock Variance',
        desc: 'Compare what should be in your cold room based on POS sales against your end-of-week physical count to spot shrinkage, over-portioning, or unrecorded waste.',
        bullet1: 'Highlights high-variance items in USD & SLSH value',
        bullet2: 'Fast mobile stock-take sheet for kitchen supervisors',
        icon: 'balance',
      },
      {
        title: 'Low-Stock Par Levels & Purchase Orders',
        desc: 'Receive instant dashboard warnings when camel milk, charcoal, or takeaway boxes drop below your minimum par level, and generate supplier POs in 1 click.',
        bullet1: 'Vendor price history and delivery receiving logs',
        bullet2: 'Automatic POS "Low Stock" badge on affected dishes',
        icon: 'notifications',
      },
      {
        title: 'Central Commissary & Inter-Branch Transfers',
        desc: 'Butcher meat or bake pastries at a central facility and transfer stock to your downtown and airport branches with full chain-of-custody signoff.',
        bullet1: 'Tracks in-transit vs. received branch quantities',
        bullet2: 'Automated branch cost allocation',
        icon: 'local_shipping',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Receive Vendor Stock',
        desc: 'Log incoming sacks of rice, meat cuts, and beverages into branch storage.',
      },
      {
        step: '02',
        title: 'Auto-Deplete on Sale',
        desc: 'Every POS and NFC order deducts exact recipe quantities automatically.',
      },
      {
        step: '03',
        title: 'Audit & Reorder',
        desc: 'Review weekly variance reports and replenish low-par ingredients.',
      },
    ],
    useCases: [
      {
        venueType: 'Steakhouses, Camel Meat & Grill Restaurants',
        scenario: 'High-value protein cuts where 10% portion variance destroys monthly net profit.',
        impact: 'Pinpoints exact kilogram discrepancies between butcher weight and billed plates.',
      },
      {
        venueType: 'Bakery & Café Chains',
        scenario: 'Tracking coffee beans, milk cartons, and central bakery pastry deliveries.',
        impact: 'Eliminates surprise morning stockouts and reduces spoilage by 24%.',
      },
    ],
    relatedSlugs: ['menu-management', 'multi-branch', 'business-analytics', 'restaurant-pos'],
    faqs: [
      {
        q: 'Can we buy ingredients in 50kg sacks or cartons and deduct them in grams or pieces?',
        a: 'Yes. SomBill handles multi-unit conversions automatically—you can purchase rice in 50kg sacks and deduct 250g per plate.',
      },
      {
        q: 'What happens if an item is voided after the kitchen already cooked it?',
        a: 'You can mark the void as "Cooked Waste", which deducts the raw ingredients from inventory and logs the cost under kitchen waste rather than leaving stock inaccurate.',
      },
    ],
  },
  'billing-payments': {
    slug: 'billing-payments',
    category: 'Finance & Enterprise',
    badge: 'Native ZAAD, e-Dahab & Dual-Currency Engine',
    badgeSo: 'Lacag-bixinta Tooska ah ee ZAAD, e-Dahab & Laba Lacagood',
    title: 'Zero-Friction Settlement Across Mobile Money, Cash & Cards',
    titleSo: 'Lacag-qabasho Degdeg ah: ZAAD, e-Dahab, Doolar &obi Shilin',
    highlightWord: 'Zero-Friction Settlement',
    subtitle:
      'Built specifically for the Somaliland and East African financial ecosystem. Trigger direct `*880#` Telesom ZAAD and `*770#` Dahabshiil e-Dahab push prompts, manage dual-currency cash drawers, and eliminate fake SMS screenshot fraud.',
    subtitleSo: 'Si toos ah ugu dir fariinta lacag-bixinta mobilka macmiilka, kana hortag fariimaha been-abuurka ah.',
    shortDesc: 'Direct ZAAD & e-Dahab API push, USD/SLSH dual ledger, and split-tender checkout.',
    iconName: 'payments',
    accentColor: '#16A34A',
    heroMetrics: [
      { label: 'Payment Verification', value: '3.4 Sec', sub: 'Automated merchant API callback' },
      { label: 'Exchange Math Errors', value: '0%', sub: 'Instant USD <-> SLSH conversion' },
      { label: 'Supported Tenders', value: '6 Native', sub: 'ZAAD, e-Dahab, USD, SLSH, Card, Folio' },
      { label: 'Drawer Reconciliation', value: '100%', sub: 'Exact till count by note denomination' },
    ],
    simulatorType: 'pos-kds',
    keyFeatures: [
      {
        title: 'Direct Telesom ZAAD & Dahabshiil e-Dahab Push',
        desc: 'No more typing long merchant codes or squinting at customer phone screens. Enter the customer’s mobile number (or let them scan QR) to trigger an instant PIN prompt.',
        bullet1: 'Auto-verifies transaction ID (#ZD-9921 / #ED-4410)',
        bullet2: 'Eliminates unpaid walkouts and SMS spoofing',
        icon: 'phonelink_ring',
      },
      {
        title: 'Dynamic Dual-Currency Ledger (USD & SLSH)',
        desc: 'Every bill displays both US Dollars and Somaliland Shillings at your configured daily rate (e.g., 1 USD = 11,801 SLSH). Accept $50 USD and return change in SLSH effortlessly.',
        bullet1: 'Quick tender buttons ($50, $100, 500k SLSH)',
        bullet2: 'Tracks USD and SLSH physical cash drawers separately',
        icon: 'currency_exchange',
      },
      {
        title: 'Flexible Split Bill & Corporate House Accounts',
        desc: 'Split a check evenly among 4 colleagues, split by individual ordered dishes, or post the invoice to a verified NGO, ministry, or corporate credit account.',
        bullet1: 'Automated monthly corporate statement invoicing',
        bullet2: 'Hotel PMS room folio charge integration',
        icon: 'account_balance_wallet',
      },
      {
        title: 'Bilingual Thermal & Digital Receipts',
        desc: 'Print crisp itemized receipts showing Dual Currency totals, MOF VAT breakdown, ZAAD/e-Dahab authorization codes, and your venue’s branding.',
        bullet1: '1-click reprint from Order History archive',
        bullet2: 'Optional WhatsApp / SMS digital receipt',
        icon: 'print',
      },
    ],
    workflowSteps: [
      { step: '01', title: 'Select Tender', desc: 'Cashier or guest chooses ZAAD, e-Dahab, Cash USD/SLSH, or Card.' },
      {
        step: '02',
        title: 'Instant Verification',
        desc: 'Mobile money USSD push confirms payment and records Auth ID.',
      },
      { step: '03', title: 'Auto-Reconcile', desc: 'Ledger updates shift totals and prints dual-currency receipt.' },
    ],
    useCases: [
      {
        venueType: 'High-Traffic Cashier Desks',
        scenario: 'Settling 150+ lunch bills in 90 minutes where 80% pay via mobile money and 20% pay mixed cash.',
        impact: 'Cuts checkout time to 3.4 seconds per guest and guarantees 100% reconciled shift closeouts.',
      },
      {
        venueType: 'Hotels & Corporate Conference Venues',
        scenario: 'Handling NGO workshops, diplomatic banquets, and multi-day guest room charges.',
        impact: 'Consolidates restaurant dining into master corporate or room invoices.',
      },
    ],
    relatedSlugs: ['restaurant-pos', 'tax-financial-reports', 'nfc-ordering', 'order-management'],
    faqs: [
      {
        q: 'How does SomBill integrate with Telesom ZAAD and Dahabshiil e-Dahab?',
        a: 'SomBill connects directly to your registered merchant tills. When a cashier initiates a push or a guest checks out on NFC/QR, the payment confirmation automatically marks the POS ticket as Settled with the telecom reference number.',
      },
      {
        q: 'Can we set our own daily USD to SLSH exchange rate?',
        a: 'Yes. Super Managers can set the branch exchange rate (e.g., 1 USD = 11,801 SLSH) or sync with the Somaliland Central Bank reference rate in one click.',
      },
    ],
  },
  'tax-financial-reports': {
    slug: 'tax-financial-reports',
    category: 'Finance & Enterprise',
    badge: 'Tax Compliance & Z-Report Engine',
    badgeSo: 'Warbixinada Maaliyadda & Cashuurta MOF',
    title: 'Automated Ministry of Finance VAT, Z-Reports & P&L Statements',
    titleSo: 'Xisaab-xidhka Maalinlaha ah (Z-Report) & Cashuurta Wasaaradda Maaliyadda',
    highlightWord: 'VAT & Z-Reports',
    subtitle:
      'Close every shift with zero variance. Generate instant X/Z-Reports, track Somaliland Ministry of Finance 4.8% VAT (or custom regional tax rates), and export audit-ready CSV/PDF statements in one click.',
    subtitleSo: 'Si fudud u xidh xisaabta shift kasta adigoo helaya warbixinta ZAAD, e-Dahab, Kaashka iyo cashuurta.',
    shortDesc: '1-click MOF VAT toggle, shift cash drawer closeout, and audit-ready financial statements.',
    iconName: 'account_balance',
    accentColor: '#0F172A',
    heroMetrics: [
      { label: 'Shift Closeout Time', value: '2 Mins', sub: 'Automated tender & note reconciliation' },
      { label: 'Tax Calculation', value: '4.8% MOF', sub: 'Configurable VAT & tax-exempt toggle' },
      { label: 'Audit Trail', value: '100% Immutable', sub: 'Every discount, void & refund logged' },
      { label: 'Export Formats', value: 'CSV / PDF', sub: 'Ready for accountants & tax filing' },
    ],
    simulatorType: 'tax-finance',
    keyFeatures: [
      {
        title: 'Somaliland Ministry of Finance (MOF) Tax Engine',
        desc: 'Support standard 4.8% MOF VAT or custom regional tax brackets. Toggle tax-exempt status for diplomatic or NGO guests with full authorization logging.',
        bullet1: 'Separate net revenue and collected tax ledgers',
        bullet2: '1-click monthly tax filing summary report',
        icon: 'gavel',
      },
      {
        title: 'Shift X-Report & End-of-Day Z-Report Closeout',
        desc: 'Count physical USD ($100, $50, $20) and SLSH (500k) notes in the till, compare against expected drawer balance, record safe drops, and sign off shift handover.',
        bullet1: 'Pinpoints exact cash overage or shortage by cashier',
        bullet2: 'Prints thermal Z-Report summary for safe deposit',
        icon: 'receipt',
      },
      {
        title: 'Tender-by-Tender Settlement Breakdown',
        desc: 'View exact daily and monthly collections split across ZAAD Service, e-Dahab Wallet, Cash USD, Cash SLSH, and Visa POS terminals.',
        bullet1: 'Reconciles directly against merchant bank statements',
        bullet2: 'Dual-currency reporting in both USD and SLSH',
        icon: 'pie_chart',
      },
      {
        title: 'Discount, Void & Refund Audit Logs',
        desc: 'Every `-5%`, `-10%`, custom discount, or voided ticket is logged with the cashier ID, timestamp, and reason code so owners have total financial transparency.',
        bullet1: 'Prevents unauthorized cashier discounting',
        bullet2: 'Exportable to Excel, CSV, and PDF',
        icon: 'fact_check',
      },
    ],
    workflowSteps: [
      { step: '01', title: 'Automated Capture', desc: 'Every sale records net amount, MOF VAT, and tender auth code.' },
      {
        step: '02',
        title: 'Shift Till Count',
        desc: 'Cashier counts physical notes and verifies $0.00 drawer variance.',
      },
      {
        step: '03',
        title: 'Z-Report & Export',
        desc: 'Print thermal Z-Report and export monthly P&L / tax statements.',
      },
    ],
    useCases: [
      {
        venueType: 'Multi-Shift Hotel & Restaurant Operations',
        scenario: 'Handing over the cash drawer between Morning Cashier and Evening Cashier at 18:00.',
        impact: 'Eliminates shift disputes with a verified opening float, safe drop, and signed Z-Report.',
      },
      {
        venueType: 'Finance Directors & External Auditors',
        scenario: 'Preparing monthly tax declarations and owner profit distributions.',
        impact: 'Downloads clean, reconciled USD & SLSH ledgers in 5 seconds instead of 3 days of manual tallying.',
      },
    ],
    relatedSlugs: ['billing-payments', 'business-analytics', 'restaurant-pos', 'multi-branch'],
    faqs: [
      {
        q: 'Can we toggle the 4.8% VAT on or off at the cashier terminal when needed?',
        a: 'Yes. Authorized cashiers or managers can toggle the MOF 4.8% VAT switch or apply a Tax-Exempt badge for eligible organizations, with every exemption recorded in the audit log.',
      },
      {
        q: 'Does the Z-Report separate US Dollar cash from Somaliland Shilling cash?',
        a: 'Yes. The physical drawer count tracks USD note denominations and SLSH note bundles separately so your float is reconciled in both currencies.',
      },
    ],
  },
  'staff-management': {
    slug: 'staff-management',
    category: 'Kitchen & Operations',
    badge: 'Workforce, Shifts & Role Permissions',
    badgeSo: 'Maamulka Shaqaalaha, Shift-yada & Ogolaanshaha',
    title: 'Granular Role-Based Access, Shift Rosters & Waiter Performance',
    titleSo: 'Maamulka Shaqaalaha, Waqtiyada Shaqada & Xakameynta Awoodaha',
    highlightWord: 'Role-Based Access',
    subtitle:
      'Give every team member the exact workspace they need: Super Manager, Head Cashier, Senior Waiter, Line Chef, or Accountant. Track shift attendance, sales per server, and table turnaround velocity.',
    subtitleSo:
      'Qof walba sii shaqada u gaarka ah: Maamule, Khasnaji, Kabalyeeri ama Kariye. La soco waxqabadka shaqaale kasta.',
    shortDesc: 'PIN & NFC badge clock-in, permission matrices, shift tracking, and server leaderboards.',
    iconName: 'badge',
    accentColor: '#4F46E5',
    heroMetrics: [
      { label: 'Role Profiles', value: 'Custom RBAC', sub: 'Manager, Cashier, Waiter, Chef, Auditor' },
      { label: 'Clock-In Speed', value: '1 Tap', sub: '4-digit PIN or NFC staff card' },
      { label: 'Server Attribution', value: '100%', sub: 'Every ticket linked to assigned waiter' },
      { label: 'Unauthorized Voids', value: '0%', sub: 'Permission-locked sensitive actions' },
    ],
    simulatorType: 'pos-kds',
    keyFeatures: [
      {
        title: 'Dedicated Role Workspaces',
        desc: 'Waiters see only their assigned tables and guest buzzers; Cashiers see the fast settlement queue and till drawer; Managers see full analytics and permission controls.',
        bullet1: 'Prevents accidental menu edits or unauthorized refunds',
        bullet2: 'Instant terminal user switching via PIN or NFC card',
        icon: 'admin_panel_settings',
      },
      {
        title: 'Morning & Evening Shift Management',
        desc: 'Organize operations into structured shifts (e.g., Shift #1 Morning 07:00–15:00, Shift #2 Evening 15:00–23:00) with live headcount, elapsed time, and shift revenue.',
        bullet1: 'Tracks late clock-ins and overtime hours',
        bullet2: 'Links cashier drawer floats to active shift IDs',
        icon: 'schedule',
      },
      {
        title: 'Waiter Sales & Velocity Leaderboards',
        desc: 'Reward your top-performing floor staff. Track total orders delivered, average delivery time (e.g., 14 mins), average check size, and customer call response speed.',
        bullet1: 'Transparent commission and service charge calculation',
        bullet2: 'Identifies coaching opportunities on slow shifts',
        icon: 'emoji_events',
      },
      {
        title: 'Granular Permission Matrix',
        desc: 'Toggle 30+ specific permissions per role: Issue Discounts, Void Cooked Items, Edit Exchange Rate, View Financial Reports, or Export Customer Data.',
        bullet1: 'Instant live enforcement across all branch devices',
        bullet2: 'Full audit log of permission changes',
        icon: 'security',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Assign Role & PIN',
        desc: 'Create staff profile with role permissions and assigned shift.',
      },
      {
        step: '02',
        title: 'Tap to Clock In',
        desc: 'Staff member taps NFC badge or enters PIN at terminal to start shift.',
      },
      {
        step: '03',
        title: 'Track Performance',
        desc: 'Review orders handled, average ticket value, and shift accuracy.',
      },
    ],
    useCases: [
      {
        venueType: 'Large Restaurants with 30+ Floor & Kitchen Staff',
        scenario: 'Managing morning and night shifts across waiters, cashiers, and chefs.',
        impact: 'Eliminates shared passwords and attributes every dollar of sales to the exact staff member.',
      },
      {
        venueType: 'Owner-Absentee Hospitality Businesses',
        scenario: 'Owners traveling abroad who need strict control over discounts and voids.',
        impact: 'Role permissions lock down cash leakage while live alerts notify the owner of any overrides.',
      },
    ],
    relatedSlugs: ['restaurant-pos', 'table-management', 'tax-financial-reports', 'business-analytics'],
    faqs: [
      {
        q: 'Can waiters share a single floor tablet while keeping their orders separate?',
        a: 'Yes. Multiple waiters can use a shared floor terminal by tapping their NFC staff card or entering their 4-digit PIN in under 1 second.',
      },
      {
        q: 'Can we restrict cashiers from viewing monthly company profit reports?',
        a: 'Yes. Cashiers only see their current shift drawer and settlement queue, while historical financial reports are restricted to Super Managers and Owners.',
      },
    ],
  },
  'multi-branch': {
    slug: 'multi-branch',
    category: 'Finance & Enterprise',
    badge: 'Multi-Branch Central HQ',
    badgeSo: 'Maamulka Xarumaha Badan (Multi-Branch HQ)',
    title: 'Control Every Branch Across Somaliland & East Africa from One Screen',
    titleSo: 'Ka Maamul Dhammaan Faracyadaada Hargeysa, Berbera, Burco & Muqdisho Hal Shaashad',
    highlightWord: 'One Screen',
    subtitle:
      'Whether you operate 2 branches in Hargeisa or 15 locations across Berbera, Burao, Borama, and Mogadishu—push global menu updates, monitor live branch sales, and manage inter-branch inventory transfers effortlessly.',
    subtitleSo: 'La soco dakhliga farac kasta si toos ah, hal marna u dir isbeddelka qiimaha iyo liiska cuntada.',
    shortDesc: 'Centralized menu push, live cross-branch telemetry, and regional exchange rates.',
    iconName: 'domain',
    accentColor: '#7C3AED',
    heroMetrics: [
      { label: 'Global Menu Push', value: '2 Sec', sub: 'Deploy prices to all outlets in 1 click' },
      { label: 'Branch Telemetry', value: 'Real-Time', sub: 'Live revenue, active tables & KDS queue' },
      { label: 'Regional Currencies', value: 'Per-Branch', sub: 'Custom SLSH / USD rate per city' },
      { label: 'Scalability', value: '1 to 100+', sub: 'Unlimited branches & terminals' },
    ],
    simulatorType: 'multi-branch',
    keyFeatures: [
      {
        title: '1-Click Global Menu & Price Synchronization',
        desc: 'Launch a new Ramadan platter or adjust beverage prices across Hargeisa HQ, Berbera Port Cafe, and Burao Central simultaneously without logging into each branch.',
        bullet1: 'Supports regional price tiers by city',
        bullet2: 'Instant propagation to all POS and NFC menus',
        icon: 'sync',
      },
      {
        title: 'Live Cross-Branch Performance Wall',
        desc: 'Compare today’s revenue, occupied tables, active KDS tickets, and online terminal health across every branch on a single executive command screen.',
        bullet1: 'Instant tenant/branch switcher filter',
        bullet2: 'Drill down into any branch’s live orders in 1 click',
        icon: 'monitoring',
      },
      {
        title: 'Central Commissary & Stock Transfers',
        desc: 'Manage a central warehouse or bakery that supplies raw ingredients and prepared items to satellite branches with full dispatch and receiving logs.',
        bullet1: 'Eliminates inter-branch stock discrepancies',
        bullet2: 'Consolidated vendor purchasing power',
        icon: 'warehouse',
      },
      {
        title: 'City-Specific Tax & Exchange Rate Rules',
        desc: 'Operate branches across different jurisdictions? Configure Somaliland SLSH rates and MOF VAT for Hargeisa/Berbera branches while running USD-only in other hubs.',
        bullet1: 'Consolidated group reporting in USD',
        bullet2: 'Localized receipt headers and tax IDs per branch',
        icon: 'public',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Configure HQ Standards',
        desc: 'Set master menu items, roles, and accounting policies at HQ.',
      },
      { step: '02', title: 'Push to Branches', desc: 'Deploy updates instantly to selected cities and terminals.' },
      {
        step: '03',
        title: 'Monitor Consolidated P&L',
        desc: 'Compare branch-by-branch sales, margins, and staff velocity.',
      },
    ],
    useCases: [
      {
        venueType: 'Growing Restaurant & Café Chains',
        scenario: 'Expanding from a flagship Hargeisa restaurant to 4 branches across Hargeisa and Berbera.',
        impact: 'Maintains identical food quality, recipe costing, and brand pricing without hiring extra admin staff.',
      },
      {
        venueType: 'Hospitality Groups (Hotels + Standalone Cafés)',
        scenario:
          'Managing a luxury hotel, a downtown fast-casual grill, and an airport lounge under one holding company.',
        impact: 'Unifies executive reporting while letting each concept run its own tailored menu.',
      },
    ],
    relatedSlugs: ['business-analytics', 'menu-management', 'inventory-management', 'tax-financial-reports'],
    faqs: [
      {
        q: 'If one branch loses internet, does it affect our other branches?',
        a: 'Never. Each branch operates its own independent local LAN mesh. The offline branch continues serving guests and syncs its transactions to the HQ dashboard as soon as its connection resumes.',
      },
      {
        q: 'Can we give a Branch Manager access to only their own location?',
        a: 'Yes. Branch Managers are scoped strictly to their assigned branch, while the General Manager or Owner can switch between All Branches or any individual outlet.',
      },
    ],
  },
  'business-analytics': {
    slug: 'business-analytics',
    category: 'Finance & Enterprise',
    badge: 'Executive BI & Revenue Intelligence',
    badgeSo: 'Falanqaynta Ganacsiga & Xogta Dakhliga',
    title: 'Real-Time Hospitality Intelligence on Any Device',
    titleSo: 'Xogta Dakhliga, Cuntooyinka Ugu Iibka Badan & Saacadaha Mashquulka',
    highlightWord: 'Hospitality Intelligence',
    subtitle:
      'Turn every order into actionable intelligence. Track hourly sales velocity, payment method distribution (ZAAD vs. e-Dahab vs. Cash), top-selling dishes, and table occupancy from your laptop or smartphone.',
    subtitleSo:
      'Kala soco mobilkaaga ama kombiyuutarkaaga dakhliga maalinlaha ah, cuntooyinka ugu iibka badan, iyo qaabka lacag-bixinta.',
    shortDesc: 'Live KPI sparklines, payment mix donuts, menu engineering matrices, and shift comparisons.',
    iconName: 'query_stats',
    accentColor: '#0284C7',
    heroMetrics: [
      { label: 'Data Latency', value: 'Live Stream', sub: 'Updates the second a ticket settles' },
      { label: 'Core KPIs', value: '25+ Reports', sub: 'Sales, AOV, RevPASH, COGS, Labor' },
      { label: 'Currency Toggle', value: 'USD & SLSH', sub: 'Dual-currency charts & exports' },
      { label: 'Mobile Access', value: '24/7 Cloud', sub: 'Check live branch performance anywhere' },
    ],
    simulatorType: 'tax-finance',
    keyFeatures: [
      {
        title: 'Live Executive KPI Command Cards',
        desc: 'Monitor Total Sales (USD + SLSH), Total Orders, Tables Occupied ring (e.g., 18/42), and Average Order Value with period-over-period trend chips.',
        bullet1: 'Filter by Today, Yesterday, 7 Days, or 30 Days',
        bullet2: '100% mathematical consistency across charts and tables',
        icon: 'insights',
      },
      {
        title: 'Payment Method Mix (ZAAD, e-Dahab, Cash, Card)',
        desc: 'Visualize exact revenue share across mobile money wallets and physical cash so you know how much liquidity sits in Telesom ZAAD vs. Dahabshiil e-Dahab.',
        bullet1: 'Instant breakdown by transaction count and USD/SLSH volume',
        bullet2: 'Helps optimize supplier payouts by wallet type',
        icon: 'donut_large',
      },
      {
        title: 'Top-Selling Dishes & Menu Profitability',
        desc: 'Identify your star dishes (high volume, high margin) and underperforming items so you can promote winners on your NFC menus and trim slow movers.',
        bullet1: 'Ranks items by quantity sold and gross revenue',
        bullet2: 'Tracks category share across Mains, Grill, and Beverages',
        icon: 'trending_up',
      },
      {
        title: 'Peak-Hour & Shift Comparison Heatmaps',
        desc: 'Compare Morning Shift vs. Night Shift revenue and order volume by hour of the day to staff your kitchen and dining floor with surgical precision.',
        bullet1: 'Eliminates over-staffing during quiet afternoon hours',
        bullet2: 'Highlights peak Friday and weekend rush windows',
        icon: 'bar_chart',
      },
    ],
    workflowSteps: [
      {
        step: '01',
        title: 'Live Transaction Ingest',
        desc: 'Every POS, Waiter, and NFC action streams into the analytics engine.',
      },
      {
        step: '02',
        title: 'Visual Drill-Down',
        desc: 'Slice metrics by date range, shift, payment method, or branch.',
      },
      {
        step: '03',
        title: 'Optimize Margins',
        desc: 'Adjust staffing, pricing, and menu placement based on hard data.',
      },
    ],
    useCases: [
      {
        venueType: 'Hospitality Owners & Investors',
        scenario: 'Checking evening dinner revenue across branches from home or while traveling.',
        impact: 'Real-time visibility on smartphone without waiting for end-of-month spreadsheets.',
      },
      {
        venueType: 'General Managers & F&B Directors',
        scenario: 'Weekly menu review to combat rising ingredient costs.',
        impact: 'Identifies high-margin combos to feature on NFC table upsell prompts.',
      },
    ],
    relatedSlugs: ['multi-branch', 'tax-financial-reports', 'inventory-management', 'restaurant-pos'],
    faqs: [
      {
        q: 'Can I view live restaurant sales on my phone while away from the venue?',
        a: 'Yes. The SomBill Super Manager and Main Admin dashboards are fully responsive web applications accessible securely from any smartphone, tablet, or laptop.',
      },
      {
        q: 'Are all charts and reports available in both USD and Somaliland Shillings?',
        a: 'Yes, every metric displays primary USD figures alongside exact SLSH equivalents.',
      },
    ],
  },
};

export const SOLUTION_PAGES: Record<SolutionSlug, SolutionPageSpec> = {
  restaurants: {
    slug: 'restaurants',
    badge: 'Full-Service & Casual Dining OS',
    title: 'Built for High-Volume Somali & International Restaurants',
    titleSo: 'Loogu Talagalay Makhaayadaha Waaweyn & Kuwa Dhexe',
    subtitle:
      'Synchronize floor waiters, family Majlis rooms, charcoal grills, and cashier desks. Turn tables 35% faster while eliminating handwritten ticket errors and billing queues.',
    shortDesc: 'Complete table service, waiter handhelds, multi-station KDS, and fast ZAAD checkout.',
    iconName: 'restaurant',
    heroStat: '+35%',
    heroStatLabel: 'Faster Table Turnaround During Peak Rush',
    challenges: [
      {
        problem: 'Waiters walking back and forth to the kitchen with handwritten paper slips during Friday rush.',
        solution:
          'Waiter Floor POS & NFC table stands fire orders to the Grill and Rice KDS screens in 14 milliseconds.',
      },
      {
        problem: 'Long customer queues at the cashier desk trying to calculate USD-to-SLSH rates and split bills.',
        solution:
          'Instant dual-currency checkout with 1-tap Telesom ZAAD & e-Dahab USSD push and automatic SLSH change math.',
      },
      {
        problem: 'Uncontrolled kitchen portioning and missing raw meat/rice stock.',
        solution: 'Real-time recipe ingredient depletion deducts exact grams on every plate sold.',
      },
    ],
    tailoredModules: [
      {
        title: 'Waiter Floor POS & Table Map',
        desc: 'Manage Main Hall, Terrace, and VIP Majlis occupancy with live guest buzzer alerts.',
        slug: 'table-management',
      },
      {
        title: 'Multi-Station Kitchen KDS',
        desc: 'Route grill items, rice platters, and Shaah to dedicated prep screens.',
        slug: 'kds',
      },
      {
        title: 'Dual-Currency Cashier Terminal',
        desc: 'Settle bills in 3.4 seconds across ZAAD, e-Dahab, USD, and SLSH.',
        slug: 'billing-payments',
      },
    ],
    workflowTitle: 'Full-Service Restaurant Workflow',
    workflowStages: [
      { title: '1. Seat & Assign', detail: 'Host seats guests on the visual floor map; table timer begins.' },
      { title: '2. Table or NFC Order', detail: 'Waiter punches order on tablet or guest taps the NFC table puck.' },
      { title: '3. Parallel Kitchen Prep', detail: 'Grill KDS and Beverage KDS prepare items with SLA timers.' },
      { title: '4. Fast ZAAD Settle', detail: 'Guest pays at table via NFC or at Terminal #02 in seconds.' },
    ],
    recommendedPlan: 'Professional',
  },
  hotels: {
    slug: 'hotels',
    badge: 'Hospitality & Resort F&B Suite',
    title: 'Unify Hotel Dining, Room Service, Rooftops & Banquet Halls',
    titleSo: 'Nidaamka Huteelada, Adeegga Qolalka & Xafladaha',
    subtitle:
      'From 24/7 bedside NFC room-service coasters to poolside lounges and diplomatic conference banquets—post F&B charges seamlessly to room folios or settle instantly via mobile money.',
    shortDesc: 'Bedside NFC room service, room folio billing, multi-venue F&B routing, and banquet management.',
    iconName: 'hotel',
    heroStat: '+28%',
    heroStatLabel: 'Increase in In-Room & Rooftop F&B Revenue',
    challenges: [
      {
        problem: 'Guests calling a busy front-desk extension to order room service with language misunderstandings.',
        solution:
          'Bedside walnut NFC coasters let guests browse HD menus in Somali, English, or Arabic and order in 2 taps.',
      },
      {
        problem: 'Disconnected billing between the hotel restaurant, rooftop cafe, and guest room checkout.',
        solution:
          'Unified Hotel Folio charging posts dining bills directly to the verified room number with guest signature.',
      },
      {
        problem: 'Managing Morning Breakfast buffets alongside Evening fine dining and corporate conferences.',
        solution: 'Day-part menu scheduling and shift-level Z-Report reconciliation across every hotel outlet.',
      },
    ],
    tailoredModules: [
      {
        title: 'Bedside NFC Room Coasters',
        desc: 'Auto-tagged to Room #204; orders route straight to the night kitchen KDS.',
        slug: 'nfc-ordering',
      },
      {
        title: 'Multi-Zone Floor Management',
        desc: 'Separate layouts for Main Dining, Rooftop Lounge, Poolside, and Banquet Hall.',
        slug: 'table-management',
      },
      {
        title: 'Corporate & Folio Billing',
        desc: 'Charge to room folios, NGO house accounts, or settle via ZAAD/Visa.',
        slug: 'billing-payments',
      },
    ],
    workflowTitle: 'Hotel & Resort F&B Flow',
    workflowStages: [
      { title: '1. Tap Bedside or Pool Puck', detail: 'Guest taps NFC coaster in Room 302 or Pool Cabana #4.' },
      { title: '2. Kitchen KDS Routing', detail: 'Room Service KDS alerts kitchen and prints tray card.' },
      { title: '3. Folio or Mobile Pay', detail: 'Charge posts to Room 302 folio or settles immediately via ZAAD.' },
      { title: '4. Night Audit Sync', detail: 'End-of-day Z-Report reconciles all hotel F&B outlets automatically.' },
    ],
    recommendedPlan: 'Enterprise & Chains',
  },
  cafes: {
    slug: 'cafes',
    badge: 'Cafés, Qawa & Bakery Lounges',
    title: 'High-Speed Counter POS & Table Tap Ordering for Modern Cafés',
    titleSo: 'Nidaamka الكافيهات, Qaxwaha, Shaaha & Macmacaanka',
    subtitle:
      'Keep morning espresso and evening Shaah Cadays lines moving at lightning speed. Handle custom milk/sugar modifiers, pastry display stock, and second-round table reorders effortlessly.',
    shortDesc: '3-tap counter checkout, barista KDS screen, pastry inventory, and NFC table reorders.',
    iconName: 'local_cafe',
    heroStat: '3.4s',
    heroStatLabel: 'Average Counter Checkout with ZAAD / e-Dahab',
    challenges: [
      {
        problem: 'Long counter lines during morning coffee and evening social hours causing walk-aways.',
        solution:
          '3-tap Express Walk-In POS plus NFC table pucks so seated guests order their second tea without standing in line.',
      },
      {
        problem: 'Baristas shouting drink modifiers (Camel milk, Cardamom, Less Sugar, Iced) across a noisy counter.',
        solution: 'Dedicated Barista KDS screen displays exact drink modifiers in order of arrival.',
      },
      {
        problem: 'Daily pastry and cake waste with unclear shelf-life tracking.',
        solution: 'Real-time bakery stock counts with automatic POS "Low Stock" indicators.',
      },
    ],
    tailoredModules: [
      {
        title: 'Express Counter POS',
        desc: 'Fast barcode & tile lookup with 1-tap ZAAD/e-Dahab/Cash settlement.',
        slug: 'restaurant-pos',
      },
      {
        title: 'Smart Table NFC Discs',
        desc: 'Guests working on laptops tap the table to order refills and pastries.',
        slug: 'nfc-ordering',
      },
      {
        title: 'Bakery & Beverage Inventory',
        desc: 'Track coffee beans, camel milk, and daily pastry batches.',
        slug: 'inventory-management',
      },
    ],
    workflowTitle: 'Café & Lounge Service Flow',
    workflowStages: [
      { title: '1. Counter or Table Tap', detail: 'Order placed at express counter or via table NFC disc.' },
      { title: '2. Barista KDS Prep', detail: 'Drink modifiers flash on the espresso & Shaah station screen.' },
      { title: '3. Instant Mobile Pay', detail: 'Settled via ZAAD/e-Dahab push in under 4 seconds.' },
      { title: '4. Automated Upsell', detail: 'NFC menu suggests warm sambusas or cake slices with every drink.' },
    ],
    recommendedPlan: 'Starter',
  },
  'fast-food': {
    slug: 'fast-food',
    badge: 'QSR, Shawarma & Fast-Food Engine',
    title: 'Sub-5-Second Order Entry & Assembly-Line Kitchen Speed',
    titleSo: 'Nidaamka Cuntooyinka Degdegga ah (Fast Food & Shawarma)',
    subtitle:
      'Engineered for high-throughput burger, fried chicken, pizza, and shawarma venues. Guided combo builders, kitchen assembly KDS, and customer pickup number callouts.',
    shortDesc: 'High-speed combo POS, takeaway parcel numbering, and assembly-line KDS.',
    iconName: 'fastfood',
    heroStat: '2.4x',
    heroStatLabel: 'Higher Peak-Hour Takeaway Order Throughput',
    challenges: [
      {
        problem: 'Cashiers taking too long to ring up meal combos, drink swaps, and extra sauces.',
        solution: 'Guided 1-screen Combo Builder with automatic meal-deal pricing and instant kitchen fire.',
      },
      {
        problem: 'Crowded pickup counters with customers shouting ticket numbers.',
        solution: 'Sequential Takeaway # tags (#108, #109, #110) synced between KDS bump bar and pickup display.',
      },
      {
        problem: 'Packaging, cooking oil, and frozen fries disappearing without accountability.',
        solution: 'Automatic deduction of wrappers, boxes, and portion weights on every combo sold.',
      },
    ],
    tailoredModules: [
      {
        title: 'Fast-Checkout Terminal',
        desc: 'High-contrast touch tiles built for 10-second counter turnarounds.',
        slug: 'restaurant-pos',
      },
      {
        title: 'Assembly-Line KDS',
        desc: 'Bump-bar controlled screens for Fry, Grill, and Packing stations.',
        slug: 'kds',
      },
      {
        title: 'Recipe & Packaging Stock',
        desc: 'Deducts buns, patties, sauces, and takeaway boxes automatically.',
        slug: 'inventory-management',
      },
    ],
    workflowTitle: 'QSR Express Workflow',
    workflowStages: [
      { title: '1. Ring Combo or QR Scan', detail: 'Cashier taps combo or customer scans lobby skip-the-line QR.' },
      { title: '2. Instant ZAAD Settle', detail: 'Paid immediately; receipt prints bold Takeaway #109.' },
      { title: '3. Fry & Grill KDS', detail: 'Line cooks assemble order under a 3-minute SLA timer.' },
      { title: '4. Bump to Pickup', detail: 'Order marked ready; customer collects parcel with zero confusion.' },
    ],
    recommendedPlan: 'Professional',
  },
  'fine-dining': {
    slug: 'fine-dining',
    badge: 'Fine Dining, Steakhouses & VIP Majlis',
    title: 'Elevated Hospitality with Course Pacing & Handcrafted NFC Pucks',
    titleSo: 'Makhaayadaha Heerka Sare & Qolalka Martida Gaarka ah (VIP)',
    subtitle:
      'Deliver unhurried, five-star hospitality. Coordinate multi-course firing, discreet VIP Majlis waiter call buzzers, walnut NFC table pucks, and effortless seat-by-seat bill splitting.',
    shortDesc: 'Course-by-course firing, VIP Majlis call queue, walnut NFC pucks, and split checks.',
    iconName: 'dining',
    heroStat: '100%',
    heroStatLabel: 'On-Time Course Delivery & VIP Call Response',
    challenges: [
      {
        problem: 'Main courses arriving from the kitchen before guests have finished their starters and soup.',
        solution: 'Course Hold & Fire controls let waiters trigger Mains to the Grill KDS at the exact right moment.',
      },
      {
        problem:
          'VIP guests in private Majlis rooms needing extra cutlery, water, or the bill without opening the curtain.',
        solution:
          'Discreet 1-tap Guest Buzzer on the table’s walnut NFC puck alerts the assigned senior waiter immediately.',
      },
      {
        problem: 'Awkward group bill splitting at the end of a diplomatic or executive dinner.',
        solution: 'Split check by seat or percentage in 1 tap with clean dual-currency receipts.',
      },
    ],
    tailoredModules: [
      {
        title: 'Walnut & Mahogany NFC Pucks',
        desc: 'Luxury laser-engraved wooden table discs matching fine interiors.',
        slug: 'nfc-ordering',
      },
      {
        title: 'VIP Majlis Buzzer Queue',
        desc: 'Prioritized service call queue sorted by wait time on Waiter POS.',
        slug: 'table-management',
      },
      {
        title: 'Seat-Level Split Billing',
        desc: 'Split by guest seat, custom percentage, or diplomatic tax-exempt.',
        slug: 'billing-payments',
      },
    ],
    workflowTitle: 'Fine Dining & VIP Majlis Experience',
    workflowStages: [
      {
        title: '1. Reservation & Welcome',
        detail: 'VIP table reserved on floor plan with guest notes and server assignment.',
      },
      {
        title: '2. Paced Course Firing',
        detail: 'Starters fire immediately; Mains held until waiter taps Fire Course 2.',
      },
      {
        title: '3. Discreet Buzzer Service',
        detail: 'Guests request assistance or bill with a silent tap on the table puck.',
      },
      { title: '4. Table-Side Settlement', detail: 'Settled at table via ZAAD push or Visa POS terminal.' },
    ],
    recommendedPlan: 'Professional',
  },
  'food-courts': {
    slug: 'food-courts',
    badge: 'Food Courts & Multi-Vendor Dining Halls',
    title: 'One Unified Table Order Across Multiple Kitchen Stalls',
    titleSo: 'Xarumaha Cuntooyinka Kala Duwan (Food Courts & Malls)',
    subtitle:
      'Let families sit at any table in your food court, scan once, and order Shawarma from Stall A, Seafood from Stall B, and Fresh Juice from Stall C on a single combined payment.',
    shortDesc: 'Multi-vendor order splitting, centralized or stall settlement, and landlord revenue dashboards.',
    iconName: 'storefront',
    heroStat: '1 Scan',
    heroStatLabel: 'To Order from Multiple Food Court Kitchens Simultaneously',
    challenges: [
      {
        problem: 'Families having to stand in 4 separate vendor queues and make 4 separate payments.',
        solution:
          'Unified Food Court QR/NFC table ordering lets guests combine items from multiple stalls in one cart.',
      },
      {
        problem: 'Routing a combined order to the right vendor kitchens without mix-ups.',
        solution: 'Automatic vendor-level KDS splitting sends each item only to the stall that prepares it.',
      },
      {
        problem:
          'Complex end-of-day revenue sharing and commission reconciliation between mall management and vendors.',
        solution: 'Automated vendor ledger splits sales and calculates landlord commission percentages in real time.',
      },
    ],
    tailoredModules: [
      {
        title: 'Multi-Vendor QR/NFC Ordering',
        desc: 'Single table scan browsing all food court stalls in one cart.',
        slug: 'qr-ordering',
      },
      {
        title: 'Vendor-Isolated KDS',
        desc: 'Each food stall sees and bumps only its own kitchen tickets.',
        slug: 'kds',
      },
      {
        title: 'Automated Revenue Split Reports',
        desc: 'Daily settlement breakdown per stall in USD and SLSH.',
        slug: 'tax-financial-reports',
      },
    ],
    workflowTitle: 'Food Court Multi-Stall Flow',
    workflowStages: [
      { title: '1. Single Table Scan', detail: 'Family scans Table 22 QR and picks items from 3 different stalls.' },
      { title: '2. Single ZAAD Checkout', detail: 'One mobile money push pays for the entire combined tray.' },
      { title: '3. Stall-Specific KDS', detail: 'Stall A, B, and C each receive their respective items immediately.' },
      { title: '4. Automated Vendor Split', detail: 'SomBill allocates net revenue to each stall’s daily ledger.' },
    ],
    recommendedPlan: 'Enterprise & Chains',
  },
  chains: {
    slug: 'chains',
    badge: 'Multi-Branch Chains & Franchises',
    title: 'Enterprise Command for Multi-City Hospitality Groups',
    titleSo: 'Maamulka Shirkadaha Leh Faracyo Badan & Franchises-ka',
    subtitle:
      'Scale from 2 outlets to 50+ across Hargeisa, Berbera, Burao, Borama, and Mogadishu. Standardize recipes, lock branch permissions, and view consolidated real-time revenue from headquarters.',
    shortDesc: 'Global menu governance, central commissary transfers, and multi-city BI.',
    iconName: 'hub',
    heroStat: '100%',
    heroStatLabel: 'Real-Time Visibility Across All Regional Branches',
    challenges: [
      {
        problem: 'Inconsistent menu prices, portion sizes, and unauthorized discounts across distant branches.',
        solution: 'Central HQ menu governance pushes locked prices and role permissions to all outlets in 2 seconds.',
      },
      {
        problem: 'Waiting until the end of the month to collect Excel sheets from each branch manager.',
        solution:
          'Live cloud consolidation streams every branch’s sales, Z-Reports, and stock levels to HQ in real time.',
      },
      {
        problem: 'Managing central warehouse purchasing and daily stock dispatches to satellite outlets.',
        solution: 'Built-in commissary transfer orders track stock from central storage to every branch kitchen.',
      },
    ],
    tailoredModules: [
      {
        title: 'Multi-Branch HQ Console',
        desc: 'Switch between All Branches or any single outlet in 1 click.',
        slug: 'multi-branch',
      },
      {
        title: 'Central Commissary Inventory',
        desc: 'Track central purchasing, batch production, and branch transfers.',
        slug: 'inventory-management',
      },
      {
        title: 'Consolidated Executive BI',
        desc: 'Compare branch-by-branch revenue, AOV, and staff performance.',
        slug: 'business-analytics',
      },
    ],
    workflowTitle: 'Enterprise Chain Governance Flow',
    workflowStages: [
      { title: '1. HQ Menu & Price Push', detail: 'Update recipes and prices once at HQ; sync to all cities in 2s.' },
      { title: '2. Commissary Dispatch', detail: 'Transfer verified raw stock batches to branch kitchens.' },
      {
        title: '3. Local Offline Execution',
        detail: 'Each branch runs fast local POS & KDS with zero internet dependency.',
      },
      {
        title: '4. Live HQ Consolidation',
        detail: 'Executive dashboard aggregates USD & SLSH revenue across the group.',
      },
    ],
    recommendedPlan: 'Enterprise & Chains',
  },
};

export const HARDWARE_PERIPHERALS = [
  {
    id: 'hw-pos-15',
    name: 'SomBill Touch Pro 15"',
    badge: 'IP54 Certified',
    spec: 'Capacitive 10-point multi-touch, spill-resistant aluminum chassis, dual customer-facing display.',
    category: 'Counter Terminal',
    icon: 'point_of_sale',
  },
  {
    id: 'hw-kds-21',
    name: 'KDS Station Display 21"',
    badge: 'Heat Rated',
    spec: 'Anti-glare high-heat casing for grill lines. VESA mountable with integrated audio alert bell.',
    category: 'Kitchen Display',
    icon: 'tv',
  },
  {
    id: 'hw-printer',
    name: 'Thermal Speed Printer',
    badge: '250mm/s',
    spec: 'Triple interface (Ethernet + USB + Bluetooth), auto-cutter, and direct RJ12 cash-drawer kick.',
    category: 'Receipt & Kitchen',
    icon: 'print',
  },
  {
    id: 'hw-bump',
    name: 'Kitchen Bump Bar 8-Key',
    badge: 'Tactile',
    spec: 'Cook-friendly heavy-duty mechanical keys. Operates effortlessly with gloved or wet hands.',
    category: 'Kitchen Control',
    icon: 'keyboard',
  },
  {
    id: 'hw-walnut',
    name: 'Solid Walnut & Mahogany Puck',
    badge: '10-Year Chip',
    spec: 'Handcrafted hardwood discs with laser-engraved table numbers and embedded waterproof NTAG215 core.',
    category: 'Smart Table NFC',
    icon: 'album',
  },
  {
    id: 'hw-steel',
    name: 'Brushed Steel & Aluminum Disc',
    badge: 'Scratch & Heat',
    spec: 'Anodized anti-scratch finish engineered for bustling tea cafes, grill houses, and outdoor rooftop gardens.',
    category: 'Smart Table NFC',
    icon: 'toll',
  },
];

export const BLOG_POSTS = [
  {
    id: 'blog-1',
    category: 'Operations & Speed',
    readTime: '6 min read',
    date: 'November 2026',
    title: 'How Offline-First Local Mesh Keeps Somaliland Restaurants Running During Fiber Outages',
    titleSo: 'Sida Nidaamka Offline-ka ah ee SomBill u Ilaaliyo Shaqada Makhaayadaha Marka Internetku Go’o',
    excerpt:
      'Why cloud-only POS systems freeze during peak Friday lunch rush—and how SomBill’s local LAN synchronization guarantees zero lost kitchen tickets.',
    content: [
      'Across Hargeisa, Berbera, and Mogadishu, hospitality venues face a common operational reality: peak Friday lunch and evening dinner rushes coincide with high regional network congestion. When a traditional cloud-dependent POS loses internet connectivity, waiter tablets stop firing tickets to the kitchen and cashiers cannot print bills.',
      'SomBill OS solves this at the architectural layer using a Local LAN Mesh Engine. Your cashier terminals, waiter handhelds, thermal kitchen printers, and Kitchen Display Screens communicate directly over your venue’s local router in under 15 milliseconds—completely independent of external internet availability.',
      'Every order, split check, and cash/mobile money settlement is written to an encrypted local ledger first. The moment external fiber or 4G connectivity restores, SomBill automatically reconciles and streams all shift data to your multi-branch cloud dashboard without duplicate tickets or manual intervention.',
    ],
  },
  {
    id: 'blog-2',
    category: 'Fintech & Payments',
    readTime: '5 min read',
    date: 'November 2026',
    title: 'Eliminating Dual-Currency Math Errors Across USD, SLSH, ZAAD & e-Dahab',
    titleSo: 'Xallinta Khaladaadka Xisaabta Laba-Lacagood (USD & SLSH) iyo ZAAD / e-Dahab',
    excerpt:
      'A practical guide to managing mixed-tender hospitality checkouts where guests pay part in US Dollars, part in Somaliland Shillings, and part via mobile money.',
    content: [
      'Hospitality cashiers in Somaliland routinely juggle two physical currencies (USD and Somaliland Shillings) alongside two dominant mobile money ecosystems (Telesom ZAAD and Dahabshiil e-Dahab). Relying on pocket calculators during a busy dinner checkout leads to rounding errors, slow queues, and end-of-shift drawer variances.',
      'With SomBill’s Dynamic Dual-Currency Engine, every menu item and receipt automatically displays both USD and exact SLSH equivalents based on the branch’s configured daily exchange rate (such as 1 USD = 11,801 SLSH).',
      'When a guest tenders a $50 USD note for a $44.02 bill, the cashier screen immediately displays the exact change due in both USD ($5.98) and SLSH (70,570 SLSH). For mobile money, direct USSD push integration triggers an instant PIN prompt on the customer’s phone and records the telecom authorization code automatically.',
    ],
  },
  {
    id: 'blog-3',
    category: 'Guest Experience',
    readTime: '4 min read',
    date: 'October 2026',
    title: 'Why NFC Smart Table Coasters Outperform Laminated Paper Menus by 28% in Average Check Size',
    titleSo: 'Sababta Kaadhadhka NFC ee Miisasku u Kordhiyaan Iibka Makhaayadaha 28%',
    excerpt:
      'How zero-app NFC tap ordering reduces table wait times, eliminates menu reprinting costs, and drives higher dessert and beverage attachment.',
    content: [
      'Printed and laminated menus suffer from three constant problems in busy restaurants: they wear out quickly, they cannot hide sold-out dishes during service, and they require expensive reprints whenever exchange rates or ingredient costs shift.',
      'By placing laser-engraved walnut or brushed aluminum NFC pucks on every table and inside VIP Majlis rooms, guests simply tap their phone to launch an instant bilingual menu in under 0.8 seconds—with zero app store downloads.',
      'Because the digital menu prompts guests with visual pairings (such as fresh mango juice, sambusas, or spiced Shaah Cadays alongside main dishes) and allows 1-tap second-round reorders, venues consistently see higher average table spend and faster bill settlement.',
    ],
  },
  {
    id: 'blog-4',
    category: 'Kitchen & Cost Control',
    readTime: '7 min read',
    date: 'October 2026',
    title: 'Recipe-Level Inventory Depletion: Controlling Meat, Rice & Spice Costs in High-Volume Kitchens',
    titleSo: 'Xakameynta Kaydka Hilibka, Bariiska & Xawaashka ee Jikooyinka Mashquulka ah',
    excerpt:
      'How mapping your Bill of Materials (BOM) to POS sales stops unrecorded kitchen waste and protects restaurant gross margins.',
    content: [
      'Counting sacks of rice and cartons of oil once a month is too late to protect your profit margin. Without recipe-level depletion, owners only discover portion creep or stock shrinkage weeks after the loss has occurred.',
      'SomBill links every dish on your POS to its exact raw ingredient recipe. The moment a cashier or waiter rings up 2x Chicken Biryani Special and 1x Spiced Grilled Fish, the system deducts the exact grams of basmati rice, poultry, fish, lemon, and spices from your live kitchen stock.',
      'At the end of the week, your Theoretical vs. Physical Variance report highlights any gap between what was sold and what remains on the shelf—giving chefs and managers total accountability.',
    ],
  },
];
