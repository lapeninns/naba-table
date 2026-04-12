'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

import { BrandLogo } from '@/components/shared/BrandLogo';
import { Button } from '@/components/ui/button';
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

export function Navbar({ isAuthenticated }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

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
        'fixed top-0 left-0 z-50 w-full border-b px-6 transition-all duration-200',
        scrolled
          ? 'border-border bg-background/80 py-3 backdrop-blur-md shadow-sm'
          : 'border-transparent bg-transparent py-5',
      )}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BrandLogo href="/" />
        </div>
        <div className="hidden items-center gap-1 rounded-4xl border border-border/70 bg-background/75 p-1 shadow-sm backdrop-blur-sm md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-4xl px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={authHref}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {authLabel}
          </Link>
          <Button
            size="sm"
            className="rounded-4xl px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
            asChild
          >
            <Link href="/contact">Contact Sales</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
