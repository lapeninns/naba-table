'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar, LayoutDashboard, LogOut, Menu, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BrandLogo } from '@/components/shared/BrandLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/hooks/useProfile';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { buildQueryStorageKey, clearPersistedQueryCache } from '@/lib/query/persist';
import { signOutFromSupabase } from '@/lib/supabase/signOut';
import { cn } from '@/lib/utils';

import type React from 'react';

type NavLink = {
  href: string;
  label: string;
};

type AccountLink = NavLink & {
  icon?: React.ComponentType<{ className?: string }>;
};

const PRIMARY_LINKS: NavLink[] = [
  { href: '/restaurants', label: 'Restaurants' },
  { href: '/bookings', label: 'Book a table' },
];

const ACCOUNT_LINKS: AccountLink[] = [
  { href: '/guest/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/guest/bookings', label: 'My bookings', icon: Calendar },
  { href: '/guest/profile', label: 'Manage profile', icon: User },
];

type Tone = 'light' | 'dark';

type GuestNavbarProps = {
  tone?: Tone;
  isSticky?: boolean;
};

type AccountSnapshot = {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  fallback: string;
};

function getInitials(value: string | null | undefined): string {
  if (!value) return '';
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts.at(-1)?.slice(0, 1) ?? ''}`.toUpperCase();
}

function resolveFallback(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const initials = getInitials(name);
  if (initials) return initials;
  if (email) {
    const local = email.split('@')[0] ?? '';
    if (local) return local.slice(0, 2).toUpperCase();
  }
  return '?';
}

function BrandMark({ tone }: { tone: Tone }) {
  return <BrandLogo href="/" variant={tone} size="sm" showBeta={false} />;
}

function PrimaryNav({
  currentPath,
  tone,
  links,
}: {
  currentPath: string | null;
  tone: Tone;
  links: NavLink[];
}) {
  const isActive = useCallback(
    (href: string) => {
      if (!currentPath) return false;
      if (href === '/') return currentPath === '/';
      return currentPath === href || currentPath.startsWith(`${href}/`);
    },
    [currentPath],
  );

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        'hidden items-center gap-1 rounded-[var(--pg-radius-pill)] border p-1 shadow-[var(--pg-shadow-edge)] backdrop-blur-xl md:flex',
        tone === 'dark'
          ? 'border-white/15 bg-white/10 text-white'
          : 'border-border/70 bg-background/75 text-foreground',
      )}
    >
      {links.map((link) => (
        <Button
          asChild
          key={link.href}
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 rounded-[var(--pg-radius-pill)] px-3.5 text-sm font-semibold',
            tone === 'dark'
              ? 'text-white/75 hover:bg-white/12 hover:text-white'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            isActive(link.href) &&
              (tone === 'dark'
                ? 'bg-white text-foreground shadow-[var(--pg-shadow-xs)] hover:bg-white hover:text-foreground'
                : 'bg-muted text-foreground shadow-[var(--pg-shadow-xs)] hover:bg-muted'),
          )}
        >
          <Link href={link.href} aria-current={isActive(link.href) ? 'page' : undefined}>
            {link.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

function DesktopActions({
  isLoading,
  isAuthenticated,
  account,
  tone,
  onSignOut,
  isSigningOut,
}: {
  isLoading: boolean;
  isAuthenticated: boolean;
  account: AccountSnapshot | null;
  tone: Tone;
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
}) {
  return (
    <div className="hidden items-center gap-3 md:flex">
      {isLoading ? <Skeleton className="size-10 rounded-full" /> : null}

      {!isLoading && !isAuthenticated ? (
        <Button
          asChild
          className={cn(
            'rounded-[var(--pg-radius-pill)]',
            tone === 'dark' && 'border-white/20 bg-white/10 text-white hover:bg-white/15',
          )}
          size="sm"
          variant="outline"
        >
          <Link href="/auth">Sign in</Link>
        </Button>
      ) : null}

      {isAuthenticated && account ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              className={cn(
                'rounded-full p-0',
                tone === 'dark' && 'border-white/20 bg-white/10 hover:bg-white/15',
              )}
              aria-label={`${account.displayName} menu`}
            >
              <Avatar className="size-10 border border-border/30">
                {account.avatarUrl ? (
                  <AvatarImage src={account.avatarUrl} alt={account.displayName} />
                ) : null}
                <AvatarFallback className="bg-muted font-medium text-foreground" aria-hidden>
                  {account.fallback}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-2" forceMount>
            <DropdownMenuLabel className="space-y-0.5 px-2 pb-1">
              <p className="text-sm font-semibold leading-none text-foreground">
                {account.displayName}
              </p>
              {account.email ? (
                <p className="text-xs leading-none text-muted-foreground">{account.email}</p>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuGroup>
              {ACCOUNT_LINKS.map((item) => (
                <DropdownMenuItem asChild key={item.href} className="cursor-pointer rounded-md p-2">
                  <Link
                    href={item.href}
                    className="flex w-full items-center gap-2.5 text-sm font-medium text-foreground/90"
                  >
                    {item.icon ? <item.icon className="text-muted-foreground" /> : null}
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void onSignOut();
              }}
              className="cursor-pointer rounded-md p-2 text-destructive focus:bg-destructive/5 focus:text-destructive"
              disabled={isSigningOut}
              aria-disabled={isSigningOut}
            >
              <div className="flex w-full items-center gap-2.5 text-sm font-medium">
                <LogOut />
                <span>Sign out</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function MobileMenu({
  tone,
  open,
  onOpenChange,
  pathname,
  isAuthenticated,
  account,
  onSignOut,
  isSigningOut,
}: {
  tone: Tone;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  pathname: string;
  isAuthenticated: boolean;
  account: AccountSnapshot | null;
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
}) {
  const isActive = useCallback(
    (href: string) => {
      if (!pathname) return false;
      if (href === '/') return pathname === '/';
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  useEffect(() => {
    const root = document.documentElement;

    if (open) {
      root.setAttribute('data-guest-nav-open', 'true');
      return () => {
        root.removeAttribute('data-guest-nav-open');
      };
    }

    root.removeAttribute('data-guest-nav-open');
    return undefined;
  }, [open]);

  const navSections: { title: string; links: AccountLink[] }[] = [
    { title: 'Explore', links: PRIMARY_LINKS.map((link) => ({ ...link })) },
  ];

  if (isAuthenticated) {
    const accountNavLinks = ACCOUNT_LINKS.filter((link) => link.href !== '/guest/profile');
    if (accountNavLinks.length > 0) {
      navSections.push({ title: 'Account', links: accountNavLinks });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon-lg"
          className={cn(
            'rounded-[var(--pg-radius-md)] border-border/80 bg-background/90 shadow-[var(--pg-shadow-xs)] md:hidden',
            tone === 'dark' && 'border-white/20 bg-white/10 text-white hover:bg-white/15',
          )}
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="guest-navigation-drawer"
        >
          <Menu aria-hidden data-icon="inline-start" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        id="guest-navigation-drawer"
        aria-label="Guest navigation"
        showCloseButton={false}
        className="flex h-full flex-col gap-0 px-0 pb-0 pt-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/70 px-6 py-5 text-left">
          <BrandMark tone="light" />
          <SheetTitle className="mt-5 text-2xl font-semibold tracking-tight">
            Guest navigation
          </SheetTitle>
          <SheetDescription>
            Find restaurants, book a table, or manage your account.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-y-auto px-6 py-5">
          {isAuthenticated && account ? (
            <div className="flex flex-col gap-4 rounded-[var(--pg-radius-lg)] border border-border/70 bg-muted/35 p-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-12 border border-border/70 bg-background">
                  {account.avatarUrl ? (
                    <AvatarImage src={account.avatarUrl} alt={account.displayName} />
                  ) : null}
                  <AvatarFallback aria-hidden>{account.fallback}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {account.displayName}
                  </span>
                  {account.email ? (
                    <span className="text-sm text-muted-foreground break-all leading-snug">
                      {account.email}
                    </span>
                  ) : null}
                </div>
              </div>
              <SheetClose asChild>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-[var(--pg-radius-pill)]"
                >
                  <Link href="/guest/profile">Manage profile</Link>
                </Button>
              </SheetClose>
            </div>
          ) : (
            <div className="rounded-[var(--pg-radius-lg)] border border-border/70 bg-muted/35 p-4">
              <p className="text-sm text-muted-foreground">
                Sign in to sync bookings, dietary notes, and saved occasions.
              </p>
            </div>
          )}

          <Separator className="my-6" />

          <div className="flex flex-col gap-6">
            {navSections.map((section) => (
              <section
                key={section.title}
                className="flex flex-col gap-3"
                aria-label={section.title}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {section.title}
                </p>
                <div className="flex flex-col gap-2">
                  {section.links.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Button
                        asChild
                        variant={isActive(link.href) ? 'secondary' : 'ghost'}
                        className={cn(
                          'h-12 justify-start rounded-[var(--pg-radius-md)] px-3 text-base font-semibold',
                          isActive(link.href) && 'border border-border/70 bg-muted',
                        )}
                      >
                        <Link href={link.href}>
                          {link.icon ? (
                            <link.icon className="text-muted-foreground" aria-hidden />
                          ) : null}
                          <span>{link.label}</span>
                        </Link>
                      </Button>
                    </SheetClose>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <SheetFooter className="border-t border-border/70 p-6">
          {isAuthenticated ? (
            <Button
              variant="outline"
              className="w-full rounded-[var(--pg-radius-pill)]"
              onClick={() => {
                void onSignOut();
              }}
              disabled={isSigningOut}
            >
              <LogOut aria-hidden data-icon="inline-start" />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </Button>
          ) : (
            <SheetClose asChild>
              <Button asChild variant="outline" className="w-full rounded-[var(--pg-radius-pill)]">
                <Link href="/auth">Sign in</Link>
              </Button>
            </SheetClose>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function GuestNavbar({ tone = 'light', isSticky = true }: GuestNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useSupabaseSession();
  const isAuthenticated = status === 'authenticated' && Boolean(user);
  const isLoadingSession = status === 'loading';
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const queryClient = useQueryClient();

  const metadata = (user?.user_metadata ?? null) as Record<string, unknown> | null;
  const metadataAvatar =
    typeof metadata?.['avatar_url'] === 'string' ? (metadata?.['avatar_url'] as string) : null;
  const metadataName =
    typeof metadata?.['full_name'] === 'string' ? (metadata?.['full_name'] as string) : null;

  const { data: profile, isLoading: isProfileLoading } = useProfile({ enabled: isAuthenticated });
  const primaryLinks = PRIMARY_LINKS;

  const accountSnapshot: AccountSnapshot | null = useMemo(() => {
    if (!isAuthenticated) return null;

    const displayName = profile?.name?.trim() || metadataName?.trim() || user?.email || 'Account';

    return {
      displayName,
      email: user?.email ?? null,
      avatarUrl: profile?.image ?? metadataAvatar ?? null,
      fallback: resolveFallback(profile?.name ?? metadataName ?? null, user?.email ?? null),
    };
  }, [isAuthenticated, metadataAvatar, metadataName, profile?.image, profile?.name, user?.email]);

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    try {
      setIsSigningOut(true);
      await signOutFromSupabase();
      const storageKey = buildQueryStorageKey(user?.id ?? null);
      queryClient.clear();
      clearPersistedQueryCache(storageKey);
      router.replace('/');
    } catch (error) {
      console.error('[GuestNavbar] sign out failed', error);
    } finally {
      setIsSigningOut(false);
      setIsMobileOpen(false);
    }
  }, [queryClient, router, user?.id]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const headerToneClasses =
    tone === 'dark'
      ? 'border-b border-white/10 bg-foreground/80 text-background'
      : 'border-b border-border/70 bg-background/88 text-foreground';

  const shellClasses = cn(
    isSticky ? 'sticky top-0' : 'relative',
    'z-50 w-full backdrop-blur-xl supports-[backdrop-filter]:saturate-150',
    headerToneClasses,
  );

  return (
    <div className={shellClasses}>
      <div className="pg-container w-full py-3">
        <div className="flex min-h-14 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center">
            <BrandMark tone={tone} />
          </div>

          <div className="hidden flex-1 items-center justify-end gap-4 md:flex">
            <PrimaryNav currentPath={pathname ?? null} tone={tone} links={primaryLinks} />
            <DesktopActions
              isLoading={isLoadingSession || (isAuthenticated && isProfileLoading)}
              isAuthenticated={isAuthenticated}
              account={accountSnapshot}
              tone={tone}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
            />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <MobileMenu
              tone={tone}
              open={isMobileOpen}
              onOpenChange={setIsMobileOpen}
              pathname={pathname ?? ''}
              isAuthenticated={isAuthenticated}
              account={accountSnapshot}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
