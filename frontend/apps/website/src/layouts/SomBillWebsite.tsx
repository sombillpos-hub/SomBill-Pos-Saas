import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight, Globe, Menu, Moon, Sparkles, Sun, X } from 'lucide-react';
import { Language } from '../utils/currency';
import {
  CompanySlug,
  PRODUCT_PAGES,
  ProductSlug,
  ResourceSlug,
  SOLUTION_PAGES,
  SolutionSlug,
  WebsitePageRoute,
} from '../services/websiteData';
import { WebsiteHomePage } from '../pages/Home/HomePage';
import { WebsiteProductDetailPage } from '../pages/Products/ProductDetailPage';
import { WebsiteSolutionDetailPage } from '../pages/Solutions/SolutionDetailPage';
import { WebsitePricingPage } from '../pages/Pricing/PricingPage';
import { WebsiteResourceDetailPage } from '../pages/Resources/ResourceDetailPage';
import { WebsiteCompanyDetailPage } from '../pages/Company/CompanyDetailPage';
import {
  ScrollProgressBar,
  TintedIcon,
  getAccentByIndex,
  renderMappedLucideIcon,
} from '../components/ui/PremiumPrimitives';
import { Footer } from '../components/footer/Footer';
import { parsePathname } from '../services/routing';
import { SITE_CONFIG } from '../services/siteConfig';

export interface SomBillWebsiteProps {
  lang: Language;
  onToggleLang: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  exchangeRate: number;
  onLaunchLiveApp: (mode: 'cashier' | 'waiter' | 'manager' | 'admin') => void;
  onToast: (msg: string) => void;
}

