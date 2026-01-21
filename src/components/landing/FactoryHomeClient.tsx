'use client';

import { Inter, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import React, { useEffect, useRef, useState, type CSSProperties } from 'react';

import { BrandLogo } from '@/components/shared/BrandLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

const LOCAL_VENUES = [
  'The Barley Mow Pub — Hartford',
  'The Queen Elizabeth Pub — King’s Lynn',
  'Prince of Wales Pub — Bromham',
  'White Horse Pub — Waterbeach',
  'The Corner House Pub — Cambridge',
  'Old Crown Pub — Girton',
  'The Bell — Sawtry',
  'The Railway Pub — Whittlesey',
];

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

type LiveFeedStatus = 'Confirmed' | 'Pending' | 'Arriving' | 'Seated';

type LiveFeedItem = {
  venue: string;
  time: string;
  party: string;
  status: LiveFeedStatus;
};

const HERO_BADGE = 'Installed in 24 Hours';

const METRICS = [
  {
    label: 'Added Revenue/Mo',
    value: 4200,
    prefix: '£',
    suffix: '+',
    detail: 'Proven Result',
    icon: 'chart' as const,
  },
  { label: 'Labor Hours Saved', value: 20, suffix: 'h+', detail: 'Per Week', icon: 'zap' as const },
];

type Metric = (typeof METRICS)[number];

const INTEGRATIONS = ['Toast', 'Square', 'Lightspeed', 'Stripe', 'Twilio'];

const BENEFITS = [
  {
    title: 'The Core Engine',
    description:
      'Automated bookings and SMS confirmations. No-shows drop to near zero immediately.',
    value: '£5,000 Value',
    icon: 'check' as const,
  },
  {
    title: 'Sunday Roast Capacity Calc',
    description:
      'An algorithm that stops kitchen meltdowns by pacing covers perfectly during peak service.',
    value: '£1,500 Value',
    icon: 'clock' as const,
  },
  {
    title: 'No-Show Prevention Pack',
    description:
      'Deposit and card pre-auth templates designed specifically for UK legal standards.',
    value: '£1,000 Value',
    icon: 'shield' as const,
  },
  {
    title: 'Host Stand Playbook',
    description:
      '10-minute pre-shift checklist and scripts so staff stop "playing Tetris" with your floor.',
    value: '£2,000 Value',
    icon: 'user' as const,
  },
  {
    title: 'Whale-Watcher CRM',
    description:
      'Identify high-spenders instantly. Ensure VIPs get the treatment that drives 3x loyalty.',
    value: '£2,000 Value',
    icon: 'chart' as const,
  },
  {
    title: 'White Glove Migration',
    description:
      'We handle the entire tech switch from old systems or spreadsheets. You do zero work.',
    value: 'PRICELESS',
    icon: 'zap' as const,
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    title: 'We Clone Your Floor',
    description:
      'We map your tables and turn times. You do nothing. We handle the setup in < 24 hours.',
  },
  {
    title: 'We Plug The Leaks',
    description:
      'We integrate with your site. Every booking is captured, confirmed, and locked in.',
  },
  {
    title: 'You Scale Revenue',
    description:
      'Fill the empty seats. Upsell the VIPs. Cut the labor costs. Watch profit margins jump.',
  },
];

const FAQ_ITEMS = [
  {
    question: 'The 90-Day No-Show Recovery Guarantee',
    answer:
      'If we don’t recover at least 3x our fee in no-show or late-cancel revenue within 90 days, we work for free until we do.',
  },
  {
    question: 'The "Anti-Guarantee"',
    answer:
      'We have no long-term contracts. We have to earn your business every single month. If you hate making more money, you can leave at any time.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'We abandoned the commodity model. We charge a one-time "White Glove" setup (£3k-£9k) and a monthly Profit-Engine fee (£299-£899).',
  },
];

const NAV_LINKS = [
  { href: '#hero', label: 'The Blueprint' },
  { href: '#problem', label: 'The Leak' },
  { href: '#features', label: 'Profit Stack' },
  { href: '#testimonials', label: 'Proof' },
  { href: '#faq', label: 'Guarantee' },
];

const OBJECTION_POINTS = [
  'Zero Setup Fee',
  'Cancel Anytime',
  '100% Satisfaction',
  'We Import Your Data',
];

const LIVE_FEED_VENUES: string[] = LOCAL_VENUES;
const LIVE_FEED_VISIBLE_COUNT = 3;
const LIVE_FEED_STATUSES: LiveFeedStatus[] = ['Confirmed', 'Pending', 'Arriving', 'Seated'];
const LIVE_FEED_SUCCESS_STATUSES: LiveFeedStatus[] = ['Confirmed', 'Arriving', 'Seated'];
const LIVE_FEED_PARTY_SIZES = ['2 guests', '3 guests', '4 guests', '5 guests', '6 guests'];
const TIME_OPTIONS = ['18:15', '18:45', '19:00', '19:30', '20:00', '20:30', '21:00'];

const TESTIMONIALS = [
  {
    quote:
      'I was paying a host £45k/year just to answer phones. Nab a Table does it better for pennies. It paid for itself on day one.',
    name: 'Sarah J.',
    city: 'Owner, The Barley Mow',
  },
  {
    quote:
      'We used to lose 5 tables a night to no-shows. Now? Zero. That’s an extra £100k a year in my pocket.',
    name: 'Marcus H.',
    city: 'GM, Riverstone Kitchen',
  },
  {
    quote:
      'The Sunday Roast Capacity Calculator saved our kitchen. No more meltdowns, just steady revenue.',
    name: 'Chef David L.',
    city: 'Harbor & Hearth',
  },
];

const BADGE_STYLES = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-blue-50 text-blue-700 ring-1 ring-blue-700/10',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-700/10',
};

