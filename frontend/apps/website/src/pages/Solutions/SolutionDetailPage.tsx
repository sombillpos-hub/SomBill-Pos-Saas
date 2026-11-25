import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Language } from '../../utils/currency';
import { PRODUCT_PAGES, SOLUTION_PAGES, SolutionSlug, WebsitePageRoute } from '../../services/websiteData';
import { LivePosKdsDualSimulator } from '../../sections/WebsiteInteractiveSimulators';
import { DeptSolutionCard, FeatureCardPremium, SectionHeader, TintedIcon } from '../../components/ui/PremiumPrimitives';

interface SharedPageProps {
  lang: Language;
  exchangeRate: number;
  onNavigate: (route: WebsitePageRoute) => void;
  onOpenDemoModal: () => void;
  onLaunchLiveApp: (mode: 'cashier' | 'waiter' | 'manager' | 'admin') => void;
  onToast: (msg: string) => void;
}

/**
 * C. INDIVIDUAL SOLUTIONS LANDING PAGE (ALL 7 SOLUTIONS — 8 CARD ARCHETYPES)
 */
export const WebsiteSolutionDetailPage: React.FC<SharedPageProps & { slug: SolutionSlug }> = ({
  slug,
  lang,
  exchangeRate,
  onNavigate,
  onOpenDemoModal,
  onLaunchLiveApp,
  onToast,
}) => {
  const solution = SOLUTION_PAGES[slug] || SOLUTION_PAGES.restaurants;

  return (
    <div className="space-y-20 pb-16">
      {/* Solution Hero */}
      <section className="pt-8 sm:pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="cta-glass-card p-8 sm:p-14 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-5">
              <div className="section-eyebrow">
                <span className="eyebrow-line" />
                <span>{solution.badge}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white [.light-theme_&]:text-slate-900 text-balance">
                {lang === 'so' ? solution.titleSo : solution.title}
              </h1>
              <p className="text-sm sm:text-base text-slate-300 [.light-theme_&]:text-slate-600 leading-relaxed max-w-2xl">
                {solution.subtitle}
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onOpenDemoModal}
                  className="btn-sombill-grad px-6 py-3.5 rounded-xl text-white font-bold text-xs sm:text-sm cursor-pointer"
                >
                  Schedule a Tailored {solution.badge.split(' ')[0]} Demo
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchLiveApp('cashier')}
                  className="btn-shimmer-sweep relative overflow-hidden px-5 py-3.5 rounded-xl bg-white/10 text-white font-bold text-xs sm:text-sm border border-white/20 cursor-pointer"
                >
                  Open Live POS Workspace →
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 rounded-2xl bg-black/40 border border-[#f97316]/30 p-6 text-center space-y-3">
              <div className="flex justify-center">
                <TintedIcon icon={solution.iconName} index={1} size="lg" />
              </div>
              <div className="text-4xl sm:text-5xl font-extrabold font-mono gradient-text">{solution.heroStat}</div>
              <div className="text-xs text-slate-300 font-medium">{solution.heroStatLabel}</div>
              <div className="pt-3 border-t border-white/15 text-[11px] font-mono text-emerald-400">
                Recommended Tier: {solution.recommendedPlan}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Challenges Solved — Archetype 3 (.feature-card-premium) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <SectionHeader
          eyebrow="Operational Bottlenecks Eliminated"
          titleBefore="How SomBill Solves Your Daily"
          titleGradient="Floor & Kitchen Challenges"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {solution.challenges.map((ch, idx) => (
            <FeatureCardPremium
              key={idx}
              icon="bolt"
              badge={`0${idx + 1}. Solved`}
              title={ch.problem}
              desc={ch.solution}
              bullets={['Verified SomBill Architecture']}
              index={idx}
            />
          ))}
        </div>
      </section>

      {/* Tailored Workflow & Modules — Archetype 2 (.dept-card-premium) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <div className="premium-waali-card rounded-3xl p-6 sm:p-10 space-y-8">
          <h2 className="text-2xl font-extrabold text-white [.light-theme_&]:text-slate-900">
            {solution.workflowTitle}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {solution.workflowStages.map((ws, i) => (
              <FeatureCardPremium
                key={i}
                icon={solution.iconName}
                badge={`Stage 0${i + 1}`}
                title={ws.title}
                desc={ws.detail}
                index={i}
              />
            ))}
          </div>

          <div className="pt-4 border-t border-white/10">
            <h3 className="text-xs font-mono font-bold text-[#f97316] uppercase mb-4">
              Core Modules Included for This Venue Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {solution.tailoredModules.map((tm, idx) => (
                <DeptSolutionCard
                  key={tm.slug}
                  icon={PRODUCT_PAGES[tm.slug]?.iconName || 'point_of_sale'}
                  badge="Included Module"
                  title={tm.title}
                  desc={tm.desc}
                  topics={['Offline LAN Ready', 'Dual-Currency USD/SLSH']}
                  actionLabel="Explore Module"
                  onClick={() => onNavigate({ type: 'product', slug: tm.slug })}
                  index={idx}
                />
              ))}
            </div>
          </div>
        </div>

        <LivePosKdsDualSimulator
          lang={lang}
          exchangeRate={exchangeRate}
          onToast={onToast}
          onLaunchLiveApp={onLaunchLiveApp}
        />
      </section>
    </div>
  );
};
