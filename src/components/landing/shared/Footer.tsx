'use client';

import { BrandLogo } from '@/components/shared/BrandLogo';
import { Separator } from '@/components/ui/separator';

const FOOTER_LINK_STYLES =
  "relative inline-flex items-center text-muted-foreground transition-colors duration-200 ease-out hover:text-foreground after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:origin-left after:bg-current after:transition-all after:duration-200 after:ease-out after:content-[''] hover:after:w-full";

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-muted/25 text-foreground">
      <div className="pg-container py-12 sm:py-14 md:py-16 lg:py-20">
        <div className="mb-6 inline-flex rounded-full border border-primary/15 bg-background/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary shadow-[var(--pg-shadow-xs)]">
          Packed House System
        </div>
        <div className="grid grid-cols-1 gap-10 rounded-[var(--pg-radius-xl)] border border-border/70 bg-background/92 p-5 shadow-[var(--pg-shadow-soft)] sm:grid-cols-2 sm:gap-8 sm:p-6 md:grid-cols-4 md:gap-10 lg:gap-12 lg:p-8">
          <div className="sm:col-span-2">
            <BrandLogo size="lg" showBeta={false} className="mb-4" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground sm:max-w-xs">
              The ultimate reservations and capacity growth system for modern food-led UK pubs.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:gap-4">
            <h4 className="text-base font-bold text-foreground">Product</h4>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                <a href="#system" className={FOOTER_LINK_STYLES}>
                  The System
                </a>
              </li>
              <li>
                <a href="#value-stack" className={FOOTER_LINK_STYLES}>
                  Value Stack
                </a>
              </li>
              <li>
                <a href="#guarantee" className={FOOTER_LINK_STYLES}>
                  Guarantee
                </a>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3 sm:gap-4">
            <h4 className="text-base font-bold text-foreground">Company</h4>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className={FOOTER_LINK_STYLES}>
                  About us
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
                <a href="/contact" className={FOOTER_LINK_STYLES}>
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
        <Separator className="my-8 bg-border sm:my-10 md:my-12" />
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-center sm:gap-6">
          <p className="order-2 text-center text-xs text-muted-foreground sm:order-1 sm:text-left">
            © 2026 Nabatable Inc.
          </p>
          <div className="order-1 flex items-center gap-2 sm:order-2">
            <div className="size-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs font-mono uppercase text-primary">System operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