const BUTTON_STYLES = {
  primary:
    'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg active:scale-95',
  secondary:
    'bg-white text-[var(--slate-900)] border border-[var(--border)] hover:bg-[var(--slate-50)]',
  ghost: 'bg-transparent text-[var(--slate-600)] hover:bg-[var(--slate-100)]',
};

const FOOTER_LINK_STYLES =
  "relative inline-flex items-center text-slate-400 hover:text-white transition-colors duration-200 ease-out after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-current after:transition-all after:duration-200 after:ease-out after:origin-left hover:after:w-full";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function createUpdatedLiveFeedItem(): LiveFeedItem {
  return {
    venue: LIVE_FEED_VENUES[Math.floor(Math.random() * LIVE_FEED_VENUES.length)],
    time: TIME_OPTIONS[Math.floor(Math.random() * TIME_OPTIONS.length)],
    party: LIVE_FEED_PARTY_SIZES[Math.floor(Math.random() * LIVE_FEED_PARTY_SIZES.length)],
    status: LIVE_FEED_STATUSES[Math.floor(Math.random() * LIVE_FEED_STATUSES.length)],
  };
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);
    const listener = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return prefersReducedMotion;
}

function useCountUp(endValue: number, duration: number, enabled: boolean) {
  const [value, setValue] = useState(0);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setValue(endValue);
      hasStartedRef.current = true;
      return;
    }
    setValue(0);
    hasStartedRef.current = false;
  }, [endValue, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const node = elementRef.current;
    if (!node) return undefined;

    let startTime: number | null = null;
    let animationFrame = 0;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const nextValue = Math.round(progress * endValue);
      setValue(progress === 1 ? endValue : nextValue);
      if (progress < 1) animationFrame = window.requestAnimationFrame(step);
    };

    const start = () => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      animationFrame = window.requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            start();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [duration, enabled, endValue]);

  return { ref: elementRef, value };
}

function GlobalStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      :root {
        --background: #F8FAFC;
        --foreground: #0F172A;
        --primary: #2563EB;
        --primary-hover: #1D4ED8;
        --card: #FFFFFF;
        --border: #E2E8F0;
        --muted: #64748B;
        --accent-success: #059669;
        --accent-warning: #F59E0B;
      }

      html { scroll-behavior: smooth; }
      body {
        background-color: var(--background);
        color: var(--foreground);
        font-family: var(--font-inter), sans-serif;
        line-height: 1.5;
        overflow-x: hidden;
      }

      h1, h2, h3, h4 { font-weight: 700; letter-spacing: -0.025em; color: var(--slate-900); }
      .font-mono { font-family: var(--font-mono), monospace; }

      .reveal-up {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease-out, transform 0.6s ease-out;
      }
      .reveal-up.active { opacity: 1; transform: translateY(0); }
      .reduce-motion .reveal-up {
        opacity: 1;
        transform: none;
        transition: none;
      }

      @keyframes float {
        0% { transform: translate(var(--tw-translate-x, 0px), var(--tw-translate-y, 0px)) translate(0, 0); }
        25% { transform: translate(var(--tw-translate-x, 0px), var(--tw-translate-y, 0px)) translate(12px, -8px); }
        50% { transform: translate(var(--tw-translate-x, 0px), var(--tw-translate-y, 0px)) translate(0, -16px); }
        75% { transform: translate(var(--tw-translate-x, 0px), var(--tw-translate-y, 0px)) translate(-12px, -8px); }
        100% { transform: translate(var(--tw-translate-x, 0px), var(--tw-translate-y, 0px)) translate(0, 0); }
      }

      @keyframes shimmer {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }

      @keyframes draw-check {
        0% { stroke-dashoffset: 24; }
        100% { stroke-dashoffset: 0; }
      }

      .text-shimmer {
        background: linear-gradient(90deg, #2563EB, #22D3EE, #2563EB);
        background-size: 200% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: shimmer 3s linear infinite;
      }

      .animate-float-slow { animation: float 10s ease-in-out infinite; }
      .animate-count-up {
        font-variant-numeric: tabular-nums;
        transition: color 0.2s ease-out, transform 0.2s ease-out;
      }
      .reduce-motion .text-shimmer,
      .reduce-motion .animate-float-slow { animation: none; }

      .factory-card {
        background: var(--card);
        border: 1px solid var(--border);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .factory-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
      }
    `,
      }}
    />
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
    close: (
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    ),
    check: <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />,
    arrowRight: <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />,
    chart: <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />,
    shield: (
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
    ),
    search: (
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    ),
    clock: (
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    ),
    user: (
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    ),
    lock: (
      <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm5-9V6a5 5 0 0 0-10 0v2a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3zM9 6a3 3 0 0 1 6 0v2H9V6z" />
    ),
    zap: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
    logo: (
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
    ),
    star: (
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    ),
  };
  return <svg {...common}>{icons[name] || icons.check}</svg>;
}

function LiveFeedCard({ reduceMotion }: { reduceMotion: boolean }) {
  const [items, setItems] = useState<LiveFeedItem[]>(() =>
    Array.from({ length: LIVE_FEED_VISIBLE_COUNT }, createUpdatedLiveFeedItem),
  );

  useEffect(() => {
    if (reduceMotion) return undefined;
    const interval = window.setInterval(() => {
      setItems((prev) => [
        createUpdatedLiveFeedItem(),
        ...prev.slice(0, LIVE_FEED_VISIBLE_COUNT - 1),
      ]);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  return (
    <div className="factory-card rounded-xl p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="motion-safe:animate-pulse relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Automated Bookings
          </span>
        </div>
        <Badge variant="secondary" className={BADGE_STYLES.success}>
          Active
        </Badge>
      </div>
      <div className="space-y-3 flex-1">
        {items.map((item, index) => (
          <div
            key={`${item.venue}-${item.time}-${index}`}
            className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 font-mono text-xs"
          >
            <div>
              <div className="font-semibold text-slate-900">{item.venue}</div>
              <div className="text-slate-500 mt-0.5">
                {item.time} • {item.party}
              </div>
            </div>
            <div
              className={cx(
                'font-medium',
                LIVE_FEED_SUCCESS_STATUSES.includes(item.status)
                  ? 'text-green-600'
                  : 'text-amber-600',
              )}
            >
              {item.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Navbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const authHref = isAuthenticated ? '/guest/dashboard' : '/auth';
  const authLabel = isAuthenticated ? 'Dashboard' : 'Sign In';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={cx(
        'fixed top-0 left-0 w-full z-50 px-6 transition-all duration-200 border-b',
        scrolled
          ? 'bg-white/90 backdrop-blur-md py-3 border-slate-200 shadow-sm'
          : 'bg-transparent py-5 border-transparent',
      )}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <BrandLogo href="/" />
        <div className="hidden md:flex items-center gap-1 bg-slate-100/50 p-1 rounded-full border border-slate-200/50 backdrop-blur-sm">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-full hover:bg-white transition-all"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={authHref}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            {authLabel}
          </Link>
          <Button
            asChild
            className={cx(
              'py-2 px-4 text-xs font-bold uppercase tracking-wide',
              BUTTON_STYLES.primary,
            )}
          >
            <Link href="/contact">Contact Sales</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

function Hero({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <section
      id="hero"
      className="relative pt-32 pb-20 px-6 border-b border-slate-200 overflow-hidden bg-white"
    >
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-20 w-[800px] h-[800px] bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none animate-float-slow" />

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
        <div className="space-y-8 text-center lg:text-left reveal-up active">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <Badge variant="secondary" className={BADGE_STYLES.success}>
              {HERO_BADGE}
            </Badge>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              Only 1 Spot Left for January
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl text-slate-900 font-extrabold tracking-tight leading-[1.1]">
            The Zero-Risk No-Show <br />
            <span className="text-shimmer">Lockdown System</span> for Food-Led UK Pubs
            <br />
          </h1>

          <p className="text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
            Using Nab a Table is like moving from a manual bicycle to a self-driving car. Set the
            destination (more profit) and let the system navigate the traffic of bookings for you.
          </p>

          <div className="flex flex-wrap justify-center lg:justify-start gap-4">
            <Button asChild variant="outline" className={BUTTON_STYLES.secondary}>
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>

          <div className="pt-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
              Integrated with your stack
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-4">
              {INTEGRATIONS.map((tech) => (
                <span
                  key={tech}
                  className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative reveal-up active delay-100 lg:pl-10">
          <LiveFeedCard reduceMotion={reduceMotion} />
          <div className="absolute -bottom-6 -left-6 bg-slate-900 p-4 rounded-xl shadow-2xl border border-slate-800 hidden sm:block motion-safe:animate-bounce-slow max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 motion-safe:animate-pulse" />
              <div className="font-mono text-xs text-green-300">Revenue Optimized</div>
            </div>
            <div className="font-mono text-[12px] text-white font-bold leading-relaxed">
              +£4,250/mo Extra Profit
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const problems = [
    {
      title: 'The £150 Friday Night Leak',
      desc: "A single no-show on a Friday night isn't just annoying; it is £150+ burned that you can never get back.",
      icon: 'close',
    },
    {
      title: 'The £45,000 Labour Trap',
      desc: 'Paying a host to manually manage DMs and phone calls is the most expensive administrative work you do.',
      icon: 'user',
    },
    {
      title: 'The Sunday Roast Chaos',
      desc: 'Holes appear in your book, the kitchen gets slammed, and staff quit because service is unmanaged firefighting.',
      icon: 'lock',
    },
  ];

  return (
    <section id="problem" className="py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal-up">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">
            The Pain is The Pitch
          </p>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            The &quot;Old Way&quot; is Broken.
          </h2>
          <p className="text-lg text-slate-600">
            Most operators accept these problems as &quot;part of the business&quot;. They
            aren&apos;t. They are leaks in your bucket.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, index) => (
            <div
              key={problem.title}
              className="group p-8 rounded-2xl bg-red-50/30 border border-red-100 transition-all duration-200 ease-out hover:bg-red-50 group-hover:-translate-y-2 group-hover:shadow-xl reveal-up"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6 transition-all duration-200 ease-out group-hover:bg-red-200 group-hover:text-red-700 group-hover:rotate-6 group-hover:scale-110">
                <Icon name={problem.icon} className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{problem.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{problem.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatMetricValue(metric: Metric, value: number) {
  const formatted = value.toLocaleString('en-GB');
  return `${metric.prefix ?? ''}${formatted}${metric.suffix ?? ''}`;
}

function MetricCard({ metric, reduceMotion }: { metric: Metric; reduceMotion: boolean }) {
  const { ref, value } = useCountUp(metric.value, 1200, !reduceMotion);

  return (
    <div className="factory-card p-6 rounded-xl bg-white">
      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
        <Icon name={metric.icon} className="w-6 h-6" />
      </div>
      <div ref={ref} className="text-4xl font-extrabold text-slate-900 mb-1 animate-count-up">
        {formatMetricValue(metric, value)}
      </div>
      <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
        {metric.label}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 font-mono">
        {metric.detail}
      </div>
    </div>
  );
}

function MetricsSection({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <section id="metrics" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-3xl font-bold text-slate-900">Numbers Don&apos;t Lie.</h2>
            <p className="text-slate-600">
              Stop guessing. See exactly how automated confirmations and waitlist monetization
              impact your bottom line.
            </p>
          </div>
          {METRICS.map((metric) => (
            <MetricCard key={metric.label} metric={metric} reduceMotion={reduceMotion} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section id="features" className="py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4 reveal-up">
          <Badge variant="secondary" className={BADGE_STYLES.success}>
            The UK Pub Profit Stack
          </Badge>
          <h2 className="text-4xl font-bold text-slate-900">The Total Lockdown Bundle</h2>
          <p className="text-lg text-slate-600">
            Total Value: £12,500+ / Yours for less than a missed 4-top.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BENEFITS.map((benefit, index) => {
            const isFeatured = index === BENEFITS.length - 1;
            return (
              <div
                key={benefit.title}
                className={cx(
                  'group p-6 rounded-2xl bg-slate-50 transition-all duration-200 ease-out border border-transparent hover:border-slate-100 hover:bg-white group-hover:-translate-y-2 group-hover:shadow-xl reveal-up',
                  isFeatured
                    ? 'md:col-span-2 lg:col-span-3 bg-gradient-to-r from-slate-50 to-blue-50 border-blue-100'
                    : '',
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-white text-blue-600 rounded-xl shadow-sm flex items-center justify-center transition-all duration-200 ease-out group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6 group-hover:scale-110">
                    <Icon name={benefit.icon} className="w-6 h-6" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={isFeatured ? BADGE_STYLES.success : BADGE_STYLES.neutral}
                  >
                    {benefit.value}
                  </Badge>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{benefit.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 reveal-up">
          <h2 className="text-3xl font-bold text-slate-900">The 3-Step Mechanism</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10 hidden md:block" />
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div
              key={step.title}
              className="relative bg-white p-6 rounded-xl border border-slate-100 shadow-sm text-center reveal-up"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4 relative z-10 border-4 border-white shadow-md text-xl">
                {index + 1}
              </div>
              <h3 className="font-bold text-slate-900 mb-2 text-xl">{step.title}</h3>
              <p className="text-sm text-slate-500">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold mb-4">Proof it Works.</h2>
            <p className="text-slate-400 text-lg">
              Food-led pubs using Nab a Table to print money.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 lg:justify-end">
            {OBJECTION_POINTS.map((point) => (
              <div
                key={point}
                className="px-4 py-2 rounded-full border border-slate-700 bg-slate-800/50 text-sm font-medium text-slate-300 flex items-center gap-2"
              >
                <Icon name="check" className="text-green-400" /> {point}
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((testimonial, index) => {
            const delayClass = index === 0 ? 'delay-100' : index === 1 ? 'delay-200' : 'delay-300';
            return (
              <div
                key={testimonial.name}
                className={cx(
                  'p-8 rounded-2xl bg-slate-800/50 border border-slate-700 reveal-up hover:bg-slate-800 transition-colors',
                  delayClass,
                )}
              >
                <div className="mb-6 text-blue-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Icon
                      key={star}
                      name="star"
                      className="w-4 h-4 inline-block mr-1 fill-current"
                    />
                  ))}
                </div>
                <p className="text-lg text-slate-200 italic mb-6 leading-relaxed">
                  &quot;{testimonial.quote}&quot;
                </p>
                <div>
                  <div className="font-bold text-white">{testimonial.name}</div>
                  <div className="text-sm text-slate-400">{testimonial.city}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">
          Guarantees & Objections
        </h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <div
              key={item.question}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm reveal-up"
            >
              <h3 className="font-bold text-slate-900 mb-2 flex items-start gap-3">
                <span className="text-blue-600 mt-1">
                  <Icon name="arrowRight" className="w-4 h-4" />
                </span>
                {item.question}
              </h3>
              <p className="text-slate-600 text-sm ml-7">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-32 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-blue-600 opacity-[0.03] pattern-grid-lg" />
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10 reveal-up">
        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">
          Ready to stop burning £150 per no-show?
        </h2>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          We’ll show you exactly how to automate the busy work and reclaim 20 hours of your week.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            asChild
            variant="outline"
            className={cx('px-8 py-4 text-base', BUTTON_STYLES.secondary)}
          >
            <Link href="/contact">Contact Sales</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-slate-500 font-medium">
          Setup takes &lt; 24h. We handle the heavy lifting.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-16 bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <BrandLogo href="/" showBeta={false} variant="dark" size="lg" className="mb-4" />
          <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
            The operating system for modern hospitality. Empowering venues to deliver exceptional
            guest experiences through data and automation.
          </p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Product</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>
              <a href="#" className={FOOTER_LINK_STYLES}>
                Features
              </a>
            </li>
            <li>
              <a href="#" className={FOOTER_LINK_STYLES}>
                Integrations
              </a>
            </li>
            <li>
              <a href="#" className={FOOTER_LINK_STYLES}>
                Pricing
              </a>
            </li>
            <li>
              <a href="#" className={FOOTER_LINK_STYLES}>
                Changelog
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>
              <a href="#" className={FOOTER_LINK_STYLES}>
                About Us
              </a>
            </li>
            <li>
              <a href="#" className={FOOTER_LINK_STYLES}>
                Careers
              </a>
            </li>
            <li>
              <a href="#" className={FOOTER_LINK_STYLES}>
                Legal
              </a>
            </li>
            <li>
              <a href="#" className={FOOTER_LINK_STYLES}>
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-xs text-slate-500">© 2024 Nab a Table Inc. All rights reserved.</div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 motion-safe:animate-pulse" />
          <span className="text-xs text-green-500 font-mono uppercase">System Operational</span>
        </div>
      </div>
    </footer>
  );
}

function AnimationObserver() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('active');
        });
      },
      { threshold: 0.1 },
    );

    document.querySelectorAll('.reveal-up').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });
  return null;
}

function FactoryHomeClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      style={FACTORY_THEME}
      className={cx(
        'min-h-screen relative selection:bg-blue-100 selection:text-blue-900 font-sans',
        prefersReducedMotion ? 'reduce-motion' : '',
        inter.variable,
        jetbrainsMono.variable,
      )}
    >
      <GlobalStyles />
      {prefersReducedMotion ? null : <AnimationObserver />}

      <Navbar isAuthenticated={isAuthenticated} />

      <main>
        <Hero reduceMotion={prefersReducedMotion} />
        <ProblemSection />
        <MetricsSection reduceMotion={prefersReducedMotion} />
        <BenefitsSection />
        <HowItWorks />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}

export { FactoryHomeClient };

export default FactoryHomeClient;
