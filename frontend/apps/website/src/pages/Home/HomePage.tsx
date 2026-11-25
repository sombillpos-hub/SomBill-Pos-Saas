import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import gsap from 'gsap';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  Wifi,
  Zap,
} from 'lucide-react';
import { Language } from '../../utils/currency';
import {
  HARDWARE_PERIPHERALS,
  PRODUCT_PAGES,
  ProductSlug,
  SOLUTION_PAGES,
  SolutionSlug,
  WebsitePageRoute,
} from '../../services/websiteData';
import {
  InteractiveNfcPhoneSimulator,
  InteractiveRoiCalculator,
  LivePosKdsDualSimulator,
} from '../../sections/WebsiteInteractiveSimulators';
import { HeroEcosystemShowcase } from '../../sections/HeroEcosystemShowcase';
import {
  AnimatedCounter,
  CourseShowcaseCard,
  DeptSolutionCard,
  FeatureCardPremium,
  HeroStatCard,
  LiveActivityItem,
  PremiumFaqSection,
  PremiumParticles,
  PricingTierCard,
  ScrollReveal,
  SectionHeader,
  StatsGlassBanner,
  TestimonialCardPremium,
  TintedIcon,
  Typewriter,
  getAccentByIndex,
} from '../../components/ui/PremiumPrimitives';

interface SharedPageProps {
  lang: Language;
  exchangeRate: number;
  onNavigate: (route: WebsitePageRoute) => void;
  onOpenDemoModal: () => void;
  onLaunchLiveApp: (mode: 'cashier' | 'waiter' | 'manager' | 'admin') => void;
  onToast: (msg: string) => void;
}

const APPLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const MARQUEE_VENUES_ROW_1 = [
  { name: 'Gulf Star Hotel & Suites', city: 'Hargeisa', tag: '42 Tables · 4 KDS' },
  { name: 'Damal Hotel & Banquet', city: 'Hargeisa', tag: 'Room Folio + POS' },
  { name: 'Maansoor Hotel Dining', city: 'Hargeisa', tag: 'Multi-Outlet Sync' },
  { name: 'Beder Hotel & Rooftop', city: 'Hargeisa', tag: 'NFC Smart Tables' },
  { name: 'Sultan Palace Mandi', city: 'Burao', tag: 'Offline LAN Mesh' },
  { name: 'Red Sea Coastal Resort', city: 'Berbera', tag: 'ZAAD & e-Dahab Push' },
  { name: 'Rays Hotel & Lounge', city: 'Borama', tag: 'Dual-Currency POS' },
  { name: 'Jazeera Palace Grill', city: 'Mogadishu', tag: 'Enterprise HQ BI' },
];

const MARQUEE_VENUES_ROW_2 = [
  { name: 'Qawa & Shaah Artisan Hub', city: 'Hargeisa', tag: '3.2s Counter Express' },
  { name: 'Hiddo Dhawr Cultural Village', city: 'Hargeisa', tag: 'VIP Majlis Buzzers' },
  { name: 'Sahil Seafood & Grill', city: 'Berbera', tag: 'IP54 Kitchen KDS' },
  { name: 'Al-Nour Bakery & Café Chain', city: '3 Cities', tag: 'Central Recipe BOM' },
  { name: 'Guled Hotel & Conference', city: 'Hargeisa', tag: 'MOF 4.8% VAT Ready' },
  { name: 'Hayat Fast Food & Shawarma', city: 'Burao', tag: 'Takeaway Queue Screen' },
  { name: 'Ambassador Hotel Dining', city: 'Hargeisa', tag: '24/7 Local Support' },
  { name: 'Caravan Espresso & Lounge', city: 'Djibouti', tag: 'QR + NFC Tap Stand' },
];

/**
 * A. COMPLETE HOME LANDING PAGE (2026 SOMBILL BRAND EDITION — 8 CARD ARCHETYPES)
 */
