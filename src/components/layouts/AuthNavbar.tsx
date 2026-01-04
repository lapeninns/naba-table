'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BrandLogo } from '@/components/shared';
import { cn } from '@/lib/utils';

const AUTH_NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/restaurants', label: 'Browse' },
  { href: '/support', label: 'Support' },
];

const MOBILE_MENU_ID = 'auth-navbar-menu';

function ctaClasses(variant: 'primary' | 'ghost' = 'primary') {
  const base =
    'inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  if (variant === 'ghost') {
    return cn(base, 'border border-border/70 bg-transparent text-foreground hover:bg-foreground/5');
  }
  return cn(base, 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm');
}

export function AuthNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const closeMenu = () => setMobileOpen(false);
  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const desktopNavLinkClass = (href: string) =>
    cn(
      'rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      isActive(href)
        ? 'bg-foreground text-background shadow-sm'
        : 'text-foreground/70 hover:text-foreground',
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <a
        href="#main-content"
        className="skip-to-content absolute left-4 top-4 -translate-y-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition focus-visible:translate-y-0 focus-visible:outline-none"
      >
        Skip to content
      </a>

      <div className="guest-boundary flex w-full max-w-4xl items-center justify-between gap-4 py-4 sm:py-5">
        <BrandLogo href="/auth" size="sm" />

        <nav
          aria-label="Auth navigation"
          className="hidden flex-1 items-center justify-center md:flex"
        >
          <div className="flex items-center gap-1 rounded-full border border-border/80 bg-background/70 px-2 py-1 shadow-sm">
            {AUTH_NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={desktopNavLinkClass(item.href)}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/support" className={ctaClasses('ghost')}>
            Need help?
          </Link>
          <Link href="/restaurants" className={ctaClasses()}>
            Explore tables
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls={MOBILE_MENU_ID}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 flex flex-col">
            <div
              className="rounded-t-3xl bg-background px-6 py-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              id={MOBILE_MENU_ID}
            >
              <div className="flex items-center justify-between pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">
                    Navigation
                  </p>
                  <p className="text-base font-semibold text-foreground">Find your way</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
                  onClick={closeMenu}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <nav className="flex flex-col gap-3" aria-label="Mobile auth navigation">
                {AUTH_NAV_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className="rounded-2xl border border-border px-4 py-3 text-base font-semibold text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 space-y-3">
                <Link
                  href="/restaurants"
                  onClick={closeMenu}
                  className={cn(ctaClasses(), 'w-full justify-center')}
                >
                  Explore tables
                </Link>
                <Link
                  href="/support"
                  onClick={closeMenu}
                  className={cn(ctaClasses('ghost'), 'w-full justify-center')}
                >
                  Need help?
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