export const SomBillWebsite: React.FC<SomBillWebsiteProps> = ({
  lang,
  onToggleLang,
  darkMode,
  onToggleDarkMode,
  exchangeRate,
  onLaunchLiveApp,
  onToast,
}) => {
  // Deep links (/about, /careers, /product/<slug>, ...) open their page; unknown paths fall back to home.
  const [route, setRoute] = useState<WebsitePageRoute>(() =>
    typeof window === 'undefined' ? { type: 'home' } : parsePathname(window.location.pathname),
  );
  const [openMegaMenu, setOpenMegaMenu] = useState<null | 'product' | 'solutions' | 'resources' | 'company'>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navMouse, setNavMouse] = useState<{ x: number; y: number }>({ x: 500, y: 34 });

  // Modals
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Demo Modal Form State
  const [demoName, setDemoName] = useState('');
  const [demoBusiness, setDemoBusiness] = useState('');
  const [demoPhone, setDemoPhone] = useState('+252 63 ');
  const [demoCity, setDemoCity] = useState('Hargeisa');
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Keep browser Back/Forward buttons synchronized with WebsitePageRoute
  useEffect(() => {
    const onPopState = () => {
      setRoute(parsePathname(window.location.pathname));
      setOpenMegaMenu(null);
      setMobileMenuOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Synchronize WebsitePageRoute with location.pathname & notify SomBill AI v2.0 widget
  useEffect(() => {
    let pathname = '/';
    if (route.type === 'pricing') {
      pathname = '/pricing';
    } else if (route.type === 'company' && route.slug === 'contact') {
      pathname = '/contact';
    } else if (route.type === 'company') {
      pathname = `/${route.slug}`;
    } else if (route.type === 'product') {
      pathname = `/product/${route.slug}`;
    } else if (route.type === 'solution') {
      pathname = `/solution/${route.slug}`;
    } else if (route.type === 'resource') {
      pathname = `/resources/${route.slug}`;
    }
    try {
      if (window.location.pathname !== pathname) {
        window.history.pushState({}, '', pathname);
      }
      window.dispatchEvent(new CustomEvent('sombill-route-change', { detail: { pathname } }));
    } catch {
      // ignore history errors in sandboxed iframes
    }
  }, [route]);

  // Listen for markdown link clicks inside SomBill AI v2.0 responses
  useEffect(() => {
    const DASHBOARD_PREFIXES = [
      '/login',
      '/reset-password',
      '/forgot-password',
      '/manager',
      '/dashboard',
      '/cashier',
      '/waiter',
      '/super-admin',
    ];
    const handleAiNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ path?: string }>;
      const rawPath = (customEvent.detail?.path || '').trim();
      const path = rawPath.toLowerCase();
      if (!path) return;
      if (path === '/demo') {
        setDemoSubmitted(false);
        setDemoModalOpen(true);
        return;
      }
      if (DASHBOARD_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
        window.location.assign(`${SITE_CONFIG.dashboardsUrl}${rawPath}`);
        return;
      }
      handleNavigate(parsePathname(path));
    };
    window.addEventListener('sombill-ai-navigate', handleAiNavigate);
    return () => window.removeEventListener('sombill-ai-navigate', handleAiNavigate);
  }, []);

  const handleNavigate = (nextRoute: WebsitePageRoute) => {
    setRoute(nextRoute);
    setOpenMegaMenu(null);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoName.trim() || !demoBusiness.trim()) return;
    setDemoSubmitted(true);
    void fetch(`${SITE_CONFIG.apiBaseUrl}/public/demo-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: demoName.trim(),
        business: demoBusiness.trim(),
        city: demoCity,
        phone: demoPhone.trim(),
      }),
    }).catch(() => {
      /* gracefully fall back when local API gateway is offline */
    });
    onToast(`Demo & 14-Day Free Trial activated for ${demoBusiness.trim()}!`);
  };

  const renderMegaIconBox = (iconName: string, idx: number) => {
    const color = getAccentByIndex(idx);
    return (
      <div
        className="nb-mega-icon-box"
        style={{
          color,
          backgroundColor: `${color}15`,
          border: `1px solid ${color}30`,
          boxShadow: `0 6px 18px ${color}18`,
        }}
      >
        <span className="inline-flex items-center justify-center" style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}>
          {renderMappedLucideIcon(iconName, 'w-4 h-4')}
        </span>
      </div>
    );
  };

  const frontOfHouseSlugs: ProductSlug[] = [
    'restaurant-pos',
    'nfc-ordering',
    'qr-ordering',
    'table-management',
    'menu-management',
  ];
  const kitchenOpsSlugs: ProductSlug[] = ['kds', 'order-management', 'inventory-management', 'staff-management'];
  const financeEnterpriseSlugs: ProductSlug[] = [
    'billing-payments',
    'tax-financial-reports',
    'multi-branch',
    'business-analytics',
  ];

  const resourceItems: { slug: ResourceSlug; title: string; desc: string; icon: string }[] = [
    {
      slug: 'blog',
      title: 'Hospitality Blog',
      desc: 'Guides on offline POS, dual-currency math & NFC dining',
      icon: 'article',
    },
    {
      slug: 'help-center',
      title: 'Help Center',
      desc: '24/7 troubleshooting & regional support desk',
      icon: 'support_agent',
    },
    {
      slug: 'documentation',
      title: 'Documentation',
      desc: 'Local LAN mesh, printer drivers & ZAAD USSD specs',
      icon: 'menu_book',
    },
    {
      slug: 'video-tutorials',
      title: 'Video Tutorials',
      desc: 'Step-by-step training for cashiers, waiters & chefs',
      icon: 'smart_display',
    },
    {
      slug: 'faqs',
      title: 'FAQs',
      desc: 'Answers on hardware, offline mode, and pricing',
      icon: 'quiz',
    },
    {
      slug: 'case-studies',
      title: 'Case Studies',
      desc: 'Operational blueprints from Horn of Africa venues',
      icon: 'insights',
    },
    {
      slug: 'product-updates',
      title: 'Product Updates',
      desc: 'Latest SomBill OS releases & feature changelog',
      icon: 'new_releases',
    },
  ];

  const companyItems: { slug: CompanySlug; title: string; desc: string; icon: string }[] = [
    {
      slug: 'about',
      title: 'About SomBill',
      desc: 'Our mission modernizing Somaliland & East African hospitality',
      icon: 'domain',
    },
    {
      slug: 'why-sombill',
      title: 'Why SomBill',
      desc: 'How SomBill compares against imported legacy POS systems',
      icon: 'verified',
    },
    {
      slug: 'contact',
      title: 'Contact Us',
      desc: 'Reach our Hargeisa, Berbera, Burao & regional offices',
      icon: 'call',
    },
    {
      slug: 'partners',
      title: 'Partners',
      desc: 'Telecom mobile money & thermal hardware ecosystem',
      icon: 'handshake',
    },
    {
      slug: 'careers',
      title: 'Careers',
      desc: 'Join our hospitality engineering & field deployment teams',
      icon: 'work',
    },
    {
      slug: 'become-partner',
      title: 'Become a Partner',
      desc: 'Earn recurring commissions as a certified installer',
      icon: 'rocket_launch',
    },
  ];

  const activeNavTab =
    openMegaMenu ||
    (route.type === 'product'
      ? 'product'
      : route.type === 'solution'
        ? 'solutions'
        : route.type === 'resource'
          ? 'resources'
          : route.type === 'company'
            ? 'company'
            : route.type);

  return (
    <div
      className={`sombill-website-shell min-h-screen flex flex-col selection:bg-[#f97316]/25 selection:text-[#f97316] ${
        darkMode ? 'dark-theme' : 'light-theme'
      }`}
    >
      {/* Top 3px Shimmering Scroll Progress Bar */}
      <ScrollProgressBar />

      {/* =====================================================================
          2026 ULTRA-PREMIUM FLOATING PILL NAVBAR & 3D GLASS MEGA-MENU
         ===================================================================== */}
      <header
        onMouseLeave={() => setOpenMegaMenu(null)}
        className={`nb-sticky-wrapper nb-wrapper ${scrolled ? 'nb-scrolled' : 'nb-top'}`}
      >
        <div
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setNavMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          className={`nb-pill-shell ${scrolled ? 'is-scrolled' : ''}`}
        >
          {/* Dedicated inner background layer for Mouse-Follow Glow (clips spotlight without clipping buttons) */}
          <div className="nb-glow-clip-layer" aria-hidden="true">
            <div
              className="w-[260px] h-[260px] rounded-full transition-transform duration-150"
              style={{
                background: 'radial-gradient(circle, rgba(249, 115, 22, 0.12) 0%, transparent 70%)',
                transform: `translate(${navMouse.x - 130}px, ${navMouse.y - 130}px)`,
              }}
            />
          </div>

          <div className="nb-inner">
            {/* Zone 1: Brand Wordmark with Spinning Conic Glow Ring */}
            <button type="button" onClick={() => handleNavigate({ type: 'home' })} className="nb-logo-btn">
              <div className="nb-logo-icon-wrap">
                <img
                  src="/images/sombill-logo.jpeg"
                  alt="SomBill Logo"
                  referrerPolicy="no-referrer"
                  className="relative z-10 w-9 h-9 rounded-[10px] object-cover block"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight text-white [.light-theme_&]:text-slate-900 leading-none">
                  Som<span className="text-[#f97316]">Bill</span>
                </span>
                <span className="text-[10.5px] font-mono uppercase tracking-widest text-slate-400 [.light-theme_&]:text-slate-500 mt-0.5">
                  Hospitality OS
                </span>
              </div>
            </button>

            {/* Zone 2: Balanced Center Navigation Links (.nb-links & .nb-link) */}
            <nav className="nb-links">
              {[
                {
                  id: 'home' as const,
                  label: lang === 'so' ? 'Bogga Hore' : 'Home',
                  hasDropdown: false,
                  onClick: () => handleNavigate({ type: 'home' }),
                  onEnter: () => setOpenMegaMenu(null),
                },
                {
                  id: 'product' as const,
                  label: lang === 'so' ? 'Adeegyada (13)' : 'Product',
                  hasDropdown: true,
                  onClick: () => setOpenMegaMenu(openMegaMenu === 'product' ? null : 'product'),
                  onEnter: () => setOpenMegaMenu('product'),
                },
                {
                  id: 'solutions' as const,
                  label: lang === 'so' ? 'Xalka Ganacsiga' : 'Solutions',
                  hasDropdown: true,
                  onClick: () => setOpenMegaMenu(openMegaMenu === 'solutions' ? null : 'solutions'),
                  onEnter: () => setOpenMegaMenu('solutions'),
                },
                {
                  id: 'resources' as const,
                  label: lang === 'so' ? 'Agabka & Aqoon' : 'Resources',
                  hasDropdown: true,
                  onClick: () => setOpenMegaMenu(openMegaMenu === 'resources' ? null : 'resources'),
                  onEnter: () => setOpenMegaMenu('resources'),
                },
                {
                  id: 'pricing' as const,
                  label: lang === 'so' ? 'Qiimaha' : 'Pricing',
                  hasDropdown: false,
                  onClick: () => handleNavigate({ type: 'pricing' }),
                  onEnter: () => setOpenMegaMenu(null),
                },
                {
                  id: 'company' as const,
                  label: lang === 'so' ? 'Shirkadda' : 'Company',
                  hasDropdown: true,
                  onClick: () => setOpenMegaMenu(openMegaMenu === 'company' ? null : 'company'),
                  onEnter: () => setOpenMegaMenu('company'),
                },
              ].map((item) => {
                const isActive = activeNavTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    onMouseEnter={item.onEnter}
                    className={`nb-link ${isActive ? 'is-active' : ''}`}
                  >
                    <span>{item.label}</span>
                    {item.hasDropdown && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          openMegaMenu === item.id ? 'rotate-180 text-[#f97316]' : ''
                        }`}
                      />
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="nb-underline"
                        className="absolute left-3 right-3 -bottom-0.5 h-[2px] rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #dc2626, #f97316)',
                          boxShadow: '0 0 12px rgba(249, 115, 22, 0.8)',
                        }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Zone 3 (.nb-actions):
                Group A (Utility Switchers): [EN / SO Switcher] + [Orbital Theme Toggle]
                Vertical Glass Divider (.nb-action-divider)
                Group B (Action CTAs): [Launch Live OS] + [Log In] + [Request Demo]
            */}
            <div className="nb-actions">
              {/* Group A.1: Hyper-Glass 3D Liquid Language Switcher (.nb-lang-hyper) */}
              <div className="nb-lang-hyper" role="group" aria-label="Language Switcher">
                <motion.span
                  className="nb-lang-globe-orb"
                  animate={{ rotate: lang === 'so' ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                >
                  <Globe size={12} />
                </motion.span>

                {(['en', 'so'] as const).map((code) => {
                  const isActive = lang === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        if (lang !== code) onToggleLang();
                      }}
                      className={`nb-lang-option ${isActive ? 'is-active' : ''}`}
                      data-no-gradient
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sombill-lang-active"
                          className="nb-lang-active-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                        />
                      )}
                      <span>{code.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>

              {/* Group A.2: Contained Crazy Orbital Theme Toggle (.nb-theme-crazy) */}
              <button
                type="button"
                className={`nb-theme-crazy ${!darkMode ? 'nb-theme-crazy--light' : ''}`}
                onClick={onToggleDarkMode}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                data-no-gradient
              >
                <div className="nb-tc-bg" />
                <span className="nb-tc-track">
                  <motion.span
                    className="nb-tc-orb"
                    animate={{
                      x: !darkMode ? 32 : 0,
                      rotate: !darkMode ? 180 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  >
                    {darkMode ? (
                      <Moon
                        size={12}
                        style={{
                          color: '#fff',
                          filter: 'drop-shadow(0 0 4px #f97316)',
                        }}
                      />
                    ) : (
                      <Sun
                        size={12}
                        style={{
                          color: '#fff',
                          filter: 'drop-shadow(0 0 4px #fef08a)',
                        }}
                      />
                    )}
                    <div className="nb-tc-ring ring-1" />
                    <div className="nb-tc-ring ring-2" />
                  </motion.span>
                </span>
                <span className="nb-tc-icon nb-tc-moon">
                  <Moon size={12} />
                </span>
                <span className="nb-tc-icon nb-tc-sun">
                  <Sun size={12} />
                </span>
              </button>

              {/* Subtle Vertical Glass Divider */}
              <div className="nb-action-divider hidden sm:block" aria-hidden="true" />

              {/* Group B.1: Launch Live OS Button (Uniform 36px height) */}
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="nb-live-os-btn btn-shimmer-sweep"
              >
                <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981] animate-pulse shrink-0" />
                <span>{lang === 'so' ? 'Live OS' : 'Launch Live OS'}</span>
              </button>

              {/* Group B.2: Log In Button (.nb-login-btn, Uniform 36px height) */}
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="nb-login-btn hidden sm:inline-flex"
              >
                <span>{lang === 'so' ? 'Gal (Log In)' : 'Log In'}</span>
              </button>

              {/* Group B.3: Request Demo Button (.nb-signup-btn, Uniform 36px height) */}
              <button
                type="button"
                onClick={() => {
                  setDemoSubmitted(false);
                  setDemoModalOpen(true);
                }}
                className="nb-signup-btn"
              >
                <span className="nb-signup-shine" />
                <Sparkles className="w-3.5 h-3.5 relative z-10 shrink-0" />
                <span className="relative z-10">{lang === 'so' ? 'Dalbo Demo' : 'Request Demo'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Toggle Mobile Menu"
                className="xl:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-white [.light-theme_&]:text-slate-900 cursor-pointer shrink-0"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ===================================================================
            FLOATING 3D GLASS MEGA-MENUS (PRODUCT, SOLUTIONS, RESOURCES, COMPANY)
           =================================================================== */}
        <AnimatePresence>
          {openMegaMenu === 'product' && (
            <motion.div
              key="mega-product"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block nb-mega-floating-panel"
            >
              {/* 2px Top Laser Beam */}
              <div className="nb-mega-top-beam" aria-hidden="true" />

              {/* 3-Column Product Matrix */}
              <div className="px-7 pt-6 pb-5 grid grid-cols-12 gap-7">
                {/* Col 1: Front of House */}
                <div className="col-span-4 space-y-1">
                  <div className="nb-mega-col-header">
                    <span className="nb-mega-col-dot" />
                    <span>Front of House & Guest Ordering</span>
                  </div>
                  {frontOfHouseSlugs.map((slug, idx) => {
                    const p = PRODUCT_PAGES[slug];
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => handleNavigate({ type: 'product', slug })}
                        className="nb-mega-item-row"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {renderMegaIconBox(p.iconName, idx)}
                          <div className="min-w-0">
                            <div className="nb-mega-item-title">{p.highlightWord}</div>
                            <div className="nb-mega-item-desc">{p.shortDesc}</div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="nb-mega-item-arrow" />
                      </button>
                    );
                  })}
                </div>

                {/* Col 2: Kitchen & Operations */}
                <div className="col-span-4 space-y-1">
                  <div className="nb-mega-col-header">
                    <span className="nb-mega-col-dot" />
                    <span>Kitchen, Stock & Staff Operations</span>
                  </div>
                  {kitchenOpsSlugs.map((slug, idx) => {
                    const p = PRODUCT_PAGES[slug];
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => handleNavigate({ type: 'product', slug })}
                        className="nb-mega-item-row"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {renderMegaIconBox(p.iconName, idx + 1)}
                          <div className="min-w-0">
                            <div className="nb-mega-item-title">{p.highlightWord}</div>
                            <div className="nb-mega-item-desc">{p.shortDesc}</div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="nb-mega-item-arrow" />
                      </button>
                    );
                  })}
                </div>

                {/* Col 3: Finance & Enterprise */}
                <div className="col-span-4 space-y-1">
                  <div className="nb-mega-col-header">
                    <span className="nb-mega-col-dot" />
                    <span>Payments, Tax & Multi-Branch HQ</span>
                  </div>
                  {financeEnterpriseSlugs.map((slug, idx) => {
                    const p = PRODUCT_PAGES[slug];
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => handleNavigate({ type: 'product', slug })}
                        className="nb-mega-item-row"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {renderMegaIconBox(p.iconName, idx + 2)}
                          <div className="min-w-0">
                            <div className="nb-mega-item-title">{p.highlightWord}</div>
                            <div className="nb-mega-item-desc">{p.shortDesc}</div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="nb-mega-item-arrow" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dedicated Full-Width Mega-Menu Bottom Bar */}
              <div className="nb-mega-footer-bar">
                <div className="flex items-center gap-2.5 text-slate-300 [.light-theme_&]:text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_10px_#10b981] animate-pulse shrink-0" />
                  <span>
                    <strong className="text-white [.light-theme_&]:text-slate-900">Interactive Sandbox Ready</strong> —
                    Test sub-second touch checkout & Zaad/e-Dahab push live in your browser.
                  </span>
                </div>

                <button type="button" onClick={() => onLaunchLiveApp('cashier')} className="nb-mega-footer-cta">
                  <span>Launch Live Cashier POS Terminal #02 →</span>
                </button>
              </div>
            </motion.div>
          )}

          {openMegaMenu === 'solutions' && (
            <motion.div
              key="mega-solutions"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block nb-mega-floating-panel"
            >
              <div className="nb-mega-top-beam" aria-hidden="true" />
              <div className="px-7 py-6 grid grid-cols-12 gap-7">
                <div className="col-span-8">
                  <div className="nb-mega-col-header">
                    <span className="nb-mega-col-dot" />
                    <span>Tailored Hospitality Venue Formats</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(SOLUTION_PAGES) as SolutionSlug[]).map((slug, idx) => {
                      const s = SOLUTION_PAGES[slug];
                      return (
                        <button
                          key={slug}
                          type="button"
                          onClick={() => handleNavigate({ type: 'solution', slug })}
                          className="nb-mega-item-row"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {renderMegaIconBox(s.iconName, idx)}
                            <div className="min-w-0">
                              <div className="nb-mega-item-title">{s.badge}</div>
                              <div className="nb-mega-item-desc">{s.shortDesc}</div>
                            </div>
                          </div>
                          <ChevronRight size={14} className="nb-mega-item-arrow" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-span-4 rounded-2xl bg-gradient-to-br from-[#1f090e] to-[#080305] border border-[#f97316]/30 text-white p-5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#fb923c] uppercase">
                      <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                      <span>Live Interactive Sandbox</span>
                    </div>
                    <div className="text-base font-extrabold">Test All 4 SomBill Role Consoles Live</div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Switch between Cashier POS, Waiter Floor Service, Super Manager, and Main Admin HQ right in your
                      browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(true)}
                    className="nb-mega-footer-cta mt-4 w-full justify-center"
                  >
                    <span>Open Role Switcher Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {openMegaMenu === 'resources' && (
            <motion.div
              key="mega-resources"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block nb-mega-floating-panel"
            >
              <div className="nb-mega-top-beam" aria-hidden="true" />
              <div className="px-7 py-6">
                <div className="nb-mega-col-header">
                  <span className="nb-mega-col-dot" />
                  <span>SomBill Knowledge Base, Docs & Masterclasses</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {resourceItems.map((res, idx) => (
                    <button
                      key={res.slug}
                      type="button"
                      onClick={() => handleNavigate({ type: 'resource', slug: res.slug })}
                      className="nb-mega-item-row"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {renderMegaIconBox(res.icon, idx)}
                        <div className="min-w-0">
                          <div className="nb-mega-item-title">{res.title}</div>
                          <div className="nb-mega-item-desc">{res.desc}</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="nb-mega-item-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {openMegaMenu === 'company' && (
            <motion.div
              key="mega-company"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block nb-mega-floating-panel"
            >
              <div className="nb-mega-top-beam" aria-hidden="true" />
              <div className="px-7 py-6">
                <div className="nb-mega-col-header">
                  <span className="nb-mega-col-dot" />
                  <span>About SomBill Technologies & Regional Hubs</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {companyItems.map((comp, idx) => (
                    <button
                      key={comp.slug}
                      type="button"
                      onClick={() => handleNavigate({ type: 'company', slug: comp.slug })}
                      className="nb-mega-item-row"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {renderMegaIconBox(comp.icon, idx)}
                        <div className="min-w-0">
                          <div className="nb-mega-item-title">{comp.title}</div>
                          <div className="nb-mega-item-desc">{comp.desc}</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="nb-mega-item-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Drawer Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pointer-events-auto xl:hidden mt-2 mx-3 rounded-2xl border border-white/10 bg-[#120609]/98 [.light-theme_&]:bg-white px-4 py-5 space-y-5 max-h-[82vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleNavigate({ type: 'home' })}
                  className="px-3 py-1.5 rounded-lg bg-white/10 [.light-theme_&]:bg-slate-100 text-xs font-bold"
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate({ type: 'pricing' })}
                  className="px-3 py-1.5 rounded-lg bg-white/10 [.light-theme_&]:bg-slate-100 text-xs font-bold"
                >
                  Pricing
                </button>
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  className="btn-sombill-grad px-3 py-1.5 rounded-lg text-white text-xs font-bold"
                >
                  Launch Live POS / Apps
                </button>
                {/* On phones the navbar has no room for "Request Demo", so it lives here (see .nb-signup-btn in globals.css). */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setDemoSubmitted(false);
                    setDemoModalOpen(true);
                  }}
                  className="sm:hidden px-3 py-1.5 rounded-lg bg-[#f97316]/15 text-[#f97316] text-xs font-bold"
                >
                  {lang === 'so' ? 'Dalbo Demo' : 'Request Demo'}
                </button>
              </div>

              <div>
                <div className="text-[11px] font-mono font-bold uppercase text-[#f97316] mb-2">
                  Products (13 Modules)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(PRODUCT_PAGES) as ProductSlug[]).map((slug) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => handleNavigate({ type: 'product', slug })}
                      className="text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5 truncate"
                    >
                      {PRODUCT_PAGES[slug].highlightWord}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono font-bold uppercase text-[#f97316] mb-2">
                  Solutions (7 Venue Types)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(SOLUTION_PAGES) as SolutionSlug[]).map((slug) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => handleNavigate({ type: 'solution', slug })}
                      className="text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5 truncate"
                    >
                      {SOLUTION_PAGES[slug].badge}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono font-bold uppercase text-[#f97316] mb-2">Resources & Company</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {resourceItems.map((r) => (
                    <button
                      key={r.slug}
                      type="button"
                      onClick={() => handleNavigate({ type: 'resource', slug: r.slug })}
                      className="text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5"
                    >
                      {r.title}
                    </button>
                  ))}
                  {companyItems.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => handleNavigate({ type: 'company', slug: c.slug })}
                      className="text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5"
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* =====================================================================
          MAIN ACTIVE PAGE VIEWPORT
         ===================================================================== */}
      <main className="flex-1">
        {route.type === 'home' && (
          <WebsiteHomePage
            lang={lang}
            exchangeRate={exchangeRate}
            onNavigate={handleNavigate}
            onOpenDemoModal={() => {
              setDemoSubmitted(false);
              setDemoModalOpen(true);
            }}
            onLaunchLiveApp={onLaunchLiveApp}
            onToast={onToast}
          />
        )}

        {route.type === 'product' && (
          <WebsiteProductDetailPage
            slug={route.slug}
            lang={lang}
            exchangeRate={exchangeRate}
            onNavigate={handleNavigate}
            onOpenDemoModal={() => {
              setDemoSubmitted(false);
              setDemoModalOpen(true);
            }}
            onLaunchLiveApp={onLaunchLiveApp}
            onToast={onToast}
          />
        )}

        {route.type === 'solution' && (
          <WebsiteSolutionDetailPage
            slug={route.slug}
            lang={lang}
            exchangeRate={exchangeRate}
            onNavigate={handleNavigate}
            onOpenDemoModal={() => {
              setDemoSubmitted(false);
              setDemoModalOpen(true);
            }}
            onLaunchLiveApp={onLaunchLiveApp}
            onToast={onToast}
          />
        )}

        {route.type === 'pricing' && (
          <WebsitePricingPage
            lang={lang}
            exchangeRate={exchangeRate}
            onNavigate={handleNavigate}
            onOpenDemoModal={() => {
              setDemoSubmitted(false);
              setDemoModalOpen(true);
            }}
            onLaunchLiveApp={onLaunchLiveApp}
            onToast={onToast}
          />
        )}

        {route.type === 'resource' && (
          <WebsiteResourceDetailPage
            slug={route.slug}
            lang={lang}
            exchangeRate={exchangeRate}
            onNavigate={handleNavigate}
            onOpenDemoModal={() => {
              setDemoSubmitted(false);
              setDemoModalOpen(true);
            }}
            onLaunchLiveApp={onLaunchLiveApp}
            onToast={onToast}
          />
        )}

        {route.type === 'company' && (
          <WebsiteCompanyDetailPage
            slug={route.slug}
            lang={lang}
            exchangeRate={exchangeRate}
            onNavigate={handleNavigate}
            onOpenDemoModal={() => {
              setDemoSubmitted(false);
              setDemoModalOpen(true);
            }}
            onLaunchLiveApp={onLaunchLiveApp}
            onToast={onToast}
          />
        )}
      </main>

      {/* =====================================================================
          PILLAR 5: 2026 ULTRA-PREMIUM FOOTER & INTERACTIVE COMPANY MODALS
         ===================================================================== */}
      <Footer
        onNavigate={handleNavigate}
        onOpenDemoModal={() => {
          setDemoSubmitted(false);
          setDemoModalOpen(true);
        }}
        onToast={onToast}
      />

      {/* =====================================================================
          MODAL 1: BOOK A DEMO / START FREE TRIAL (WITH ANIMATEPRESENCE)
         ===================================================================== */}
      <AnimatePresence>
        {demoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="premium-waali-card w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-white [.light-theme_&]:text-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TintedIcon icon="rocket_launch" index={1} size="sm" />
                  <div>
                    <div className="text-[11px] font-mono font-bold uppercase text-[#f97316]">
                      14-Day Pilot & Live Walkthrough
                    </div>
                    <h3 className="text-xl font-extrabold">Book Your SomBill Demo</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {demoSubmitted ? (
                <div className="py-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="font-extrabold text-base">Demo & Trial Request Confirmed!</div>
                  <p className="text-xs text-slate-400">
                    Our Hargeisa & regional hospitality team will reach out to{' '}
                    <strong className="text-white">{demoName}</strong> ({demoPhone}) shortly. Want to explore the live
                    system right now?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDemoModalOpen(false);
                      onLaunchLiveApp('cashier');
                    }}
                    className="btn-sombill-grad w-full py-3 rounded-xl text-white font-bold text-xs cursor-pointer"
                  >
                    Launch Live Cashier POS Workspace Now →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Your Full Name</label>
                    <input
                      type="text"
                      required
                      value={demoName}
                      onChange={(e) => setDemoName(e.target.value)}
                      placeholder="e.g. Mohamed Sheikh"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Restaurant / Hotel Name
                    </label>
                    <input
                      type="text"
                      required
                      value={demoBusiness}
                      onChange={(e) => setDemoBusiness(e.target.value)}
                      placeholder="e.g. Gulf Star Hotel & Dining"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">City</label>
                      <select
                        value={demoCity}
                        onChange={(e) => setDemoCity(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#120609] [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs"
                      >
                        <option>Hargeisa</option>
                        <option>Berbera</option>
                        <option>Burao</option>
                        <option>Borama</option>
                        <option>Mogadishu</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        WhatsApp / Phone
                      </label>
                      <input
                        type="tel"
                        required
                        value={demoPhone}
                        onChange={(e) => setDemoPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn-sombill-grad w-full py-3 rounded-xl text-white font-bold text-xs cursor-pointer"
                  >
                    Confirm Demo & Start 14-Day Free Trial
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MODAL 2: LOG IN / LAUNCH LIVE SOMBILL APPLICATIONS
         ===================================================================== */}
      <AnimatePresence>
        {loginModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="premium-waali-card w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-white [.light-theme_&]:text-slate-900"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-bold uppercase text-[#f97316]">
                    SomBill OS Live Workspace Portal
                  </div>
                  <h3 className="text-xl font-extrabold">Select a Live Console to Launch</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <a
                href={SITE_CONFIG.signInUrl}
                className="dept-card-premium flex items-center justify-between gap-3 p-4 rounded-2xl"
                style={{ '--card-accent': getAccentByIndex(0) } as React.CSSProperties}
              >
                <span className="relative z-10">
                  <span className="block font-bold text-sm text-white [.light-theme_&]:text-slate-900">
                    {lang === 'so' ? 'Gal akoonkaaga SomBill' : 'Sign in to your SomBill account'}
                  </span>
                  <span className="block text-[11px] text-slate-400 [.light-theme_&]:text-slate-600">
                    {lang === 'so'
                      ? 'Maamulaha, khasnajiga, kabalaha iyo Group HQ'
                      : 'Manager, cashier, waiter and Group HQ dashboards'}
                  </span>
                </span>
                <ArrowRight className="w-4 h-4 text-[#f97316] relative z-10 shrink-0" />
              </a>
              <div className="text-[11px] font-mono uppercase text-slate-400 [.light-theme_&]:text-slate-500">
                {lang === 'so' ? 'Ama tijaabi muuqaalada (demo)' : 'Or try the interactive previews'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  {
                    mode: 'cashier' as const,
                    title: 'Cashier POS Workspace',
                    user: 'Hassan Bare · Terminal #02',
                    desc: 'Fast settlement queue, ZAAD/e-Dahab push, MOF 4.8% VAT & Z-Report.',
                    icon: 'point_of_sale',
                  },
                  {
                    mode: 'waiter' as const,
                    title: 'Waiter & Floor POS',
                    user: 'Mahamud Warsame · Terminal #04',
                    desc: 'Visual floor map, guest call buzzers, and active table tickets.',
                    icon: 'table_restaurant',
                  },
                  {
                    mode: 'manager' as const,
                    title: 'Super Manager Dashboard',
                    user: 'Mohamed Sheikh · Branch Manager',
                    desc: 'Branch KPIs, shifts, menu management, staff & roles.',
                    icon: 'storefront',
                  },
                  {
                    mode: 'admin' as const,
                    title: 'Main Admin SaaS Console',
                    user: 'Mahad · Sole Main Admin',
                    desc: 'Platform-wide control across 128 businesses, plans & billing.',
                    icon: 'admin_panel_settings',
                  },
                ].map((app, idx) => (
                  <button
                    key={app.mode}
                    type="button"
                    onClick={() => {
                      setLoginModalOpen(false);
                      onLaunchLiveApp(app.mode);
                    }}
                    className="dept-card-premium text-left p-4 rounded-2xl space-y-2 group cursor-pointer"
                    style={{ '--card-accent': getAccentByIndex(idx) } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between relative z-10">
                      <TintedIcon icon={app.icon} index={idx} size="sm" />
                      <span className="text-[11px] font-bold text-[#f97316] group-hover:translate-x-1 transition-transform">
                        Launch →
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white [.light-theme_&]:text-slate-900 relative z-10">
                      {app.title}
                    </div>
                    <div className="text-[11px] font-mono text-[#fb923c] relative z-10">{app.user}</div>
                    <p className="text-[11px] text-slate-400 [.light-theme_&]:text-slate-600 leading-snug relative z-10">
                      {app.desc}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
