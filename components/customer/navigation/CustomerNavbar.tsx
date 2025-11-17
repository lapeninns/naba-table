"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { signOutFromSupabase } from "@/lib/supabase/signOut";
import { cn } from "@/lib/utils";

type PrimaryLink = {
  href: string;
  label: string;
};

type AccountLink = {
  href: string;
  label: string;
};

const BROWSE_PATH = "/browse";

const PRIMARY_LINKS: PrimaryLink[] = [
  { href: BROWSE_PATH, label: "Browse" },
  { href: "/reserve", label: "Reserve" },
];

const ACCOUNT_LINKS: AccountLink[] = [
  { href: "/my-bookings", label: "My bookings" },
  { href: "/profile/manage", label: "Manage profile" },
];

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

type SignOutOptions = {
  onSuccess?: () => void;
};

function useSignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(
    async ({ onSuccess }: SignOutOptions = {}) => {
      try {
        setIsSigningOut(true);
        await signOutFromSupabase();
        toast.success("Signed out");
        onSuccess?.();
        router.push("/");
        router.refresh();
      } catch (error) {
        console.error("[customer-navbar] sign out failed", error);
        toast.error("We couldn’t sign you out. Please try again.");
      } finally {
        setIsSigningOut(false);
      }
    },
    [router],
  );

  return { signOut, isSigningOut };
}

function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 text-base font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 via-primary/90 to-primary text-sm font-bold text-primary-foreground shadow-sm">
        SRX
      </span>
      <span>SajiloReserveX</span>
    </Link>
  );
}

type PrimaryNavProps = {
  links: PrimaryLink[];
  currentPath: string | null;
};

function PrimaryNav({ links, currentPath }: PrimaryNavProps) {
  if (links.length === 0) {
    return <nav aria-label="Primary navigation" />;
  }

  const isActive = useCallback(
    (href: string) => {
      if (!currentPath) return false;
      if (href === "/") return currentPath === "/";
      return currentPath === href || currentPath.startsWith(`${href}/`);
    },
    [currentPath],
  );

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden items-center gap-1 md:flex"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(link.href) ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isActive(link.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
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
  isAuthenticated: boolean;
  account: AccountSnapshot | null;
  accountLinks: AccountLink[];
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
};

function DesktopActions({
  isLoading,
  isAuthenticated,
  account,
  accountLinks,
  onSignOut,
  isSigningOut,
}: DesktopActionsProps) {
  return (
    <div className="hidden items-center gap-2 md:flex">
      {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : null}

      {!isLoading && !isAuthenticated ? (
        <Link
          href="/signin"
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "touch-manipulation")}
        >
          Sign in
        </Link>
      ) : null}

      {isAuthenticated && account ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background touch-manipulation"
              aria-label={`${account.displayName} menu`}
            >
              <Avatar className="h-10 w-10">
                {account.avatarUrl ? (
                  <AvatarImage src={account.avatarUrl} alt={account.displayName} />
                ) : null}
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
                <Link
                  href={item.href}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-sm"
                >
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
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

type MobileMenuProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  links: PrimaryLink[];
  isLoading: boolean;
  isAuthenticated: boolean;
  account: AccountSnapshot | null;
  accountLinks: AccountLink[];
  onSignOut: (options?: SignOutOptions) => Promise<void>;
  isSigningOut: boolean;
  pathname: string;
};

function MobileMenu({
  open,
  onOpenChange,
  links,
  isLoading,
  isAuthenticated,
  account,
  accountLinks,
  onSignOut,
  isSigningOut,
  pathname,
}: MobileMenuProps) {
  const sessionActions = isAuthenticated ? accountLinks : [{ href: "/signin", label: "Sign in" }];
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background touch-manipulation md:hidden"
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="customer-navigation-drawer"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        id="customer-navigation-drawer"
        aria-label="Customer navigation"
        className="flex flex-col gap-8 px-6 py-8"
      >
        <BrandMark />

        {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : null}

        {isAuthenticated && account ? (
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

        <nav className="flex flex-col gap-2" aria-label="Primary navigation">
          {links.map((link) => (
            <SheetClose asChild key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-base font-medium transition",
                  isActive(link.href) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                {link.label}
              </Link>
            </SheetClose>
          ))}
        </nav>

        <div className="flex flex-col gap-2">
          {sessionActions.map((action) => (
            <SheetClose asChild key={action.href}>
              <Link
                href={action.href}
                className="rounded-lg px-3 py-2 text-base font-medium text-foreground transition hover:bg-muted"
              >
                {action.label}
              </Link>
            </SheetClose>
          ))}

          {isAuthenticated ? (
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "justify-center touch-manipulation",
              )}
              onClick={() => {
                void onSignOut({ onSuccess: () => onOpenChange(false) });
              }}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function CustomerNavbar() {
  const pathname = usePathname();
  const { user, status } = useSupabaseSession();
  const isAuthenticated = status === "ready" && Boolean(user);
  const isLoading = status === "loading";
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const metadata = (user?.user_metadata ?? null) as Record<string, unknown> | null;
  const metadataAvatar = typeof metadata?.["avatar_url"] === "string" ? metadata?.["avatar_url"] ?? null : null;
  const metadataName = typeof metadata?.["full_name"] === "string" ? metadata?.["full_name"] ?? null : null;

  const {
    data: profile,
    isLoading: isProfileLoading,
  } = useProfile({ enabled: isAuthenticated });

  const accountSnapshot: AccountSnapshot | null = useMemo(() => {
    if (!isAuthenticated) return null;

    const displayName =
      profile?.name?.trim() ||
      metadataName?.trim() ||
      user?.email ||
      "Account";

    return {
      displayName,
      email: user?.email ?? null,
      avatarUrl: profile?.image ?? metadataAvatar ?? null,
      fallback: resolveFallback(profile?.name ?? metadataName ?? null, user?.email ?? null),
    };
  }, [isAuthenticated, metadataAvatar, metadataName, profile?.image, profile?.name, user?.email]);

  const { signOut, isSigningOut } = useSignOut();

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <div className="relative sticky top-0 z-50">
      <a
        href="#main-content"
        className="skip-to-content absolute left-4 top-4 -translate-y-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition focus-visible:translate-y-0 focus-visible:outline-none"
      >
        Skip to content
      </a>
      <header className="border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandMark />

          <div className="flex items-center gap-3">
            <PrimaryNav links={PRIMARY_LINKS} currentPath={pathname ?? null} />
            <DesktopActions
              isLoading={isLoading || (isAuthenticated && isProfileLoading)}
              isAuthenticated={isAuthenticated}
              account={accountSnapshot}
              accountLinks={ACCOUNT_LINKS}
              onSignOut={() => signOut()}
              isSigningOut={isSigningOut}
            />
            <MobileMenu
              open={isMobileOpen}
              onOpenChange={setIsMobileOpen}
              links={PRIMARY_LINKS}
              isLoading={isLoading || (isAuthenticated && isProfileLoading)}
              isAuthenticated={isAuthenticated}
              account={accountSnapshot}
              accountLinks={ACCOUNT_LINKS}
              onSignOut={signOut}
              isSigningOut={isSigningOut}
              pathname={pathname ?? ""}
            />
          </div>
        </div>
      </header>
    </div>
  );
}
