import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BellRing,
  CheckCircle2,
  ChefHat,
  Coffee,
  Flame,
  LayoutGrid,
  Monitor,
  Package,
  Smartphone,
  Utensils,
  Wifi,
  Wine,
} from 'lucide-react';

export interface HeroEcosystemShowcaseProps {
  exchangeRate?: number;
  onLaunchLiveApp?: (mode: 'cashier' | 'waiter' | 'manager' | 'admin') => void;
  onToast?: (msg: string) => void;
}

const DISH_TILES = [
  {
    id: 'camel-steak',
    name: 'Camel Steak',
    priceUsd: '$12.00',
    priceSlsh: '141,600 SLSH',
    icon: Utensils,
    accent: '#ef4444',
  },
  {
    id: 'spiced-mandi',
    name: 'Spiced Mandi',
    priceUsd: '$9.50',
    priceSlsh: '112,100 SLSH',
    icon: Flame,
    accent: '#f97316',
  },
  {
    id: 'fresh-mango',
    name: 'Fresh Mango',
    priceUsd: '$3.00',
    priceSlsh: '35,400 SLSH',
    icon: Wine,
    accent: '#fbbf24',
  },
  {
    id: 'somali-tea',
    name: 'Somali Tea',
    priceUsd: '$1.50',
    priceSlsh: '17,700 SLSH',
    icon: Coffee,
    accent: '#10b981',
  },
] as const;

const MINI_RAIL_ITEMS = [
  { id: 'POS', label: 'POS', icon: Monitor },
  { id: 'Tables', label: 'Tables', icon: LayoutGrid },
  { id: 'KDS', label: 'KDS', icon: ChefHat },
  { id: 'Stock', label: 'Stock', icon: Package },
  { id: 'Reports', label: 'Reports', icon: BarChart3 },
] as const;