export const WebsiteHomePage: React.FC<SharedPageProps> = ({
  lang,
  exchangeRate,
  onNavigate,
  onOpenDemoModal,
  onLaunchLiveApp,
  onToast,
}) => {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [annualBilling, setAnnualBilling] = useState<boolean>(true);
  const [previewHovered, setPreviewHovered] = useState<boolean>(false);
  const [selectedHornCity, setSelectedHornCity] = useState<string>('All');

  // Mouse-following spotlight states for Hero & CTA
  const [heroMouse, setHeroMouse] = useState<{ x: number; y: number }>({ x: 600, y: 320 });
  const [ctaMouse, setCtaMouse] = useState<{ x: number; y: number }>({ x: 500, y: 200 });

  // Consultation form state
  const [venueName, setVenueName] = useState('');
  const [venueCity, setVenueCity] = useState('Hargeisa, Somaliland');
  const [venuePhone, setVenuePhone] = useState('+252 63 ');
  const [venueSize, setVenueSize] = useState('15–40 Tables (Full-Service Restaurant)');
  const [consultSubmitted, setConsultSubmitted] = useState(false);

  const floatingGridRef = useRef<HTMLDivElement | null>(null);

  // Layer B: GSAP Continuous Sine-Wave Float on .floating-icon-card
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to('.floating-icon-card', {
        y: -15,
        stagger: { each: 0.2, yoyo: true, repeat: -1 },
        ease: 'sine.inOut',
        duration: 2,
      });
    }, floatingGridRef);

    return () => ctx.revert();
  }, []);

  const workflowStages = [
    {
      num: '01',
      title: 'Guest Table Tap or Waiter Seat',
      desc: 'Diners tap the handcrafted NFC table puck to browse the bilingual menu, or floor staff seat them on the visual floor map in Main Dining, Terrace, or VIP Majlis.',
      metric: '0.6s Menu Launch · Zero App Install',
      actionLabel: 'Explore NFC Ordering',
      slug: 'nfc-ordering' as ProductSlug,
      icon: 'contactless',
    },
    {
      num: '02',
      title: 'Instant Station-Routed Kitchen Fire',
      desc: 'Orders split automatically across Grill KDS, Rice & Mandi Oven KDS, and Barista Shaah screens over your local 14ms LAN mesh—even if external internet is down.',
      metric: '14ms Local LAN Sync · 0 Lost Tickets',
      actionLabel: 'Explore Kitchen KDS',
      slug: 'kds' as ProductSlug,
      icon: 'kitchen',
    },
    {
      num: '03',
      title: 'Real-Time Recipe Stock Deduction',
      desc: 'Every plate sold automatically depletes exact grams of Basmati rice, camel/goat meat, spices, and takeaway packaging from your branch inventory.',
      metric: '24% Less Kitchen Waste',
      actionLabel: 'Explore Inventory Engine',
      slug: 'inventory-management' as ProductSlug,
      icon: 'inventory_2',
    },
    {
      num: '04',
      title: '3.4-Second ZAAD, e-Dahab & Dual-Currency Settle',
      desc: 'Settle at the table or Cashier Terminal #02 with direct *880# ZAAD & *770# e-Dahab USSD push, split checks, and automatic USD-to-SLSH change calculation.',
      metric: '100% Drawer & Shift Reconciliation',
      actionLabel: 'Explore Billing & Payments',
      slug: 'billing-payments' as ProductSlug,
      icon: 'payments',
    },
  ];

  const homeFaqs = [
    {
      q: 'What happens if our restaurant internet goes down during rush hour?',
      a: 'SomBill OS is built on a resilient Offline-First Local LAN Mesh. Your POS terminals, waiter tablets, thermal receipt printers, and Kitchen Display Screens communicate directly over your local Wi-Fi router with zero dependency on external internet. Once connectivity returns, transactions sync to your cloud HQ automatically.',
    },
    {
      q: 'How does SomBill integrate with Telesom ZAAD and Dahabshiil e-Dahab?',
      a: 'SomBill connects directly with your merchant tills to trigger automated USSD push prompts to customer handsets and verify payment authorization codes in real time—eliminating manual number typing and fake SMS screenshot fraud.',
    },
    {
      q: 'Do we need to buy expensive proprietary touchscreen hardware?',
      a: 'No. SomBill runs smoothly on existing Windows/Android touch terminals, iPads, Android waiter tablets, and standard ESC/POS thermal printers. We also offer industrial IP54 touch terminals and custom laser-engraved NFC table pucks if you want a turnkey hardware kit.',
    },
    {
      q: 'How does the Dual-Currency (USD & Somaliland Shilling) engine work?',
      a: 'You set your daily branch exchange rate (for example, 1 USD = 11,801 SLSH) in one click. Every menu item, KDS screen, customer NFC menu, and printed receipt automatically displays accurate prices in both currencies, and the cashier drawer calculates mixed-currency change effortlessly.',
    },
  ];

  const handleConsultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueName.trim() || venuePhone.trim().length < 7) {
      onToast('Please enter your restaurant/hotel name and valid WhatsApp/ZAAD phone number.');
      return;
    }
    setConsultSubmitted(true);
    onToast(`Consultation scheduled for ${venueName.trim()} (${venueCity})!`);
  };

  return (
    <div className="space-y-28 pb-20">
      {/* =====================================================================
          1. CENTERPIECE 2026 HERO SECTION (PARTICLES, AURORA, TYPEWRITER, 3D TILT)
         ===================================================================== */}
      <section
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHeroMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        className="relative overflow-hidden pt-10 sm:pt-16 pb-14 px-4 sm:px-6 lg:px-8 border-b border-white/5 [.light-theme_&]:border-slate-200/80"
      >
        {/* Ambient Aurora + Radial Dot Grid + Drifting Orbs */}
        <div className="hero-aurora-bg absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="hero-grid-bg absolute inset-0 pointer-events-none opacity-65" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#dc2626]/20 blur-[110px]"
          style={{ animation: 'orbDrift1 14s ease-in-out infinite' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-32 -right-24 w-96 h-96 rounded-full bg-[#f97316]/18 blur-[120px]"
          style={{ animation: 'orbDrift2 16s ease-in-out infinite' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-12 left-1/3 w-80 h-80 rounded-full bg-[#f59e0b]/12 blur-[110px]"
          style={{ animation: 'orbDrift1 18s ease-in-out infinite reverse' }}
          aria-hidden="true"
        />

        {/* Mouse-Following Spotlight (600px x 600px) */}
        <div
          className="pointer-events-none absolute w-[600px] h-[600px] rounded-full transition-transform duration-150 ease-out"
          style={{
            background:
              'radial-gradient(circle, rgba(249, 115, 22, 0.14) 0%, rgba(220, 38, 38, 0.08) 40%, transparent 70%)',
            filter: 'blur(50px)',
            transform: `translate(${heroMouse.x - 300}px, ${heroMouse.y - 300}px)`,
          }}
          aria-hidden="true"
        />

        {/* Layer C: Interactive Particles */}
        <PremiumParticles id="sombill-hero-particles" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left 6 Cols: 2026 God-Level Staggered Framer Motion Entrance */}
            <div className="lg:col-span-6 space-y-6">
              {/* Step 1 (delay 0s): 2026 God-Level 3D Liquid Glass Kicker Capsule */}
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0, ease: APPLE_EASE }}
                className="hero-god-kicker"
              >
                <span className="hero-god-kicker-badge">
                  <Sparkles className="w-3.5 h-3.5 text-[#fde047]" />
                  <span>NEW 2026 OS</span>
                </span>
                <span className="hero-god-kicker-text">
                  {lang === 'so'
                    ? 'Saaxiibka Lagu Kalsoon Yahay · Geeska Afrika'
                    : 'Trusted Hospitality Partner · Somaliland & East Africa'}
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 hidden sm:inline-block" />
              </motion.div>

              {/* Step 2 (delay 0.12s): Monumental 3-Line Hero Title with 3D Typewriter Stage */}
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.12, ease: APPLE_EASE }}
                className="space-y-3"
              >
                <h1 className="hero-god-title text-white [.light-theme_&]:text-slate-900">
                  {lang === 'so' ? (
                    <>
                      <span className="block">
                        Nidaamka Casriga ah
                        <span className="hero-god-os-pill">ee</span>
                      </span>
                      <span className="hero-typewriter-stage">
                        <Typewriter
                          words={[
                            'Huteelada & POS',
                            'Bixinta ZAAD',
                            'Dalbashada NFC',
                            'Shaashadda KDS',
                            'Laba-Lacagood',
                          ]}
                        />
                      </span>
                      <span className="block pt-1">
                        <span className="horn-moving-gradient-alt">Somaliland &amp; Geeska Afrika</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block">
                        Next-Gen
                        <span className="hero-god-os-pill">OS for</span>
                      </span>
                      <span className="hero-typewriter-stage">
                        <Typewriter
                          words={[
                            'Restaurant Tech',
                            'Hospitality & Hotels',
                            'Billing & Touch POS',
                            'ZAAD & e-Dahab Pay',
                            'Smart NFC Dining',
                            'Guest Experience',
                          ]}
                        />
                      </span>
                      <span className="block pt-1">
                        <span className="horn-moving-gradient-alt">Somaliland &amp; East Africa</span>
                      </span>
                    </>
                  )}
                </h1>

                <div className="pt-1">
                  <div className="god-headline-laser-bar" aria-hidden="true" />
                </div>
              </motion.div>

              {/* Step 3 (delay 0.26s): 2026 Editorial Glass Lead Card with Highlighted Capabilities */}
              <motion.div
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.26, ease: APPLE_EASE }}
                className="hero-god-lead-box"
              >
                {lang === 'so' ? (
                  <p className="text-base sm:text-[17px] text-slate-200 [.light-theme_&]:text-slate-700 leading-relaxed font-medium">
                    Casriyee adeegga miisaska adigoo adeegsanaya{' '}
                    <span className="hero-lead-highlight">Touchscreen POS</span>, dalbashada degdegga ah ee{' '}
                    <span className="hero-lead-highlight">NFC &amp; QR Menu</span>, shaashadaha jikada{' '}
                    <span className="hero-lead-highlight">Kitchen KDS</span>, iyo lacag-bixinta tooska ah ee{' '}
                    <span className="text-[#fbbf24] [.light-theme_&]:text-orange-600 font-extrabold">
                      Telesom ZAAD &amp; Dahabshiil e-Dahab
                    </span>{' '}
                    — xitaa marka internetku go’o.
                  </p>
                ) : (
                  <p className="text-base sm:text-[17px] text-slate-200 [.light-theme_&]:text-slate-700 leading-relaxed font-medium">
                    Streamline high-volume dining with <span className="hero-lead-highlight">Touchscreen POS</span>,
                    instant <span className="hero-lead-highlight">NFC / QR Table Ordering</span>, real-time{' '}
                    <span className="hero-lead-highlight">Kitchen Display Screens (KDS)</span>, multi-branch inventory,
                    and integrated{' '}
                    <span className="text-[#fbbf24] [.light-theme_&]:text-orange-600 font-extrabold">
                      Telesom ZAAD &amp; Dahabshiil e-Dahab
                    </span>{' '}
                    checkout—even when local internet disconnects.
                  </p>
                )}
              </motion.div>

              {/* Step 4 (delay 0.38s): Primary & Secondary CTA Row */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.38, ease: APPLE_EASE }}
                className="flex flex-wrap items-center gap-3.5 pt-1"
              >
                <button
                  type="button"
                  onClick={onOpenDemoModal}
                  className="btn-sombill-grad px-6 py-4 rounded-2xl text-white font-extrabold text-sm sm:text-[15px] flex items-center gap-2.5 cursor-pointer whitespace-nowrap shadow-[0_12px_34px_rgba(220,38,38,0.45)]"
                >
                  <Rocket className="w-4 h-4" />
                  <span>{lang === 'so' ? 'Ka Hirgeli Xaruntaada' : 'Deploy SomBill in Your Branch'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onLaunchLiveApp('cashier')}
                  className="btn-shimmer-sweep relative overflow-hidden px-5 py-4 rounded-2xl bg-white/[0.06] [.light-theme_&]:bg-white hover:bg-white/10 text-white [.light-theme_&]:text-slate-900 border border-white/15 [.light-theme_&]:border-slate-300 hover:border-[#f97316] font-extrabold text-sm sm:text-[15px] flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
                >
                  <PlayCircle className="w-4 h-4 text-[#f97316]" />
                  <span>{lang === 'so' ? 'Tijaabi Nidaamka Tooska ah (Live POS)' : 'Launch Interactive Live POS'}</span>
                </button>
              </motion.div>

              {/* Step 5 (delay 0.5s): Non-Colliding 4-Chip Live Telemetry Dock */}
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.5, ease: APPLE_EASE }}
                className="flex flex-wrap items-center gap-2.5 pt-1"
              >
                <button
                  type="button"
                  onClick={() => onToast('ZAAD *880# & e-Dahab USSD Push — Verified 2.8s average checkout speed')}
                  className="hero-telemetry-chip cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                  <span>ZAAD *880# Push · 2.8s</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToast('100% Offline Local LAN Mesh — 14ms sync across POS, Watch & Kitchen KDS')}
                  className="hero-telemetry-chip cursor-pointer"
                >
                  <Wifi className="w-3.5 h-3.5 text-[#f97316] shrink-0" />
                  <span>Offline LAN Mesh · 14ms</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onToast(`Live Dual-Currency Ledger: 1 USD = ${exchangeRate.toLocaleString('en-US')} SLSH`)
                  }
                  className="hero-telemetry-chip cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-[#fbbf24] shrink-0" />
                  <span>1 USD = {exchangeRate.toLocaleString('en-US')} SLSH</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToast('Automated Somaliland MOF 4.8% VAT & Z-Report Compliance')}
                  className="hero-telemetry-chip cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                  <span>MOF 4.8% VAT Certified</span>
                </button>
              </motion.div>
            </div>

            {/* Right 6 Cols: Live 3D 5-Device SomBill Ecosystem Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.75, delay: 0.3, ease: APPLE_EASE }}
              className="lg:col-span-6"
            >
              <HeroEcosystemShowcase exchangeRate={exchangeRate} onLaunchLiveApp={onLaunchLiveApp} onToast={onToast} />
            </motion.div>
          </div>

          {/* Step 6 (delay 0.75s): Archetype 8 Wide Stats Glass Banner (.stats-glass-card) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.75, ease: APPLE_EASE }}
            className="mt-12"
          >
            <StatsGlassBanner
              items={[
                {
                  icon: 'storefront',
                  valueNode: <AnimatedCounter end={128} suffix="+ Venues" />,
                  label: 'Verified Restaurants & Hotels',
                  sub: 'Hargeisa, Berbera, Burao & Borama',
                },
                {
                  icon: 'wifi',
                  valueNode: <AnimatedCounter end={14} suffix=" ms" />,
                  label: 'Local LAN Sync Latency',
                  sub: '100% resilient during fiber outages',
                },
                {
                  icon: 'trending_up',
                  valueNode: <AnimatedCounter end={28} prefix="+" suffix="%" />,
                  label: 'Average Check Size Lift',
                  sub: 'Via NFC smart table visual upsells',
                },
                {
                  icon: 'verified',
                  valueNode: <AnimatedCounter end={99.98} decimals={2} suffix="%" />,
                  label: 'Drawer & VAT Accuracy',
                  sub: 'Automated USD + SLSH Z-Reports',
                },
              ]}
            />
          </motion.div>

          {/* 3D Perspective Interactive Mockup Wrapping LivePosKdsDualSimulator */}
          <div
            id="live-simulator"
            className="mt-12 scroll-mt-24"
            style={{ perspective: '1400px' }}
            onMouseEnter={() => setPreviewHovered(true)}
            onMouseLeave={() => setPreviewHovered(false)}
          >
            <motion.div
              initial={{ rotateX: 12, rotateY: -4, scale: 0.95, opacity: 0.92 }}
              animate={
                previewHovered
                  ? { rotateX: 0, rotateY: 0, scale: 1, opacity: 1 }
                  : { rotateX: 2, rotateY: -1, scale: 0.985, opacity: 1 }
              }
              transition={{ duration: 0.65, ease: APPLE_EASE }}
              className="rounded-3xl p-1.5 bg-gradient-to-r from-[#dc2626]/40 via-[#f97316]/40 to-[#f59e0b]/40 shadow-[0_30px_90px_rgba(220,38,38,0.22)]"
            >
              <LivePosKdsDualSimulator
                lang={lang}
                exchangeRate={exchangeRate}
                onToast={onToast}
                onLaunchLiveApp={onLaunchLiveApp}
              />
            </motion.div>
          </div>

          {/* Scroll Cue */}
          <div className="mt-8 flex flex-col items-center justify-center gap-1.5 text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-widest">Scroll to Explore 13 Modules</span>
            <ChevronDown className="w-4 h-4 text-[#f97316] animate-scroll-bounce" />
          </div>
        </div>
      </section>

      {/* =====================================================================
          1B. 2026 GOD-LEVEL REGIONAL TRUST & VENUE NETWORK SHOWCASE STAGE
         ===================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="horn-trust-stage space-y-8">
            {/* Top Horizon Laser Beam + Moving Comet */}
            <div className="horn-stage-top-beam" aria-hidden="true" />
            {/* Breathing Radial Aura Glow Behind Headline */}
            <div className="horn-ambient-orb" aria-hidden="true" />

            {/* Header Block: Eyebrow + Monumental Moving Gradient Headline + Interactive City Filter */}
            <div className="text-center space-y-5 relative z-10">
              {/* God-Level Eyebrow with Animated Laser Wings */}
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, ease: APPLE_EASE }}
                className="horn-eyebrow-wrap"
              >
                <span className="horn-laser-wing wing-left hidden sm:inline-block" />
                <div className="horn-eyebrow-badge">
                  <Sparkles className="w-4 h-4 text-[#fbbf24] shrink-0" />
                  <span className="horn-eyebrow-text">Trusted Across the Horn of Africa</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
                <span className="horn-laser-wing wing-right hidden sm:inline-block" />
              </motion.div>

              {/* Monumental God-Level Display Headline with Continuous Moving Color Gradients */}
              <motion.h2
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.65, delay: 0.08, ease: APPLE_EASE }}
                className="horn-god-headline text-white [.light-theme_&]:text-slate-900"
              >
                Powering <span className="horn-moving-gradient-text">Flagship Hotels, Bustling Mandi Houses,</span>{' '}
                <span className="horn-moving-gradient-alt">Rooftop Lounges &amp; Multi-City Franchises</span>
              </motion.h2>

              {/* Dynamic Sub-Kicker with Live Typewriter & Regional Telemetry */}
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.16, ease: APPLE_EASE }}
                className="text-base sm:text-lg text-slate-300 [.light-theme_&]:text-slate-600 max-w-3xl mx-auto leading-relaxed font-medium"
              >
                Engineered for zero-downtime hospitality across East Africa — delivering instant{' '}
                <span className="text-white [.light-theme_&]:text-slate-900 font-bold underline decoration-[#f97316]/60 decoration-2 underline-offset-4">
                  <Typewriter
                    words={[
                      'ZAAD & e-Dahab Push Settlement',
                      '14ms Offline Local LAN Sync',
                      '5-Star Hotel Room Folio Posting',
                      'Multi-Station Kitchen KDS Routing',
                      'Dual-Currency USD & SLSH Ledgers',
                    ]}
                    typingSpeed={55}
                    deletingSpeed={30}
                    pauseDelay={2200}
                  />
                </span>
              </motion.p>

              {/* Interactive Regional Hub Filter Pills */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.22, ease: APPLE_EASE }}
                className="flex flex-wrap items-center justify-center gap-2 pt-1"
              >
                {[
                  { id: 'All', label: 'All 6 Cities · 520+ Venues' },
                  { id: 'Hargeisa', label: 'Hargeisa HQ (310+)' },
                  { id: 'Mogadishu', label: 'Mogadishu (85+)' },
                  { id: 'Berbera', label: 'Berbera Port (42+)' },
                  { id: 'Burao', label: 'Burao (38+)' },
                  { id: 'Borama', label: 'Borama (25+)' },
                  { id: 'Djibouti', label: 'Djibouti (20+)' },
                ].map((hub) => {
                  const isActive = selectedHornCity === hub.id;
                  return (
                    <button
                      key={hub.id}
                      type="button"
                      onClick={() => {
                        setSelectedHornCity(hub.id);
                        onToast(
                          hub.id === 'All'
                            ? 'Showing all flagship Horn of Africa hospitality partners'
                            : `Highlighting verified SomBill venues in ${hub.id}`,
                        );
                      }}
                      className={`horn-city-pill ${isActive ? 'active' : ''}`}
                    >
                      <span>{hub.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            </div>

            {/* Dual Infinite Marquee Tracks */}
            <div className="marquee-mask overflow-hidden space-y-4 py-2 relative z-10">
              {/* Row 1: Scrolls Left (40s) */}
              <div className="marquee-track-left gap-4">
                {[...MARQUEE_VENUES_ROW_1, ...MARQUEE_VENUES_ROW_1].map((v, i) => {
                  const isHighlighted =
                    selectedHornCity === 'All' || v.city.toLowerCase().includes(selectedHornCity.toLowerCase());
                  return (
                    <button
                      key={`r1-${i}`}
                      type="button"
                      onClick={() => onToast(`${v.name} (${v.city}) — Running SomBill ${v.tag}`)}
                      className={`hero-stat-card mr-4 shrink-0 text-left cursor-pointer transition-all duration-300 ${
                        isHighlighted ? 'opacity-100 scale-100' : 'opacity-40 scale-95 hover:opacity-90'
                      }`}
                      style={{ '--laser-color': getAccentByIndex(i) } as React.CSSProperties}
                    >
                      <div className="stat-card-glow" style={{ background: getAccentByIndex(i) }} />
                      <TintedIcon icon="storefront" index={i} size="sm" />
                      <div>
                        <div className="text-sm font-bold text-white [.light-theme_&]:text-slate-900 flex items-center gap-2">
                          <span>{v.name}</span>
                        </div>
                        <div className="text-xs font-mono text-[#fb923c] mt-0.5">
                          {v.city} · {v.tag}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Scrolls Right (50s) */}
              <div className="marquee-track-right gap-4">
                {[...MARQUEE_VENUES_ROW_2, ...MARQUEE_VENUES_ROW_2].map((v, i) => {
                  const isHighlighted =
                    selectedHornCity === 'All' ||
                    v.city.toLowerCase().includes(selectedHornCity.toLowerCase()) ||
                    (selectedHornCity !== 'All' && v.city === '3 Cities');
                  return (
                    <button
                      key={`r2-${i}`}
                      type="button"
                      onClick={() => onToast(`${v.name} (${v.city}) — Verified SomBill Partner (${v.tag})`)}
                      className={`hero-stat-card mr-4 shrink-0 text-left cursor-pointer transition-all duration-300 ${
                        isHighlighted ? 'opacity-100 scale-100' : 'opacity-40 scale-95 hover:opacity-90'
                      }`}
                      style={{ '--laser-color': getAccentByIndex(i + 2) } as React.CSSProperties}
                    >
                      <div className="stat-card-glow" style={{ background: getAccentByIndex(i + 2) }} />
                      <TintedIcon icon="verified" index={i + 2} size="sm" />
                      <div>
                        <div className="text-sm font-bold text-white [.light-theme_&]:text-slate-900 flex items-center gap-2">
                          <span>{v.name}</span>
                        </div>
                        <div className="text-xs font-mono text-emerald-400 mt-0.5">
                          {v.city} · {v.tag}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* =====================================================================
          2. COMPLETE 13-MODULE PRODUCT ECOSYSTEM (ARCHETYPE 2 + ARCHETYPE 4)
         ===================================================================== */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Unified Hospitality Operating System"
            titleBefore="Six Core Pillars."
            titleGradient="Thirteen Specialized Modules."
            titleAfter="One Scalable Engine."
            subtitle="From bustling street-side tea shops to 5-star hotel banquet halls, every SomBill module shares a single real-time database and dual-currency ledger. Click any module to explore its full interactive product page."
          />
        </ScrollReveal>

        {/* Top 3 Flagship Modules — Archetype 2 (.dept-card-premium) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[PRODUCT_PAGES['restaurant-pos'], PRODUCT_PAGES['nfc-ordering'], PRODUCT_PAGES['kds']].map((prod, idx) => (
            <ScrollReveal key={prod.slug} delayMs={idx * 80}>
              <DeptSolutionCard
                icon={prod.iconName}
                badge={`Flagship 0${idx + 1}`}
                title={lang === 'so' ? prod.titleSo : prod.title}
                desc={prod.subtitle}
                topics={prod.keyFeatures.slice(0, 3).map((kf) => kf.bullet1)}
                actionLabel={`Explore ${prod.highlightWord} Architecture`}
                onClick={() => onNavigate({ type: 'product', slug: prod.slug })}
                index={idx}
              />
            </ScrollReveal>
          ))}
        </div>

        {/* Remaining 10 Product Modules — Archetype 4 (.course-card-premium) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {(
            [
              'qr-ordering',
              'table-management',
              'menu-management',
              'order-management',
              'inventory-management',
              'billing-payments',
              'tax-financial-reports',
              'staff-management',
              'multi-branch',
              'business-analytics',
            ] as ProductSlug[]
          ).map((slug, idx) => {
            const p = PRODUCT_PAGES[slug];
            return (
              <ScrollReveal key={slug} delayMs={(idx % 5) * 60}>
                <CourseShowcaseCard
                  categoryChip={p.category}
                  icon={p.iconName}
                  title={p.highlightWord}
                  desc={p.shortDesc}
                  tags={[p.heroMetrics[0].label, p.heroMetrics[0].value]}
                  metricBadge={`${p.heroMetrics[0].label}: ${p.heroMetrics[0].value}`}
                  actionLabel="Explore →"
                  onClick={() => onNavigate({ type: 'product', slug })}
                  index={idx + 1}
                />
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          3. NFC TAP-TO-ORDER SHOWCASE SECTION
         ===================================================================== */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="premium-waali-card rounded-3xl p-6 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            <div className="lg:col-span-6 space-y-6">
              <SectionHeader
                align="left"
                eyebrow="Contactless Table Innovation"
                titleBefore="Tap-to-Order NFC Stands."
                titleGradient="Turn Tables 35% Faster."
                subtitle="Allow guests to browse your culinary offerings in their preferred language (Somali, English, or Arabic), customize spice levels, order in seconds, and settle using local mobile money without waiting to flag down a waiter."
              />

              <div className="space-y-3.5">
                {[
                  {
                    num: '01',
                    title: 'Zero App Installation Required',
                    desc: 'Compatible with all iOS and Android phones via native NFC tap or QR camera scan—loads in under 0.8 seconds.',
                    icon: 'contactless',
                  },
                  {
                    num: '02',
                    title: 'Dynamic Upsells & Platter Combos',
                    desc: 'Automatically prompts guests with warm sambusas, fresh mango smoothies, or spiced Shaah Cadays—lifting average check size by 28%.',
                    icon: 'trending_up',
                  },
                  {
                    num: '03',
                    title: 'Automated ZAAD & e-Dahab Push Prompts',
                    desc: 'Customers confirm their mobile money PIN right on their handset while the kitchen KDS receives the paid ticket immediately.',
                    icon: 'payments',
                  },
                ].map((item, idx) => (
                  <div
                    key={item.num}
                    className="hero-stat-card"
                    style={{ '--laser-color': getAccentByIndex(idx) } as React.CSSProperties}
                  >
                    <div className="stat-card-glow" style={{ background: getAccentByIndex(idx) }} />
                    <TintedIcon icon={item.icon} index={idx} size="sm" />
                    <div className="relative z-10">
                      <div className="font-bold text-sm text-white [.light-theme_&]:text-slate-900">
                        {item.num}. {item.title}
                      </div>
                      <p className="text-xs text-slate-400 [.light-theme_&]:text-slate-600 mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate({ type: 'product', slug: 'nfc-ordering' })}
                  className="btn-sombill-grad px-5 py-3 rounded-xl text-white font-bold text-xs cursor-pointer"
                >
                  Explore NFC Smart Tables & Hardware →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate({ type: 'product', slug: 'qr-ordering' })}
                  className="btn-shimmer-sweep relative overflow-hidden px-5 py-3 rounded-xl bg-white/5 [.light-theme_&]:bg-white border border-white/15 [.light-theme_&]:border-slate-300 text-white [.light-theme_&]:text-slate-900 font-bold text-xs hover:border-[#f97316] transition-colors cursor-pointer"
                >
                  Explore QR Code Ordering
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <InteractiveNfcPhoneSimulator lang={lang} exchangeRate={exchangeRate} onToast={onToast} />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. BUILT FROM THE GROUND UP FOR EAST AFRICA (ARCHETYPE 3 .feature-card-premium)
         ===================================================================== */}
      <section ref={floatingGridRef} className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Native Regional Engineering"
            titleBefore="Built From the Ground Up for the"
            titleGradient="Horn of Africa"
            subtitle="Imported global POS platforms fail in local restaurants because they lack offline LAN resilience, dual-currency USD/SLSH accounting, and direct mobile money gateway integration. SomBill solves this completely."
          />
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-3">
          {[
            {
              title: 'Native ZAAD & e-Dahab',
              desc: 'Avoid manual calculator errors and fake SMS screenshots. Cashiers trigger instant payment prompts directly to customer mobile numbers with automated verification.',
              icon: 'phonelink_ring',
              slug: 'billing-payments' as ProductSlug,
            },
            {
              title: 'Dynamic Dual-Currency POS',
              desc: 'Operate seamlessly between USD and Somaliland Shillings (SLSH). Set custom daily branch exchange rates and print dual-currency receipts automatically.',
              icon: 'currency_exchange',
              slug: 'restaurant-pos' as ProductSlug,
            },
            {
              title: 'Resilient Offline LAN Mesh',
              desc: 'Fiber cuts or cellular drops never freeze your restaurant. Terminals communicate over local Wi-Fi and sync to the cloud automatically upon reconnection.',
              icon: 'wifi_off',
              slug: 'kds' as ProductSlug,
            },
            {
              title: 'MOF Tax & Z-Report Compliance',
              desc: 'Generate verified shift Z-Reports and Somaliland Ministry of Finance 4.8% VAT statements formatted for local accounting and tax filing.',
              icon: 'account_balance',
              slug: 'tax-financial-reports' as ProductSlug,
            },
          ].map((card, idx) => (
            <div key={idx} className="floating-icon-card h-full">
              <FeatureCardPremium
                icon={card.icon}
                badge={`Pillar 0${idx + 1}`}
                title={card.title}
                desc={card.desc}
                actionLabel="Learn more"
                onClick={() => onNavigate({ type: 'product', slug: card.slug })}
                index={idx}
              />
            </div>
          ))}
        </div>

        {/* Interactive 4-Step End-to-End Hospitality Workflow */}
        <div className="premium-waali-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div>
              <div className="section-eyebrow">
                <span className="eyebrow-line" />
                <span>End-to-End Restaurant Workflow</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white [.light-theme_&]:text-slate-900 mt-1">
                How an Order Flows Through <span className="gradient-text">SomBill</span> in Milliseconds
              </h3>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-200">
              {workflowStages.map((st, idx) => (
                <button
                  key={st.num}
                  type="button"
                  onClick={() => setActiveWorkflowStep(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeWorkflowStep === idx
                      ? 'btn-sombill-grad text-white'
                      : 'text-slate-400 hover:text-white [.light-theme_&]:text-slate-600'
                  }`}
                >
                  Step {st.num}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
            {workflowStages.map((stage, idx) => {
              const isActive = idx === activeWorkflowStep;
              return (
                <FeatureCardPremium
                  key={stage.num}
                  icon={stage.icon}
                  badge={`STEP ${stage.num}`}
                  title={stage.title}
                  desc={stage.desc}
                  bullets={[stage.metric]}
                  actionLabel={stage.actionLabel}
                  onClick={() => {
                    setActiveWorkflowStep(idx);
                    onNavigate({ type: 'product', slug: stage.slug });
                  }}
                  index={idx}
                  className={isActive ? 'border-[#f97316] shadow-[0_0_30px_rgba(249,115,22,0.2)]' : ''}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. INTERACTIVE ROI CALCULATOR
         ===================================================================== */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <InteractiveRoiCalculator exchangeRate={exchangeRate} onRequestDemo={onOpenDemoModal} />
      </section>

      {/* =====================================================================
          6. SUPPORTED HOSPITALITY BUSINESS TYPES (7 SOLUTIONS — ARCHETYPE 2 .dept-card-premium)
         ===================================================================== */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <SectionHeader
          eyebrow="Tailored Industry Solutions"
          titleBefore="Purpose-Built for Every"
          titleGradient="Hospitality Format"
          subtitle="Select your business type below to view tailored operational workflows, hardware setups, and live demos."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {(Object.keys(SOLUTION_PAGES) as SolutionSlug[]).map((slug, idx) => {
            const sol = SOLUTION_PAGES[slug];
            return (
              <ScrollReveal key={slug} delayMs={(idx % 4) * 70}>
                <DeptSolutionCard
                  icon={sol.iconName}
                  badge={`${sol.heroStat} Impact`}
                  title={lang === 'so' ? sol.titleSo : sol.badge}
                  desc={sol.shortDesc}
                  topics={sol.tailoredModules.slice(0, 2).map((m) => m.title)}
                  actionLabel="View Solution"
                  onClick={() => onNavigate({ type: 'solution', slug })}
                  index={idx}
                />
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          6B. ARCHETYPE 7: HOSPITALITY TESTIMONIALS & LIVE VENUE ACTIVITY STREAM
         ===================================================================== */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <SectionHeader
          eyebrow="Verified Venue Outcomes"
          titleBefore="Hospitality Leaders & Live"
          titleGradient="Floor Activity Pulse"
          subtitle="Real-time settlement telemetry and executive endorsements from Somaliland and East Africa's busiest hospitality venues."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            <TestimonialCardPremium
              quote="Before SomBill, Friday dinner rushes meant lost paper tickets and 12-minute ZAAD verification queues. Now every waiter tablet fires directly to our Grill and Mandi KDS in 14ms—even when outside internet drops."
              authorName="Mohamed Sheikh"
              authorRole="General Manager · Hargeisa"
              initials="MS"
              companyBadge="Gulf Star Hotel"
            />
            <TestimonialCardPremium
              quote="Our dual-currency drawer reconciliation used to take 45 minutes every night. SomBill's Terminal #02 calculates mixed USD and SLSH change automatically and prints our MOF 4.8% VAT Z-Report in one click."
              authorName="Khadra Warsame"
              authorRole="Operations Director · Berbera"
              initials="KW"
              companyBadge="Red Sea Resort"
            />
          </div>

          <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
            <LiveActivityItem
              icon="payments"
              venue="Gulf Star Hotel (#T-12)"
              actionHighlight="Settled $48.50 via ZAAD *880#"
              detail="· 3.1s Push Verified"
              timeAgo="Just now"
              index={0}
            />
            <LiveActivityItem
              icon="contactless"
              venue="Beder Rooftop Lounge"
              actionHighlight="NFC Smart Puck Tap (#M-04)"
              detail="· +2x Camel Milk Chai Upsell"
              timeAgo="14s ago"
              index={1}
            />
            <LiveActivityItem
              icon="kitchen"
              venue="Sultan Palace Mandi"
              actionHighlight="Grill KDS Bumped 6 Orders"
              detail="· Offline LAN Mesh 12ms"
              timeAgo="38s ago"
              index={2}
            />
            <LiveActivityItem
              icon="account_balance"
              venue="Damal Hotel Banquet"
              actionHighlight="Room #308 Folio Posted"
              detail="· Dual USD / SLSH Receipt"
              timeAgo="1m ago"
              index={4}
            />
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. TRANSPARENT PRICING PREVIEW (ARCHETYPE 5 .pricing-card)
         ===================================================================== */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <SectionHeader
            eyebrow="Transparent Investment"
            titleBefore="Simple Plans for Every"
            titleGradient="Hospitality Size"
            subtitle="No hidden activation fees. Full local on-site training and hardware installation support included in all packages."
          />
          <div className="pt-2 inline-flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-200">
            <button
              type="button"
              onClick={() => setAnnualBilling(false)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !annualBilling ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 [.light-theme_&]:text-slate-600'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setAnnualBilling(true)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                annualBilling ? 'btn-sombill-grad text-white' : 'text-slate-400 [.light-theme_&]:text-slate-600'
              }`}
            >
              Annual Billing (Save 20%)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {[
            {
              tier: 'SMALL VENUES',
              name: 'Café & Qawa Starter',
              desc: 'Ideal for single-counter cafes, tea lounges, juice bars, and bakeries.',
              monthlyUsd: 39,
              annualUsd: 29,
              popular: false,
              icon: 'local_cafe',
              features: [
                '1 Touch POS Terminal License',
                'Offline Local LAN Order Sync',
                'ZAAD & e-Dahab Checkout Integration',
                'QR Digital Customer Menu',
                'Daily Shift Z-Report & Financial Summary',
              ],
              cta: 'Start 14-Day Free Trial',
            },
            {
              tier: 'FULL SERVICE',
              name: 'Restaurant Pro',
              desc: 'Complete suite for sit-down restaurants, grill houses, and high-volume kitchens.',
              monthlyUsd: 99,
              annualUsd: 79,
              popular: true,
              icon: 'restaurant',
              features: [
                'Up to 4 POS Terminals + 2 KDS Screens',
                'Unlimited NFC Tap & QR Table Stands',
                'Visual Floor Map & VIP Majlis Buzzer Queue',
                'Real-Time Recipe Costing & Stock Deduction',
                'Waiter Performance & Shift RBAC Audits',
                '24/7 Local Dedicated WhatsApp & On-Site SLA',
              ],
              cta: 'Claim 14-Day Free Trial',
            },
            {
              tier: 'MULTI-UNIT & HOTELS',
              name: 'Chain & Hotel OS',
              desc: 'Engineered for hospitality groups, hotel room billing, and multi-city branches.',
              monthlyUsd: 199,
              annualUsd: 169,
              popular: false,
              icon: 'domain',
              features: [
                'Unlimited Terminals & Kitchen KDS Displays',
                'Hotel Room Folio & Corporate House Accounts',
                'Central HQ Menu Push & Commissary Transfers',
                'Multi-Branch Consolidated Executive BI',
                'Custom ERP / API Export & Dedicated Engineer',
              ],
              cta: 'Compare Full Pricing Matrix →',
            },
          ].map((plan, idx) => {
            const price = annualBilling ? plan.annualUsd : plan.monthlyUsd;
            const slshPrice = Math.round(price * exchangeRate);
            return (
              <PricingTierCard
                key={plan.name}
                tierBadge={plan.tier}
                name={plan.name}
                desc={plan.desc}
                priceDisplay={`$${price}`}
                periodSub={`/ month ${annualBilling ? '(billed annually)' : ''}`}
                secondaryCurrencySub={`≈ ${slshPrice.toLocaleString('en-US')} SLSH / mo (configurable)`}
                included={plan.features}
                ctaLabel={plan.cta}
                popular={plan.popular}
                icon={plan.icon}
                onCtaClick={() => (plan.popular ? onOpenDemoModal() : onNavigate({ type: 'pricing' }))}
                index={idx}
              />
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          8. 2026 PREMIUM GLASS ACCORDION FAQ SECTION (SOMBILL POS EDITION)
         ===================================================================== */}
      <PremiumFaqSection onContactClick={() => onNavigate({ type: 'company', slug: 'contact' })} />

      {/* =====================================================================
          9. ARCHETYPE 8: WIDE FINAL CTA GLASS CARD (.cta-glass-card)
         ===================================================================== */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setCtaMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          className="cta-glass-card p-6 sm:p-12 shadow-[0_30px_90px_rgba(220,38,38,0.28)]"
        >
          {/* Mouse-Following Spotlight (.cta-mouse-glow) */}
          <div
            className="cta-mouse-glow pointer-events-none absolute w-[550px] h-[550px] rounded-full transition-transform duration-150"
            style={{
              background:
                'radial-gradient(circle, rgba(249, 115, 22, 0.22) 0%, rgba(220, 38, 38, 0.1) 45%, transparent 70%)',
              filter: 'blur(45px)',
              transform: `translate(${ctaMouse.x - 275}px, ${ctaMouse.y - 275}px)`,
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center gap-3">
                <div className="animate-float-icon">
                  <TintedIcon icon="rocket_launch" accentColor="#f97316" size="md" />
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-mono text-[#fb923c]">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                  <span>Fast-Track Branch Deployment · Same-Day Setup</span>
                </div>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white [.light-theme_&]:text-slate-900 text-balance">
                Ready to upgrade your restaurant or hotel operations with{' '}
                <span className="gradient-text">SomBill OS</span>?
              </h2>
              <p className="text-sm sm:text-base text-slate-300 [.light-theme_&]:text-slate-600 leading-relaxed max-w-xl">
                Schedule a personalized 30-minute hands-on demonstration at your establishment in Hargeisa, Berbera,
                Burao, Borama, Mogadishu, or online via video call.
              </p>

              {/* Avatar Stack + Social Proof */}
              <div className="pt-1 flex flex-wrap items-center gap-4">
                <div className="flex -space-x-2.5">
                  {['MS', 'HB', 'KW', 'AN', 'FA'].map((initials, i) => (
                    <div
                      key={initials}
                      className="w-9 h-9 rounded-full border-2 border-[#120609] flex items-center justify-center text-[11px] font-mono font-extrabold text-white"
                      style={{ background: getAccentByIndex(i) }}
                    >
                      {initials}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-300 [.light-theme_&]:text-slate-700">
                  <strong className="text-white [.light-theme_&]:text-slate-900">128+ General Managers & Owners</strong>{' '}
                  switched to SomBill in 2026
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-6 text-xs font-semibold text-white [.light-theme_&]:text-slate-900">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  <span>Free On-Site Network Assessment</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#f97316]" />
                  <span>Full Waiter & Chef Training</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#f59e0b]" />
                  <span>Menu & Recipe Upload Included</span>
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="premium-waali-card rounded-2xl p-6 shadow-2xl text-white [.light-theme_&]:text-slate-900">
                {consultSubmitted ? (
                  <div className="py-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-extrabold">Consultation Request Confirmed!</h3>
                    <p className="text-xs text-slate-400">
                      Our regional hospitality engineering team will contact <strong>{venueName}</strong> at{' '}
                      <strong>{venuePhone}</strong> within 2 hours.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConsultSubmitted(false)}
                      className="text-xs font-bold text-[#f97316] hover:underline"
                    >
                      Submit another branch request
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleConsultSubmit} className="space-y-4 relative z-10">
                    <div>
                      <h3 className="text-base font-extrabold">Request Free Consultation</h3>
                      <p className="text-xs text-slate-400">
                        Our regional hospitality specialists will contact you within 2 hours.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Restaurant / Hotel Name
                      </label>
                      <input
                        type="text"
                        required
                        value={venueName}
                        onChange={(e) => setVenueName(e.target.value)}
                        placeholder="e.g. Sultan Palace Lounge"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs font-medium focus:outline-none focus:border-[#f97316]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                          City / Region
                        </label>
                        <select
                          value={venueCity}
                          onChange={(e) => setVenueCity(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-[#120609] [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs font-medium"
                        >
                          <option>Hargeisa, Somaliland</option>
                          <option>Berbera, Somaliland</option>
                          <option>Burao, Somaliland</option>
                          <option>Borama, Somaliland</option>
                          <option>Mogadishu</option>
                          <option>Djibouti / Nairobi / Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                          WhatsApp / ZAAD Phone
                        </label>
                        <input
                          type="tel"
                          required
                          value={venuePhone}
                          onChange={(e) => setVenuePhone(e.target.value)}
                          placeholder="+252 63 442 8919"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Estimated Venue Capacity
                      </label>
                      <select
                        value={venueSize}
                        onChange={(e) => setVenueSize(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#120609] [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs font-medium"
                      >
                        <option>Under 15 Tables (Café / Express)</option>
                        <option>15–40 Tables (Full-Service Restaurant)</option>
                        <option>40+ Tables / Hotel & Banquet Venue</option>
                        <option>Multi-Branch Restaurant Chain</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="btn-sombill-grad w-full py-3.5 px-4 rounded-xl text-white font-bold text-xs cursor-pointer"
                    >
                      Book My Free In-Person Demo
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
