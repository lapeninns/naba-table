'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import { BrandLogo } from '@/components/shared/BrandLogo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#system', label: 'The System' },
  { href: '#value-stack', label: 'The Value Stack' },
  { href: '#faq', label: 'FAQ' },
] as const;

interface NavbarProps {
  isAuthenticated: boolean;
}

function NavLinkList({
  className,
  onNavigate,
  variant = 'desktop',
}: {
  className?: string;
  onNavigate?: () => void;
  variant?: 'desktop' | 'mobile';
}) {
  if (variant === 'desktop') {
    return (
      <div
        className={cn(
          'pg-panel hidden items-center gap-1 rounded-full border-border/70 bg-background/80 p-1 shadow-[var(--pg-shadow-soft)] backdrop-blur-md md:flex lg:gap-1',
          className,
        )}
      >
        {NAV_LINKS.map((link) => (
          <Button
            key={link.href}
            variant="guest-ghost"
            size="guest-sm"
            className="px-3 text-xs font-medium text-muted-foreground hover:text-foreground sm:px-4 sm:text-sm"
            asChild
          >
            <a href={link.href}>{link.label}</a>
          </Button>
        ))}
      </div>
    );
  }
  return (
    <nav className={cn('flex flex-col gap-1', className)}>
      {NAV_LINKS.map((link) => (
        <Button
          key={link.href}
          variant="guest-ghost"
          className="h-auto justify-start rounded-2xl px-3 py-3 text-base font-medium text-foreground"
          asChild
        >
          <a href={link.href} onClick={onNavigate}>
            {link.label}
          </a>
        </Button>
      ))}
    </nav>
  );
}

export function Navbar({ isAuthenticated }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const authHref = isAuthenticated ? '/guest/dashboard' : '/auth';
  const authLabel = isAuthenticated ? 'Dashboard' : 'Member Login';

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 z-50 w-full transition-all duration-200',
        scrolled ? 'py-2.5 sm:py-3' : 'py-3 sm:py-4 md:py-5',
      )}
    >
      <div className="pg-container">
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-full border px-3 py-2.5 sm:px-4 sm:py-3',
            scrolled
              ? 'border-border/80 bg-background/92 shadow-[var(--pg-shadow-nav)] backdrop-blur-md'
              : 'border-border/50 bg-background/78 shadow-[var(--pg-shadow-xs)] backdrop-blur-sm',
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo href="/" showBeta={false} />
          </div>
          <NavLinkList />

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={authHref}
              className="hidden min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-primary/[0.08] hover:text-foreground sm:inline-flex"
            >
              {authLabel}
            </Link>
            <Button
              variant="guest-primary"
              size="guest-sm"
              className="hidden sm:inline-flex"
              asChild
            >
              <Link href="/contact">Claim Your Pub&apos;s Spot</Link>
            </Button>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 md:hidden"
                  aria-label="Open menu"
                  type="button"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 border-l-border/70 bg-background/98 sm:max-w-sm"
              >
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                  <SheetDescription className="sr-only">
                    Navigate Nabatable public pages and account actions.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
                  <NavLinkList variant="mobile" onNavigate={() => setMobileOpen(false)} />
                  <Separator />
                  <Link
                    href={authHref}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl px-3 py-3 text-base font-semibold text-muted-foreground transition-colors hover:bg-primary/[0.08] hover:text-foreground"
                  >
                    {authLabel}
                  </Link>
                  <Button variant="guest-primary" size="guest-lg" asChild className="w-full">
                    <Link href="/contact" onClick={() => setMobileOpen(false)}>
                      Claim Your Pub&apos;s Spot
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
