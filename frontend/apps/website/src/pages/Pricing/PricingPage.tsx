import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, ChevronUp, PlayCircle, Search } from 'lucide-react';
import { Language } from '../../utils/currency';
import { BLOG_POSTS, CompanySlug, ResourceSlug, WebsitePageRoute } from '../../services/websiteData';
import {
  CourseShowcaseCard,
  FeatureCardPremium,
  PremiumFaqSection,
  PricingTierCard,
  ProfilePartnerCard,
  SectionHeader,
  getAccentByIndex,
} from '../../components/ui/PremiumPrimitives';

interface Part2Props {
  lang: Language;
  exchangeRate: number;
  onNavigate: (route: WebsitePageRoute) => void;
  onOpenDemoModal: () => void;
  onLaunchLiveApp: (mode: 'cashier' | 'waiter' | 'manager' | 'admin') => void;
  onToast: (msg: string) => void;
}

/**
 * E. COMPLETE PRICING LANDING PAGE (2026 SOMBILL BRAND EDITION)
 */
export const WebsitePricingPage: React.FC<Part2Props> = ({ exchangeRate, onNavigate, onOpenDemoModal, onToast }) => {
  const [billedAnnually, setBilledAnnually] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'SLSH'>('USD');

  // Instant Branch & Terminal Cost Estimator state
  const [numBranches, setNumBranches] = useState(2);
  const [terminalsPerBranch, setTerminalsPerBranch] = useState(3);

  // Tailored Hospitality Solutions Matrix tab
  const [activeMatrixTab, setActiveMatrixTab] = useState<'dining' | 'hotels' | 'cafes' | 'qsr' | 'chains'>('dining');

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const formatPrice = (usdAmount: number) => {
    if (displayCurrency === 'USD') {
      return `$${usdAmount}`;
    }
    return `${Math.round(usdAmount * exchangeRate).toLocaleString('en-US')} Sh`;
  };

  // Estimator calculation
  const basePerBranch = billedAnnually ? 69 : 85;
  const extraTerminals = Math.max(0, terminalsPerBranch - 2) * 10;
  const estimatedMonthlyUsd = numBranches * (basePerBranch + extraTerminals);
  const estimatedMonthlySlsh = Math.round(estimatedMonthlyUsd * exchangeRate);

  const matrixTabs = {
    dining: {
      badge: 'FLOOR SPEED MASTERY',
      title: 'Restaurants & Full-Service Dining',
      desc: 'Keep waiters on the floor taking orders on handhelds that immediately transmit tickets to kitchen stations separated into Grill, Mandi Oven, Bakery, and Drink bars.',
      box1Title: 'Table Visual Grid',
      box1Sub: 'Real-time status: Occupied, Billed, Available, Reserved.',
      box2Title: 'Instant Bill Splitting',
      box2Sub: 'Split by seat or item across USD and SL Shilling.',
      recommendedTier: 'Professional Plan',
    },
    hotels: {
      badge: 'IN-ROOM & FOLIO SYNC',
      title: 'Luxury Hotels, Resorts & Guest Houses',
      desc: 'Unify bedside NFC room-service coasters, rooftop lounges, poolside cabanas, and conference banquets with direct room folio charging.',
      box1Title: 'Room Folio Charge',
      box1Sub: 'Post restaurant bills directly to verified guest rooms.',
      box2Title: '24/7 Bedside NFC',
      box2Sub: 'Trilingual Somali, English & Arabic digital room menu.',
      recommendedTier: 'Enterprise & Chains',
    },
    cafes: {
      badge: '3-TAP COUNTER VELOCITY',
      title: 'Cafés, Qawa & Bakery Hubs',
      desc: 'Move morning coffee and evening Shaah Cadays lines in under 4 seconds with express ZAAD/e-Dahab push and barista drink modifier screens.',
      box1Title: 'Barista KDS Screen',
      box1Sub: 'Clear milk, spice, and sugar modifiers without shouting.',
      box2Title: 'Smart Table Reorders',
      box2Sub: 'Seated laptop guests tap NFC disc for second-round refills.',
      recommendedTier: 'Starter Plan',
    },
    qsr: {
      badge: 'ASSEMBLY LINE SPEED',
      title: 'QSR, Fast Food & Shawarma',
      desc: 'High-contrast combo builders, sequential Takeaway # parcel tags, and bump-bar controlled fry/grill screens.',
      box1Title: '1-Tap Combo Builder',
      box1Sub: 'Auto-bundles main, side, and drink with packaging stock deduction.',
      box2Title: 'Pickup Screen Sync',
      box2Sub: 'Alerts waiting takeaway customers the second KDS bumps ready.',
      recommendedTier: 'Professional Plan',
    },
    chains: {
      badge: 'CENTRAL HQ GOVERNANCE',
      title: 'Multi-Branch Franchises & Groups',
      desc: 'Standardize recipes, push price updates across cities in 2 seconds, and track commissary transfers from one executive console.',
      box1Title: 'Global Menu Push',
      box1Sub: 'Update prices across Hargeisa, Berbera & Burao in 1 click.',
      box2Title: 'Commissary Transfers',
      box2Sub: 'Full chain-of-custody from central warehouse to branch kitchen.',
      recommendedTier: 'Enterprise & Chains',
    },
  };

  const activeMatrix = matrixTabs[activeMatrixTab];

  return (
    <div className="space-y-20 pb-16">
      {/* 1. Pricing Hero & Toggles */}
      <section className="pt-10 sm:pt-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <SectionHeader
            eyebrow="Enterprise-Ready Somali Hospitality Engine"
            titleBefore="Transparent, Scalable Pricing for"
            titleGradient="Hospitality Venues of All Sizes"
            subtitle="Configurable subscription plans built for restaurants, cafés, and hotels across Somaliland and the Horn of Africa—with built-in ZAAD, e-Dahab, and dual-currency ledger support."
          />

          {/* Billing Period & Display Currency Toggles */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <div className="inline-flex items-center p-1.5 rounded-2xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-200">
              <button
                type="button"
                onClick={() => setBilledAnnually(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !billedAnnually
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-400 [.light-theme_&]:text-slate-600'
                }`}
              >
                Billed Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilledAnnually(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  billedAnnually ? 'btn-sombill-grad text-white' : 'text-slate-400 [.light-theme_&]:text-slate-600'
                }`}
              >
                Billed Annually (Save 20%)
              </button>
            </div>

            <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-200 text-xs">
              <span className="pl-2.5 text-slate-400 font-medium">Display Currency:</span>
              <button
                type="button"
                onClick={() => setDisplayCurrency('USD')}
                className={`px-3 py-1.5 rounded-xl font-mono font-bold cursor-pointer ${
                  displayCurrency === 'USD'
                    ? 'btn-sombill-grad text-white'
                    : 'text-slate-400 [.light-theme_&]:text-slate-600'
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setDisplayCurrency('SLSH')}
                className={`px-3 py-1.5 rounded-xl font-mono font-bold cursor-pointer ${
                  displayCurrency === 'SLSH'
                    ? 'btn-sombill-grad text-white'
                    : 'text-slate-400 [.light-theme_&]:text-slate-600'
                }`}
              >
                SLSH (Sh)
              </button>
            </div>
          </div>
        </div>

        {/* 3 Plan Cards — Archetype 5: Pricing & Tier Comparison Cards (.pricing-card) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {[
            {
              tag: 'Single Outlet',
              name: 'Starter',
              desc: 'Ideal for single cafes, tea spots, & quick-service takeouts needing fast orders and mobile money.',
              monthlyUsd: 49,
              annualUsd: 39,
              popular: false,
              icon: 'local_cafe',
              included: [
                '1 POS Terminal license',
                'Kitchen Display Station (Cloud/LAN KDS)',
                'QR digital customer menu',
                'Basic ingredient inventory',
                'ZAAD & e-Dahab QR/Push integration',
              ],
              excluded: ['Multi-zone floor layout & VIP Majlis buzzer'],
              cta: 'Start 14-Day Free Trial',
            },
            {
              tag: 'Full Dining & Bars',
              name: 'Professional',
              desc: 'Engineered for busy casual dining, steakhouses, & high-volume floor operations with table turnover speed.',
              monthlyUsd: 109,
              annualUsd: 89,
              popular: true,
              icon: 'restaurant',
              included: [
                'Up to 4 POS Terminals included',
                'Unlimited KDS Kitchen screens',
                'NFC Tap-to-Order & Table QR payments',
                'Interactive Table Matrix & Waiter Assignments',
                'Real-time Recipe Costing & Stock deductions',
                'Staff Clock-in/out & Shift Z-Report audits',
              ],
              excluded: [],
              cta: 'Get Started with Professional',
            },
            {
              tag: 'Multi-Property',
              name: 'Enterprise & Chains',
              desc: 'Multi-branch franchises, hotel resorts, and regional hospitality groups requiring central control and ERP sync.',
              monthlyUsd: 249,
              annualUsd: 199,
              popular: false,
              icon: 'domain',
              included: [
                'Unlimited Terminals & Branches',
                'Hotel PMS Integration (Room folio charge)',
                'Central Master Kitchen & Commissary routing',
                'Dedicated Account Engineer in Hargeisa',
                'Custom API & Local Accounting Export',
                '24/7 Phone & On-Site Priority SLA',
              ],
              excluded: [],
              cta: 'Talk to Enterprise Sales',
            },
          ].map((plan, idx) => {
            const usdVal = billedAnnually ? plan.annualUsd : plan.monthlyUsd;
            return (
              <PricingTierCard
                key={plan.name}
                index={idx}
                tierBadge={plan.tag}
                name={plan.name}
                desc={plan.desc}
                priceDisplay={formatPrice(usdVal)}
                periodSub="/ month"
                secondaryCurrencySub={
                  billedAnnually
                    ? `Billed annually ($${usdVal * 12}/yr · Configurable)`
                    : 'Flexible month-to-month billing'
                }
                included={plan.included}
                excluded={plan.excluded}
                ctaLabel={plan.cta}
                popular={plan.popular}
                icon={plan.icon}
                onCtaClick={onOpenDemoModal}
              />
            );
          })}
        </div>
      </section>

      {/* 2. Interactive Instant Branch & Terminal Cost Estimator — Archetype 8 Wide Glass Card */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="stats-glass-card">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-7 space-y-6">
              <div>
                <div className="section-eyebrow">
                  <span className="eyebrow-line" />
                  <span>Interactive Licensing Calculator</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white [.light-theme_&]:text-slate-900 mt-1">
                  Instant Branch & Terminal Cost Estimator
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 [.light-theme_&]:text-slate-600 mt-1">
                  Operating a growing franchise across multiple cities? Calculate your consolidated monthly licensing
                  with multi-branch volume savings.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span>Number of Branches / Locations</span>
                    <span className="font-mono text-[#f97316] font-extrabold">
                      {numBranches} {numBranches === 1 ? 'Location' : 'Locations'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    value={numBranches}
                    onChange={(e) => setNumBranches(Number(e.target.value))}
                    aria-label="Number of Branches"
                    className="w-full accent-[#f97316] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                    <span>1 Branch</span>
                    <span>5 Branches</span>
                    <span>10 Branches</span>
                    <span>15 Branches</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span>POS & Handheld Terminals (Per Branch)</span>
                    <span className="font-mono text-[#f97316] font-extrabold">{terminalsPerBranch} Terminals</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={terminalsPerBranch}
                    onChange={(e) => setTerminalsPerBranch(Number(e.target.value))}
                    aria-label="Terminals Per Branch"
                    className="w-full accent-[#f97316] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                    <span>1 Terminal</span>
                    <span>4 Terminals</span>
                    <span>8 Terminals</span>
                    <span>12 Terminals</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 pricing-card pricing-card-featured">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">Calculated Monthly Rate:</span>
                  <span className="text-xs font-bold text-emerald-400">Includes Local Setup</span>
                </div>

                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums gradient-text">
                    ${estimatedMonthlyUsd.toLocaleString('en-US')}{' '}
                    <span className="text-sm font-normal text-slate-400">/ month</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    ≈ {estimatedMonthlySlsh.toLocaleString('en-US')} SLSH / month
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-white/10 [.light-theme_&]:border-slate-200 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Branches Licensed:</span>
                    <span className="font-bold">{numBranches} Locations</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Active Devices:</span>
                    <span className="font-bold">{numBranches * terminalsPerBranch} Active Terminals</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Offline Sync Engine:</span>
                    <span className="font-bold text-emerald-400">Included (Mesh LAN)</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onToast(
                    `Locked quote for ${numBranches} branches (${numBranches * terminalsPerBranch} terminals) — $${estimatedMonthlyUsd}/mo`,
                  );
                  onOpenDemoModal();
                }}
                className="btn-sombill-grad mt-5 w-full py-3 px-4 rounded-xl text-white font-bold text-xs cursor-pointer"
              >
                Lock In This Quote & Request Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Tailored Hospitality Solutions Matrix */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <SectionHeader
          eyebrow="Industry Architectures"
          titleBefore="Tailored Hospitality"
          titleGradient="Solutions Matrix"
          subtitle="Each venue archetype demands distinct floor logic. SomBill OS switches seamlessly between quick-touch cashier counters and luxury table-turn styles."
        />

        <div className="flex flex-wrap items-center justify-center gap-2">
          {(
            [
              { id: 'dining', label: 'Fine & Casual Dining' },
              { id: 'hotels', label: 'Luxury Hotels & Resorts' },
              { id: 'cafes', label: 'Cafés & Coffee Hubs' },
              { id: 'qsr', label: 'QSR & Fast Food' },
              { id: 'chains', label: 'Multi-Branch Franchises' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveMatrixTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMatrixTab === t.id
                  ? 'btn-sombill-grad text-white'
                  : 'bg-white/5 [.light-theme_&]:bg-white border border-white/10 [.light-theme_&]:border-slate-200 text-slate-300 [.light-theme_&]:text-slate-700 hover:border-[#f97316]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="stats-glass-card">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-7 space-y-5">
              <div className="text-xs font-mono font-bold text-[#f97316]">{activeMatrix.badge}</div>
              <h3 className="text-2xl font-extrabold text-white [.light-theme_&]:text-slate-900">
                {activeMatrix.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 [.light-theme_&]:text-slate-600 leading-relaxed">
                {activeMatrix.desc}
              </p>
              {/* Archetype 3: Platform Feature Cards for the 2 Sub-Feature Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <FeatureCardPremium
                  index={0}
                  icon="table_restaurant"
                  title={activeMatrix.box1Title}
                  desc={activeMatrix.box1Sub}
                />
                <FeatureCardPremium
                  index={1}
                  icon="payments"
                  title={activeMatrix.box2Title}
                  desc={activeMatrix.box2Sub}
                />
              </div>
            </div>
            <div className="lg:col-span-5 pricing-card pricing-card-featured">
              <div className="space-y-4">
                <div className="text-xs font-mono text-[#fb923c]">RECOMMENDED CONFIGURATION</div>
                <div className="text-xl font-extrabold text-white [.light-theme_&]:text-slate-900">
                  {activeMatrix.recommendedTier}
                </div>
                <p className="text-xs text-slate-300 [.light-theme_&]:text-slate-600 leading-relaxed">
                  Includes full local LAN offline mesh, bilingual Somali/English interface, and native ZAAD & e-Dahab
                  USSD push settlement.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onNavigate({
                    type: 'solution',
                    slug:
                      activeMatrixTab === 'dining'
                        ? 'restaurants'
                        : activeMatrixTab === 'hotels'
                          ? 'hotels'
                          : activeMatrixTab === 'cafes'
                            ? 'cafes'
                            : activeMatrixTab === 'qsr'
                              ? 'fast-food'
                              : 'chains',
                  })
                }
                className="btn-sombill-grad mt-5 w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs cursor-pointer"
              >
                Explore Full Industry Blueprint →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Comprehensive Feature Comparison Matrix */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <SectionHeader
          eyebrow="Deep Dive"
          titleBefore="Comprehensive Feature"
          titleGradient="Comparison Matrix"
          subtitle="Everything included in each tier, with zero hidden activation fees."
        />

        <div className="stats-glass-card overflow-x-auto !p-0">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 [.light-theme_&]:border-slate-200 bg-white/5 [.light-theme_&]:bg-slate-50">
                <th className="py-4 px-6 font-extrabold text-white [.light-theme_&]:text-slate-900">
                  Feature Category
                </th>
                <th className="py-4 px-6 font-extrabold text-center text-slate-300 [.light-theme_&]:text-slate-700">
                  Starter
                </th>
                <th className="py-4 px-6 font-extrabold text-center text-[#f97316] bg-[#f97316]/10">Professional</th>
                <th className="py-4 px-6 font-extrabold text-center text-white [.light-theme_&]:text-slate-900">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 [.light-theme_&]:divide-slate-200">
              <tr className="bg-white/5 [.light-theme_&]:bg-slate-50/70">
                <td colSpan={4} className="py-2.5 px-6 font-mono font-bold text-[11px] text-[#f97316]">
                  1. POS & ORDER MANAGEMENT
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-6 font-medium">POS Terminal Licenses</td>
                <td className="py-3.5 px-6 text-center text-slate-400">1 Terminal</td>
                <td className="py-3.5 px-6 text-center font-bold bg-[#f97316]/5">Up to 4 Terminals</td>
                <td className="py-3.5 px-6 text-center font-bold text-[#f97316]">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3.5 px-6 font-medium">Kitchen Display Screens (KDS)</td>
                <td className="py-3.5 px-6 text-center text-slate-400">1 Screen</td>
                <td className="py-3.5 px-6 text-center font-bold bg-[#f97316]/5">Unlimited Screens</td>
                <td className="py-3.5 px-6 text-center font-bold">Unlimited Screens</td>
              </tr>
              <tr>
                <td className="py-3.5 px-6 font-medium">Offline Mesh Sync (Local LAN)</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold">✓</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold bg-[#f97316]/5">✓</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold">✓</td>
              </tr>

              <tr className="bg-white/5 [.light-theme_&]:bg-slate-50/70">
                <td colSpan={4} className="py-2.5 px-6 font-mono font-bold text-[11px] text-[#f97316]">
                  2. REGIONAL PAYMENTS & CURRENCIES
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-6 font-medium">ZAAD & e-Dahab USSD Push Integration</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold">✓</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold bg-[#f97316]/5">✓</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-3.5 px-6 font-medium">Dual Currency Ledger (USD & SLSH)</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold">✓</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold bg-[#f97316]/5">✓</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-3.5 px-6 font-medium">MOF 4.8% VAT & Z-Report Reconciliation</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold">✓</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold bg-[#f97316]/5">✓</td>
                <td className="py-3.5 px-6 text-center text-emerald-400 font-bold">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. 2026 Premium Glass Accordion FAQs (Pricing & Setup) */}
      <PremiumFaqSection
        initialCategory="Pricing & Setup"
        onContactClick={() => onNavigate({ type: 'company', slug: 'contact' })}
      />
    </div>
  );
};
