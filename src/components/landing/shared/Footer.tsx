'use client';

import { BrandLogo } from '@/components/shared/BrandLogo';

const FOOTER_LINK_STYLES =
  "relative inline-flex items-center text-slate-400 hover:text-white transition-colors duration-200 ease-out after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-current after:transition-all after:duration-200 after:ease-out after:origin-left hover:after:w-full";

export function Footer() {
  return (
    <footer className="py-16 bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <BrandLogo variant="dark" size="lg" showBeta={false} className="mb-4" />
          <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
            The operating system for modern hospitality. Empowering venues to deliver exceptional
            guest experiences through data and automation.
          </p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Product</h4>
          <ul className="space-y-2 text-sm text-slate-400">
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
              <a href="/contact" className={FOOTER_LINK_STYLES}>
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-xs text-slate-500">© 2024 Nab a Table Inc. All rights reserved.</div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-500 font-mono uppercase">System Operational</span>
        </div>
      </div>
    </footer>
  );
}
