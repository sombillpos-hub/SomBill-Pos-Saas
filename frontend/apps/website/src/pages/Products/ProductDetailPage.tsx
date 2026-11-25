import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Language } from '../../utils/currency';
import { HARDWARE_PERIPHERALS, PRODUCT_PAGES, ProductSlug, WebsitePageRoute } from '../../services/websiteData';
import { InteractiveNfcPhoneSimulator, LivePosKdsDualSimulator } from '../../sections/WebsiteInteractiveSimulators';
import {
  CourseShowcaseCard,
  DeptSolutionCard,
  FeatureCardPremium,
  HeroStatCard,
  SectionHeader,
  TintedIcon,
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

/**
 * B. INDIVIDUAL PRODUCT LANDING PAGE (ALL 13 PRODUCTS — 8 CARD ARCHETYPES)
 */
export const WebsiteProductDetailPage: React.FC<SharedPageProps & { slug: ProductSlug }> = ({
  slug,
  lang,
  exchangeRate,
  onNavigate,
  onOpenDemoModal,
  onLaunchLiveApp,
  onToast,
}) => {
  const product = PRODUCT_PAGES[slug] || PRODUCT_PAGES['restaurant-pos'];
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [syncedBranches, setSyncedBranches] = useState(false);

  return (
    <div className="space-y-20 pb-16">
      {/* Product Hero */}
      <section className="relative pt-10 sm:pt-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="section-eyebrow">
            <span className="eyebrow-line" />
            <span>
              {lang === 'so' ? product.badgeSo : product.badge} · {product.category}
            </span>
            <span className="eyebrow-line" />
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white [.light-theme_&]:text-slate-900 leading-[1.1] text-balance">
            {lang === 'so' ? product.titleSo : product.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 [.light-theme_&]:text-slate-600 leading-relaxed">
            {lang === 'so' ? product.subtitleSo : product.subtitle}
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenDemoModal}
              className="btn-sombill-grad px-6 py-3.5 rounded-xl text-white font-bold text-xs sm:text-sm cursor-pointer"
            >
              Deploy {product.highlightWord} in Your Venue
            </button>
            <button
              type="button"
              onClick={() =>
                onLaunchLiveApp(
                  slug === 'table-management'
                    ? 'waiter'
                    : slug === 'multi-branch'
                      ? 'admin'
                      : slug === 'business-analytics' || slug === 'staff-management' || slug === 'menu-management'
                        ? 'manager'
                        : 'cashier',
                )
              }
              className="btn-shimmer-sweep relative overflow-hidden px-5 py-3.5 rounded-xl bg-white/5 [.light-theme_&]:bg-white border border-white/15 [.light-theme_&]:border-slate-300 text-white [.light-theme_&]:text-slate-900 font-bold text-xs sm:text-sm hover:border-[#f97316] transition-colors cursor-pointer"
            >
              Try Live Interactive Console →
            </button>
          </div>
        </div>

        {/* 4 Quantitative Product Metrics — Archetype 1 (.hero-stat-card) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {product.heroMetrics.map((m, idx) => (
            <HeroStatCard
              key={idx}
              icon={product.iconName}
              index={idx}
              label={m.label}
              sub={m.sub}
              valueNode={<span className="gradient-text">{m.value}</span>}
            />
          ))}
        </div>

        {/* Interactive Product Demonstration */}
        <div>
          {product.simulatorType === 'nfc-phone' ? (
            <div className="premium-waali-card rounded-3xl p-6 sm:p-10">
              <InteractiveNfcPhoneSimulator lang={lang} exchangeRate={exchangeRate} onToast={onToast} />
            </div>
          ) : (
            <LivePosKdsDualSimulator
              lang={lang}
              exchangeRate={exchangeRate}
              onToast={onToast}
              onLaunchLiveApp={onLaunchLiveApp}
            />
          )}
        </div>
      </section>

      {/* High-Volume Architecture & Key Capabilities — Archetype 3 (.feature-card-premium) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <SectionHeader
          eyebrow="Core Capabilities"
          titleBefore="High-Volume Architecture Built for"
          titleGradient="Unforgiving Shifts"
          subtitle="No lagging screens, no lost tickets, and zero downtime during your busiest Friday and evening dining rushes."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {product.keyFeatures.map((feat, idx) => (
            <FeatureCardPremium
              key={idx}
              icon={feat.icon}
              badge={`Capability 0${idx + 1}`}
              title={feat.title}
              desc={feat.desc}
              bullets={[feat.bullet1, feat.bullet2]}
              index={idx}
            />
          ))}
        </div>
      </section>

      {/* Operational Workflow Steps — Archetype 3 (.feature-card-premium) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <SectionHeader
          eyebrow="Operational Speed"
          titleBefore="How"
          titleGradient={product.highlightWord}
          titleAfter="Works in Practice"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {product.workflowSteps.map((st, idx) => (
            <FeatureCardPremium
              key={st.step}
              icon={product.iconName}
              badge={`Step ${st.step}`}
              title={st.title}
              desc={st.desc}
              index={idx}
            />
          ))}
        </div>
      </section>

      {/* Special Deep-Dive Section for NFC/QR Comparison OR Multi-Branch Sync */}
      {slug === 'nfc-ordering' || slug === 'qr-ordering' ? (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
          <div className="premium-waali-card rounded-3xl p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              <div className="lg:col-span-5 space-y-4">
                <div className="section-eyebrow">
                  <span className="eyebrow-line" />
                  <span>Proven Operational Advantage</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white [.light-theme_&]:text-slate-900">
                  Why Traditional Laminated Menus Cost You Customers & Margins
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 [.light-theme_&]:text-slate-600 leading-relaxed">
                  Paper menus in high-volume Horn of Africa restaurants face continuous price volatility, torn pages,
                  high reprint costs, and delayed table turns. SomBill updates your menu across every table in 2
                  seconds.
                </p>
              </div>
              <div className="lg:col-span-7 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-bold">
                      <th className="py-3 px-4">Feature & Metric</th>
                      <th className="py-3 px-4 text-[#f97316] bg-[#f97316]/10 rounded-t-xl">SomBill NFC / QR OS</th>
                      <th className="py-3 px-4">Traditional Paper Menu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    <tr>
                      <td className="py-3 px-4 font-bold">Average Order Value</td>
                      <td className="py-3 px-4 font-bold text-emerald-400 bg-[#f97316]/5">
                        +28% via visual upsell prompts
                      </td>
                      <td className="py-3 px-4 text-slate-400">Flat baseline check size</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold">Menu Reprint Cost</td>
                      <td className="py-3 px-4 font-bold text-emerald-400 bg-[#f97316]/5">
                        $0 (Instant cloud price updates)
                      </td>
                      <td className="py-3 px-4 text-slate-400">$1,200 – $3,500 / year</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold">Bill Settlement Wait</td>
                      <td className="py-3 px-4 font-bold text-emerald-400 bg-[#f97316]/5">
                        0 minutes (Instant ZAAD/e-Dahab)
                      </td>
                      <td className="py-3 px-4 text-slate-400">9 – 14 minutes per table</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold">Local Currency Support</td>
                      <td className="py-3 px-4 font-bold text-[#f97316] bg-[#f97316]/5">
                        Live USD + SLSH Dual Display
                      </td>
                      <td className="py-3 px-4 text-slate-400">Static, outdated exchange rate</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
          <div className="premium-waali-card rounded-3xl p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              <div className="lg:col-span-7 space-y-4">
                <div className="section-eyebrow">
                  <span className="eyebrow-line" />
                  <span>Multi-Branch Central HQ</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white [.light-theme_&]:text-slate-900">
                  Push Menu Changes & Price Updates to All Outlets in One Click
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 [.light-theme_&]:text-slate-600 leading-relaxed">
                  Manage your flagship venue in Hargeisa and secondary outlets in Berbera, Burao, Borama, or Mogadishu
                  from one unified executive dashboard. Enforce role-based security so line staff cannot modify bills or
                  grant unauthorized discounts.
                </p>
              </div>

              <div className="lg:col-span-5 rounded-2xl bg-black/40 [.light-theme_&]:bg-slate-50 border border-white/10 [.light-theme_&]:border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white [.light-theme_&]:text-slate-900">
                    Live Venue Performance
                  </span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400">
                    {syncedBranches ? 'Synced Just Now' : 'Live Pulse'}
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  {[
                    { name: 'Branch 01 (Hargeisa HQ)', meta: '38 Tables · 4 KDS Active', usd: 3420.5 },
                    { name: 'Branch 02 (Downtown Hub)', meta: '24 Tables · 3 KDS Active', usd: 2190.0 },
                    { name: 'Branch 03 (Berbera Port Cafe)', meta: '14 Tables · 1 KDS Active', usd: 1145.2 },
                  ].map((b) => (
                    <div
                      key={b.name}
                      className="p-3 rounded-xl bg-white/5 [.light-theme_&]:bg-white border border-white/10 [.light-theme_&]:border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-white [.light-theme_&]:text-slate-900">{b.name}</div>
                        <div className="text-[11px] text-slate-400">{b.meta}</div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="font-extrabold text-[#f97316]">
                          ${b.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {Math.round(b.usd * exchangeRate).toLocaleString('en-US')} SLSH
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSyncedBranches(true);
                    onToast('Synced Global Price & Exchange Rate Adjustment to all 3 branches!');
                  }}
                  className="btn-sombill-grad w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs cursor-pointer"
                >
                  Sync Global Price Adjustment Across Branches
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Industrial Hardware Peripherals Showcase — Archetype 4 (.course-card-premium) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <SectionHeader
          eyebrow="Enterprise Hardware Rig"
          titleBefore="Industrial Peripherals Built for"
          titleGradient="Heavy Commercial Kitchens"
          subtitle="Plug-and-play compatibility. Certified IP54 water & grease resistant displays, thermal speed printers, and handcrafted NFC table pucks."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {HARDWARE_PERIPHERALS.map((hw, idx) => (
            <CourseShowcaseCard
              key={hw.id}
              categoryChip={hw.badge}
              icon={hw.icon}
              title={hw.name}
              desc={hw.spec}
              tags={['Plug & Play', 'LAN / USB / NFC']}
              metricBadge={hw.badge}
              actionLabel="Request Kit →"
              onClick={onOpenDemoModal}
              index={idx}
            />
          ))}
        </div>
      </section>

      {/* Product FAQs & Related Modules */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10">
        <div className="space-y-4">
          <h2 className="text-2xl font-extrabold text-white [.light-theme_&]:text-slate-900 text-center">
            Frequently Asked Questions — <span className="gradient-text">{product.highlightWord}</span>
          </h2>
          <div className="space-y-3">
            {product.faqs.map((faq, idx) => (
              <div key={idx} className="premium-waali-card rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between font-bold text-sm text-white [.light-theme_&]:text-slate-900 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-4 h-4 text-[#f97316]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 pt-2 text-xs sm:text-sm text-slate-300 [.light-theme_&]:text-slate-600 border-t border-white/10 leading-relaxed">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Related Products */}
        <div className="pt-6 border-t border-white/10 space-y-4">
          <h3 className="text-xs font-mono font-bold text-[#f97316] uppercase tracking-wider">
            Related SomBill OS Modules
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {product.relatedSlugs.map((relSlug, idx) => {
              const rel = PRODUCT_PAGES[relSlug];
              return (
                <DeptSolutionCard
                  key={relSlug}
                  icon={rel.iconName}
                  badge={rel.category.split(' ')[0]}
                  title={rel.highlightWord}
                  desc={rel.shortDesc}
                  topics={[rel.heroMetrics[0].label]}
                  actionLabel="Open Module"
                  onClick={() => onNavigate({ type: 'product', slug: relSlug })}
                  index={idx}
                />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
