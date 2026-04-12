'use client';

import Link from 'next/link';

import { BrandLogo } from '@/components/shared/BrandLogo';

const FOOTER_LINK_STYLES =
  "relative inline-flex items-center text-slate-500 hover:text-foreground transition-colors duration-200 ease-out after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-current after:transition-all after:duration-200 after:ease-out after:origin-left hover:after:w-full";

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-background/75 py-16 text-muted-foreground backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <BrandLogo size="lg" showBeta={false} className="mb-4" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            The operating system for modern hospitality. Empowering venues to deliver exceptional
            guest experiences through data and automation.
          </p>
        </div>
        <div>
          <h4 className="mb-4 font-bold text-foreground">Product</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#features" className={FOOTER_LINK_STYLES}>
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
          <h4 className="mb-4 font-bold text-foreground">Guests</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/restaurants" className={FOOTER_LINK_STYLES}>
                Restaurants
              </Link>
            </li>
            <li>
              <Link href="/site-map" className={FOOTER_LINK_STYLES}>
                Site Map
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={FOOTER_LINK_STYLES}>
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/contact" className={FOOTER_LINK_STYLES}>
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-col items-center gap-4 border-t border-border px-6 pt-8 md:flex-row md:justify-between">
        <div className="text-xs text-muted-foreground">
          © 2024 Nab a Table Inc. All rights reserved.
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-xs uppercase text-primary">System Operational</span>
        </div>
      </div>
    </footer>
  );
}
