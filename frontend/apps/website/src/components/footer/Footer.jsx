import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle,
  Cpu,
  Globe,
  Mail,
  MapPin,
  Receipt,
  Send,
  Shield,
  Star,
  TrendingUp,
  Utensils,
  Zap,
} from 'lucide-react';
import { FaFacebook, FaLinkedin, FaTwitter, FaWhatsapp, FaYoutube } from 'react-icons/fa';
import { CompanyModal } from './CompanyModal';
import './Footer.css';

const TOP_STATS = [
  { icon: <Building2 size={14} />, val: '500+', lbl: 'PARTNERS' },
  { icon: <Receipt size={14} />, val: '2.5M+', lbl: 'BILLS ISSUED' },
  { icon: <Zap size={14} />, val: '99.9%', lbl: 'UPTIME SLA' },
  { icon: <Star size={14} />, val: '4.9★', lbl: 'RATING' },
  { icon: <Shield size={14} />, val: '24/7', lbl: 'SUPPORT' },
  { icon: <Globe size={14} />, val: '15+', lbl: 'CITIES' },
];

const COMPANY_MODAL_LINKS = [
  'About Us',
  'Careers',
  'Help Center',
  'Partner Network',
  'Privacy Policy',
  'Terms of Use',
  'Cookie Policy',
];

const ECOSYSTEM_TAGS = ['Zaad', 'EVC Plus', 'eDahab', 'Visa/MC', 'Offline Sync', '80mm Thermal'];

