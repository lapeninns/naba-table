"use client";

import React, { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { toast } from "react-hot-toast";

import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { cn } from "@/lib/utils";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useProfile } from "@/hooks/useProfile";
import { signOutFromSupabase } from "@/lib/supabase/signOut";

type AccountLink = {
  href: string;
  label: string;
};

const ACCOUNT_LINKS: AccountLink[] = [
  { href: "/my-bookings", label: "My bookings" },
  { href: "/profile/manage", label: "Manage profile" },
];

function getInitials(name: string | null | undefined): string {
  if (!name) {
    return "";
  }

  const words = name.trim().split(/\s+/);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
}

function resolveFallback(
  profileName: string | null | undefined,
  email: string | undefined,
): string {
  const initials = getInitials(profileName);
  if (initials) {
    return initials;
  }

  if (email) {
    const localPart = email.split("@")[0] ?? "";
    return localPart.slice(0, 2).toUpperCase();
  }

  return "?";
}

export function CustomerNavbar(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useSupabaseSession();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isAuthenticated = status === "ready" && Boolean(user);

  const metadata = (user?.user_metadata ?? null) as Record<string, unknown> | null;
  const rawAvatar = metadata?.["avatar_url"];
  const metadataAvatar = typeof rawAvatar === "string" && rawAvatar.trim().length > 0 ? rawAvatar : undefined;
  const rawName = metadata?.["full_name"];
  const metadataName = typeof rawName === "string" && rawName.trim().length > 0 ? rawName : undefined;

  const {
    data: profile,
    isLoading: isProfileLoading,
  } = useProfile({
    enabled: isAuthenticated,
  });

  const avatarImage = profile?.image ?? metadataAvatar ?? null;
  const fallbackLabel = resolveFallback(profile?.name ?? metadataName, user?.email ?? undefined);

  const accountMenuLabel = useMemo(() => {
    if (profile?.name) {
      return profile.name;
    }

    if (user?.email) {
      return user.email;
    }

    return "Account";
  }, [profile?.name, user?.email]);

  const handleSignOut = useCallback(async () => {
    try {
      setIsSigningOut(true);
      await signOutFromSupabase();
      setIsSheetOpen(false);
      toast.success("Signed out");
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("[customer-navbar] sign out failed", error);
      toast.error("We couldn’t sign you out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }, [router]);

  const mobileActions = isAuthenticated
    ? ACCOUNT_LINKS
    : [{ href: "/signin", label: "Sign in" }];

  useEffect(() => {
    setIsSheetOpen(false);
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
          <Link
            href="/"
            aria-label="Go to SajiloReserveX home"
            className="flex items-center gap-3 text-base font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              SRX
            </span>
            <span>SajiloReserveX</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              {status === "loading" ? (
                <Skeleton className="h-10 w-10 rounded-full" />
              ) : null}
              {status === "ready" && !isAuthenticated ? (
                <Link
                  href="/signin"
                  className={cn(
                    buttonVariants({ variant: "primary", size: "sm" }),
                    "touch-manipulation",
                  )}
                >
                  Sign in
                </Link>
              ) : null}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background touch-manipulation"
                      aria-label={`${accountMenuLabel} menu`}
                    >
                      {isProfileLoading ? (
                        <Skeleton className="h-6 w-6 rounded-full" />
                      ) : (
                        <Avatar className="h-10 w-10">
                          {typeof avatarImage === "string" && avatarImage ? (
                            <AvatarImage src={avatarImage} alt={accountMenuLabel} />
                          ) : null}
                          <AvatarFallback aria-hidden>{fallbackLabel}</AvatarFallback>
                        </Avatar>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56" forceMount>
                    <DropdownMenuLabel>{accountMenuLabel}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ACCOUNT_LINKS.map((item) => (
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
                        void handleSignOut();
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

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background touch-manipulation md:hidden"
                  aria-label="Open navigation menu"
                  aria-expanded={isSheetOpen}
                  aria-controls="customer-navigation-drawer"
                >
                  <Menu className="h-5 w-5" aria-hidden />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex gap-8"
                id="customer-navigation-drawer"
                aria-label="Customer navigation"
              >
                <div className="flex w-full flex-col gap-6">
                  <Link
                    href="/"
                    className="flex items-center gap-3 text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => setIsSheetOpen(false)}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      SRX
                    </span>
                    SajiloReserveX
                  </Link>

                  {status === "loading" ? (
                    <Skeleton className="h-10 w-10 rounded-full" />
                  ) : null}

                  {isAuthenticated ? (
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        {typeof avatarImage === "string" && avatarImage ? (
                          <AvatarImage src={avatarImage} alt={accountMenuLabel} />
                        ) : null}
                        <AvatarFallback aria-hidden>{fallbackLabel}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{accountMenuLabel}</span>
                        {user?.email ? (
                          <span className="text-sm text-muted-foreground">{user.email}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <nav className="flex flex-col gap-3">
                    {mobileActions.map((item) => (
                      <SheetClose asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-md px-3 py-2 text-base font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          onClick={() => {
                            if (item.href === pathname) {
                              setIsSheetOpen(false);
                            }
                          }}
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    ))}
                    {isAuthenticated ? (
                      <button
                        type="button"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "primary" }),
                          "justify-center touch-manipulation",
                        )}
                        onClick={() => void handleSignOut()}
                        disabled={isSigningOut}
                      >
                        {isSigningOut ? "Signing out…" : "Sign out"}
                      </button>
                    ) : null}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </div>
  );
}
