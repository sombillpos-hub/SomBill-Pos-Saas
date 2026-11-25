import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  Clock,
  Coins,
  Cpu,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Flame,
  Globe,
  Handshake,
  HelpCircle,
  Layers,
  LayoutGrid,
  LifeBuoy,
  Lock,
  MessageSquare,
  Monitor,
  Package,
  PhoneCall,
  PlayCircle,
  Printer,
  QrCode,
  Receipt,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tablet,
  TrendingUp,
  Users,
  Utensils,
  Video,
  Wallet,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';

export const SOMBILL_ACCENTS = [
  '#ef4444', // Crimson
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#10b981', // Emerald
] as const;

export function getAccentByIndex(idx: number): string {
  return SOMBILL_ACCENTS[Math.abs(idx) % SOMBILL_ACCENTS.length];
}

/**
 * Top Fixed 3px Shimmering Scroll Progress Bar with Glowing Tip
 */
export const ScrollProgressBar: React.FC = () => {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const updateScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight <= 0) {
        setProgress(12);
        return;
      }
      const pct = Math.min(100, Math.max(4, (scrollTop / docHeight) * 100));
      setProgress(pct);
    };
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  return <div className="top-scroll-progress-bar" style={{ width: `${progress}%` }} aria-hidden="true" />;
};

/**
 * Pillar 1: Custom Typewriter Effect in Hero Title
 */
export interface TypewriterProps {
  words?: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDelay?: number;
}

export const Typewriter: React.FC<TypewriterProps> = ({
  words = ['Hospitality', 'Billing & POS', 'Hotel Operations', 'Restaurant Tech', 'Guest Experience', 'Smart Payments'],
  typingSpeed = 70,
  deletingSpeed = 40,
  pauseDelay = 2000,
}) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [subText, setSubText] = useState(words[0] || 'Hospitality');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentFullWord = words[wordIndex % words.length] || 'Hospitality';

    let timer: ReturnType<typeof setTimeout>;
    if (!isDeleting && subText === currentFullWord) {
      timer = setTimeout(() => setIsDeleting(true), pauseDelay);
    } else if (isDeleting && subText === '') {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % words.length);
    } else {
      timer = setTimeout(
        () => {
          const nextLength = isDeleting ? subText.length - 1 : subText.length + 1;
          setSubText(currentFullWord.slice(0, nextLength));
        },
        isDeleting ? deletingSpeed : typingSpeed,
      );
    }

    return () => clearTimeout(timer);
  }, [subText, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDelay]);

  return (
    <span className="hero-typewriter-wrap">
      <span className="gradient-text">{subText || '\u00A0'}</span>
      <span className="typewriter-cursor" aria-hidden="true">
        |
      </span>
    </span>
  );
};

/**
 * Pillar 2 (Layer C): Interactive Hero Particles (@tsparticles/react + @tsparticles/slim)
 */
export const PremiumParticles: React.FC<{ id?: string }> = ({ id = 'sombill-hero-particles' }) => {
  return (
    <ParticlesProvider
      init={async (engine) => {
        await loadSlim(engine);
      }}
    >
      <Particles
        id={id}
        className="absolute inset-0 pointer-events-auto z-0"
        options={{
          fullScreen: { enable: false },
          fpsLimit: 60,
          detectRetina: true,
          interactivity: {
            events: {
              onHover: {
                enable: true,
                mode: 'grab',
              },
            },
            modes: {
              grab: {
                distance: 155,
                links: {
                  opacity: 0.42,
                  color: '#f97316',
                },
              },
            },
          },
          particles: {
            number: {
              value: 75,
              density: {
                enable: true,
                width: 1200,
                height: 800,
              },
            },
            color: {
              value: ['#dc2626', '#f97316', '#fbbf24', '#ffffff'],
            },
            links: {
              enable: true,
              distance: 135,
              color: '#f97316',
              opacity: 0.18,
              width: 1,
            },
            move: {
              enable: true,
              speed: 0.85,
              direction: 'none',
              random: true,
              straight: false,
              outModes: {
                default: 'bounce',
              },
            },
            opacity: {
              value: { min: 0.2, max: 0.65 },
            },
            size: {
              value: { min: 1.2, max: 3.2 },
            },
          },
        }}
      />
    </ParticlesProvider>
  );
};

/**
 * Pillar 2 (Layer D): ScrollReveal Component with IntersectionObserver (threshold: 0.12)
 */
