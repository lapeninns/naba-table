'use client';

import Link from 'next/link';
import React, { useEffect, useState, type CSSProperties } from 'react';

const FACTORY_THEME = {
  '--brand-blue': '#2563EB',
  '--brand-blue-hover': '#1D4ED8',
  '--brand-blue-subtle': '#F0F7FF',
  '--slate-950': '#020617',
  '--slate-900': '#0F172A',
  '--slate-800': '#1E293B',
  '--slate-700': '#334155',
  '--slate-600': '#475569',
  '--slate-500': '#64748B',
  '--slate-400': '#94A3B8',
  '--slate-300': '#CBD5E1',
  '--slate-200': '#E2E8F0',
  '--slate-100': '#F1F5F9',
  '--slate-50': '#F8FAFC',
  '--white': '#FFFFFF',
  '--green-600': '#059669',
  '--amber-500': '#F59E0B',
  '--red-500': '#EF4444',
  '--background': '#F8FAFC',
  '--foreground': '#0F172A',
  '--card': '#FFFFFF',
  '--card-foreground': '#0F172A',
  '--primary': '#2563EB',
  '--primary-foreground': '#FFFFFF',
  '--muted': '#F8FAFC',
  '--muted-foreground': '#64748B',
  '--border': '#E2E8F0',
  '--input': '#FFFFFF',
  '--ring': '#2563EB',
  '--radius-sm': '0.5rem',
  '--radius-md': '0.75rem',
  '--radius-lg': '1rem',
  '--radius-xl': '1.5rem',
  '--radius-full': '9999px',
  '--shadow-sm': '0 1px 2px rgba(0,0,0,0.05)',
  '--shadow-md': '0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -1px rgba(0,0,0,0.03)',
  '--shadow-lg': '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)',
  '--shadow-float': '0 6px 16px rgba(0,0,0,0.08)',
} as CSSProperties;

const LIVE_FEED = [
  { venue: 'The Barley Mow', time: '7:30 PM', party: '2 guests', status: 'Confirmed' },
  { venue: 'Old Crown Pub', time: '8:00 PM', party: '4 guests', status: 'Pending' },
  { venue: 'Prince of Wales', time: '6:45 PM', party: '2 guests', status: 'Confirmed' },
];

const METRICS = [
  { label: 'Guests seated within 5 minutes', value: '91%', detail: 'Arrival P95', icon: 'clock' as const },
  { label: 'Monthly diners', value: '180k+', detail: 'This month', icon: 'user' as const },
];

const HERO_BADGE = 'Instant confirmation · No phone calls';
const SOCIAL_PROOF_LOGOS = ['Oak & Ember', 'Riverstone', 'Harbor & Hearth', 'The Glasshouse', 'Skyline', 'Juniper'];
const OBJECTION_POINTS = ['Free to book', 'No credit card required', 'Cancel anytime', 'We hold your table for 15 minutes'];
const BENEFITS = [
  { title: 'Live availability', description: 'See real tables, not guesses.', icon: 'search' as const },
  { title: 'Instant confirmation', description: 'Get your booking code immediately.', icon: 'check' as const },
  { title: 'Kitchen-ready notes', description: 'Share dietary notes and occasions with the host.', icon: 'user' as const },
  { title: 'Zero surprises', description: 'Upfront seating window and wait estimates.', icon: 'clock' as const },
];
const TESTIMONIAL = {
  quote: 'Booked date night in 45 seconds; skipped a 50-minute walk-in line.',
  name: 'Amelia K.',
  city: 'London',
};

const NAV_LINKS = [
  { href: '#hero', label: 'Product' },
  { href: '#metrics', label: 'Live data' },
  { href: '#benefits', label: 'Benefits' },
  { href: '#testimonials', label: 'Reviews' },
  { href: '#cta', label: 'Get started' },
];

