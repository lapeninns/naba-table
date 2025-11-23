"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

import logo from "@/app/icon.png";
import config from "@/config";

interface HeaderProps {
  variant?: "marketing" | "app" | "auth";
}

type NavLink = {
  href: string;
  label: string;
};

const MARKETING_LINKS: NavLink[] = [
  { href: "/restaurants", label: "Restaurants" },
  { href: "/product", label: "How it works" },
];

const APP_LINKS: NavLink[] = [
  { href: "/restaurants", label: "Browse" },
  { href: "/guest/bookings", label: "My bookings" },
];

const ACCOUNT_LINKS: NavLink[] = [
  { href: "/guest/profile", label: "Profile" },
  { href: "/guest/bookings", label: "My bookings" },
];

const CTA_LOGGED_OUT = { href: "/restaurants", label: "Find a table" } satisfies NavLink;
const CTA_LOGGED_IN = { href: "/restaurants", label: "Book now" } satisfies NavLink;

type AccountSnapshot = {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  fallback: string;
};

function getInitials(value: string | null | undefined): string {
  if (!value) return "";
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0].slice(0, 1)}${parts.at(-1)?.slice(0, 1) ?? ""}`.toUpperCase();
}

function resolveFallback(name: string | null | undefined, email: string | null | undefined): string {
  const initials = getInitials(name);
  if (initials) return initials;
  if (email) {
    const local = email.split("@")[0] ?? "";
    if (local) return local.slice(0, 2).toUpperCase();
  }
  return "?";
}

function BrandMark() {
  return (
    <Link
      href="/"
      className="group flex items-center gap-3 rounded-full px-2 py-1 text-left transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/90 to-primary text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25">
        <Image src={logo} alt={config.appName} className="h-6 w-6" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold text-foreground">{config.appName ?? "SajiloReserveX"}</span>
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Book great tables fast</span>
      </span>
    </Link>
  );
}

type NavPillsProps = {
  links: NavLink[];
  currentPath: string | null;
};

function NavPills({ links, currentPath }: NavPillsProps) {
  const isActive = useMemo(
    () =>
      (href: string) => {
        if (!currentPath) return false;
        if (href === "/") return currentPath === "/";
        return currentPath === href || currentPath.startsWith(`${href}/`);
      },
    [currentPath],
  );

  if (links.length === 0) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden items-center gap-2 rounded-full border border-border/60 bg-background/70 px-1.5 py-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60 md:flex"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(link.href) ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 py-2 text-sm font-semibold leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isActive(link.href)
              ? "bg-foreground text-background shadow-sm ring-0"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

type DesktopActionsProps = {
  isLoading: boolean;
  isLoggedIn: boolean;
  account: AccountSnapshot | null;
  accountLinks: NavLink[];
  cta: NavLink;
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
};

function DesktopActions({ isLoading, isLoggedIn, account, accountLinks, cta, onSignOut, isSigningOut }: DesktopActionsProps) {
  return (
    <div className="hidden items-center gap-3 md:flex">
      <Link
        href={cta.href}
        className={cn(
          buttonVariants({ variant: "default", size: "sm" }),
          "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/15 transition hover:shadow-lg focus-visible:ring-offset-2",
        )}
      >
        {cta.label}
      </Link>

      {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : null}

      {!isLoading && !isLoggedIn ? (
        <Link
          href="/auth/signin"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-border/70 text-foreground shadow-sm")}
        >
          Sign in
        </Link>
      ) : null}

      {isLoggedIn && account ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`${account.displayName} menu`}
            >
              <Avatar className="h-10 w-10">
                {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt={account.displayName} /> : null}
                <AvatarFallback aria-hidden>{account.fallback}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" forceMount>
            <DropdownMenuLabel>
              <span className="block text-sm font-medium text-foreground">{account.displayName}</span>
              {account.email ? (
                <span className="block text-xs font-normal text-muted-foreground">{account.email}</span>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accountLinks.map((item) => (
              <DropdownMenuItem asChild key={item.href}>
                <Link href={item.href} className="flex w-full items-center justify-between px-2 py-1.5 text-sm">
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void onSignOut();
              }}
              className="flex items-center justify-between px-2 py-1.5 text-sm text-destructive focus:text-destructive"
              disabled={isSigningOut}
              aria-disabled={isSigningOut}
            >
              <span className="inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

type MobileMenuProps = {
  navLinks: NavLink[];
  sessionActions: NavLink[];
  account: AccountSnapshot | null;
  isLoggedIn: boolean;
  isSigningOut: boolean;
  onSignOut: () => Promise<void>;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  pathname: string;
  cta: NavLink;
};

function MobileMenu({ navLinks, sessionActions, account, isLoggedIn, isSigningOut, onSignOut, open, onOpenChange, pathname, cta }: MobileMenuProps) {
  const isActive = useCallback(
    (href: string) => {
      if (!pathname) return false;
      if (href === "/") return pathname === "/";
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background text-foreground shadow-sm transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background touch-manipulation md:hidden"
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="site-navigation-drawer"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        id="site-navigation-drawer"
        aria-label="Site navigation"
        className="flex flex-col gap-8 px-6 py-8"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Site navigation</SheetTitle>
          <SheetDescription>Browse links and account actions.</SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between gap-3">
          <BrandMark />
          <SheetClose asChild>
            <Link
              href={cta.href}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "shadow-sm touch-manipulation",
              )}
            >
              {cta.label}
            </Link>
          </SheetClose>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary to-primary/80 px-4 py-5 text-primary-foreground shadow-md shadow-primary/25">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 text-left">
              <span className="text-xs font-semibold uppercase tracking-[0.08em]">Plan your visit</span>
              <span className="text-sm leading-relaxed opacity-90">Browse live tables and reserve in seconds.</span>
            </div>
            <SheetClose asChild>
              <Link
                href={cta.href}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "text-primary shadow-sm shadow-primary/25",
                )}
              >
                Start
              </Link>
            </SheetClose>
          </div>
        </div>

        {isLoggedIn && account ? (
          <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/40 px-4 py-4">
            <Avatar className="h-12 w-12">
              {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt={account.displayName} /> : null}
              <AvatarFallback aria-hidden>{account.fallback}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{account.displayName}</span>
              {account.email ? <span className="text-sm text-muted-foreground">{account.email}</span> : null}
            </div>
          </div>
        ) : null}

        <section className="flex flex-col gap-3" aria-label="Explore">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Explore</p>
          <nav className="flex flex-col gap-2" aria-label="Primary navigation">
            {navLinks.map((link) => (
              <SheetClose asChild key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "rounded-xl px-3.5 py-2.5 text-base font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive(link.href) ? "bg-primary/10 text-primary shadow-inner" : "text-foreground hover:bg-muted",
                  )}
                >
                  {link.label}
                </Link>
              </SheetClose>
            ))}
          </nav>
        </section>

        <Separator className="bg-border/70" />

        <section className="flex flex-col gap-3" aria-label="Account">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Account</p>
          <div className="flex flex-col gap-2">
            {sessionActions.map((action) => (
              <SheetClose asChild key={action.href}>
                <Link
                  href={action.href}
                  className="rounded-xl px-3.5 py-2.5 text-base font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {action.label}
                </Link>
              </SheetClose>
            ))}

            {isLoggedIn ? (
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "justify-center touch-manipulation",
                )}
                onClick={() => {
                  void onSignOut();
                }}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Signing out…" : "Sign out"}
              </button>
            ) : null}
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}

export default function Header({ variant = "marketing" }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useSupabaseSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const isLoggedIn = status === "ready" && Boolean(user);
  const navLinks = variant === "marketing" && !isLoggedIn ? MARKETING_LINKS : APP_LINKS;
  const sessionActions = isLoggedIn ? ACCOUNT_LINKS : [{ href: "/auth/signin", label: "Sign in" }];
  const cta = isLoggedIn ? CTA_LOGGED_IN : CTA_LOGGED_OUT;

  const accountSnapshot: AccountSnapshot | null = useMemo(() => {
    if (!isLoggedIn || !user) return null;
    const metadata = (user.user_metadata ?? null) as Record<string, unknown> | null;
    const metadataAvatar = typeof metadata?.["avatar_url"] === "string" ? (metadata?.["avatar_url"] as string) : null;
    const metadataName = typeof metadata?.["full_name"] === "string" ? (metadata?.["full_name"] as string) : null;

    const displayName = metadataName?.trim() || user.email || "Account";

    return {
      displayName,
      email: user.email ?? null,
      avatarUrl: metadataAvatar,
      fallback: resolveFallback(metadataName ?? null, user.email ?? null),
    };
  }, [isLoggedIn, user]);

  const handleSignOut = useMemo(
    () =>
      async () => {
        try {
          setIsSigningOut(true);
          await supabase.auth.signOut();
          router.refresh();
          router.push("/");
        } finally {
          setIsSigningOut(false);
        }
      },
    [router, supabase],
  );

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  if (variant === "auth") {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 md:px-6">
          <BrandMark />
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground hover:text-foreground")}
          >
            Back home
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="container mx-auto w-full px-4 md:px-6">
        <div className="flex items-center justify-between gap-3 py-3 md:py-4">
          <BrandMark />

          <div className="hidden flex-1 items-center justify-end gap-4 md:flex">
            <NavPills links={navLinks} currentPath={pathname ?? null} />
            <DesktopActions
              isLoading={status === "loading"}
              isLoggedIn={isLoggedIn}
              account={accountSnapshot}
              accountLinks={ACCOUNT_LINKS}
              cta={cta}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
            />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              href={cta.href}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "shadow-sm touch-manipulation",
              )}
            >
              {cta.label}
            </Link>
            <MobileMenu
              navLinks={navLinks}
              sessionActions={sessionActions}
              account={accountSnapshot}
              isLoggedIn={isLoggedIn}
              isSigningOut={isSigningOut}
              onSignOut={handleSignOut}
              open={isMobileOpen}
              onOpenChange={setIsMobileOpen}
              pathname={pathname ?? ""}
              cta={cta}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
