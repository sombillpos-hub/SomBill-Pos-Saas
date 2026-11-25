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
 * F. INDIVIDUAL COMPANY LANDING PAGES (ALL 6 COMPANY PAGES)
 */
export const WebsiteCompanyDetailPage: React.FC<Part2Props & { slug: CompanySlug }> = ({ slug, onToast }) => {
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('+252 63 ');
  const [contactMessage, setContactMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Partner commission estimator
  const [referralsPerMonth, setReferralsPerMonth] = useState(4);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;
    setSubmitted(true);
    onToast(`Thank you ${contactName.trim()} — our SomBill team has received your submission!`);
  };

  return (
    <div className="space-y-16 pb-16 pt-8 sm:pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Banner — Archetype 8 Wide Glass Card */}
      <div className="stats-glass-card space-y-4">
        <div className="section-eyebrow">
          <span className="eyebrow-line" />
          <span>SomBill Technologies Co. · Horn of Africa Hospitality OS</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl text-white [.light-theme_&]:text-slate-900 text-balance">
          {slug === 'about' && 'Engineering the Digital Future of Horn of Africa Hospitality'}
          {slug === 'why-sombill' && 'Why Leading Restaurants & Hotels Choose SomBill Over Legacy POS'}
          {slug === 'contact' && 'Get in Touch with Our Regional Hospitality Engineers'}
          {slug === 'partners' && 'Our Telecom, Hardware & Hospitality Partner Ecosystem'}
          {slug === 'careers' && 'Build Mission-Critical Hospitality Technology with Us'}
          {slug === 'become-partner' && 'Become a Certified SomBill Reseller & Implementation Partner'}
        </h1>
        <p className="text-sm sm:text-base text-slate-300 [.light-theme_&]:text-slate-600 max-w-2xl leading-relaxed">
          Headquartered in Hargeisa with regional deployment teams serving Berbera, Burao, Borama, Mogadishu, and the
          wider East African hospitality corridor.
        </p>
      </div>

      {/* Tailored Content by Company Slug */}
      {slug === 'why-sombill' ? (
        <div className="stats-glass-card space-y-6">
          <h2 className="text-2xl font-extrabold text-white [.light-theme_&]:text-slate-900">
            SomBill OS vs. <span className="gradient-text">Generic Imported POS Systems</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3.5 px-4 font-bold">Operational Requirement</th>
                  <th className="py-3.5 px-4 font-bold text-[#f97316] bg-[#f97316]/10">SomBill Hospitality OS</th>
                  <th className="py-3.5 px-4 font-bold text-slate-400">Generic Overseas Cloud POS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <tr>
                  <td className="py-3.5 px-4 font-bold">Telesom ZAAD & e-Dahab USSD Push</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">✓ Native 3.4-second API Push</td>
                  <td className="py-3.5 px-4 text-slate-400">Not supported (manual entry)</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold">Dual-Currency USD + SLSH Ledger</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">✓ Live simultaneous display & change math</td>
                  <td className="py-3.5 px-4 text-slate-400">Single currency only</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold">Internet Outage Resilience</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">✓ 100% Local LAN Mesh (POS + Waiter + KDS)</td>
                  <td className="py-3.5 px-4 text-slate-400">Freezes when internet drops</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold">Bilingual Somali & English Interface</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">✓ 1-Click EN / SO Switcher Everywhere</td>
                  <td className="py-3.5 px-4 text-slate-400">English only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : slug === 'become-partner' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 stats-glass-card space-y-5">
            <div className="section-eyebrow">
              <span className="eyebrow-line" />
              <span>Partner Commission Estimator</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white [.light-theme_&]:text-slate-900">
              Earn Recurring Revenue Deploying SomBill in Your City
            </h2>
            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span>New Venues Referred / Installed Per Month</span>
                <span className="font-mono text-[#f97316]">{referralsPerMonth} Venues / mo</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={referralsPerMonth}
                onChange={(e) => setReferralsPerMonth(Number(e.target.value))}
                className="w-full accent-[#f97316]"
              />
            </div>
            <div className="p-5 rounded-2xl bg-black/40 border border-white/10">
              <div className="text-xs text-slate-400">Estimated Partner Commission + Setup Fee</div>
              <div className="text-3xl font-extrabold font-mono gradient-text mt-1">
                ${(referralsPerMonth * 240).toLocaleString('en-US')} USD / mo
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 stats-glass-card">
            <h3 className="text-lg font-extrabold text-white [.light-theme_&]:text-slate-900 mb-4">
              Apply to Become a Certified Partner
            </h3>
            {submitted ? (
              <div className="py-8 text-center text-sm font-bold text-emerald-400">
                ✓ Partner application received! Our channel team will reach out today.
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your Name / IT Consultancy Name"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs"
                />
                <input
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+252 63 ..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs font-mono"
                />
                <textarea
                  rows={3}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Tell us about your city and hospitality or IT installation experience..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs"
                />
                <button
                  type="submit"
                  className="btn-sombill-grad w-full py-3 rounded-xl text-white font-bold text-xs cursor-pointer"
                >
                  Submit Partner Application
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Archetype 6: Team / Partner / Regional Hub Profile Cards (.instructor-card) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: 'Hargeisa Headquarters',
                role: '26 June District · Presidential Rd',
                sub: 'Primary engineering lab, NTAG215 NFC provisioning center, and 24/7 enterprise hospitality command desk.',
                icon: 'domain',
                tags: ['Core Engineering', 'Hardware Lab'],
                statLeft: '85+ Active Venues',
                statRight: '< 45m On-Site SLA',
              },
              {
                title: 'Berbera & Coastal Hub',
                role: 'Port Corridor & Beach Resorts',
                sub: 'Dedicated coastal hospitality specialists serving waterfront seafood restaurants, port hotels, and resorts.',
                icon: 'storefront',
                tags: ['Resort PMS', 'Waterproof NFC'],
                statLeft: '18+ Coastal Venues',
                statRight: '24/7 Support',
              },
              {
                title: 'Burao & Borama Desks',
                role: 'Regional Field Engineering',
                sub: 'Local on-site staff training in Somali & English, thermal printer servicing, and instant NFC kit delivery.',
                icon: 'handshake',
                tags: ['Staff Training', 'LAN Mesh Setup'],
                statLeft: '24+ Regional Venues',
                statRight: 'Same-Day Setup',
              },
              {
                title: '24/7 Hospitality SLA Team',
                role: 'Direct WhatsApp & Field Engineers',
                sub: 'Mission-critical support during peak lunch, dinner, and Ramadan Iftar rushes with zero downtime tolerance.',
                icon: 'support_agent',
                tags: ['99.98% Uptime', 'ZAAD & e-Dahab'],
                statLeft: '3.4s Settlement',
                statRight: 'Verified SLA',
              },
            ].map((hub, i) => (
              <ProfilePartnerCard
                key={i}
                iconOrInitials={hub.icon}
                name={hub.title}
                role={hub.role}
                bio={hub.sub}
                tags={hub.tags}
                statLeft={hub.statLeft}
                statRight={hub.statRight}
              />
            ))}
          </div>

          <div className="lg:col-span-5 stats-glass-card">
            <h3 className="text-lg font-extrabold text-white [.light-theme_&]:text-slate-900 mb-4">
              Send a Direct Message to SomBill HQ
            </h3>
            {submitted ? (
              <div className="py-8 text-center text-sm font-bold text-emerald-400">
                ✓ Message delivered! Our team will respond within 2 hours.
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your Full Name & Venue"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs"
                />
                <input
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="WhatsApp / ZAAD Number (+252...)"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs font-mono"
                />
                <textarea
                  rows={3}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="How can our hospitality engineers help your business?"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs"
                />
                <button
                  type="submit"
                  className="btn-sombill-grad w-full py-3 rounded-xl text-white font-bold text-xs cursor-pointer"
                >
                  Send Message to SomBill HQ
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2026 Premium Glass Accordion FAQs on Contact Page */}
      {slug === 'contact' && (
        <div className="pt-6">
          <PremiumFaqSection onContactClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </div>
      )}
    </div>
  );
};
