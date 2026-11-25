import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Cookie,
  FileText,
  Globe,
  Handshake,
  HelpCircle,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  PhoneCall,
  Send,
  Shield,
  Sparkles,
  Star,
  Users,
  X,
  Zap,
} from 'lucide-react';
import './CompanyModal.css';

// 12 deterministic rising glowing backdrop particles
const BACKDROP_PARTICLES = [
  { left: '8%', delay: '0s', duration: '5.8s', color: '#dc2626' },
  { left: '16%', delay: '1.1s', duration: '6.4s', color: '#f97316' },
  { left: '24%', delay: '0.5s', duration: '7.0s', color: '#fbbf24' },
  { left: '33%', delay: '2.0s', duration: '6.1s', color: '#dc2626' },
  { left: '41%', delay: '0.8s', duration: '5.5s', color: '#f97316' },
  { left: '49%', delay: '1.6s', duration: '6.8s', color: '#dc2626' },
  { left: '58%', delay: '0.3s', duration: '6.2s', color: '#f97316' },
  { left: '66%', delay: '2.4s', duration: '5.9s', color: '#fbbf24' },
  { left: '74%', delay: '1.3s', duration: '6.6s', color: '#dc2626' },
  { left: '82%', delay: '0.7s', duration: '5.7s', color: '#f97316' },
  { left: '89%', delay: '1.9s', duration: '6.3s', color: '#dc2626' },
  { left: '95%', delay: '0.2s', duration: '6.9s', color: '#f97316' },
];