export const ScrollReveal: React.FC<{
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}> = ({ children, delayMs = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0px)' : 'translateY(32px)',
        transition: `opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Pillar 2 (Layer D): Smooth AnimatedCounter using requestAnimationFrame & cubic ease-out
 */
export const AnimatedCounter: React.FC<{
  end: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
}> = ({ end, decimals = 0, prefix = '', suffix = '', durationMs = 1500, className = '' }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState<number>(end);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            const startTime = performance.now();
            const step = (now: number) => {
              const prog = Math.min(1, (now - startTime) / durationMs);
              const eased = 1 - Math.pow(1 - prog, 3);
              setVal(end * eased);
              if (prog < 1) {
                requestAnimationFrame(step);
              } else {
                setVal(end);
              }
            };
            requestAnimationFrame(step);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end, durationMs]);

  const formatted = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString('en-US');

  return (
    <span ref={ref} className={`font-mono tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

/**
 * Maps legacy material icon strings or semantic names to crisp Lucide React icons
 */
export function renderMappedLucideIcon(name: string, sizeClass = 'w-5 h-5'): React.ReactNode {
  const key = (name || '').trim().toLowerCase();
  switch (key) {
    case 'point_of_sale':
    case 'pos':
    case 'terminal':
      return <Monitor className={sizeClass} />;
    case 'contactless':
    case 'nfc':
    case 'sensors':
    case 'tap_and_play':
      return <Smartphone className={sizeClass} />;
    case 'qr_code_2':
    case 'qr_code_scanner':
    case 'qr':
      return <QrCode className={sizeClass} />;
    case 'kitchen':
    case 'skillet':
    case 'restaurant_menu':
    case 'dining':
    case 'restaurant':
      return <ChefHat className={sizeClass} />;
    case 'table_restaurant':
    case 'table_bar':
    case 'deck':
      return <LayoutGrid className={sizeClass} />;
    case 'menu_book':
    case 'book':
      return <BookOpen className={sizeClass} />;
    case 'receipt_long':
    case 'receipt':
      return <Receipt className={sizeClass} />;
    case 'inventory_2':
    case 'inventory':
    case 'warehouse':
      return <Package className={sizeClass} />;
    case 'payments':
    case 'credit_card':
    case 'account_balance_wallet':
      return <Wallet className={sizeClass} />;
    case 'account_balance':
    case 'request_quote':
    case 'calculate':
      return <FileSpreadsheet className={sizeClass} />;
    case 'badge':
    case 'groups':
    case 'people':
    case 'engineering':
      return <Users className={sizeClass} />;
    case 'hub':
    case 'domain':
    case 'apartment':
    case 'hotel':
    case 'storefront':
      return <Building2 className={sizeClass} />;
    case 'insights':
    case 'querystats':
    case 'analytics':
    case 'monitoring':
    case 'trending_up':
      return <BarChart3 className={sizeClass} />;
    case 'phonelink_ring':
    case 'smartphone':
    case 'phone_iphone':
      return <Smartphone className={sizeClass} />;
    case 'currency_exchange':
    case 'paid':
    case 'attach_money':
      return <Coins className={sizeClass} />;
    case 'wifi_off':
      return <WifiOff className={sizeClass} />;
    case 'wifi':
    case 'router':
    case 'lan':
      return <Wifi className={sizeClass} />;
    case 'print':
      return <Printer className={sizeClass} />;
    case 'tablet_mac':
    case 'tablet_android':
      return <Tablet className={sizeClass} />;
    case 'article':
    case 'description':
      return <FileText className={sizeClass} />;
    case 'support_agent':
    case 'help':
      return <LifeBuoy className={sizeClass} />;
    case 'smart_display':
    case 'play_circle':
      return <Video className={sizeClass} />;
    case 'quiz':
      return <HelpCircle className={sizeClass} />;
    case 'new_releases':
    case 'bolt':
      return <Zap className={sizeClass} />;
    case 'verified':
    case 'verified_user':
    case 'admin_panel_settings':
    case 'security':
      return <ShieldCheck className={sizeClass} />;
    case 'call':
      return <PhoneCall className={sizeClass} />;
    case 'handshake':
      return <Handshake className={sizeClass} />;
    case 'work':
      return <Briefcase className={sizeClass} />;
    case 'rocket_launch':
      return <Rocket className={sizeClass} />;
    case 'local_cafe':
    case 'coffee':
      return <Flame className={sizeClass} />;
    case 'fastfood':
    case 'lunch_dining':
    case 'bakery_dining':
      return <Utensils className={sizeClass} />;
    case 'schedule':
    case 'timer':
    case 'speed':
      return <Clock className={sizeClass} />;
    case 'memory':
      return <Cpu className={sizeClass} />;
    case 'dns':
      return <Server className={sizeClass} />;
    case 'lock':
      return <Lock className={sizeClass} />;
    case 'public':
      return <Globe className={sizeClass} />;
    case 'award':
      return <Award className={sizeClass} />;
    case 'layers':
      return <Layers className={sizeClass} />;
    case 'store':
      return <Store className={sizeClass} />;
    case 'creditcard':
      return <CreditCard className={sizeClass} />;
    case 'activity':
      return <Activity className={sizeClass} />;
    case 'trendingup':
      return <TrendingUp className={sizeClass} />;
    case 'play':
      return <PlayCircle className={sizeClass} />;
    case 'check':
      return <CheckCircle2 className={sizeClass} />;
    default:
      return <Sparkles className={sizeClass} />;
  }
}

/**
 * Pillar 4: Tinted Glass Icon Container (48px–60px square, border-radius 14px–18px)
 */
export const TintedIcon: React.FC<{
  icon: string | React.ReactNode;
  accentColor?: string;
  index?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ icon, accentColor, index = 0, size = 'md', className = '' }) => {
  const color = accentColor || getAccentByIndex(index);
  const dims =
    size === 'sm'
      ? 'w-10 h-10 rounded-[13px]'
      : size === 'lg'
        ? 'w-14 h-14 rounded-[18px]'
        : 'w-12 h-12 rounded-[15px]';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <div
      className={`tinted-icon-box inline-flex items-center justify-center shrink-0 ${dims} ${className}`}
      style={{
        color,
        backgroundColor: `${color}15`,
        border: `1px solid ${color}30`,
        boxShadow: `0 6px 20px ${color}18`,
      }}
    >
      <span className="inline-flex items-center justify-center" style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}>
        {typeof icon === 'string' ? renderMappedLucideIcon(icon, iconSize) : icon}
      </span>
    </div>
  );
};

