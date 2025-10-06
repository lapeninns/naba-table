"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Dialog } from "@headlessui/react";
import { Menu, X } from "lucide-react";

import config from "@/config";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { MarketingSessionActions } from "@/components/marketing/MarketingSessionActions";

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useSupabaseSession();

  const navLinks = useMemo(() => {
    const supportEmail = config.mailgun.supportEmail?.trim();
    const isAuthenticated = Boolean(user);

    const items: { href: string; label: string }[] = [
      { href: "#restaurants", label: "Restaurants" },
    ];

    if (isAuthenticated) {
      items.push({ href: "/dashboard", label: "Dashboard" });
    }

    items.push({ href: "/profile/manage", label: isAuthenticated ? "Profile" : "My profile" });

    if (supportEmail) {
      items.push({ href: `mailto:${supportEmail}`, label: "Support" });
    }

    return items;
  }, [user]);

  return (
    <div className="relative z-40">
      <a
        href="#main-content"
        className="skip-to-content absolute left-4 top-4 -translate-y-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition focus-visible:translate-y-0 focus-visible:outline-none"
      >
        Skip to content
      </a>
      <header className="border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-3 text-base font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              SRX
            </span>
            <span>SajiloReserveX</span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-8 text-sm font-medium md:flex"
          >
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <MarketingSessionActions
            size="sm"
            className="hidden md:flex flex-row items-center gap-3"
          />

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background touch-manipulation md:hidden"
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-haspopup="dialog"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <Dialog
        as="div"
        className="md:hidden"
        open={isMobileMenuOpen}
        onClose={setIsMobileMenuOpen}
      >
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" aria-hidden />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-xs">
            <Dialog.Panel className="ml-auto flex h-full w-full flex-col gap-8 border-l border-border/60 bg-background px-6 py-6 shadow-xl">
              <div className="flex items-center justify-between">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    SRX
                  </span>
                  SajiloReserveX
                </Link>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background touch-manipulation"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <nav aria-label="Mobile navigation" className="flex flex-col gap-4 text-base font-medium">
                {navLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-1 py-1 text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <MarketingSessionActions
                size="lg"
                className="mt-auto flex flex-col gap-3 [&>a]:w-full"
              />
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
