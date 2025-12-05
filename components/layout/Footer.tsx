"use client";

import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { useMemo } from "react";

import config from "@/config";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { cn } from "@/lib/utils";

type FooterProps = {
  variant?: "default" | "auth" | "app" | "marketing";
};

export default function Footer({ variant = "default" }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const { status, user } = useSupabaseSession();

  const isAuthenticated = status === "authenticated" && Boolean(user);
  const isAuth = variant === "auth";
  const isMarketing = variant === "marketing";
  const isDark = isMarketing || isAuth;

  const footerLinks = useMemo(() => {
    const restaurantLink = { href: "/restaurants", label: "Restaurants" };

    if (isAuthenticated) {
      return [
        { href: "/guest/dashboard", label: "Dashboard" },
        { href: "/guest/bookings", label: "Bookings" },
        { href: "/guest/profile", label: "Profile" },
        restaurantLink,
      ];
    }

    return [restaurantLink, { href: "/auth/signin", label: "Sign in" }];
  }, [isAuthenticated]);

  const shellClass = isDark
    ? "border-t border-white/10 bg-white/5 text-white backdrop-blur"
    : "border-t border-border/60 bg-white text-foreground";

  const linkTone = isDark
    ? "text-white/80 hover:text-white focus-visible:ring-white/50 focus-visible:ring-offset-0"
    : "text-muted-foreground hover:text-foreground focus-visible:ring-offset-background";

  return (
    <footer className={cn("py-10", shellClass)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left md:px-6 lg:px-8">
        <Link
          href="/guest/dashboard"
          className="group flex items-center gap-3 transition hover:opacity-100"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-sm shadow-primary/25">
            <UtensilsCrossed className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            {config.appName}
          </span>
        </Link>

        <div
          className={cn(
            "flex flex-col items-center gap-3 text-sm",
            isDark ? "text-white/70" : "text-muted-foreground sm:text-slate-600",
          )}
        >
          <span>© {currentYear} {config.appName}. All rights reserved.</span>
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      linkTone,
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
