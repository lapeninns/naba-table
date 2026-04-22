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
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#hero', label: 'The Blueprint' },
  { href: '#problem', label: 'The Leak' },
  { href: '#features', label: 'Profit Stack' },
  { href: '#testimonials', label: 'Proof' },
  { href: '#faq', label: 'Guarantee' },
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
          'hidden items-center gap-1 rounded-full border border-border/60 bg-muted/50 p-1 backdrop-blur-sm md:flex lg:gap-1',
          className,
        )}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground sm:px-4 sm:text-sm"
          >
            {link.label}
          </a>
        ))}
      </div>
    );
  }
  return (
    <nav className={cn('flex flex-col gap-1', className)}>
      {NAV_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
        >
          {link.label}
        </a>
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
  const authLabel = isAuthenticated ? 'Dashboard' : 'Sign In';

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 z-50 w-full border-b transition-all duration-200',
        'px-4 sm:px-6 md:px-8 2xl:px-10',
        scrolled
          ? 'border-border bg-background/90 py-2.5 shadow-sm backdrop-blur-md sm:py-3'
          : 'border-transparent bg-transparent py-3 sm:py-4 md:py-5',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo href="/" />
        </div>
        <NavLinkList />

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={authHref}
            className="hidden min-h-11 shrink-0 items-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            {authLabel}
          </Link>
          <Button size="default" className="hidden sm:inline-flex" asChild>
            <Link href="/contact">Contact Sales</Link>
          </Button>
          <Button size="sm" className="sm:hidden" asChild>
            <Link href="/contact">Contact</Link>
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
            <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-sm">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
                <NavLinkList variant="mobile" onNavigate={() => setMobileOpen(false)} />
                <Separator />
                <Link
                  href={authHref}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {authLabel}
                </Link>
                <Button asChild className="w-full">
                  <Link href="/contact" onClick={() => setMobileOpen(false)}>
                    Contact Sales
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
