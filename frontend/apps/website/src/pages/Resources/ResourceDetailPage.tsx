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
 * D. INDIVIDUAL RESOURCES LANDING PAGES (ALL 7 RESOURCES)
 */
export const WebsiteResourceDetailPage: React.FC<Part2Props & { slug: ResourceSlug }> = ({
  slug,
  lang,
  onNavigate,
  onOpenDemoModal,
  onToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<string>(BLOG_POSTS[0].id);
  const [activeDocChapter, setActiveDocChapter] = useState<number>(0);
  const [activeTutorialIdx, setActiveTutorialIdx] = useState<number>(0);

  const selectedArticle = BLOG_POSTS.find((b) => b.id === selectedArticleId) || BLOG_POSTS[0];

  const docChapters = [
    {
      title: '01. Local LAN Offline Mesh Architecture',
      summary: 'Configuring local static IPs and WebSocket sync across POS, Waiter tablets, and KDS.',
      body: 'SomBill OS uses a primary-replica local mesh inside your restaurant router. Even if external fiber or 4G disconnects, Terminal #01 acts as the local coordinator so Waiter tablets and Kitchen Display Screens exchange tickets in <15ms. When internet restores, encrypted delta batches push to SomBill Cloud automatically.',
      checklist: [
        'Assign static DHCP lease to Main Cashier Terminal (#01)',
        'Connect Thermal Kitchen Printers via RJ45 Ethernet on subnet 192.168.1.x',
        'Verify green "Live • 14ms" indicator on top command bar',
      ],
    },
    {
      title: '02. Telesom ZAAD & Dahabshiil e-Dahab USSD Push Setup',
      summary: 'Binding your merchant shortcodes and configuring automatic payment callbacks.',
      body: 'Connect your official Telesom ZAAD (*880#) and Somtel/Dahabshiil e-Dahab (*770#) merchant numbers under Settings -> Regional Payments. Cashiers can trigger direct mobile push prompts or display dynamic QR codes on the customer-facing screen.',
      checklist: [
        'Enter verified ZAAD Merchant Till ID and API webhook secret',
        'Enable Dual-Currency auto-conversion for SLSH mobile wallets',
        'Test $1.00 / 11,801 SLSH sandbox push transaction',
      ],
    },
    {
      title: '03. Dual-Currency (USD / SLSH) & MOF 4.8% VAT Ledger',
      summary: 'Managing daily exchange rates, rounding rules, and Z-Report shift handovers.',
      body: 'SomBill maintains base prices in USD while computing real-time Somaliland Shilling (SLSH) equivalents across all screens. Cashiers can toggle the Somaliland Ministry of Finance 4.8% VAT switch or mark diplomatic tickets as Tax-Exempt with full audit logging.',
      checklist: [
        'Configure daily branch exchange rate (e.g., 1 USD = 11,801 SLSH)',
        'Set opening cash float for USD notes and 500k SLSH bundles',
        'Print Shift X-Report at handover and Z-Report at night closeout',
      ],
    },
    {
      title: '04. NTAG215 Smart NFC Table Puck Provisioning',
      summary: 'Encoding cryptographic table URLs and QR fallback codes.',
      body: 'Each SomBill walnut or aluminum table puck contains an NTAG215 NFC tag encoded with your venue slug and cryptographic table token. Guests tap their iPhone or Android phone to launch the PWA menu in under 0.8 seconds with zero app installation.',
      checklist: [
        'Generate Table Tokens in Super Manager -> Tables',
        'Write NTAG215 payload and lock tag to read-only mode',
        'Test guest buzzer call ("Needs Water & Bill") to Waiter Floor POS',
      ],
    },
  ];

  const videoTutorials = [
    {
      title: 'Masterclass 01: Fast Cashier Checkout, Split Bills & ZAAD Push',
      duration: '04:15',
      role: 'Cashier Terminal #02',
      steps: [
        'Select incoming table ticket (#SB-8924) from the Ready to Pay queue',
        'Apply optional -5% / -10% discount or toggle MOF 4.8% VAT',
        'Choose Telesom ZAAD, enter customer phone (+252 63...), and click Send Push',
        'Or select $50 USD quick tender note to view instant USD & SLSH change due',
      ],
    },
    {
      title: 'Masterclass 02: Waiter Floor Map & Guest Buzzer Queue',
      duration: '03:40',
      role: 'Floor Server Tablet',
      steps: [
        'Monitor real-time Customer Calls & Guest Buzzers at the top of the screen',
        'Click Mark Done / Dhamee to acknowledge VIP Majlis requests',
        'Tap any Occupied table to add second-round drinks or fire to Kitchen KDS',
      ],
    },
    {
      title: 'Masterclass 03: Super Manager Menu Pricing & Shift Z-Reports',
      duration: '05:20',
      role: 'Super Manager Console',
      steps: [
        'Update the daily USD-to-SLSH exchange rate in 1 click',
        'Toggle any sold-out dish to Unavailable (86) across all channels',
        'Audit Morning and Evening shift cash drawers with zero variance',
      ],
    },
  ];

  return (
    <div className="space-y-16 pb-16 pt-8 sm:pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Resource Header — Archetype 8 Wide Glass Card */}
      <div className="stats-glass-card space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="section-eyebrow">
              <span className="eyebrow-line" />
              <span>SomBill Knowledge & Resource Center · {slug.replace('-', ' ')}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white [.light-theme_&]:text-slate-900">
              {slug === 'blog' && 'Hospitality Engineering & Operations Blog'}
              {slug === 'help-center' && '24/7 SomBill Help Center & Troubleshooting'}
              {slug === 'documentation' && 'Technical & Operational Documentation'}
              {slug === 'video-tutorials' && 'Interactive Video Masterclasses & Staff Training'}
              {slug === 'faqs' && 'Complete Frequently Asked Questions Directory'}
              {slug === 'case-studies' && 'Horn of Africa Hospitality Operational Blueprints'}
              {slug === 'product-updates' && 'SomBill OS Product Updates & Release Changelog'}
            </h1>
          </div>

          <div className="w-full sm:w-72 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides, docs, topics..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs font-medium"
            />
          </div>
        </div>

        {/* Sub-navigation across all 7 Resource pages */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10 relative z-10">
          {(
            [
              { id: 'blog', label: 'Blog' },
              { id: 'help-center', label: 'Help Center' },
              { id: 'documentation', label: 'Documentation' },
              { id: 'video-tutorials', label: 'Video Tutorials' },
              { id: 'faqs', label: 'FAQs' },
              { id: 'case-studies', label: 'Case Studies' },
              { id: 'product-updates', label: 'Product Updates' },
            ] as { id: ResourceSlug; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSearchQuery('');
                onNavigate({ type: 'resource', slug: tab.id });
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                slug === tab.id
                  ? 'btn-sombill-grad text-white'
                  : 'bg-white/5 [.light-theme_&]:bg-slate-100 text-slate-300 [.light-theme_&]:text-slate-700 hover:border-[#f97316]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. BLOG VIEW — Archetype 2 (.dept-card-premium) + Archetype 8 Reader */}
      {slug === 'blog' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-4">
            {BLOG_POSTS.filter(
              (b) =>
                !searchQuery ||
                b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.excerpt.toLowerCase().includes(searchQuery.toLowerCase()),
            ).map((post, idx) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedArticleId(post.id)}
                className={`dept-card-premium w-full text-left !p-5 transition-all cursor-pointer ${
                  selectedArticle.id === post.id ? '!border-[#f97316]' : ''
                }`}
                style={{ '--card-accent': getAccentByIndex(idx) } as React.CSSProperties}
              >
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1.5 relative z-10">
                  <span className="font-bold text-[#f97316]">{post.category}</span>
                  <span>·</span>
                  <span>{post.date}</span>
                  <span>·</span>
                  <span>{post.readTime}</span>
                </div>
                <h3 className="font-bold text-sm text-white [.light-theme_&]:text-slate-900 relative z-10">
                  {lang === 'so' ? post.titleSo : post.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 relative z-10">{post.excerpt}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-7 stats-glass-card space-y-6">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-bold text-[#f97316]">{selectedArticle.category}</span>
              <span>·</span>
              <span>{selectedArticle.date}</span>
              <span>·</span>
              <span>{selectedArticle.readTime}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white [.light-theme_&]:text-slate-900 leading-snug">
              {lang === 'so' ? selectedArticle.titleSo : selectedArticle.title}
            </h2>
            <div className="space-y-4 text-sm text-slate-300 [.light-theme_&]:text-slate-600 leading-relaxed">
              {selectedArticle.content.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            <div className="pt-6 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Want to deploy this architecture in your venue?</span>
              <button
                type="button"
                onClick={onOpenDemoModal}
                className="btn-sombill-grad px-4 py-2 rounded-xl text-white text-xs font-bold cursor-pointer"
              >
                Book Live Demo →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. DOCUMENTATION VIEW */}
      {slug === 'documentation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-2.5">
            {docChapters.map((ch, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveDocChapter(idx)}
                className={`w-full text-left p-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  activeDocChapter === idx
                    ? 'btn-sombill-grad text-white border-transparent'
                    : 'dept-card-premium !p-4 text-white [.light-theme_&]:text-slate-900'
                }`}
              >
                <div>{ch.title}</div>
                <div
                  className={`text-[11px] font-normal mt-1 ${
                    activeDocChapter === idx ? 'text-white/85' : 'text-slate-400'
                  }`}
                >
                  {ch.summary}
                </div>
              </button>
            ))}
          </div>
          <div className="lg:col-span-8 stats-glass-card space-y-6">
            <h2 className="text-2xl font-extrabold text-white [.light-theme_&]:text-slate-900">
              {docChapters[activeDocChapter].title}
            </h2>
            <p className="text-sm text-slate-300 [.light-theme_&]:text-slate-600 leading-relaxed">
              {docChapters[activeDocChapter].body}
            </p>
            <div className="p-5 rounded-2xl bg-black/30 [.light-theme_&]:bg-slate-50 border border-white/10 [.light-theme_&]:border-slate-200 space-y-3">
              <div className="text-xs font-mono font-bold text-[#f97316] uppercase">
                Implementation Verification Checklist
              </div>
              <ul className="space-y-2 text-xs text-slate-300 [.light-theme_&]:text-slate-700">
                {docChapters[activeDocChapter].checklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 3. VIDEO TUTORIALS VIEW */}
      {slug === 'video-tutorials' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-3">
            {videoTutorials.map((vid, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTutorialIdx(idx)}
                className={`dept-card-premium w-full text-left !p-5 transition-all cursor-pointer ${
                  activeTutorialIdx === idx ? '!border-[#f97316]' : ''
                }`}
              >
                <div className="flex items-center justify-between text-xs text-[#f97316] font-bold mb-1 relative z-10">
                  <span>{vid.role}</span>
                  <span className="font-mono">{vid.duration}</span>
                </div>
                <div className="font-bold text-sm text-white [.light-theme_&]:text-slate-900 relative z-10">
                  {vid.title}
                </div>
              </button>
            ))}
          </div>
          <div className="lg:col-span-7 stats-glass-card space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#fb923c]">
                INTERACTIVE TRAINING MODULE · {videoTutorials[activeTutorialIdx].duration}
              </span>
              <button
                type="button"
                onClick={() => onToast(`Playing "${videoTutorials[activeTutorialIdx].title}" walkthrough`)}
                className="btn-sombill-grad px-4 py-1.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Start Guided Walkthrough</span>
              </button>
            </div>
            <h2 className="text-2xl font-extrabold text-white [.light-theme_&]:text-slate-900">
              {videoTutorials[activeTutorialIdx].title}
            </h2>
            <div className="space-y-3 pt-2">
              {videoTutorials[activeTutorialIdx].steps.map((st, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-50 border border-white/10 [.light-theme_&]:border-slate-200 flex items-center gap-3 text-xs"
                >
                  <span className="w-6 h-6 rounded-full bg-gradient-to-r from-[#dc2626] to-[#f97316] text-white font-mono font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span>{st}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4A. FAQS DIRECTORY VIEW — 2026 Premium Glass Accordion */}
      {slug === 'faqs' && <PremiumFaqSection onContactClick={() => onNavigate({ type: 'company', slug: 'contact' })} />}

      {/* 4B. HELP CENTER, CASE STUDIES, PRODUCT UPDATES — Archetype 4: Media/Module Showcase Cards (.course-card-premium) */}
      {(slug === 'help-center' || slug === 'case-studies' || slug === 'product-updates') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              tag: slug === 'product-updates' ? 'v4.2 Release · Nov 2026' : 'Operational Blueprint 01',
              title:
                slug === 'product-updates'
                  ? 'Fast Cashier Terminal #02 & MOF 4.8% VAT Toggle'
                  : 'High-Volume Grill & Multi-Zone VIP Majlis Optimization',
              desc: 'Complete dual-currency USD/SLSH settlement queue with 1-tap Telesom ZAAD USSD push, quick tender notes ($50/$100/500k Sh), and Z-Report drawer closeout.',
              metric: '3.4 Sec Average Settlement Speed',
              icon: 'point_of_sale',
              tags: ['ZAAD USSD Push', 'USD + SLSH Ledger'],
            },
            {
              tag: slug === 'product-updates' ? 'v4.1 Release · Oct 2026' : 'Operational Blueprint 02',
              title:
                slug === 'product-updates'
                  ? 'Waiter Floor Mode & Real-Time Guest Buzzer Queue'
                  : 'Hotel Rooftop & In-Room Bedside NFC Coaster Rollout',
              desc: 'Prioritized guest service call queue sorted by wait time, visual floor occupancy matrix, and instant kitchen KDS ready alerts.',
              metric: '35% Faster Table Turnaround',
              icon: 'table_restaurant',
              tags: ['NTAG215 NFC', 'Guest Buzzer'],
            },
            {
              tag: slug === 'product-updates' ? 'v4.0 Release · Sep 2026' : 'Operational Blueprint 03',
              title:
                slug === 'product-updates'
                  ? 'Multi-Branch HQ Sync & Recipe BOM Depletion'
                  : 'Multi-City Café & Bakery Chain Inventory Control',
              desc: 'Centralized menu price pushing across Hargeisa, Berbera, and Burao outlets with real-time gram-level ingredient deduction.',
              metric: '24% Reduction in Kitchen Waste',
              icon: 'inventory_2',
              tags: ['Recipe Costing', 'Multi-Branch Sync'],
            },
          ].map((card, i) => (
            <CourseShowcaseCard
              key={i}
              index={i}
              categoryChip={card.tag}
              icon={card.icon}
              title={card.title}
              desc={card.desc}
              tags={card.tags}
              metricBadge={card.metric}
              actionLabel="Read Blueprint →"
              onClick={onOpenDemoModal}
            />
          ))}
        </div>
      )}
    </div>
  );
};