/**
 * Pillar 5: 2026 God-Level Section Header with Animated Laser Wings, 3D Eyebrow Badge,
 * Continuous Moving Color Gradient Headline, Laser Comet Bar & Breathing Aura
 */
export const SectionHeader: React.FC<{
  eyebrow: string;
  titleBefore: string;
  titleGradient: string;
  titleAfter?: string;
  subtitle?: string;
  align?: 'center' | 'left';
}> = ({ eyebrow, titleBefore, titleGradient, titleAfter = '', subtitle, align = 'center' }) => {
  const isCenter = align === 'center';
  return (
    <div
      className={`god-section-header-wrap ${
        isCenter ? 'text-center max-w-4xl mx-auto space-y-5' : 'text-left max-w-3xl space-y-4'
      }`}
    >
      {isCenter && <div className="god-section-aura" aria-hidden="true" />}

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={isCenter ? 'horn-eyebrow-wrap' : 'inline-flex items-center gap-3 flex-wrap'}
      >
        {isCenter && <span className="horn-laser-wing wing-left hidden sm:inline-block" aria-hidden="true" />}
        <div className="horn-eyebrow-badge">
          <Sparkles className="w-4 h-4 text-[#fbbf24] shrink-0" />
          <span className="horn-eyebrow-text">{eyebrow}</span>
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        </div>
        <span className="horn-laser-wing wing-right hidden sm:inline-block" aria-hidden="true" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        className={`horn-god-headline text-white [.light-theme_&]:text-slate-900 ${isCenter ? 'mx-auto' : 'mx-0'}`}
      >
        {titleBefore} <span className="horn-moving-gradient-text">{titleGradient}</span>
        {titleAfter ? (
          <>
            {' '}
            <span className="horn-moving-gradient-alt">{titleAfter}</span>
          </>
        ) : null}
      </motion.h2>

      <div className={isCenter ? 'flex justify-center' : 'flex justify-start'}>
        <div className="god-headline-laser-bar" aria-hidden="true" />
      </div>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className={`section-subtitle-md text-slate-300 [.light-theme_&]:text-slate-600 leading-relaxed font-medium ${
            isCenter ? 'max-w-3xl mx-auto' : 'max-w-2xl'
          }`}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
};

/* ============================================================================
   THE 8 SIGNATURE 2026 CARD ARCHETYPE COMPONENTS
   ============================================================================ */

/**
 * ARCHETYPE 1: HERO & KPI STAT CARD (.hero-stat-card / .premium-waali-card)
 */
export const HeroStatCard: React.FC<{
  icon: string;
  valueNode: React.ReactNode;
  label: string;
  sub?: string;
  index?: number;
  accentColor?: string;
  className?: string;
}> = ({ icon, valueNode, label, sub, index = 0, accentColor, className = '' }) => {
  const color = accentColor || getAccentByIndex(index);
  return (
    <div
      className={`hero-stat-card premium-waali-card ${className}`}
      style={{ '--laser-color': color } as React.CSSProperties}
    >
      <div className="stat-card-glow" style={{ background: color }} />
      <div
        className="stat-icon-wrap"
        style={{
          color,
          backgroundColor: `${color}15`,
          border: `1px solid ${color}30`,
        }}
      >
        <span style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}>{renderMappedLucideIcon(icon, 'w-5 h-5')}</span>
      </div>
      <div className="relative z-10 min-w-0">
        <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white [.light-theme_&]:text-slate-900 leading-tight">
          {valueNode}
        </div>
        <div className="text-xs font-bold text-slate-200 [.light-theme_&]:text-slate-800 truncate mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 [.light-theme_&]:text-slate-500 truncate">{sub}</div>}
      </div>
    </div>
  );
};

/**
 * ARCHETYPE 2: SERVICE / SOLUTION / DEPARTMENT CARD (.dept-card-premium)
 */
