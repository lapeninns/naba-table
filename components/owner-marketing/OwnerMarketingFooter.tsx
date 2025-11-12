import Link from "next/link";

import config from "@/config";

const SUPPORT_EMAIL = config.email?.supportEmail ?? "support@example.com";

export function OwnerMarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-slate-50 text-muted-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4 md:max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/70">SajiloReserveX</p>
          <h2 className="text-2xl font-semibold text-foreground">Built for restaurants, not marketplaces.</h2>
          <p className="text-sm">
            Transform your owned channels into a high-converting booking engine while keeping every guest relationship on your terms.
          </p>
        </div>
        <div className="grid flex-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Explore</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/product" className="text-foreground transition hover:text-primary">
                  Product
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-foreground transition hover:text-primary">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-foreground transition hover:text-primary">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Reach us</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground transition hover:text-primary">
                  Email partnerships
                </a>
              </li>
              <li>
                <Link href="/terms" className="text-foreground transition hover:text-primary">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-foreground transition hover:text-primary">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {currentYear} {config.appName ?? "SajiloReserveX"}. All rights reserved.</p>
          <p className="text-muted-foreground">Lowering no-shows, lifting cover pacing, one service at a time.</p>
        </div>
      </div>
    </footer>
  );
}