export const HeroEcosystemShowcase: React.FC<HeroEcosystemShowcaseProps> = ({ onLaunchLiveApp, onToast }) => {
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });
  const [activeDishIdx, setActiveDishIdx] = useState<number>(0);
  const [paymentPaid, setPaymentPaid] = useState<boolean>(false);
  const [bellFlashing, setBellFlashing] = useState<boolean>(false);
  const [watchAccepted, setWatchAccepted] = useState<boolean>(false);
  const [activeRail, setActiveRail] = useState<string>('POS');

  // Auto-cycle active dish tile every 2.4s
  useEffect(() => {
    const dishTimer = setInterval(() => {
      setActiveDishIdx((prev) => (prev + 1) % DISH_TILES.length);
    }, 2400);
    return () => clearInterval(dishTimer);
  }, []);

  // Auto-cycle payment status between Pushing ZAAD/e-Dahab and PAID IN 2.8s
  useEffect(() => {
    const payTimer = setInterval(() => {
      setPaymentPaid((prev) => !prev);
    }, 3200);
    return () => clearInterval(payTimer);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0.5, y: 0.5 });
  };

  const triggerBellAlert = () => {
    setBellFlashing(true);
    setWatchAccepted(false);
    onToast?.('🔔 Table #04 VIP Ring Bell Pinged! Instant alert dispatched to Waiter Smart Watch & Cashier POS #01.');
    setTimeout(() => {
      setBellFlashing(false);
    }, 1800);
  };

  const rotateX = ((mousePos.y - 0.5) * -6).toFixed(2);
  const rotateY = ((mousePos.x - 0.5) * 8).toFixed(2);

  return (
    <div className="hero-ecosystem-stage" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <div
        className="eco-stage-tilt-inner"
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        }}
      >
        {/* 1. Ambient Backdrop & Rotating Orbital Rings */}
        <div className="eco-ambient-aura" aria-hidden="true" />
        <div className="eco-orbital-ring-1" aria-hidden="true" />
        <div className="eco-orbital-ring-2" aria-hidden="true" />

        {/* Animated SVG Data Beams Connecting All 5 Devices */}
        <svg className="eco-svg-beams" viewBox="0 0 640 540" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="sombillBeam" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="40%" stopColor="#f97316" />
              <stop offset="75%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Connection 1A: NFC Puck (top-left) -> Mobile App Frame (bottom-left) */}
          <path d="M 65 55 C 32 190, 42 310, 92 415" className="eco-beam-path" />
          {/* Connection 1B: Mobile App Frame (bottom-left) -> Desktop POS (center) */}
          <path d="M 155 415 C 210 385, 245 340, 295 290" className="eco-beam-path" />
          {/* Connection 1C: NFC Puck (top-left) -> Desktop POS (center-left) */}
          <path d="M 95 45 C 165 65, 210 115, 255 165" className="eco-beam-path" />

          {/* Connection 2A: Ring Bell (bottom-right) -> Smart Watch (top-right) */}
          <path
            d="M 555 485 C 605 355, 600 215, 555 110"
            className={`eco-beam-path ${bellFlashing ? 'beam-fast' : ''}`}
          />
          {/* Connection 2B: Ring Bell (bottom-right) -> Desktop POS (center-right) */}
          <path
            d="M 505 490 C 445 445, 415 385, 385 325"
            className={`eco-beam-path ${bellFlashing ? 'beam-fast' : ''}`}
          />
          {/* Connection 2C: Smart Watch (top-right) -> Desktop POS (top-center) */}
          <path
            d="M 495 85 C 435 105, 395 135, 365 175"
            className={`eco-beam-path ${bellFlashing ? 'beam-fast' : ''}`}
          />
        </svg>

        {/* ===================================================================
            2. DEVICE 1 (CENTERPIECE): SOMBILL DESKTOP TOUCH POS SOFTWARE FRAME
           =================================================================== */}
        <div className={`eco-desktop-pos ${bellFlashing ? 'pos-bell-flash' : ''}`}>
          {/* Top OS Status Bar */}
          <div className="px-3.5 py-2.5 bg-[#120609] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            {/* Left: Traffic Dots + SomBill Mini Badge */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              </div>
              <span className="ml-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[10px] font-mono font-bold text-white tracking-tight">
                SomBill POS OS · Terminal #01
              </span>
            </div>

            {/* Center/Right: Live Telemetry Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-[9.5px] font-mono font-bold">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-400">
                🟢 Offline LAN 14ms
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#f97316]/15 border border-[#f97316]/35 text-[#fb923c] hidden sm:inline-block">
                1 USD = 11,800 SLSH
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300">
                MOF 4.8% VAT
              </span>
            </div>
          </div>

          {/* POS Software Interface (3-Panel Split Inside Screen) */}
          <div className="grid grid-cols-12 bg-[#090305]/95 p-3 gap-2.5 items-stretch">
            {/* Panel 1: Left Mini Rail */}
            <div className="col-span-2 flex flex-col gap-1.5 bg-white/[0.02] border border-white/[0.06] rounded-xl p-1.5">
              {MINI_RAIL_ITEMS.map((item) => {
                const IconComp = item.icon;
                const isActive = activeRail === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveRail(item.id);
                      if (item.id === 'POS') {
                        onLaunchLiveApp?.('cashier');
                      } else {
                        onToast?.(`Switched POS Terminal preview to ${item.label} module`);
                      }
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-br from-[#dc2626] to-[#f97316] text-white shadow-[0_4px_14px_rgba(249,115,22,0.45)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold mt-1 leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Panel 2: Center Dish & Table Grid */}
            <div className="col-span-6 flex flex-col justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5 space-y-2.5">
              {/* Header */}
              <div className="flex items-center justify-between gap-1.5 border-b border-white/[0.07] pb-2">
                <div>
                  <div className="text-[10.5px] font-extrabold text-white leading-tight">
                    Floor Map: VIP Majlis · Table #04 (Active)
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">Waiter: Ahmed M. · 4 Guests Seated</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#f97316]/20 border border-[#f97316]/45 text-[9px] font-mono font-bold text-[#fb923c] shrink-0">
                  🔥 Kitchen KDS Synced
                </span>
              </div>

              {/* 2x2 Dish Tiles */}
              <div className="grid grid-cols-2 gap-2">
                {DISH_TILES.map((dish, idx) => {
                  const DishIcon = dish.icon;
                  const isPulsing = activeDishIdx === idx;
                  return (
                    <button
                      key={dish.id}
                      type="button"
                      onClick={() => {
                        setActiveDishIdx(idx);
                        onToast?.(`Added ${dish.name} (${dish.priceUsd} / ${dish.priceSlsh}) to Table #04`);
                      }}
                      className={`p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-left transition-all cursor-pointer ${
                        isPulsing ? 'eco-pos-dish-active' : 'hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{
                            background: `${dish.accent}22`,
                            border: `1px solid ${dish.accent}55`,
                            color: dish.accent,
                          }}
                        >
                          <DishIcon className="w-3.5 h-3.5" />
                        </span>
                        {isPulsing && (
                          <span className="px-1.5 py-0.5 rounded bg-[#f97316] text-[8px] font-mono font-extrabold text-white uppercase">
                            +1 Tap
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-white truncate">{dish.name}</div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10.5px] font-mono font-extrabold text-[#fb923c]">{dish.priceUsd}</span>
                        <span className="text-[8.5px] font-mono text-slate-400">
                          {dish.priceSlsh.replace(' SLSH', '')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Ring Bell Live Banner inside POS */}
              <div
                className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-[9.5px] font-mono transition-colors ${
                  bellFlashing
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-white/[0.03] border-white/[0.07] text-slate-300'
                }`}
              >
                <span>
                  {bellFlashing
                    ? '🔔 LIVE RING ALERT: Table #04 VIP Requested Service!'
                    : '⚡ Local Mesh Synced: POS #01 ↔ Watch ↔ KDS #01'}
                </span>
                <span className="text-[#fbbf24] font-bold">0.01s</span>
              </div>
            </div>

            {/* Panel 3: Right Live Receipt & Instant ZAAD/e-Dahab Settlement Panel */}
            <div className="col-span-4 flex flex-col justify-between bg-white/[0.025] border border-white/[0.08] rounded-xl p-2.5 space-y-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span className="text-[10px] font-extrabold text-white uppercase tracking-wider">Folio #T04</span>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">VIP Majlis</span>
                </div>

                {/* Itemized Receipt Lines */}
                <div className="space-y-1 text-[10px] font-mono">
                  <div className="flex justify-between text-slate-200">
                    <span>1x Camel Steak</span>
                    <span className="font-bold text-white">$12.00</span>
                  </div>
                  <div className="flex justify-between text-slate-200">
                    <span>1x Spiced Mandi</span>
                    <span className="font-bold text-white">$9.50</span>
                  </div>
                  <div className="flex justify-between text-slate-200">
                    <span>1x Fresh Mango</span>
                    <span className="font-bold text-white">$3.00</span>
                  </div>
                  <div className="flex justify-between text-slate-200">
                    <span>1x Somali Tea</span>
                    <span className="font-bold text-white">$1.50</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-white/15 pt-1.5 space-y-0.5 text-[9.5px] font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-slate-200">$24.81</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (4.8%)</span>
                    <span className="text-[#fb923c]">$1.19</span>
                  </div>
                </div>
              </div>

              {/* Dual-Currency Total Box */}
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#dc2626]/20 via-[#f97316]/15 to-transparent border border-[#f97316]/40">
                <div className="flex items-baseline justify-between">
                  <span className="text-[9px] font-mono uppercase text-slate-300 font-bold">Total Due</span>
                  <span className="text-sm font-mono font-extrabold text-white">$26.00</span>
                </div>
                <div className="text-right text-[10px] font-mono font-bold text-[#fbbf24]">306,800 SLSH</div>
              </div>

              {/* Animated Payment Status Button Cycling Smoothly */}
              <button
                type="button"
                onClick={() => {
                  setPaymentPaid((prev) => !prev);
                  onToast?.('✓ Table #04 Settled ($26.00 / 306,800 SLSH) via ZAAD *880# Push in 2.8s!');
                }}
                className={`w-full py-2 px-2 rounded-lg text-[9.5px] font-mono font-extrabold text-center transition-all duration-300 cursor-pointer ${
                  paymentPaid
                    ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'bg-gradient-to-r from-[#dc2626] to-[#f97316] text-white border border-[#fbbf24]/50 shadow-[0_0_20px_rgba(249,115,22,0.45)]'
                }`}
              >
                {paymentPaid ? '✓ PAID IN 2.8s · Receipt Printed' : '📲 Pushing ZAAD *880# / e-Dahab...'}
              </button>
            </div>
          </div>
        </div>

        {/* ===================================================================
            3. DEVICE 2 (BOTTOM-LEFT FOREGROUND): MOBILE APPLICATION FRAME
           =================================================================== */}
        <div
          className="eco-mobile-frame"
          onClick={() => {
            onToast?.('📱 SomBill Waiter & Guest QR App — Instant Table #04 Menu & Tap-to-Pay');
          }}
        >
          {/* Dynamic Island Notch */}
          <div className="eco-dynamic-island" />

          {/* Mobile App Screen (SomBill Waiter & QR App) */}
          <div className="rounded-[18px] bg-[#0e0407] border border-white/10 p-2.5 space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-[#f97316]" />
                <span className="text-[9.5px] font-extrabold text-white truncate">Table #04 · QR Menu</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-[8.5px] font-mono font-bold text-[#fbbf24] shrink-0">
                🇸🇴 / 🇬🇧
              </span>
            </div>

            {/* Live Order Card */}
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 space-y-1">
              <div className="flex justify-between text-[9.5px] font-bold text-slate-200">
                <span>2x Mixed Grill</span>
                <span className="font-mono text-[#fb923c]">$21.50</span>
              </div>
              <div className="flex justify-between text-[9.5px] font-bold text-slate-200">
                <span>1x Mojito</span>
                <span className="font-mono text-[#fb923c]">$4.50</span>
              </div>
              <div className="pt-1 border-t border-white/10 flex items-center gap-1 text-[8.5px] font-mono font-bold text-emerald-400">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>✓ Sent to KDS #01</span>
              </div>
            </div>

            {/* Glowing Gradient CTA Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPaymentPaid(true);
                onToast?.('📲 Guest Mobile Tap & Pay ($26.00) initiated via ZAAD / e-Dahab!');
              }}
              className="w-full py-1.5 px-2 rounded-xl bg-gradient-to-r from-[#dc2626] via-[#f97316] to-[#f59e0b] text-white font-extrabold text-[10px] shadow-[0_6px_18px_rgba(249,115,22,0.45)] cursor-pointer"
            >
              Tap &amp; Pay · $26.00
            </button>
          </div>
        </div>

        {/* ===================================================================
            4. DEVICE 3 (TOP-RIGHT FOREGROUND): WAITER SMART WATCH FRAME
           =================================================================== */}
        <div className="eco-watch-frame">
          {/* Top Strap */}
          <div className="eco-watch-strap-top" />

          {/* Watch Case */}
          <div className={`eco-watch-case ${bellFlashing ? 'watch-bell-flash' : ''}`}>
            {/* Glowing Orange Side Digital Crown Knob */}
            <div className="eco-watch-crown" />

            {/* Watch Screen UI (Live Ring Bell Alert) */}
            <div className="rounded-[20px] bg-[#070204] border border-white/10 p-2.5 space-y-2">
              {/* Pulsing Red/Orange Header */}
              <div className="flex items-center justify-between px-2 py-1 rounded-full bg-[#dc2626]/25 border border-[#f97316]/50">
                <div className="flex items-center gap-1 text-[8.5px] font-mono font-extrabold text-[#fb923c]">
                  <Bell size={11} className="watch-bell-shake text-[#ef4444]" />
                  <span>CALL ALERT · NOW</span>
                </div>
              </div>

              {/* Main Alert Text */}
              <div className="text-center py-0.5">
                <div className="text-xs font-extrabold text-white tracking-tight">Table #04 VIP</div>
                <div className="text-[9.5px] font-medium text-[#fbbf24] leading-tight mt-0.5">
                  {watchAccepted ? '✓ Waiter En Route' : 'Guest Pressed Ring Bell'}
                </div>
              </div>

              {/* Two Mini Action Pills at Bottom of Watch Face */}
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setWatchAccepted(true);
                    onToast?.('⌚ Waiter Smart Watch: Accepted Table #04 VIP Call Alert!');
                  }}
                  className="py-1 px-1.5 rounded-full bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/60 text-[9px] font-mono font-extrabold text-emerald-300 cursor-pointer transition-colors"
                >
                  ✓ Accept
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentPaid(true);
                    onToast?.('⌚ Waiter Smart Watch: Dispatched Instant Folio Bill to Table #04!');
                  }}
                  className="py-1 px-1.5 rounded-full bg-[#f97316]/25 hover:bg-[#f97316]/40 border border-[#f97316]/60 text-[9px] font-mono font-extrabold text-[#fb923c] cursor-pointer transition-colors"
                >
                  Bill
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Strap */}
          <div className="eco-watch-strap-bottom" />
        </div>

        {/* ===================================================================
            5. DEVICE 4 (TOP-LEFT): SMART NFC TABLE PUCK (NTAG215)
           =================================================================== */}
        <div
          className="eco-nfc-node"
          onClick={() => onToast?.('📡 NTAG215 Smart NFC Table Puck — Launches Bilingual QR/NFC Menu in 0.6s!')}
        >
          <div className="eco-nfc-disc">
            <span className="nfc-wave-3" aria-hidden="true" />
            <div className="flex flex-col items-center justify-center relative z-10">
              <Wifi className="w-5 h-5 text-[#f97316]" />
              <span className="text-[7.5px] font-mono font-extrabold text-amber-300 tracking-wider mt-0.5">NFC</span>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-[#120609]/95 border border-[#f97316]/45 shadow-lg backdrop-blur-md">
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#fb923c',
              }}
            >
              NFC Puck · Instant Menu
            </div>
            <div className="text-[9px] font-mono text-slate-400">NTAG215 · Tap to Order</div>
          </div>
        </div>

        {/* ===================================================================
            6. DEVICE 5 (BOTTOM-RIGHT): GUEST RING BELL / CALL BUZZER
           =================================================================== */}
        <button
          type="button"
          onClick={triggerBellAlert}
          className="eco-bell-node text-left"
          title="Click to test real-time Ring Bell alert to Watch & POS"
        >
          <div className="eco-bell-btn-circle">
            <BellRing size={18} color="#fff" className="watch-bell-shake" />
          </div>
          <div>
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.2,
              }}
            >
              Table Ring Bell
            </div>
            <div
              style={{
                fontSize: '0.66rem',
                color: '#fb923c',
                fontWeight: 700,
              }}
            >
              Pings Watch &amp; POS · Click to Test
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