export const DeptSolutionCard: React.FC<{
  icon: string;
  badge?: string;
  title: string;
  desc: string;
  topics: string[];
  actionLabel: string;
  onClick: () => void;
  index?: number;
  accentColor?: string;
}> = ({ icon, badge, title, desc, topics, actionLabel, onClick, index = 0, accentColor }) => {
  const color = accentColor || getAccentByIndex(index);
  return (
    <div
      onClick={onClick}
      className="dept-card-premium h-full cursor-pointer group"
      style={{ '--card-accent': color } as React.CSSProperties}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div
            className="dept-icon-box"
            style={{
              color,
              backgroundColor: `${color}15`,
              border: `1px solid ${color}30`,
              boxShadow: `0 8px 24px ${color}18`,
            }}
          >
            <span style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}>{renderMappedLucideIcon(icon, 'w-6 h-6')}</span>
          </div>
          {badge && (
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase"
              style={{
                color,
                backgroundColor: `${color}15`,
                border: `1px solid ${color}33`,
              }}
            >
              {badge}
            </span>
          )}
        </div>

        <h3 className="text-[1.15rem] font-bold text-white [.light-theme_&]:text-slate-900 leading-snug">{title}</h3>
        <p className="text-xs sm:text-sm text-[#94a3b8] [.light-theme_&]:text-slate-600 mt-2 leading-relaxed">{desc}</p>

        {topics.length > 0 && (
          <div className="dept-topics-list">
            {topics.map((topic, i) => (
              <div key={i} className="dept-topic-row text-slate-300 [.light-theme_&]:text-slate-700">
                <span className="font-extrabold text-[#f97316] text-sm leading-none">›</span>
                <span className="truncate">{topic}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 pt-5 mt-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="dept-explore-btn w-full cursor-pointer"
          style={{
            border: `1px solid ${color}38`,
            color,
            backgroundColor: `${color}0d`,
          }}
        >
          <span>{actionLabel}</span>
          <ArrowRight size={14} className="dept-explore-arrow transition-transform" />
        </button>
      </div>
    </div>
  );
};

/**
 * ARCHETYPE 3: PLATFORM FEATURE / BENEFIT CARD (.feature-card-premium)
 */
export const FeatureCardPremium: React.FC<{
  icon: string;
  badge?: string;
  title: string;
  desc: string;
  bullets?: string[];
  actionLabel?: string;
  onClick?: () => void;
  index?: number;
  accentColor?: string;
  className?: string;
}> = ({ icon, badge, title, desc, bullets, actionLabel, onClick, index = 0, accentColor, className = '' }) => {
  const color = accentColor || getAccentByIndex(index);
  return (
    <div
      onClick={onClick}
      className={`feature-card-premium h-full flex flex-col justify-between gap-4 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      style={{ '--card-accent': color } as React.CSSProperties}
    >
      <div className="feature-corner-glow" />
      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <div
            className="feature-icon-ring"
            style={{
              color,
              backgroundColor: `${color}12`,
              border: `1px solid ${color}33`,
            }}
          >
            <span style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}>{renderMappedLucideIcon(icon, 'w-6 h-6')}</span>
          </div>
          {badge && <span className="text-[11px] font-mono font-bold text-[#fb923c] uppercase">{badge}</span>}
        </div>

        <h3 className="text-base sm:text-lg font-extrabold text-white [.light-theme_&]:text-slate-900">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-400 [.light-theme_&]:text-slate-600 leading-relaxed">{desc}</p>

        {bullets && bullets.length > 0 && (
          <div className="pt-3 border-t border-white/10 [.light-theme_&]:border-slate-200 space-y-1.5 text-xs text-slate-300 [.light-theme_&]:text-slate-700">
            {bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionLabel && (
        <div className="relative z-10 pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color }}>
            <span>{actionLabel}</span>
            <ArrowRight size={13} />
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * ARCHETYPE 4: MEDIA / PRODUCT / MODULE SHOWCASE CARD (.course-card-premium)
 */
export const CourseShowcaseCard: React.FC<{
  categoryChip: string;
  icon: string;
  title: string;
  desc: string;
  tags: string[];
  metricBadge?: string;
  actionLabel?: string;
  onClick?: () => void;
  index?: number;
}> = ({ categoryChip, icon, title, desc, tags, metricBadge, actionLabel = 'Explore →', onClick, index = 0 }) => {
  const color = getAccentByIndex(index);
  const [mousePos, setMousePos] = useState<{ x: string; y: string }>({
    x: '50%',
    y: '50%',
  });

  return (
    <div
      onClick={onClick}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
          x: `${e.clientX - rect.left}px`,
          y: `${e.clientY - rect.top}px`,
        });
      }}
      className={`course-card-premium h-full ${onClick ? 'cursor-pointer' : ''} group`}
      style={
        {
          '--mouse-x': mousePos.x,
          '--mouse-y': mousePos.y,
        } as React.CSSProperties
      }
    >
      <div className="card-accent-line" />
      <div className="card-spotlight" />

      {/* Top 185px Visual Header with Zoom, Category Chip & Center Hover Action Orb */}
      <div className="course-card-img-wrap">
        <div
          className="course-card-img-inner flex flex-col items-center justify-center p-5 relative"
          style={{
            background: `radial-gradient(circle at 75% 25%, ${color}35 0%, rgba(18, 6, 9, 0.96) 72%)`,
          }}
        >
          {/* Subtle HUD grid pattern inside media preview */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(${color}55 1px, transparent 1px)`,
              backgroundSize: '18px 18px',
            }}
          />
          <div
            className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              color,
              backgroundColor: `${color}18`,
              border: `1px solid ${color}40`,
              boxShadow: `0 12px 32px ${color}30`,
            }}
          >
            {renderMappedLucideIcon(icon, 'w-8 h-8')}
          </div>
          {metricBadge && (
            <div className="relative z-10 mt-2.5 px-2.5 py-0.5 rounded-md bg-black/55 border border-white/10 text-[10px] font-mono text-slate-200">
              {metricBadge}
            </div>
          )}
        </div>
        <div className="course-card-img-overlay" />
        <span className="course-category-chip">{categoryChip}</span>
        <div className="course-hover-orb" aria-hidden="true">
          <ArrowRight className="w-5 h-5" />
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between gap-4 relative z-10">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5 text-[#f59e0b] text-xs" aria-label="5 out of 5 stars">
              <Star className="w-3.5 h-3.5 fill-[#f59e0b]" />
              <Star className="w-3.5 h-3.5 fill-[#f59e0b]" />
              <Star className="w-3.5 h-3.5 fill-[#f59e0b]" />
              <Star className="w-3.5 h-3.5 fill-[#f59e0b]" />
              <Star className="w-3.5 h-3.5 fill-[#f59e0b]" />
              <span className="ml-1.5 text-[10px] font-mono text-slate-400">5.0</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">Verified OS</span>
          </div>

          <h3 className="font-extrabold text-base text-white [.light-theme_&]:text-slate-900 group-hover:text-[#f97316] transition-colors">
            {title}
          </h3>
          <p className="text-xs text-slate-400 [.light-theme_&]:text-slate-600 line-clamp-2 leading-relaxed">{desc}</p>
        </div>

        <div className="pt-3 border-t border-white/10 [.light-theme_&]:border-slate-200 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.slice(0, 2).map((t, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-md bg-white/5 [.light-theme_&]:bg-slate-100 text-[10px] font-mono text-slate-300 [.light-theme_&]:text-slate-700"
              >
                {t}
              </span>
            ))}
          </div>
          <span className="text-xs font-bold text-[#f97316] shrink-0 group-hover:translate-x-1 transition-transform">
            {actionLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * ARCHETYPE 5: PRICING & TIER COMPARISON CARD (.pricing-card)
 */
export const PricingTierCard: React.FC<{
  tierBadge: string;
  name: string;
  desc: string;
  priceDisplay: string;
  periodSub: string;
  secondaryCurrencySub: string;
  included: string[];
  excluded?: string[];
  ctaLabel: string;
  popular?: boolean;
  icon?: string;
  onCtaClick: () => void;
  index?: number;
}> = ({
  tierBadge,
  name,
  desc,
  priceDisplay,
  periodSub,
  secondaryCurrencySub,
  included,
  excluded = [],
  ctaLabel,
  popular = false,
  icon = 'storefront',
  onCtaClick,
  index = 0,
}) => {
  const color = popular ? '#f97316' : getAccentByIndex(index);
  return (
    <div className={`pricing-card h-full ${popular ? 'pricing-card-featured' : ''}`}>
      {popular && (
        <div className="absolute top-3.5 right-4 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-[#dc2626] to-[#f97316] text-white text-[10px] font-mono font-extrabold uppercase tracking-wider shadow-lg">
          MOST POPULAR
        </div>
      )}

      <div className="space-y-4 relative z-10">
        {/* Top 52x52px Tinted Icon Box + Pill Badge */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div
            className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0"
            style={{
              color,
              backgroundColor: `${color}15`,
              border: `1px solid ${color}35`,
            }}
          >
            {renderMappedLucideIcon(icon, 'w-6 h-6')}
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-200 text-[10px] font-mono font-bold text-[#fb923c] uppercase">
            <Lock size={10} />
            <span>{tierBadge}</span>
          </span>
        </div>

        <div>
          <h3 className="text-2xl font-extrabold text-white [.light-theme_&]:text-slate-900">{name}</h3>
          <p className="text-xs text-slate-400 [.light-theme_&]:text-slate-600 mt-1 leading-relaxed">{desc}</p>
        </div>

        {/* 1px subtle divider */}
        <div className="h-[1px] w-full bg-white/10 [.light-theme_&]:bg-slate-200" />

        {/* Price Display with Gradient Text on Numbers */}
        <div>
          <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
            <span className="text-4xl font-extrabold gradient-text">{priceDisplay}</span>
            <span className="text-xs text-slate-400">{periodSub}</span>
          </div>
          <div className="text-[11px] font-mono text-[#fb923c] mt-1">{secondaryCurrencySub}</div>
        </div>

        <div className="h-[1px] w-full bg-white/10 [.light-theme_&]:bg-slate-200" />

        {/* Feature Checklist */}
        <ul className="space-y-2.5 text-xs text-slate-200 [.light-theme_&]:text-slate-700 pt-1">
          {included.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
          {excluded.map((exc, i) => (
            <li key={`ex-${i}`} className="flex items-start gap-2.5 text-[#475569] line-through">
              <span>—</span>
              <span>{exc}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onCtaClick}
        className={`relative z-10 mt-6 w-full py-3.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          popular
            ? 'btn-sombill-grad text-white'
            : 'btn-shimmer-sweep overflow-hidden bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/15 [.light-theme_&]:border-slate-300 hover:border-[#f97316] text-white [.light-theme_&]:text-slate-900'
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  );
};

/**
 * ARCHETYPE 6: TEAM / PARTNER / PROFILE CARD (.instructor-card)
 */
export const ProfilePartnerCard: React.FC<{
  iconOrInitials: string;
  name: string;
  role: string;
  bio: string;
  tags: string[];
  statLeft: string;
  statRight: string;
  isInitials?: boolean;
}> = ({ iconOrInitials, name, role, bio, tags, statLeft, statRight, isInitials = false }) => {
  const [mousePos, setMousePos] = useState<{ x: string; y: string }>({
    x: '50%',
    y: '50%',
  });

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
          x: `${e.clientX - rect.left}px`,
          y: `${e.clientY - rect.top}px`,
        });
      }}
      className="instructor-card h-full flex flex-col justify-between gap-5 group"
      style={
        {
          '--mouse-x': mousePos.x,
          '--mouse-y': mousePos.y,
        } as React.CSSProperties
      }
    >
      <div className="inst-card-spotlight" />
      <div className="space-y-4 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="inst-avatar-box">
            <div className="avatar-icon-glow" />
            {isInitials ? (
              <span className="font-mono font-extrabold text-lg">{iconOrInitials}</span>
            ) : (
              renderMappedLucideIcon(iconOrInitials, 'w-6 h-6')
            )}
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-400">
            Verified Hub
          </span>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-white [.light-theme_&]:text-slate-900 group-hover:text-[#fb923c] transition-colors">
            {name}
          </h3>
          <div className="text-xs font-mono font-bold text-[#fb923c] mt-0.5">{role}</div>
          <p className="text-xs text-slate-400 [.light-theme_&]:text-slate-600 mt-2 leading-relaxed">{bio}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tags.map((t, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-md bg-white/5 [.light-theme_&]:bg-slate-100 border border-white/10 [.light-theme_&]:border-slate-200 text-[10px] font-mono text-slate-300 [.light-theme_&]:text-slate-700"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 pt-3.5 border-t border-white/10 [.light-theme_&]:border-slate-200 flex items-center justify-between text-[11px] font-mono">
        <span className="text-slate-300 [.light-theme_&]:text-slate-700 font-bold">{statLeft}</span>
        <span className="text-[#f97316] font-bold">{statRight}</span>
      </div>
    </div>
  );
};

/**
 * ARCHETYPE 7A: TESTIMONIAL CARD (.testimonial-card-premium)
 */
export const TestimonialCardPremium: React.FC<{
  quote: string;
  authorName: string;
  authorRole: string;
  initials: string;
  companyBadge: string;
}> = ({ quote, authorName, authorRole, initials, companyBadge }) => {
  return (
    <div className="testimonial-card-premium h-full flex flex-col justify-between gap-6">
      <div className="testimonial-watermark-quote" aria-hidden="true">
        “
      </div>

      <div className="space-y-4 relative z-10">
        <div className="flex items-center gap-1 text-[#f59e0b]">
          <Star className="w-4 h-4 fill-[#f59e0b]" />
          <Star className="w-4 h-4 fill-[#f59e0b]" />
          <Star className="w-4 h-4 fill-[#f59e0b]" />
          <Star className="w-4 h-4 fill-[#f59e0b]" />
          <Star className="w-4 h-4 fill-[#f59e0b]" />
        </div>

        <p className="text-sm sm:text-base italic text-[#cbd5e1] [.light-theme_&]:text-slate-700 leading-relaxed">
          “{quote}”
        </p>
      </div>

      <div className="relative z-10 pt-4 border-t border-white/10 [.light-theme_&]:border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#dc2626] to-[#f97316]">
            <div className="w-10 h-10 rounded-full bg-[#120609] text-white font-mono font-extrabold text-xs flex items-center justify-center">
              {initials}
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-white [.light-theme_&]:text-slate-900">{authorName}</div>
            <div className="text-[11px] text-slate-400">{authorRole}</div>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-[#f97316]/15 border border-[#f97316]/30 text-[11px] font-mono font-bold text-[#fb923c]">
          {companyBadge}
        </span>
      </div>
    </div>
  );
};

/**
 * ARCHETYPE 7B: LIVE ACTIVITY FEED CARD (.activity-item)
 */
export const LiveActivityItem: React.FC<{
  icon: string;
  venue: string;
  actionHighlight: string;
  detail: string;
  timeAgo: string;
  index?: number;
}> = ({ icon, venue, actionHighlight, detail, timeAgo, index = 0 }) => {
  const color = getAccentByIndex(index);
  return (
    <div className="activity-item">
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className="w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0"
          style={{
            color,
            backgroundColor: `${color}15`,
            border: `1px solid ${color}35`,
          }}
        >
          {renderMappedLucideIcon(icon, 'w-4 h-4')}
        </div>
        <div className="text-xs sm:text-sm min-w-0">
          <span className="font-bold text-white [.light-theme_&]:text-slate-900">{venue}</span>{' '}
          <span className="font-bold text-[#f97316]">{actionHighlight}</span>{' '}
          <span className="text-slate-400 [.light-theme_&]:text-slate-600">{detail}</span>
        </div>
      </div>
      <span className="text-[11px] font-mono text-slate-400 shrink-0">{timeAgo}</span>
    </div>
  );
};

/**
 * ARCHETYPE 8: WIDE STATS GLASS BANNER (.stats-glass-card)
 */
export const StatsGlassBanner: React.FC<{
  items: {
    icon: string;
    valueNode: React.ReactNode;
    label: string;
    sub?: string;
  }[];
}> = ({ items }) => {
  return (
    <div className="stats-glass-card">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex flex-col items-center text-center space-y-2.5 ${
              idx < items.length - 1
                ? 'lg:border-r lg:border-white/10 [.light-theme_&]:lg:border-slate-200 lg:pr-6'
                : ''
            }`}
          >
            <div className="stat-icon-bg">{renderMappedLucideIcon(item.icon, 'w-5 h-5')}</div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums stat-banner-num">
              {item.valueNode}
            </div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-white [.light-theme_&]:text-slate-900">
              {item.label}
            </div>
            {item.sub && <div className="text-[11px] text-slate-400 [.light-theme_&]:text-slate-500">{item.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   2026 PREMIUM GLASS ACCORDION FAQ SECTION (SOMBILL POS EDITION)
   ============================================================================ */

export type FaqCategory =
  | 'All Questions'
  | 'POS & Restaurant'
  | 'Hotel & Rooms'
  | 'Payments (Zaad/EVC)'
  | 'Offline & Hardware'
  | 'Pricing & Setup';

export const FAQ_CATEGORIES: FaqCategory[] = [
  'All Questions',
  'POS & Restaurant',
  'Hotel & Rooms',
  'Payments (Zaad/EVC)',
  'Offline & Hardware',
  'Pricing & Setup',
];

export interface SomBillFaqItem {
  q: string;
  a: string;
  category: Exclude<FaqCategory, 'All Questions'>;
}

export const SOMBILL_MASTER_FAQS: SomBillFaqItem[] = [
  {
    q: 'Does SomBill POS work offline when the internet goes down?',
    a: 'Yes! SomBill features a hybrid Local-First Offline Engine. Your cashiers and waiters can continue taking orders, printing kitchen tickets (KOT), and generating bills without interruption. Everything automatically syncs to the cloud the moment your internet reconnects.',
    category: 'Offline & Hardware',
  },
  {
    q: 'Which local mobile money and payment methods are supported?',
    a: 'SomBill natively supports EVC Plus, Zaad Service, eDahab, Sahal, Premier Wallet, Cash (USD & Somali Shilling dual-currency), and Visa/Mastercard — complete with instant split-bill and shift reconciliation.',
    category: 'Payments (Zaad/EVC)',
  },
  {
    q: 'Can I manage both my Hotel Rooms and Restaurant from one SomBill account?',
    a: 'Absolutely. SomBill connects your Front Desk PMS and Restaurant POS seamlessly. Guests can order food or drinks and charge the bill directly to their Room Folio for one unified checkout invoice.',
    category: 'Hotel & Rooms',
  },
  {
    q: 'What hardware do I need to run SomBill POS?',
    a: 'SomBill runs on any touchscreen POS terminal, Windows/Mac PC, iPad, Android tablet, or smartphone. It connects plug-and-play with standard 80mm/58mm thermal receipt printers, kitchen printers, barcode scanners, and cash drawers.',
    category: 'Offline & Hardware',
  },
  {
    q: 'How long does setup and staff training take?',
    a: 'Most restaurants, cafes, and hotels go live within 24 hours. Our onboarding team imports your menu, configures your tables/rooms, and trains your cashiers and waiters in under 45 minutes.',
    category: 'Pricing & Setup',
  },
  {
    q: 'How do the NFC & QR Smart Table stands accelerate floor service?',
    a: 'Each handcrafted SomBill table stand encodes a unique NTAG215 NFC chip and high-contrast QR code. Guests tap their smartphone or scan with their camera to open your bilingual menu in 0.6 seconds with zero app install, customize dishes, and fire orders straight to your Kitchen Display System (KDS).',
    category: 'POS & Restaurant',
  },
  {
    q: 'How does SomBill handle dual-currency USD and Somaliland Shilling (SLSH) accounting?',
    a: 'Managers set the daily branch exchange rate in one click. Every POS screen, customer display, and thermal receipt shows both USD and SLSH simultaneously, calculates mixed-currency change automatically, and produces Somaliland Ministry of Finance 4.8% VAT Z-Reports.',
    category: 'Payments (Zaad/EVC)',
  },
  {
    q: 'Can our kitchen stations separate Grill, Mandi Oven, Bakery, and Barista tickets?',
    a: 'Yes. SomBill routes each item on a waiter order to its dedicated Kitchen Display Screen (KDS) or thermal printer over your local 14ms LAN mesh, complete with prep-time SLA color coding and instant waiter bump notifications.',
    category: 'POS & Restaurant',
  },
  {
    q: 'Does the Hotel PMS support group bookings, housekeeping status, and corporate folios?',
    a: 'Yes. Your reception desk gets a live visual room rack showing Checked-In, Dirty, Inspected, and Reserved rooms, along with bedside NFC room-service ordering and monthly corporate house accounts.',
    category: 'Hotel & Rooms',
  },
  {
    q: 'Is there a free trial before we commit to a monthly or annual plan?',
    a: 'Yes! Every restaurant, cafe, and hotel receives a full-featured 14-day pilot trial including menu digitization, local payment gateway binding, and on-site staff walkthrough in Hargeisa, Berbera, Burao, Borama, or Mogadishu.',
    category: 'Pricing & Setup',
  },
];

export const PremiumFaqSection: React.FC<{
  initialCategory?: FaqCategory;
  onContactClick?: () => void;
  onAskAiClick?: () => void;
}> = ({ initialCategory = 'All Questions', onContactClick, onAskAiClick }) => {
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const filteredFaqs = SOMBILL_MASTER_FAQS.filter((item) => {
    const matchesCategory = selectedCategory === 'All Questions' || item.category === selectedCategory;
    const qTrim = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !qTrim ||
      item.q.toLowerCase().includes(qTrim) ||
      item.a.toLowerCase().includes(qTrim) ||
      item.category.toLowerCase().includes(qTrim);
    return matchesCategory && matchesSearch;
  });

  const handleAskAi = () => {
    if (typeof onAskAiClick === 'function') {
      onAskAiClick();
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sombill-ai-open'));
    }
  };

  const handleContactSupport = () => {
    if (typeof onContactClick === 'function') {
      onContactClick();
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sombill-ai-navigate', { detail: { path: '/contact' } }));
    }
  };

  return (
    <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* 1. God-Level Section Header & Eyebrow */}
      <div className="god-section-header-wrap text-center max-w-4xl mx-auto space-y-5 mb-10">
        <div className="god-section-aura" aria-hidden="true" />

        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="horn-eyebrow-wrap"
        >
          <span className="horn-laser-wing wing-left hidden sm:inline-block" aria-hidden="true" />
          <div className="horn-eyebrow-badge">
            <Sparkles className="w-4 h-4 text-[#fbbf24] shrink-0" />
            <span className="horn-eyebrow-text">SUPPORT &amp; CLARITY</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <span className="horn-laser-wing wing-right hidden sm:inline-block" aria-hidden="true" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="horn-god-headline text-white [.light-theme_&]:text-slate-900 mx-auto"
        >
          Frequently Asked <span className="horn-moving-gradient-text">Questions</span>
        </motion.h2>

        <div className="flex justify-center">
          <div className="god-headline-laser-bar" aria-hidden="true" />
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="section-subtitle-md text-slate-300 [.light-theme_&]:text-slate-600 leading-relaxed font-medium max-w-3xl mx-auto"
        >
          Everything you need to know about SomBill POS, Hotel PMS, Mobile Money integration, and 24/7 support.
        </motion.p>
      </div>

      {/* 2. Interactive Category Filter Pills & Instant Frosted Search Bar */}
      <div className="faq-controls-wrap">
        <div className="faq-filter-pills" role="tablist" aria-label="FAQ Categories">
          {FAQ_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setSelectedCategory(cat);
                  setOpenFaq(0);
                }}
                className={`faq-filter-pill ${isActive ? 'active' : ''}`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="faq-search-bar">
          <Search size={17} className="faq-search-icon" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpenFaq(0);
            }}
            placeholder="Search questions (e.g., offline mode, Zaad, EVC Plus, hotel folio, printers)..."
            className="faq-search-input"
            aria-label="Search frequently asked questions"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-mono font-bold text-[#fb923c] hover:underline cursor-pointer shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 3. Glassmorphic Accordion Cards */}
      <div className="faq-list">
        {filteredFaqs.length === 0 ? (
          <div className="faq-item-premium p-8 text-center space-y-3">
            <div className="text-base font-bold text-white [.light-theme_&]:text-slate-900">
              No matching questions found for “{searchQuery}”
            </div>
            <p className="text-xs text-slate-400">
              Try clearing your search filter or ask SomBill AI directly for an instant answer.
            </p>
            <div className="pt-1 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All Questions');
                }}
                className="faq-filter-pill"
              >
                Reset Filters
              </button>
              <button type="button" onClick={handleAskAi} className="faq-callout-btn-primary">
                Ask SomBill AI →
              </button>
            </div>
          </div>
        ) : (
          filteredFaqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={faq.q} className={`faq-item-premium ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  data-no-gradient
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="faq-question-btn"
                  aria-expanded={isOpen}
                >
                  <div className="faq-question-left">
                    <span className="faq-num-badge">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="faq-question-text">{faq.q}</span>
                  </div>
                  <div className="faq-chevron-box">
                    <ChevronDown size={17} className="faq-chevron" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="faq-answer-wrap">
                        <p className="faq-answer-text">{faq.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Bottom "Still have questions?" Support Callout Card */}
      <div className="faq-support-callout">
        <div className="flex items-center gap-4">
          <div className="faq-avatar-stack">
            <span className="faq-avatar-circle" style={{ background: 'linear-gradient(135deg, #dc2626, #f97316)' }}>
              SB
            </span>
            <span className="faq-avatar-circle" style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}>
              AI
            </span>
            <span className="faq-avatar-circle" style={{ background: 'linear-gradient(135deg, #b91c1c, #dc2626)' }}>
              24
            </span>
            <span className="faq-online-dot" aria-hidden="true" />
          </div>

          <div>
            <div className="text-base font-extrabold text-white [.light-theme_&]:text-slate-900">
              Still have questions?
            </div>
            <div className="text-xs sm:text-sm text-slate-400 [.light-theme_&]:text-slate-600">
              Our 24/7 Hospitality Support team responds in under 2 hours.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleAskAi} className="faq-callout-btn-ghost">
            <MessageSquare size={15} className="text-[#fb923c]" />
            <span>Ask SomBill AI</span>
          </button>

          <button type="button" onClick={handleContactSupport} className="faq-callout-btn-primary">
            <span>Contact Support →</span>
          </button>
        </div>
      </div>
    </section>
  );
};
