'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

import { BrandLogo } from '@/components/shared';
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
        'fixed top-0 left-0 w-full z-50 px-6 transition-all duration-200 border-b',
        scrolled
          ? 'bg-white/90 backdrop-blur-md py-3 border-slate-200 shadow-sm'
          : 'bg-transparent py-5 border-transparent',
      )}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BrandLogo href="/" />
        </div>
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
            size="sm"
            className="py-2 px-4 text-xs font-bold uppercase tracking-wide bg-blue-600 text-white hover:bg-blue-700 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg active:scale-95 shadow-sm"
            asChild
          >
            <Link href="/contact">Contact Sales</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