export const Footer = ({ onNavigate, onOpenDemoModal, onToast }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [nlEmail, setNlEmail] = useState('');
  const [nlSubscribed, setNlSubscribed] = useState(false);

  const currentYear = new Date().getFullYear();

  const handlePlatformClick = (item) => {
    if (!onNavigate) return;
    switch (item) {
      case 'Home':
        onNavigate({ type: 'home' });
        break;
      case 'POS Features':
        onNavigate({ type: 'product', slug: 'restaurant-pos' });
        break;
      case 'Hotel & Restaurant':
        onNavigate({ type: 'solution', slug: 'hotels' });
        break;
      case 'Pricing Plans':
        onNavigate({ type: 'pricing' });
        break;
      case 'Hardware':
        onNavigate({ type: 'resource', slug: 'documentation' });
        break;
      case 'Request Demo':
        if (onOpenDemoModal) onOpenDemoModal();
        break;
      case 'Contact':
        onNavigate({ type: 'company', slug: 'contact' });
        break;
      default:
        onNavigate({ type: 'home' });
    }
  };

  const handleSolutionClick = (item) => {
    if (!onNavigate) return;
    switch (item) {
      case 'Restaurant & Cafe POS':
        onNavigate({ type: 'solution', slug: 'restaurants' });
        break;
      case 'Hotel & Room Billing':
        onNavigate({ type: 'solution', slug: 'hotels' });
        break;
      case 'Kitchen Display (KDS)':
        onNavigate({ type: 'product', slug: 'kds' });
        break;
      case 'Inventory & Recipes':
        onNavigate({ type: 'product', slug: 'inventory-management' });
        break;
      case 'Mobile Money (Zaad/EVC)':
        onNavigate({ type: 'product', slug: 'billing-payments' });
        break;
      case 'Multi-Branch Cloud':
        onNavigate({ type: 'product', slug: 'multi-branch' });
        break;
      case 'Thermal & Barcode POS':
        onNavigate({ type: 'product', slug: 'order-management' });
        break;
      default:
        onNavigate({ type: 'home' });
    }
  };

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (!nlEmail.trim() || !nlEmail.includes('@')) return;
    const email = nlEmail.trim();
    setNlSubscribed(true);
    void fetch('/api/v1/public/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {
      /* gracefully fall back when local API gateway is offline */
    });
    if (onToast) {
      onToast(`Subscribed ${email} to SomBill Hospitality & POS Updates!`);
    }
    setNlEmail('');
  };

  return (
    <>
      <footer className="pf-root">
        {/* 1. ATMOSPHERIC BACKGROUND LAYERS */}
        <div className="pf-bg" aria-hidden="true">
          <div className="pf-top-beam" />
          <div className="pf-glow-1" />
          <div className="pf-glow-2" />
          <div className="pf-grid" />
        </div>

        <div className="pf-container">
          {/* 2. TOP 6-ITEM HOSPITALITY STATS BAR */}
          <div className="pf-stats-bar">
            {TOP_STATS.map((item, idx) => (
              <div key={idx} className="pf-stat-item">
                <span className="pf-stat-icon">{item.icon}</span>
                <span className="pf-stat-val">{item.val}</span>
                <span className="pf-stat-lbl">{item.lbl}</span>
              </div>
            ))}
          </div>

          {/* 3. 5-COLUMN MAIN FOOTER GRID */}
          <div className="pf-main-grid">
            {/* Column 1: Brand Identity, Trust Pills & Spring Socials */}
            <div className="pf-brand-col">
              <div className="pf-brand-header">
                <div className="pf-logo-ring">
                  <img
                    src="/images/sombill-logo.jpeg"
                    alt="SomBill Logo"
                    referrerPolicy="no-referrer"
                    className="pf-logo-img"
                  />
                </div>
                <div>
                  <div className="pf-brand-name">SomBill</div>
                  <div className="pf-brand-sub">TRUSTED HOSPITALITY PARTNER</div>
                </div>
              </div>

              <p className="pf-brand-desc">
                SomBill is the leading all-in-one POS, Hotel PMS, Restaurant Billing, Smart NFC/QR Ordering, and
                Inventory platform engineered for modern hospitality venues.
              </p>

              {/* 3 Frosted Trust Badges */}
              <div className="pf-trust-row">
                <span className="pf-trust-pill">
                  <Shield size={11} />
                  <span>SSL & Cloud Secured</span>
                </span>
                <span className="pf-trust-pill">
                  <Award size={11} />
                  <span>Hospitality Certified</span>
                </span>
                <span className="pf-trust-pill">
                  <CheckCircle size={11} />
                  <span>Offline-First POS</span>
                </span>
              </div>

              {/* 5 Spring-Animated Social Buttons */}
              <div className="pf-socials">
                {[
                  {
                    icon: <FaFacebook size={15} />,
                    label: 'Facebook',
                    href: '#facebook',
                    sc: '#3b82f6',
                    glow: 'rgba(59, 130, 246, 0.35)',
                  },
                  {
                    icon: <FaWhatsapp size={15} />,
                    label: 'WhatsApp',
                    href: '#whatsapp',
                    sc: '#10b981',
                    glow: 'rgba(16, 185, 129, 0.35)',
                  },
                  {
                    icon: <FaLinkedin size={15} />,
                    label: 'LinkedIn',
                    href: '#linkedin',
                    sc: '#f97316',
                    glow: 'rgba(249, 115, 22, 0.35)',
                  },
                  {
                    icon: <FaTwitter size={15} />,
                    label: 'Twitter',
                    href: '#twitter',
                    sc: '#fbbf24',
                    glow: 'rgba(251, 191, 36, 0.35)',
                  },
                  {
                    icon: <FaYoutube size={15} />,
                    label: 'YouTube',
                    href: '#youtube',
                    sc: '#dc2626',
                    glow: 'rgba(220, 38, 38, 0.38)',
                  },
                ].map((soc, idx) => (
                  <motion.a
                    key={idx}
                    href={soc.href}
                    onClick={(e) => {
                      e.preventDefault();
                      if (onToast) onToast(`Connected to SomBill Official ${soc.label}`);
                    }}
                    whileHover={{ y: -4, scale: 1.12 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label={soc.label}
                    className="pf-social-btn"
                    style={{
                      '--sc': soc.sc,
                      '--sc-glow': soc.glow,
                    }}
                  >
                    {soc.icon}
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Column 2: Platform Navigation Links */}
            <div className="pf-link-col">
              <div className="pf-col-title">
                <Zap size={13} color="#f97316" />
                <span>PLATFORM</span>
              </div>
              <ul className="pf-link-list">
                {[
                  'Home',
                  'POS Features',
                  'Hotel & Restaurant',
                  'Pricing Plans',
                  'Hardware',
                  'Request Demo',
                  'Contact',
                ].map((label) => (
                  <li key={label}>
                    <button type="button" onClick={() => handlePlatformClick(label)} className="pf-link">
                      <ArrowRight size={11} className="pf-link-arrow" />
                      <span>{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Hospitality Solutions Links */}
            <div className="pf-link-col">
              <div className="pf-col-title">
                <Utensils size={13} color="#f97316" />
                <span>SOLUTIONS</span>
              </div>
              <ul className="pf-link-list">
                {[
                  'Restaurant & Cafe POS',
                  'Hotel & Room Billing',
                  'Kitchen Display (KDS)',
                  'Inventory & Recipes',
                  'Mobile Money (Zaad/EVC)',
                  'Multi-Branch Cloud',
                  'Thermal & Barcode POS',
                ].map((label) => (
                  <li key={label}>
                    <button type="button" onClick={() => handleSolutionClick(label)} className="pf-link">
                      <ArrowRight size={11} className="pf-link-arrow" />
                      <span>{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Interactive Company Modal Triggers */}
            <div className="pf-link-col">
              <div className="pf-col-title">
                <Globe size={13} color="#f97316" />
                <span>COMPANY</span>
              </div>
              <ul className="pf-link-list">
                {COMPANY_MODAL_LINKS.map((modalName) => (
                  <li key={modalName}>
                    <motion.button
                      type="button"
                      whileHover={{ x: 3 }}
                      onClick={() => setActiveModal(modalName)}
                      className="pf-link"
                    >
                      <ArrowRight size={11} className="pf-link-arrow" />
                      <span>{modalName}</span>
                    </motion.button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 5: Newsletter, Ecosystem Tags & Mini Highlights */}
            <div className="pf-nl-col">
              <div className="pf-col-title">
                <Mail size={13} color="#f97316" />
                <span>STAY UPDATED</span>
              </div>
              <p className="pf-nl-desc">
                Get SomBill POS releases, hospitality playbooks, and feature updates delivered monthly.
              </p>

              {nlSubscribed ? (
                <div className="pf-nl-success">
                  <CheckCircle size={15} />
                  <span>Subscribed successfully!</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="pf-nl-form">
                  <input
                    type="email"
                    required
                    value={nlEmail}
                    onChange={(e) => setNlEmail(e.target.value)}
                    placeholder="Enter your work email..."
                    className="pf-nl-input"
                    aria-label="Work email for SomBill newsletter"
                  />
                  <button type="submit" className="pf-nl-btn" title="Subscribe" aria-label="Subscribe">
                    <Send size={15} />
                  </button>
                </form>
              )}

              {/* Payment & POS Ecosystem Tags */}
              <div className="pf-stack">
                {ECOSYSTEM_TAGS.map((tag) => (
                  <span key={tag} className="pf-stack-chip">
                    {tag}
                  </span>
                ))}
              </div>

              {/* 3 Mini Feature Highlights */}
              <div className="pf-features-mini">
                <div className="pf-feature-mini-item">
                  <CheckCircle size={12} />
                  <span>Instant Receipt Printing</span>
                </div>
                <div className="pf-feature-mini-item">
                  <TrendingUp size={12} />
                  <span>Live Owner Mobile Reports</span>
                </div>
                <div className="pf-feature-mini-item">
                  <Cpu size={12} />
                  <span>99.9% Hybrid Cloud Uptime</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. SIGNATURE BOTTOM BAR */}
          <div className="pf-bottom">
            <div className="pf-bottom-left">
              <span>
                © {currentYear} <strong style={{ color: '#fb923c' }}>SomBill</strong>. All rights reserved.
              </span>
              <span className="pf-dev-pill">SomBill Hospitality OS</span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <MapPin size={12} className="text-[#f97316]" />
                <span>Hargeisa, Somaliland</span>
              </span>
            </div>

            <div className="pf-bottom-right">
              <div className="pf-status">
                <span className="pf-status-dot" aria-hidden="true" />
                <span>All POS systems operational</span>
              </div>
              <span className="pf-version">v2.4.0</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 5. COMPANION <CompanyModal /> PORTAL SYSTEM */}
      <CompanyModal
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        onNavigateContact={() => {
          if (onNavigate) onNavigate({ type: 'company', slug: 'contact' });
        }}
        onOpenDemoModal={onOpenDemoModal}
        onToast={onToast}
      />
    </>
  );
};

export default Footer;
