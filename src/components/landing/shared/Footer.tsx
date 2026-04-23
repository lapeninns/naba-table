'use client';

import { BrandLogo } from '@/components/shared/BrandLogo';
import { Separator } from '@/components/ui/separator';

const FOOTER_LINK_STYLES =
  "relative inline-flex items-center text-muted-foreground transition-colors duration-200 ease-out hover:text-foreground after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:origin-left after:bg-current after:transition-all after:duration-200 after:ease-out after:content-[''] hover:after:w-full";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background text-foreground">
      <div className="pg-container py-12 sm:py-14 md:py-16 lg:py-20">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-8 md:grid-cols-4 md:gap-10 lg:gap-12">
          <div className="sm:col-span-2">
            <BrandLogo size="lg" showBeta={false} className="mb-4" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground sm:max-w-xs">
              The operating system for modern hospitality. Empowering venues to deliver exceptional
              guest experiences through data and automation.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:gap-4">
            <h4 className="text-base font-bold text-foreground">Product</h4>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
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
            © 2024 Nab a Table Inc. All rights reserved.
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