const SECTION_IDS = NAV_LINKS.filter((link) => link.href.startsWith('#')).map((link) => link.href.slice(1));
const MOBILE_MENU_ID = 'factory-home-mobile-menu';
const SECTION_CONTAINER = 'guest-boundary w-full';
const SECTION_SPACING = 'py-12 sm:py-16 lg:py-20';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    query.addEventListener('change', listener);
    return () => {
      query.removeEventListener('change', listener);
    };
  }, []);

  return prefersReducedMotion;
}

function FactoryStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

      .factory-page {
        background-color: var(--background);
        color: var(--foreground);
        font-family: 'Inter', sans-serif;
        line-height: 1.5;
      }

      .factory-page *,
      .factory-page *::before,
      .factory-page *::after {
        box-sizing: border-box;
      }

      .factory-page button,
      .factory-page input {
        font-family: inherit;
      }

      .factory-page button {
        cursor: pointer;
      }

      .factory-page .heading-xl {
        font-size: 3.5rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
      }
      .factory-page .heading-lg {
        font-size: 2.25rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 1.2;
      }
      .factory-page .heading-md {
        font-size: 1.5rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.3;
      }
      .factory-page .text-body  {
        font-size: 1.0625rem;
        font-weight: 400;
        color: var(--slate-600);
        line-height: 1.6;
      }
      .factory-page .text-subtle { color: var(--muted-foreground); }
      .factory-page .text-brand { color: var(--brand-blue); }

      .factory-page .bg-surface { background-color: var(--background); }

      .factory-page .shadow-card {
        box-shadow: var(--shadow-sm);
        border: 1px solid var(--border);
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }
      .factory-page .shadow-card:hover {
        box-shadow: var(--shadow-lg);
        transform: translateY(-2px);
      }

      .factory-page .fade-in { animation: fadeIn 0.4s ease-out; }
      .factory-page .slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }

      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

      .factory-page .input-base {
        width: 100%;
        border-radius: var(--radius-md);
        background-color: var(--input);
        border: 1px solid var(--border);
        padding: 0.75rem 1rem;
        color: var(--foreground);
        font-size: 0.9375rem;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .factory-page .input-base:focus {
        outline: none;
        border-color: var(--brand-blue);
        box-shadow: 0 0 0 4px var(--brand-blue-subtle);
      }
      .factory-page .input-base[data-invalid="true"] {
        border-color: var(--red-500);
        box-shadow: 0 0 0 1px var(--red-500);
      }

      .factory-page .search-pill-container {
        box-shadow: 0 3px 12px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.08);
        border: 1px solid var(--slate-200);
      }
      .factory-page .search-pill-section:hover {
        background-color: var(--slate-100);
        border-radius: 9999px;
      }

      .factory-page .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        z-index: 40;
        backdrop-filter: blur(6px);
      }

      @media (prefers-reduced-motion: reduce) {
        .factory-page .fade-in,
        .factory-page .slide-up { animation: none; }
      }
    `}</style>
  );
}

function Icon({ name, className }: { name: string; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    className: cx('w-5 h-5 inline-block shrink-0', className),
  };
  const icons: Record<string, React.ReactElement> = {
    menu: <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />,
    close: <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />,
    check: <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />,
    arrowRight: <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />,
    chart: <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />,
    shield: <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />,
    zap: <path d="M7 21h10v-9h-5v-6h5v-2h-10v9h5v6z" fill="currentColor" />,
    search: <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />,
    calendar: <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />,
    user: <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />,
    clock: <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />,
    star: <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />,
    logo: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />,
  };
  return <svg {...common}>{icons[name] || icons.check}</svg>;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin -ml-1 mr-2 h-4 w-4', className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

type ButtonStyleProps = {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  iconOnly?: boolean;
  className?: string;
};

function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth,
  iconOnly,
  className,
}: ButtonStyleProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--ring)] disabled:opacity-50 disabled:cursor-not-allowed text-sm rounded-full';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110 border border-transparent shadow-sm',
    secondary: 'bg-[var(--white)] text-[var(--slate-900)] hover:bg-[var(--slate-50)] border border-[var(--border)]',
    ghost: 'bg-transparent text-[var(--slate-700)] hover:bg-[var(--slate-100)] border border-transparent',
  };
  const sizes: Record<string, string> = { sm: 'px-4 py-2', md: 'px-6 py-3', lg: 'px-8 py-4 text-base' };
  const iconPad: Record<string, string> = { sm: 'p-2', md: 'p-3', lg: 'p-4' };

  return cx(baseClasses, variants[variant], iconOnly ? iconPad[size] : sizes[size], fullWidth ? 'w-full' : '', className);
}

function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  iconOnly,
  loading,
  leftIcon,
  rightIcon,
  children,
  className,
  ...props
}: ButtonStyleProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  }) {
  return (
    <button
      type="button"
      className={buttonClasses({ variant, size, fullWidth, iconOnly, className })}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner /> : leftIcon ? <span className={cx(iconOnly ? '' : 'mr-2')}>{leftIcon}</span> : null}
      {!iconOnly && children}
      {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
}

function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth,
  iconOnly,
  leftIcon,
  rightIcon,
  children,
  className,
  ...rest
}: ButtonStyleProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    children?: React.ReactNode;
  }) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth, iconOnly, className })} {...rest}>
      {leftIcon ? <span className={cx(iconOnly ? '' : 'mr-2')}>{leftIcon}</span> : null}
      {!iconOnly && children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </Link>
  );
}

function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning'; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    neutral: 'bg-[var(--slate-100)] text-[var(--slate-700)]',
    success: 'bg-[var(--brand-blue-subtle)] text-[var(--brand-blue)]',
    warning: 'bg-[var(--amber-500)]/10 text-[var(--amber-500)]',
  };
  return <span className={cx('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold', tones[tone])}>{children}</span>;
}

function MetricTile({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: React.ReactElement }) {
  return (
    <div className="shadow-card rounded-xl p-6 flex flex-col gap-4 bg-[var(--card)] h-full border border-[var(--border)]">
      <div className="flex justify-between items-start">
        <div className="bg-[var(--slate-50)] p-2 rounded-full text-[var(--slate-900)]">{icon ? icon : <Icon name="chart" />}</div>
        {detail && <Badge tone="success">{detail}</Badge>}
      </div>
      <div>
        <div className="text-[var(--slate-500)] text-sm font-medium mb-1">{label}</div>
        <div className="text-[var(--slate-900)] text-3xl font-bold tracking-tight">{value}</div>
      </div>
    </div>
  );
}

function LiveFeedCard({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const [activeSlot, setActiveSlot] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      setActiveSlot(0);
      return;
    }
    const interval = window.setInterval(() => setActiveSlot((p) => (p + 1) % LIVE_FEED.length), 3000);
    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--green-600)]"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--slate-500)]">Live Feed</span>
        </div>
        <Badge tone="neutral">{LIVE_FEED.length} active</Badge>
      </div>
      <div className="space-y-3 flex-1">
        {LIVE_FEED.map((item, idx) => (
          <div
            key={item.venue}
            className={cx(
              'flex items-center justify-between p-3 rounded-lg transition-all duration-500',
              idx === activeSlot
                ? 'bg-[var(--brand-blue-subtle)] border border-[var(--brand-blue)]/10 shadow-sm transform scale-[1.02]'
                : 'bg-[var(--slate-50)] border border-transparent opacity-60',
            )}
          >
            <div>
              <p className="text-sm font-bold text-[var(--slate-900)]">{item.venue}</p>
              <p className="text-xs text-[var(--slate-500)]">
                {item.time} · {item.party}
              </p>
            </div>
            <Badge tone={item.status === 'Confirmed' ? 'success' : 'warning'}>{item.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavBar({ isAuthenticated, reduceMotion }: { isAuthenticated: boolean; reduceMotion: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(SECTION_IDS[0] ?? null);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    if (typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (reduceMotion) {
      setActiveSection(SECTION_IDS[0] ?? null);
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }

    let rafId: number | null = null;
    let ticking = false;

    const resolveSections = () =>
      SECTION_IDS.map((id) => document.getElementById(id)).filter(
        (el): el is HTMLElement => Boolean(el),
      );

    const updateActive = () => {
      ticking = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }

      const sections = resolveSections();
      if (sections.length === 0) {
        return;
      }

      const viewportThreshold = window.scrollY + window.innerHeight * 0.35;
      let current = sections[0]?.id ?? null;
      sections.forEach((section) => {
        if (section.offsetTop <= viewportThreshold) {
          current = section.id;
        }
      });
      setActiveSection(current);
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      rafId = window.requestAnimationFrame(updateActive);
    };

    updateActive();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [reduceMotion]);

  const authCtaHref = isAuthenticated ? '/guest/bookings' : '/auth/signin';
  const authCtaLabel = isAuthenticated ? 'My bookings' : 'Sign in';

  const getDesktopLinkState = (href: string) => {
    const targetId = href.startsWith('#') ? href.slice(1) : href;
    const isActive = Boolean(targetId && activeSection === targetId);
    return {
      isActive,
      className: cx(
        'rounded-full px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]',
        isActive
          ? 'bg-[var(--slate-900)] text-white shadow-sm'
          : 'text-[var(--slate-600)] hover:text-[var(--slate-900)]',
      ),
    };
  };

  const closeMenu = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)]/70 bg-[var(--card)]/85 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--card)]/65">
      <div className="guest-boundary flex w-full items-center justify-between gap-4 py-4">
        <Link
          href="#hero"
          className="group flex items-center gap-2 rounded-full border border-transparent px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
        >
          <div className="w-9 h-9 bg-[var(--brand-blue)] rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-card group-hover:scale-105 transition-transform">
            N
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight text-[var(--slate-900)]">Nab a Table</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--slate-400)]">Factory</span>
          </div>
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/70 px-2 py-1 shadow-sm">
            {NAV_LINKS.map((link) => {
              const { className, isActive } = getDesktopLinkState(link.href);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className={className}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <ButtonLink href="/restaurants" size="sm" aria-label="Find a table" className="shadow-sm">
            Find a table
          </ButtonLink>
          <ButtonLink href={authCtaHref} variant="secondary" size="sm" aria-label={authCtaLabel}>
            {authCtaLabel}
          </ButtonLink>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <ButtonLink href="/restaurants" size="sm" aria-label="Find a table" className="px-4">
            Book
          </ButtonLink>
          <Button
            variant="ghost"
            iconOnly
            leftIcon={<Icon name={mobileOpen ? 'close' : 'menu'} />}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls={MOBILE_MENU_ID}
            onClick={() => setMobileOpen((prev) => !prev)}
          />
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-[var(--slate-900)]/70 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col">
            <div className="mt-auto rounded-t-3xl bg-[var(--card)] px-6 py-6 shadow-2xl" role="dialog" aria-modal="true" id={MOBILE_MENU_ID}>
              <div className="flex items-center justify-between pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--slate-400)]">Navigate</p>
                  <p className="text-base font-semibold text-[var(--slate-900)]">Explore Nab a Table</p>
                </div>
                <Button variant="ghost" iconOnly leftIcon={<Icon name="close" />} aria-label="Close menu" onClick={closeMenu} />
              </div>
              <nav aria-label="Mobile primary" className="flex flex-col gap-2">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--slate-50)] px-4 py-3 text-base font-semibold text-[var(--slate-800)]"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="mt-6 space-y-3">
                <ButtonLink href="/restaurants" size="md" fullWidth>
                  Find a table
                </ButtonLink>
                <ButtonLink href={authCtaHref} variant="secondary" size="md" fullWidth>
                  {authCtaLabel}
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <header id="hero" className="border-b border-[var(--border)] bg-[var(--slate-50)] pt-20">
      <div
        className={cx(
          SECTION_CONTAINER,
          'grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]',
        )}
      >
        <div className="space-y-6 text-left">
          <Badge tone="success">{HERO_BADGE}</Badge>
          <div className="space-y-4">
            <h1 className="heading-xl text-[var(--slate-900)]">
              Reserve your table in 30 seconds,
              <span className="text-[var(--brand-blue)]"> confirmed instantly.</span>
            </h1>
            <p className="text-body max-w-2xl text-[var(--slate-600)]">
              Pick your time and party size, add a note, and you&apos;re locked in. No phone calls, no waiting on hold.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/restaurants" size="lg" rightIcon={<Icon name="arrowRight" />} aria-label="Find a table now">
              Find a table now
            </ButtonLink>
            <ButtonLink href="/restaurants" variant="secondary" size="lg">
              Browse restaurants
            </ButtonLink>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[var(--slate-600)]">Trusted by 180,000 diners this month</p>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {SOCIAL_PROOF_LOGOS.map((logo) => (
                <div
                  key={logo}
                  className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--slate-700)] shadow-sm"
                >
                  <Icon name="logo" className="h-4 w-4 text-[var(--brand-blue)]" />
                  <span>{logo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <LiveFeedCard reduceMotion={reduceMotion} />
          <div className="grid gap-4 sm:grid-cols-2">
            {METRICS.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-card"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">{metric.detail}</p>
                <p className="text-3xl font-bold text-[var(--slate-900)]">{metric.value}</p>
                <p className="text-sm text-[var(--slate-600)]">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function ObjectionBand() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--card)] py-5">
      <div className={cx(SECTION_CONTAINER, 'flex flex-wrap items-center justify-center gap-2 sm:gap-3')}>
        {OBJECTION_POINTS.map((point) => (
          <div
            key={point}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--slate-100)] border border-[var(--border)] text-sm font-semibold text-[var(--slate-700)]"
          >
            <Icon name="check" className="w-4 h-4 text-[var(--brand-blue)]" />
            <span>{point}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BentoGridSection() {
  return (
    <section id="metrics" className={cx(SECTION_SPACING, 'bg-white')}>
      <div className={cx(SECTION_CONTAINER, 'grid gap-6 lg:grid-cols-12')}>
        <div className="rounded-[32px] bg-[var(--brand-blue)] px-8 py-10 text-white shadow-card lg:col-span-7">
          <div className="space-y-4">
            <Badge tone="neutral">Avg. confirmation</Badge>
            <div className="text-5xl font-extrabold tracking-tight">30s</div>
            <p className="text-lg text-blue-50 max-w-lg">
              Most bookings lock in under half a minute with instant confirmation codes and no phone tag.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <div className="flex flex-col rounded-2xl border border-white/40 bg-white/20 px-4 py-3 text-left">
              <span className="text-xs uppercase tracking-[0.2em] text-white/80">Hold window</span>
              <span className="text-2xl font-semibold">15 minutes</span>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/40 bg-white/20 px-4 py-3 text-left">
              <span className="text-xs uppercase tracking-[0.2em] text-white/80">No-shows</span>
              <span className="text-2xl font-semibold">↓ 38%</span>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-card lg:col-span-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--slate-400)]">Playbook</p>
            <h3 className="text-2xl font-semibold text-[var(--slate-900)]">Kitchen-ready booking details</h3>
            <p className="text-sm text-[var(--slate-600)]">
              Hosts and kitchens see the same data as guests—notes, celebrations, and dietary needs included.
            </p>
          </div>
          <div className="mt-6 space-y-3">
            {BENEFITS.map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-[var(--border)] px-4 py-3">
                <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-blue-subtle)] text-[var(--brand-blue)]">
                  <Icon name={item.icon} className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--slate-800)]">{item.title}</p>
                  <p className="text-sm text-[var(--slate-600)]">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {METRICS.map((metric) => (
          <div key={metric.label} className="lg:col-span-4">
            <MetricTile
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              icon={<Icon name={metric.icon} className={metric.icon === 'clock' ? 'text-[var(--brand-blue)]' : 'text-[var(--amber-500)]'} />}
            />
          </div>
        ))}

        <div className="rounded-[32px] bg-[var(--slate-900)] p-6 text-white shadow-card lg:col-span-4">
          <div className="space-y-2">
            <Icon name="shield" className="h-8 w-8 text-[var(--brand-blue)]" />
            <h3 className="text-lg font-bold">Zero guesswork</h3>
            <p className="text-sm text-[var(--slate-300)]">Availability mirrors the host view—no fake slots or long holds.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4 w-full bg-[var(--slate-800)] text-white border-[var(--slate-700)] hover:bg-[var(--slate-700)]"
          >
            Browse venues
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeatureSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const primaryCtaHref = '/restaurants';
  const secondaryHref = isAuthenticated ? '/guest/bookings' : '/auth/signin';
  const secondaryLabel = isAuthenticated ? 'View My Bookings' : 'Sign In';

  return (
    <section id="benefits" className={cx(SECTION_SPACING, 'border-y border-[var(--border)] bg-[var(--slate-50)]')}>
      <div className={cx(SECTION_CONTAINER, 'grid items-center gap-12 md:gap-16 md:grid-cols-2')}>
        <div className="space-y-6">
          <div className="inline-block p-3 rounded-xl bg-[var(--white)] shadow-sm border border-[var(--border)]">
            <Icon name="calendar" className="w-6 h-6 text-[var(--brand-blue)]" />
          </div>
          <h2 className="heading-lg text-[var(--slate-900)]">Everything you need to book without friction.</h2>
          <p className="text-body">
            Live tables, instant codes, host-ready notes, and clear hold windows so you arrive confident.
          </p>
          <div className="space-y-4 pt-4 grid sm:grid-cols-2 gap-3">
            {BENEFITS.map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="w-6 h-6 rounded-full bg-[var(--brand-blue-subtle)] flex items-center justify-center text-[var(--brand-blue)] mt-0.5">
                  <Icon name={item.icon} className="w-3 h-3" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--slate-700)]">{item.title}</div>
                  <p className="text-sm text-[var(--slate-600)]">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={primaryCtaHref} rightIcon={<Icon name="arrowRight" />}>Book tonight&apos;s table</ButtonLink>
            <ButtonLink href={secondaryHref} variant="secondary">{secondaryLabel}</ButtonLink>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-[var(--brand-blue-subtle)] to-transparent rounded-full filter blur-3xl opacity-50 transform translate-x-12 translate-y-12"></div>
          <div className="bg-[var(--card)] rounded-2xl shadow-float border border-[var(--border)] p-6 relative z-10 space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-4">
              <div>
                <div className="text-xs font-bold text-[var(--slate-500)] uppercase">Confirmation</div>
                <div className="font-mono text-sm text-[var(--slate-900)]">#NAT-8292</div>
              </div>
              <Badge tone="success">Confirmed</Badge>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-[var(--slate-100)] rounded w-3/4"></div>
              <div className="h-4 bg-[var(--slate-100)] rounded w-1/2"></div>
            </div>
            <div className="pt-4 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--slate-50)] border border-[var(--border)] text-center">
                <Icon name="calendar" className="mx-auto mb-1 text-[var(--slate-400)]" />
                <div className="text-xs font-bold text-[var(--slate-700)]">Hold window: 15m</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--slate-50)] border border-[var(--border)] text-center">
                <Icon name="user" className="mx-auto mb-1 text-[var(--slate-400)]" />
                <div className="text-xs font-bold text-[var(--slate-700)]">Notes sent to host</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialSection() {
  return (
    <section id="testimonials" className={cx(SECTION_SPACING, 'bg-white')}>
      <div className={cx(SECTION_CONTAINER, 'grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]')}>
        <div className="rounded-2xl border border-[var(--border)] shadow-card p-8 bg-[var(--card)] space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-blue-subtle)] text-[var(--brand-blue)] flex items-center justify-center font-bold text-lg" aria-hidden="true">
              &quot;
            </div>
            <div className="space-y-3">
              <p className="heading-md text-[var(--slate-900)] leading-snug">&quot;{TESTIMONIAL.quote}&quot;</p>
              <p className="text-sm text-[var(--slate-600)] font-semibold">
                {TESTIMONIAL.name} · {TESTIMONIAL.city}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] shadow-card p-6 bg-[var(--slate-50)] grid gap-4 sm:grid-cols-2">
          {METRICS.map((metric) => (
            <div key={metric.label} className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">{metric.label}</div>
              <div className="text-3xl font-bold text-[var(--slate-900)]">{metric.value}</div>
              <div className="text-sm text-[var(--slate-500)]">{metric.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section id="cta" className={cx(SECTION_SPACING, 'bg-[var(--brand-blue)] text-white')}>
      <div className="guest-boundary">
        <div className="mx-auto w-full max-w-4xl space-y-5 text-center">
          <p className="text-sm font-semibold text-blue-100">91% of guests are seated within 5 minutes of arrival.</p>
          <h2 className="heading-lg text-white">Book tonight&apos;s table</h2>
          <p className="mx-auto max-w-2xl text-base text-blue-50">
            Instant confirmation, hold window included, and notes to the kitchen before you leave home.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/restaurants" size="lg" rightIcon={<Icon name="arrowRight" />} className="shadow-md">Book tonight&apos;s table</ButtonLink>
            <ButtonLink href="/restaurants" variant="secondary" size="lg">Browse venues</ButtonLink>
          </div>
          <p className="text-sm text-blue-100">Takes 30 seconds.</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[var(--card)] pt-20 pb-10 border-t border-[var(--border)]">
      <div className="guest-boundary grid gap-12 md:grid-cols-4 mb-16">
        <div className="space-y-4">
          <div className="w-8 h-8 bg-[var(--slate-900)] rounded-lg flex items-center justify-center text-white font-bold text-lg">N</div>
          <p className="text-sm text-[var(--slate-500)]">Premium dining, confirmed in seconds.</p>
        </div>
        <div>
          <h4 className="font-bold text-[var(--slate-900)] mb-4">Platform</h4>
          <ul className="space-y-2 text-sm text-[var(--slate-600)]">
            <li><Link href="/restaurants">Find a Table</Link></li>
            <li><Link href="/restaurants">For Restaurants</Link></li>
            <li><Link href="/auth/signin">Sign In</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-[var(--slate-900)] mb-4">Support</h4>
          <ul className="space-y-2 text-sm text-[var(--slate-600)]">
            <li><Link href="/support">Help Center</Link></li>
            <li><Link href="/terms">Terms of Service</Link></li>
            <li><Link href="/privacy">Privacy Policy</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-[var(--slate-900)] mb-4">Status</h4>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--green-600)]"></span>
            <span className="text-sm font-medium text-[var(--green-600)]">Systems Operational</span>
          </div>
        </div>
      </div>
      <div className="guest-boundary border-t border-[var(--border)] pt-8 text-center text-xs text-[var(--slate-400)]">
        © 2024 Nab a Table. Built with Factory Design System.
      </div>
    </footer>
  );
}

export function FactoryHomeClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      className="factory-page min-h-screen bg-[var(--background)] selection:bg-[var(--brand-blue-subtle)] selection:text-[var(--brand-blue)]"
      style={FACTORY_THEME}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
    >
      <FactoryStyles />
      <NavBar isAuthenticated={isAuthenticated} reduceMotion={prefersReducedMotion} />
      <main>
        <Hero reduceMotion={prefersReducedMotion} />
        <ObjectionBand />
        <BentoGridSection />
        <TestimonialSection />
        <FeatureSection isAuthenticated={isAuthenticated} />
        <FinalCTASection />
      </main>
      <Footer />
    </div>
  );
}
