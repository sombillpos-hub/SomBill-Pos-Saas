import React, { useState } from 'react';
import { Language } from '../utils/currency';

interface SimulatorProps {
  lang: Language;
  exchangeRate: number;
  onToast: (msg: string) => void;
  onLaunchLiveApp?: (mode: 'cashier' | 'waiter' | 'manager' | 'admin') => void;
}

/**
 * 1. Interactive Dual Terminal Simulator:
 * Left: Floor Terminal #01 (Touchscreen POS with Somali dishes, USD + SLSH live ticket, ZAAD/e-Dahab/Split/Send to KDS)
 * Right: Kitchen KDS: Main Grill Line (Live tickets, timers, 1-click Bump/Complete)
 */
export const LivePosKdsDualSimulator: React.FC<SimulatorProps> = ({ exchangeRate, onToast, onLaunchLiveApp }) => {
  const [activeCategory, setActiveCategory] = useState<'Specialties' | 'Breakfast' | 'Rice & Platters' | 'Beverages'>(
    'Specialties',
  );
  const [cart, setCart] = useState<
    { id: string; code: string; name: string; sub: string; priceUsd: number; qty: number; tag: string }[]
  >([
    {
      id: 'dish-2',
      code: 'MAIN-12',
      name: 'Bariis Isku-Karis Platter',
      sub: 'Spiced rice + tender goat meat',
      priceUsd: 9.0,
      qty: 1,
      tag: 'Popular',
    },
    {
      id: 'dish-1',
      code: 'BEV-04',
      name: 'Camel Milk Spiced Chai',
      sub: 'Spiced with cardamom & cloves',
      priceUsd: 1.5,
      qty: 1,
      tag: 'Hot',
    },
  ]);

  const [kdsTickets, setKdsTickets] = useState<
    {
      id: string;
      badge: string;
      badgeColor: 'amber' | 'emerald' | 'rose';
      tableLabel: string;
      timer: string;
      items: string[];
      note?: string;
      completed: boolean;
    }[]
  >([
    {
      id: 'kds-1',
      badge: 'RUSH',
      badgeColor: 'amber',
      tableLabel: 'Table 12 • Dine-In',
      timer: '04:12',
      items: ['1x Bariis & Hilib Ari (Extra Bisbaas)', '2x Camel Milk Spiced Chai'],
      note: 'WELL DONE • NO ONION MODIFIER',
      completed: false,
    },
    {
      id: 'kds-2',
      badge: 'NFC',
      badgeColor: 'emerald',
      tableLabel: 'Table 04 • QR Guest',
      timer: '00:45 ago',
      items: ['1x Tender Grilled Goat + Somali Flatbread (Sabaayad)'],
      note: 'ZAAD PAID (#ZD-78412)',
      completed: false,
    },
  ]);

  const catalog = [
    {
      id: 'dish-1',
      code: 'BEV-04',
      name: 'Camel Milk Chai',
      sub: 'Spiced with cardamom & cloves',
      priceUsd: 1.5,
      category: 'Specialties',
      tag: 'Shaah',
    },
    {
      id: 'dish-2',
      code: 'MAIN-12',
      name: 'Bariis Isku-Karis',
      sub: 'Spiced rice + tender goat meat',
      priceUsd: 9.0,
      category: 'Specialties',
      tag: 'Popular',
    },
    {
      id: 'dish-3',
      code: 'GRILL-08',
      name: 'Hilib Ari Solan',
      sub: 'Oven roasted goat ribs & sauce',
      priceUsd: 11.0,
      category: 'Specialties',
      tag: 'Grill',
    },
    {
      id: 'dish-4',
      code: 'SEA-02',
      name: 'Kalluun Shilan',
      sub: 'Red Sea snapper fillet & lemon',
      priceUsd: 14.0,
      category: 'Rice & Platters',
      tag: 'Fresh',
    },
    {
      id: 'dish-5',
      code: 'BRK-01',
      name: 'Beer & Canjeero',
      sub: 'Spiced goat liver & sourdough',
      priceUsd: 6.5,
      category: 'Breakfast',
      tag: 'Morning',
    },
    {
      id: 'dish-6',
      code: 'BEV-09',
      name: 'Fresh Mango & Lime',
      sub: 'Cold pressed pure fruit jug',
      priceUsd: 3.5,
      category: 'Beverages',
      tag: 'Bar',
    },
  ];

  const visibleCatalog =
    activeCategory === 'Specialties'
      ? catalog.slice(0, 3)
      : catalog.filter((c) => c.category === activeCategory || c.category === 'Specialties').slice(0, 3);

  const totalUsd = cart.reduce((acc, item) => acc + item.priceUsd * item.qty, 0);
  const totalSlsh = Math.round(totalUsd * exchangeRate);

  const handleAddItem = (item: (typeof catalog)[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          id: item.id,
          code: item.code,
          name: item.name,
          sub: item.sub,
          priceUsd: item.priceUsd,
          qty: 1,
          tag: item.tag,
        },
      ];
    });
    onToast(`Added 1x ${item.name} ($${item.priceUsd.toFixed(2)}) to Table 12`);
  };

  const handleFireToKds = () => {
    if (cart.length === 0) {
      onToast('Add at least one dish to fire to the Kitchen Display');
      return;
    }
    const newTicket = {
      id: `kds-${Date.now()}`,
      badge: 'NEW',
      badgeColor: 'rose' as const,
      tableLabel: `Table 12 • POS Fire (${cart.reduce((s, i) => s + i.qty, 0)} items)`,
      timer: 'Just now',
      items: cart.map((i) => `${i.qty}x ${i.name}`),
      note: `TOTAL $${totalUsd.toFixed(2)} (${totalSlsh.toLocaleString('en-US')} SLSH)`,
      completed: false,
    };
    setKdsTickets((prev) => [newTicket, ...prev.slice(0, 2)]);
    onToast('Fired order to Kitchen KDS: Main Grill Line (14ms LAN sync)');
  };

  const handleBumpTicket = (id: string) => {
    setKdsTickets((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
    onToast('KDS Ticket bumped — Floor Server paged automatically');
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden">
      {/* Window Chrome Bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            <span className="w-3 h-3 rounded-full bg-amber-400"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
            Live Terminal: SomBill POS & Kitchen Display Station Sync
          </span>
          <span className="hidden md:inline-block text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Branch #1: Hargeisa Central · Local LAN 14ms
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAddItem(catalog[2])}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold transition-colors whitespace-nowrap"
          >
            + Add Sample Dish
          </button>
          <button
            type="button"
            onClick={() => {
              setCart([
                {
                  id: 'dish-2',
                  code: 'MAIN-12',
                  name: 'Bariis Isku-Karis Platter',
                  sub: 'Spiced rice + tender goat meat',
                  priceUsd: 9.0,
                  qty: 1,
                  tag: 'Popular',
                },
                {
                  id: 'dish-1',
                  code: 'BEV-04',
                  name: 'Camel Milk Spiced Chai',
                  sub: 'Spiced with cardamom & cloves',
                  priceUsd: 1.5,
                  qty: 1,
                  tag: 'Hot',
                },
              ]);
              onToast('Reset interactive POS & KDS simulator cart');
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            Reset Cart
          </button>
          {onLaunchLiveApp && (
            <button
              type="button"
              onClick={() => onLaunchLiveApp('cashier')}
              className="px-3 py-1.5 rounded-lg bg-[#E11D48] text-white hover:bg-rose-700 text-xs font-bold transition-colors whitespace-nowrap"
            >
              Open Full POS App →
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Interactive Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50 items-stretch">
        {/* Left 7 Cols: Touchscreen POS Terminal */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            {/* POS Subheader */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#E11D48] text-xl">point_of_sale</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Floor Terminal #01 (Server: Nimco M.)
                </span>
              </div>
              <div className="text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-md">
                Table 12 · Dine-In (4 Guests)
              </div>
            </div>

            {/* Category Filter Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(['Specialties', 'Breakfast', 'Rice & Platters', 'Beverages'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    activeCategory === cat
                      ? 'bg-[#E11D48] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 3 Interactive Menu Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {visibleCatalog.map((item) => {
                const itemSlsh = Math.round(item.priceUsd * exchangeRate);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddItem(item)}
                    className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#E11D48] dark:hover:border-rose-500 bg-white dark:bg-slate-900 transition-all group flex flex-col justify-between gap-2 active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span>{item.code}</span>
                        <span className="text-[#E11D48] font-bold group-hover:translate-x-0.5 transition-transform">
                          + ADD
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white leading-snug">{item.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {item.sub}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between gap-1 font-mono tabular-nums">
                      <span className="text-xs font-extrabold text-[#E11D48]">${item.priceUsd.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        / {itemSlsh.toLocaleString('en-US')} SLSH
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Ticket Cart List */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 uppercase">
                <span>Active Order (#SB-8842)</span>
                <span>Qty / Dual Price</span>
              </div>
              <div className="divide-y divide-slate-200/60 dark:divide-slate-800 max-h-36 overflow-y-auto pr-1">
                {cart.map((line) => {
                  const lineUsd = line.priceUsd * line.qty;
                  const lineSlsh = Math.round(lineUsd * exchangeRate);
                  return (
                    <div key={line.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200 shrink-0">
                          {line.qty}x
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white truncate">{line.name}</span>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="font-bold text-slate-900 dark:text-white">${lineUsd.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500">{lineSlsh.toLocaleString('en-US')} SLSH</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dual-Currency Total Row */}
              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">Total Payable (USD)</div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#E11D48]">
                    ${totalUsd.toFixed(2)} USD
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Total SLSH (Rate 1:{exchangeRate.toLocaleString('en-US')})
                  </div>
                  <div className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                    {totalSlsh.toLocaleString('en-US')} SLSH
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom 4 Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                onToast(
                  `Sent Telesom ZAAD *880# Push for $${totalUsd.toFixed(2)} (${totalSlsh.toLocaleString('en-US')} SLSH)`,
                )
              }
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex flex-col items-center justify-center transition-colors shadow-xs"
            >
              <span>TELESOM</span>
              <span className="text-[10px] opacity-90 font-mono">ZAAD *880#</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onToast(
                  `Sent Dahabshiil e-Dahab *770# Push for $${totalUsd.toFixed(2)} (${totalSlsh.toLocaleString('en-US')} SLSH)`,
                )
              }
              className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex flex-col items-center justify-center transition-colors shadow-xs"
            >
              <span>DAHABSHIIL</span>
              <span className="text-[10px] opacity-90 font-mono">E-DAHAB</span>
            </button>
            <button
              type="button"
              onClick={() => onToast(`Split Table 12 check evenly: 2x $${(totalUsd / 2).toFixed(2)} USD`)}
              className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex flex-col items-center justify-center transition-colors"
            >
              <span>SPLIT</span>
              <span className="text-[10px] opacity-75">BY SEAT</span>
            </button>
            <button
              type="button"
              onClick={handleFireToKds}
              className="py-2.5 px-3 rounded-xl bg-[#E11D48] hover:bg-rose-700 text-white font-bold text-xs flex flex-col items-center justify-center transition-colors shadow-sm"
            >
              <span>SEND TO</span>
              <span className="text-[10px] opacity-90">KITCHEN KDS</span>
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Dark Industrial Kitchen Display System (KDS) */}
        <div className="lg:col-span-5 rounded-2xl bg-[#0B1120] text-white border border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">Soup_Kitchen</span>
                </span>
                <div>
                  <div className="text-xs font-extrabold tracking-tight text-white">Kitchen KDS: Main Grill Line</div>
                  <div className="text-[11px] text-slate-400 font-mono">Station #01 · Audio Chime Active</div>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">
                {kdsTickets.filter((t) => !t.completed).length} In Progress
              </span>
            </div>

            <div className="space-y-3">
              {kdsTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`rounded-xl p-3.5 border transition-all ${
                    ticket.completed
                      ? 'bg-slate-900/50 border-emerald-500/40 opacity-75'
                      : ticket.badgeColor === 'amber'
                        ? 'bg-slate-900/90 border-amber-500/50'
                        : ticket.badgeColor === 'rose'
                          ? 'bg-slate-900/90 border-rose-500/60'
                          : 'bg-slate-900/90 border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase ${
                          ticket.completed
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : ticket.badgeColor === 'amber'
                              ? 'bg-amber-500 text-slate-950'
                              : ticket.badgeColor === 'rose'
                                ? 'bg-rose-600 text-white'
                                : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {ticket.completed ? 'READY' : ticket.badge}
                      </span>
                      <span className="font-bold text-xs text-white">{ticket.tableLabel}</span>
                    </div>
                    <span className="font-mono text-xs text-amber-400">⏱ {ticket.timer}</span>
                  </div>

                  <ul className="space-y-1 text-xs text-slate-200 font-medium mb-2.5">
                    {ticket.items.map((itm, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-mono">✓</span>
                        <span className={ticket.completed ? 'line-through text-slate-400' : ''}>{itm}</span>
                      </li>
                    ))}
                  </ul>

                  {ticket.note && <div className="text-[10px] font-mono text-emerald-400 mb-2.5">{ticket.note}</div>}

                  <button
                    type="button"
                    onClick={() => handleBumpTicket(ticket.id)}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                      ticket.completed
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {ticket.completed
                      ? 'Completed — Tap to Recall Ticket'
                      : `Mark ${ticket.tableLabel.split('•')[0].trim()} Complete`}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* KDS Footer Telemetry */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>AVG PREP TIME TODAY: 7M 18S</span>
            <span className="text-emerald-400">LAN SYNC OK</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 2. Interactive Smartphone NFC Tap-to-Order Simulator
 * Matches image_747a7c3a.png & image_b7b3ecb1.png
 */
export const InteractiveNfcPhoneSimulator: React.FC<SimulatorProps> = ({ exchangeRate, onToast }) => {
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'SLSH'>('USD');
  const [tappedAnimation, setTappedAnimation] = useState(false);
  const [items, setItems] = useState([
    {
      id: 'nfc-1',
      name: 'Crispy Somali Sambusa (3x)',
      sub: 'Spiced minced beef & fresh cilantro',
      priceUsd: 2.5,
      qty: 1,
    },
    {
      id: 'nfc-2',
      name: 'Suqaar Hilib Geel & Sabaayad',
      sub: 'Spiced tender camel cubes & flatbread',
      priceUsd: 8.5,
      qty: 1,
    },
    {
      id: 'nfc-3',
      name: 'Spiced Ginger Tea (Shaah Cadays)',
      sub: 'Fresh camel milk & cardamom',
      priceUsd: 1.5,
      qty: 2,
    },
  ]);

  const totalUsd = items.reduce((acc, i) => acc + i.priceUsd * i.qty, 0);
  const totalSlsh = Math.round(totalUsd * exchangeRate);

  const updateQty = (id: string, delta: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item)));
  };

  const triggerTapSimulation = () => {
    setTappedAnimation(true);
    onToast('NFC Puck Tapped — Table 14 digital menu loaded in 0.48s (Zero App Download)');
    setTimeout(() => setTappedAnimation(false), 1200);
  };

  return (
    <div className="relative flex flex-col sm:flex-row items-center justify-center gap-6">
      {/* Interactive NFC Table Puck Callout Card */}
      <button
        type="button"
        onClick={triggerTapSimulation}
        className={`group p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all shadow-xl text-left max-w-[210px] ${
          tappedAnimation
            ? 'border-[#E11D48] scale-105'
            : 'border-slate-200 dark:border-slate-800 hover:border-[#E11D48]'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold text-slate-900 dark:text-white">Table 14 Puck</span>
          <span className="material-symbols-outlined text-[#E11D48] text-lg">contactless</span>
        </div>
        <div className="w-16 h-16 mx-auto my-2 rounded-full bg-gradient-to-br from-rose-50 to-amber-50 dark:from-slate-800 dark:to-slate-900 border border-rose-200 dark:border-slate-700 flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[#E11D48] text-2xl">sensors</span>
          <span className="text-[9px] font-mono font-bold text-slate-700 dark:text-slate-300">NTAG215</span>
        </div>
        <div className="text-center">
          <div className="text-[11px] font-bold text-[#E11D48] group-hover:underline">Tap Puck to Test NFC →</div>
          <div className="text-[10px] text-slate-500 mt-0.5">0.6s Instant Browser Launch</div>
        </div>
      </button>

      {/* Realistic Smartphone Frame */}
      <div className="w-full max-w-[340px] rounded-[36px] bg-slate-950 p-3 shadow-2xl border-4 border-slate-800">
        <div className="rounded-[28px] bg-white dark:bg-slate-900 overflow-hidden border border-slate-200 dark:border-slate-800">
          {/* Phone Header */}
          <div className="bg-gradient-to-r from-[#9F1239] via-[#BE123C] to-[#0F172A] text-white p-4">
            <div className="flex items-center justify-between text-[11px] opacity-90 mb-1">
              <span className="font-mono">Table 14 • Terrace</span>
              <div className="inline-flex rounded-md bg-black/30 p-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setCurrencyMode('USD')}
                  className={`px-1.5 py-0.5 rounded ${
                    currencyMode === 'USD' ? 'bg-white text-slate-900' : 'text-white'
                  }`}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyMode('SLSH')}
                  className={`px-1.5 py-0.5 rounded ${
                    currencyMode === 'SLSH' ? 'bg-white text-slate-900' : 'text-white'
                  }`}
                >
                  SLSH
                </button>
              </div>
            </div>
            <div className="font-extrabold text-base tracking-tight">Sultan Palace & Rooftop Grill</div>
            <div className="text-[11px] text-rose-100 mt-0.5">100% Halal · Hargeisa Main Road · NFC Ready</div>
          </div>

          {/* Dish List */}
          <div className="p-3.5 space-y-2.5 bg-slate-50 dark:bg-slate-950 max-h-[290px] overflow-y-auto">
            {items.map((dish) => {
              const dishSlsh = Math.round(dish.priceUsd * exchangeRate);
              return (
                <div
                  key={dish.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{dish.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{dish.sub}</div>
                    <div className="text-xs font-extrabold font-mono text-[#E11D48] mt-1">
                      {currencyMode === 'USD'
                        ? `$${dish.priceUsd.toFixed(2)}`
                        : `${dishSlsh.toLocaleString('en-US')} SLSH`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(dish.id, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center hover:bg-slate-200"
                    >
                      -
                    </button>
                    <span className="w-5 text-center font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {dish.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(dish.id, 1)}
                      className="w-7 h-7 rounded-lg bg-[#E11D48] text-white font-bold text-sm flex items-center justify-center hover:bg-rose-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phone Checkout Footer */}
          <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-baseline justify-between font-mono tabular-nums">
              <span className="text-[11px] font-bold uppercase text-slate-500">Ticket Total</span>
              <div className="text-right">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  ${totalUsd.toFixed(2)} USD
                </span>
                <span className="text-[11px] text-slate-500 ml-1.5">({totalSlsh.toLocaleString('en-US')} SLSH)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onToast(
                  `Table 14 NFC Order Paid via Telesom ZAAD ($${totalUsd.toFixed(2)} / ${totalSlsh.toLocaleString('en-US')} SLSH) & Fired to KDS!`,
                )
              }
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-base">bolt</span>
              <span>Pay via Telesom ZAAD *880#</span>
            </button>

            <button
              type="button"
              onClick={() => onToast(`Table 14 NFC Order Paid via e-Dahab ($${totalUsd.toFixed(2)}) & Fired to KDS!`)}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors"
            >
              Pay via e-Dahab / Cash at Table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 3. Interactive Revenue Uplift & ROI Calculator
 * Matches image_747a7c3a.png ("Calculate Your Monthly Revenue Uplift")
 */
export const InteractiveRoiCalculator: React.FC<{
  exchangeRate: number;
  onRequestDemo: () => void;
}> = ({ exchangeRate, onRequestDemo }) => {
  const [dailyCovers, setDailyCovers] = useState<number>(120);
  const [avgSpendUsd, setAvgSpendUsd] = useState<number>(15);

  // Based on 18% faster table turns + 4.5% kitchen waste & billing leakage reduction
  const monthlyBaseRevenueUsd = dailyCovers * avgSpendUsd * 30;
  const monthlyTableTurnGainUsd = Math.round(monthlyBaseRevenueUsd * 0.168);
  const monthlyWasteSavedUsd = Math.round(monthlyBaseRevenueUsd * 0.054);
  const totalMonthlyUpliftUsd = monthlyTableTurnGainUsd + monthlyWasteSavedUsd;
  const totalAnnualUpliftUsd = totalMonthlyUpliftUsd * 12;
  const totalAnnualUpliftSlsh = Math.round(totalAnnualUpliftUsd * exchangeRate);

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left 6 Cols: Sliders */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <div className="text-xs font-bold text-[#E11D48] mb-2">Financial Impact Estimator</div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Calculate Your Annual Revenue Uplift
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              See how replacing legacy paper tickets and manual calculators with SomBill increases table turns, boosts
              NFC modifier upsells, and cuts kitchen food waste.
            </p>
          </div>

          <div className="space-y-5 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-slate-700 dark:text-slate-300">Daily Table Covers / Guests</span>
                <span className="font-mono text-sm text-[#E11D48] font-extrabold">{dailyCovers} Guests / day</span>
              </div>
              <input
                type="range"
                min={30}
                max={500}
                step={10}
                value={dailyCovers}
                onChange={(e) => setDailyCovers(Number(e.target.value))}
                aria-label="Daily Table Covers"
                className="w-full accent-[#E11D48] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                <span>30 Guests (Café)</span>
                <span>200 Guests (Restaurant)</span>
                <span>500 Guests (Hotel/Chain)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-slate-700 dark:text-slate-300">Average Spend Per Guest / Table (USD)</span>
                <span className="font-mono text-sm text-[#E11D48] font-extrabold">${avgSpendUsd.toFixed(2)} USD</span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={avgSpendUsd}
                onChange={(e) => setAvgSpendUsd(Number(e.target.value))}
                aria-label="Average Spend Per Guest"
                className="w-full accent-[#E11D48] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                <span>$5.00</span>
                <span>$25.00</span>
                <span>$60.00</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal">
            *Calculated based on faster table turn velocity (+16.8% peak seating capacity & visual NFC upsells) and 5.4%
            reduction in unbilled kitchen waste and currency rounding errors.
          </p>
        </div>

        {/* Right 6 Cols: Output Card */}
        <div className="lg:col-span-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 space-y-6">
          <div>
            <div className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
              Projected Added Annual Value
            </div>
            <div className="text-3xl sm:text-5xl font-extrabold font-mono tabular-nums text-[#E11D48] mt-1">
              +${totalAnnualUpliftUsd.toLocaleString('en-US')} USD
            </div>
            <div className="text-xs sm:text-sm font-mono font-semibold text-slate-600 dark:text-slate-400 mt-1">
              ≈ {totalAnnualUpliftSlsh.toLocaleString('en-US')} Somaliland Shillings / yr
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500">Faster Table Turns & Upsells</div>
              <div className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                +${monthlyTableTurnGainUsd.toLocaleString('en-US')} /mo
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs text-slate-500">Kitchen Waste & Leakage Saved</div>
              <div className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                +${monthlyWasteSavedUsd.toLocaleString('en-US')} /mo
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onRequestDemo}
            className="w-full py-3.5 px-6 rounded-xl bg-[#E11D48] hover:bg-rose-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            Lock In These Gains with a Custom Branch Pilot →
          </button>
        </div>
      </div>
    </div>
  );
};
