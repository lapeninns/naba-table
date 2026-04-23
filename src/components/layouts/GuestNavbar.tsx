'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Menu, User, LayoutDashboard, Calendar } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BrandLogo } from '@/components/shared/BrandLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
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

const PRIMARY_LINKS: NavLink[] = [{ href: '/restaurants', label: 'Restaurants' }];

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
  return <BrandLogo href="/" variant={tone} size="sm" />;
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

  const baseStyles =
    tone === 'dark'
      ? 'pg-nav-inverse'
      : 'border-border bg-background/80 text-foreground shadow-[var(--pg-shadow-nav)]';
  const inactive =
    tone === 'dark'
      ? 'pg-nav-inverse-muted'
      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground';
  const active =
    tone === 'dark'
      ? 'bg-background text-foreground ring-0'
      : 'bg-primary text-primary-foreground shadow-[var(--pg-shadow-button)] ring-0';

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        'hidden h-12 items-center gap-1.5 rounded-full px-1.5 py-1 backdrop-blur-xl supports-[backdrop-filter]:saturate-150 md:flex',
        baseStyles,
      )}
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(link.href) ? 'page' : undefined}
          className={cn(
            'rounded-full px-3.5 py-2 text-sm font-semibold leading-5 transition active:translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isActive(link.href) ? active : inactive,
          )}
        >
          {link.label}
        </Link>
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
      {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : null}

      {!isLoading && !isAuthenticated ? (
        <Link
          href="/auth"
          className={cn(
            buttonVariants({ variant: tone === 'dark' ? 'secondary' : 'outline', size: 'sm' }),
            tone === 'dark' ? 'pg-nav-inverse' : undefined,
          )}
        >
          Sign in
        </Link>
      ) : null}

      {isAuthenticated && account ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group relative h-10 w-10 rounded-full border border-border/50 bg-background text-foreground outline-none transition hover:ring-2 hover:ring-primary/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={`${account.displayName} menu`}
            >
              <Avatar className="h-10 w-10 border border-border/30">
                {account.avatarUrl ? (
                  <AvatarImage src={account.avatarUrl} alt={account.displayName} />
                ) : null}
                <AvatarFallback className="bg-primary/5 text-primary font-medium" aria-hidden>
                  {account.fallback}
                </AvatarFallback>
              </Avatar>
            </button>
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
            {ACCOUNT_LINKS.map((item) => (
              <DropdownMenuItem
                asChild
                key={item.href}
                className="cursor-pointer rounded-md p-2 focus:bg-primary/5"
              >
                <Link
                  href={item.href}
                  className="flex w-full items-center gap-2.5 text-sm font-medium text-foreground/90"
                >
                  {item.icon ? <item.icon className="h-4 w-4 text-muted-foreground" /> : null}
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
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
                <LogOut className="h-4 w-4" />
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
        <button
          type="button"
          className="pg-card pg-action pg-focus-ring pg-touch inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:text-primary md:hidden"
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="guest-navigation-drawer"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        id="guest-navigation-drawer"
        aria-label="Guest navigation"
        className="flex h-full flex-col gap-6 px-6 pb-6 pt-12 sm:px-8"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Guest navigation</SheetTitle>
        </SheetHeader>
        <div className="pg-card p-4">
          <div className="flex flex-col gap-1 pr-10">
            <BrandMark tone={tone} />
          </div>

          {isAuthenticated && account ? (
            <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/50 p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border border-border/70 bg-background">
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
                <Link
                  href="/guest/profile"
                  className="inline-flex items-center justify-center rounded-full border border-border/80 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Manage profile
                </Link>
              </SheetClose>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Sign in to sync bookings, dietary notes, and saved occasions.
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {navSections.map((section) => (
            <section key={section.title} className="flex flex-col gap-3" aria-label={section.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {section.title}
              </p>
              <div className="flex flex-col gap-2">
                {section.links.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 text-base font-semibold text-foreground transition',
                        'hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        isActive(link.href)
                          ? 'border-primary/50 bg-primary/5 text-primary'
                          : undefined,
                      )}
                    >
                      {link.icon ? (
                        <link.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                      ) : null}
                      <span>{link.label}</span>
                    </Link>
                  </SheetClose>
                ))}
              </div>
            </section>
          ))}
        </div>

        <SheetFooter className="mt-auto flex w-full flex-col gap-3 border-t border-border/50 pt-4">
          {isAuthenticated ? (
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'default' }),
                'w-full justify-center gap-2 rounded-2xl text-base font-semibold touch-manipulation',
              )}
              onClick={() => {
                void onSignOut();
              }}
              disabled={isSigningOut}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          ) : (
            <SheetClose asChild>
              <Link
                href="/auth"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'default' }),
                  'w-full justify-center rounded-2xl text-base font-semibold',
                )}
              >
                Sign in
              </Link>
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
  const primaryLinks = useMemo<NavLink[]>(
    () =>
      isAuthenticated
        ? [...PRIMARY_LINKS, { href: '/guest/bookings', label: 'My bookings' }]
        : PRIMARY_LINKS,
    [isAuthenticated],
  );

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
      ? 'border-b pg-nav-inverse pg-nav-inverse-border'
      : 'border-b border-border bg-background/85 text-foreground';

  const shellClasses = cn(
    isSticky ? 'sticky top-0' : 'relative',
    'z-50 w-full backdrop-blur supports-[backdrop-filter]:saturate-150',
    headerToneClasses,
  );

  return (
    <div className={shellClasses}>
      <div className="guest-boundary w-full py-3 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <BrandMark tone={tone} />

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