export const FAQItem = ({ question, answer, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-[#fb923c] transition-colors cursor-pointer"
      >
        <span>{question}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[#f97316] shrink-0"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 text-xs text-slate-300 leading-relaxed border-t border-white/5">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MODAL_METADATA = {
  'About Us': {
    title: 'About SomBill Hospitality OS',
    tagline: 'Trusted Hospitality Partner · Horn of Africa & Beyond',
    icon: <Building2 size={24} />,
    callout:
      'SomBill is the all-in-one POS, Hotel PMS, Smart NFC/QR Ordering, Kitchen Display (KDS), and Multi-Currency Financial platform purpose-built for restaurants, cafés, and hotels.',
  },
  Careers: {
    title: 'Careers at SomBill',
    tagline: 'Build Mission-Critical Hospitality Infrastructure With Us',
    icon: <Briefcase size={24} />,
    callout:
      'Join our fast-growing engineering, product design, and regional hospitality deployment teams across Hargeisa, Berbera, Burao, Borama, and Mogadishu.',
  },
  'Help Center': {
    title: '24/7 SomBill Help Center',
    tagline: 'Instant Hospitality Support · <15 Minute Priority SLA',
    icon: <HelpCircle size={24} />,
    callout:
      'Our dedicated field and remote hospitality engineers are available 24/7 via WhatsApp, phone, and live chat so your dining floor and front desk never stop.',
  },
  'Partner Network': {
    title: 'SomBill Partner Network',
    tagline: 'Telecom, Hardware & Certified Channel Ecosystem',
    icon: <Handshake size={24} />,
    callout:
      'We collaborate with leading East African telecom mobile money providers, thermal hardware manufacturers, and certified regional IT consultants.',
  },
  'Privacy Policy': {
    title: 'Privacy Policy & Data Protection',
    tagline: 'Enterprise-Grade Hospitality Data Governance',
    icon: <Shield size={24} />,
    callout:
      'Your venue sales, guest folios, recipes, and mobile money merchant credentials are protected with bank-grade AES-256 encryption and strict tenant isolation.',
  },
  'Terms of Use': {
    title: 'Terms of Use & SLA Agreement',
    tagline: 'Transparent Commercial Licensing & 99.9% Uptime SLA',
    icon: <FileText size={24} />,
    callout:
      'Clear, fair subscription terms designed for single cafés, full-service restaurants, luxury hotels, and multi-branch hospitality franchises.',
  },
  'Cookie Policy': {
    title: 'POS & Web Cookie Policy',
    tagline: 'Session Security, Offline Cache & Telemetry Transparency',
    icon: <Cookie size={24} />,
    callout:
      'SomBill uses strictly scoped browser cookies and local storage tokens to keep your POS terminals authenticated, synced offline, and responsive.',
  },
};

export const CompanyModal = ({ activeModal, onClose, onNavigateContact, onOpenDemoModal, onToast }) => {
  // Lock body scroll and bind Escape key when open
  useEffect(() => {
    if (!activeModal) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModal, onClose]);

  const meta = activeModal ? MODAL_METADATA[activeModal] || MODAL_METADATA['About Us'] : null;

  return (
    <AnimatePresence>
      {activeModal && meta && (
        <motion.div
          key="sombill-company-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          className="cm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={meta.title}
        >
          {/* 12 Rising Glowing Backdrop Particles */}
          {BACKDROP_PARTICLES.map((p, idx) => (
            <span
              key={idx}
              className="cm-bp"
              style={{
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.duration,
                background: p.color,
                boxShadow: `0 0 12px ${p.color}`,
              }}
              aria-hidden="true"
            />
          ))}

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="cm-panel"
          >
            <div className="cm-top-beam" />
            <div className="cm-glow" />

            {/* Modal Header */}
            <div className="cm-header">
              <div className="flex items-center gap-4 min-w-0">
                <div className="cm-icon-ring">{meta.icon}</div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white truncate">{meta.title}</h2>
                  <p className="text-xs font-mono text-[#fb923c] truncate mt-0.5">{meta.tagline}</p>
                </div>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                className="cm-close-btn"
                aria-label="Close modal"
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="cm-body">
              {/* Hero Callout Bar */}
              <div className="cm-callout">{meta.callout}</div>

              {/* 1. ABOUT US CONTENT */}
              {activeModal === 'About Us' && (
                <div className="space-y-5">
                  {/* 4 KPI Stat Boxes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { val: '2021', label: 'Founded' },
                      { val: '500+', label: 'Partners' },
                      { val: '2.5M+', label: 'Bills Issued' },
                      { val: '4.9★', label: 'Client Rating' },
                    ].map((k, i) => (
                      <div key={i} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                        <div className="text-lg sm:text-xl font-extrabold font-mono gradient-text">{k.val}</div>
                        <div className="text-[11px] text-slate-400 font-semibold mt-0.5">{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Mission / Vision / Why SomBill Slide Cards */}
                  <div className="space-y-2.5">
                    {[
                      {
                        title: 'Our Mission',
                        desc: 'Empower every restaurant, café, and hotel across the Horn of Africa with lightning-fast, offline-resilient POS & hospitality billing.',
                      },
                      {
                        title: 'Our Vision',
                        desc: 'Unify tabletop NFC guest ordering, multi-station kitchen displays, hotel room folios, and instant Zaad/EVC/eDahab mobile money into one cloud OS.',
                      },
                      {
                        title: 'Why SomBill Wins',
                        desc: 'Unlike generic overseas POS software, SomBill handles simultaneous USD + Shilling ledgers, 14ms LAN offline sync, and bilingual Somali/English workflows natively.',
                      },
                    ].map((item, idx) => (
                      <div key={idx} className="cm-card-slide">
                        <div className="text-xs font-extrabold text-[#fb923c] uppercase tracking-wider">
                          {item.title}
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Core Leadership Grid */}
                  <div>
                    <div className="text-xs font-mono font-bold text-slate-400 uppercase mb-2.5">
                      Executive & Engineering Leadership
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          name: 'Mahad SomBill',
                          role: 'Founder & Chief Architect',
                          tag: 'Hospitality Cloud & POS',
                        },
                        {
                          name: 'Mohamed Sheikh',
                          role: 'VP of Hospitality Operations',
                          tag: 'Enterprise Hotels & Chains',
                        },
                        {
                          name: 'Eng. Khadra Cali',
                          role: 'Head of Offline Mesh & KDS',
                          tag: 'LAN Sync & NFC Hardware',
                        },
                      ].map((leader, i) => (
                        <div key={i} className="cm-grid-card">
                          <div className="text-xs font-extrabold text-white">{leader.name}</div>
                          <div className="text-[11px] font-mono text-[#f97316] mt-0.5">{leader.role}</div>
                          <div className="text-[10.5px] text-slate-400 mt-1.5">{leader.tag}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Headquarters Location Bar */}
                  <div className="p-3.5 rounded-xl bg-[#f97316]/10 border border-[#f97316]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <MapPin size={15} className="text-[#f97316] shrink-0" />
                      <span>
                        HQ: 26 June District, Presidential Road, Hargeisa · Offices in Berbera, Burao & Mogadishu
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#fdba74]">ISO-Compliant Cloud</span>
                  </div>
                </div>
              )}

              {/* 2. CAREERS CONTENT */}
              {activeModal === 'Careers' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        title: 'Ownership & Speed',
                        desc: 'Ship real features used by thousands of cashiers, waiters, and chefs every single day.',
                      },
                      {
                        title: 'Competitive USD Pay',
                        desc: 'Attractive USD compensation, hardware allowance, and performance bonuses.',
                      },
                      {
                        title: 'Field & Lab Impact',
                        desc: 'Work directly with flagship hotels, steakhouses, and resorts across East Africa.',
                      },
                    ].map((c, i) => (
                      <div key={i} className="cm-grid-card">
                        <div className="text-xs font-extrabold text-[#fb923c]">{c.title}</div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{c.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2.5">
                    <div className="text-xs font-mono font-bold text-slate-400 uppercase">
                      Open Positions (Hargeisa / Mogadishu / Remote)
                    </div>
                    {[
                      {
                        role: 'Senior Full-Stack POS Engineer (React / Node / Offline Sync)',
                        loc: 'Hargeisa / Hybrid · Full-Time',
                        badge: 'Hot 🔥',
                      },
                      {
                        role: 'Hospitality Implementation & Hardware Specialist (80mm / KDS)',
                        loc: 'Hargeisa & Berbera · Full-Time',
                        badge: 'New ✨',
                      },
                      {
                        role: 'Enterprise Hotel & Restaurant Account Executive',
                        loc: 'Mogadishu / Hargeisa · Full-Time',
                        badge: 'Hot 🔥',
                      },
                    ].map((job, idx) => (
                      <div key={idx} className="cm-card-slide flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-white">{job.role}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{job.loc}</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-[#f97316]/15 border border-[#f97316]/35 text-[10.5px] font-mono font-bold text-[#fdba74]">
                          {job.badge}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-400">Ready to build the future of hospitality technology?</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (onToast) {
                          onToast('Careers Portal: Please attach your CV or LinkedIn link in our Contact form!');
                        }
                        onClose();
                        if (onNavigateContact) onNavigateContact();
                      }}
                      className="btn-sombill-grad px-5 py-2.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Send size={13} />
                      <span>Send Your CV</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. HELP CENTER CONTENT */}
              {activeModal === 'Help Center' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        icon: <Mail size={16} className="text-[#f97316]" />,
                        title: 'Email Support',
                        sub: 'support@sombill.com',
                        action: 'Send Email →',
                        onClick: () => {
                          if (onToast) onToast('Support ticket routing to support@sombill.com');
                          onClose();
                          if (onNavigateContact) onNavigateContact();
                        },
                      },
                      {
                        icon: <MessageSquare size={16} className="text-emerald-400" />,
                        title: '24/7 Live Chat',
                        sub: 'SomBill AI & Engineers',
                        action: 'Start Chat →',
                        onClick: () => {
                          if (onToast) {
                            onToast('24/7 Live Support active — use the SomBill AI widget in the bottom-right corner!');
                          }
                          onClose();
                        },
                      },
                      {
                        icon: <PhoneCall size={16} className="text-[#fbbf24]" />,
                        title: 'WhatsApp / Phone',
                        sub: '+252 63 440 8910',
                        action: 'Request Callback →',
                        onClick: () => {
                          if (onToast) onToast('Priority WhatsApp callback requested (+252 63 440 8910)');
                          onClose();
                          if (onOpenDemoModal) onOpenDemoModal();
                        },
                      },
                    ].map((ch, idx) => (
                      <div key={idx} className="cm-grid-card flex flex-col justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 font-bold text-xs text-white">
                            {ch.icon}
                            <span>{ch.title}</span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">{ch.sub}</div>
                        </div>
                        <button
                          type="button"
                          onClick={ch.onClick}
                          className="text-left text-[11px] font-bold text-[#fb923c] hover:text-white cursor-pointer"
                        >
                          {ch.action}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2.5">
                    <div className="text-xs font-mono font-bold text-slate-400 uppercase">
                      Frequently Asked Support Questions
                    </div>
                    <FAQItem
                      defaultOpen
                      question="What happens if our restaurant Wi-Fi or fiber internet drops during dinner rush?"
                      answer="SomBill's Hybrid Offline-First Engine keeps your Cashier POS, Waiter tablets, and Kitchen Display Screens (KDS) running at 100% speed over your local LAN router. All bills and thermal receipts print normally and sync to the cloud automatically once internet restores."
                    />
                    <FAQItem
                      question="How fast can you migrate our existing menu and train our staff?"
                      answer="Our onboarding engineers digitize your complete menu, modifiers, table floor plan, and tax settings in under 24 hours, followed by hands-on staff training in Somali and English."
                    />
                    <FAQItem
                      question="Which thermal printers and mobile money wallets are supported?"
                      answer="SomBill supports all standard 80mm & 58mm USB/LAN/Bluetooth thermal printers, cash drawers, barcode scanners, and native Zaad, EVC Plus, eDahab, Sahal, and Visa/Mastercard settlement."
                    />
                  </div>
                </div>
              )}

              {/* 4. PARTNER NETWORK CONTENT */}
              {activeModal === 'Partner Network' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      {
                        title: 'Telecom & Mobile Money Partners',
                        badge: 'API Integrated',
                        desc: 'Direct USSD push & merchant reconciliation with Telesom ZAAD, Hormuud EVC Plus, Somtel e-Dahab, and Golis Sahal.',
                      },
                      {
                        title: 'POS & Thermal Hardware Vendors',
                        badge: 'Certified Kits',
                        desc: 'Turnkey touchscreen terminals, 80mm autocutter kitchen printers, and NTAG215 waterproof NFC table coasters.',
                      },
                      {
                        title: 'Certified IT & Reseller Channel',
                        badge: '20% Recurring Rev',
                        desc: 'Regional IT consultancies and hospitality advisors earning recurring commission deploying SomBill in their city.',
                      },
                      {
                        title: 'Upcoming Live Webinars & Demos',
                        badge: 'Every Thursday',
                        desc: 'Weekly live masterclasses on reducing kitchen food cost by 24% and speeding up table turnover.',
                      },
                    ].map((p, i) => (
                      <div key={i} className="cm-grid-card space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-white">{p.title}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[#f97316]/15 border border-[#f97316]/35 text-[10px] font-mono font-bold text-[#fdba74]">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{p.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (onToast) onToast('Opening SomBill Partner & Demo Registration...');
                        onClose();
                        if (onOpenDemoModal) onOpenDemoModal();
                      }}
                      className="btn-sombill-grad px-5 py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer"
                    >
                      Join Partner Network / Book Live Demo →
                    </button>
                  </div>
                </div>
              )}

              {/* 5. PRIVACY POLICY & TERMS OF USE CONTENT */}
              {(activeModal === 'Privacy Policy' || activeModal === 'Terms of Use') && (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f97316]/12 border border-[#f97316]/30 text-[11px] font-mono text-[#fdba74]">
                    <Calendar size={12} />
                    <span>Last Updated: November 2026 · Version 2.4 Compliance</span>
                  </div>

                  <div className="space-y-3">
                    {(activeModal === 'Privacy Policy'
                      ? [
                          {
                            title: '1. End-to-End POS & Financial Data Encryption',
                            desc: 'All daily sales ledgers, Z-Reports, guest folios, and mobile money transaction references are encrypted in transit (TLS 1.3) and at rest (AES-256).',
                          },
                          {
                            title: '2. Strict Multi-Tenant Data Isolation',
                            desc: 'Your restaurant recipes, supplier pricing, and customer phone numbers belong 100% to your business and are never shared with third parties.',
                          },
                          {
                            title: '3. Role-Based Staff Access & Audit Trails',
                            desc: 'Granular PIN and role permissions ensure cashiers, waiters, and managers only access authorized modules, with immutable logs for every void or discount.',
                          },
                          {
                            title: '4. Data Portability & Export Rights',
                            desc: 'Owners can export complete historical invoices, tax ledgers, and inventory records in CSV, Excel, or PDF format at any time.',
                          },
                        ]
                      : [
                          {
                            title: '1. 99.9% Hybrid Cloud & Offline Uptime SLA',
                            desc: 'SomBill guarantees 99.9% cloud availability backed by 100% local LAN offline continuity so billing and kitchen printing never halt.',
                          },
                          {
                            title: '2. Transparent Subscription & Licensing Rules',
                            desc: 'Subscriptions are billed monthly or annually in USD or local Shillings with zero hidden transaction surcharges and a 14-day pilot trial.',
                          },
                          {
                            title: '3. Account Security & Authorized Terminals',
                            desc: 'Each licensed POS terminal and waiter tablet is bound to your verified venue tenant with instant remote revocation from the Super Manager console.',
                          },
                          {
                            title: '4. 24/7 Priority Hospitality Support Commitment',
                            desc: 'All active subscribers receive continuous software updates, tax ledger compliance updates, and 24/7 technical assistance.',
                          },
                        ]
                    ).map((item, idx) => (
                      <div key={idx} className="cm-card-slide flex items-start gap-3">
                        <CheckCircle2 size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-white">{item.title}</div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. COOKIE POLICY CONTENT */}
              {activeModal === 'Cookie Policy' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      {
                        title: 'Essential POS Cookies 🔒 Required',
                        code: 'sb_auth_session, sb_offline_queue',
                        desc: 'Maintains cashier & waiter PIN sessions, CSRF protection, and local IndexedDB offline order queuing.',
                      },
                      {
                        title: 'Performance & LAN Sync 📊',
                        code: 'sb_lan_mesh_node, sb_kds_latency',
                        desc: 'Monitors local router WebSocket latency (14ms target) between Cashier POS and Kitchen Display Screens.',
                      },
                      {
                        title: 'Functional Preferences ⚙️',
                        code: 'sb_lang_pref, sb_theme_mode, sb_fx_rate',
                        desc: 'Remembers your preferred language (English / Af-Soomaali), Dark/Light theme, and display currency (USD / SLSH).',
                      },
                      {
                        title: 'Anonymous Analytics 📣',
                        code: 'sb_ui_perf_metric',
                        desc: 'Helps our engineering team optimize touch-screen checkout speed and thermal receipt print formatting.',
                      },
                    ].map((ck, idx) => (
                      <div key={idx} className="cm-grid-card space-y-2">
                        <div className="text-xs font-extrabold text-white">{ck.title}</div>
                        <div>
                          <code className="px-2 py-0.5 rounded bg-black/50 border border-white/10 text-[10.5px] font-mono text-[#fb923c]">
                            {ck.code}
                          </code>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{ck.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompanyModal;
