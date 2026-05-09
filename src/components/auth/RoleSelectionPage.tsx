'use client';

import { ArrowRight, Building2, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { GuestContent, GuestPageFrame, GuestPanel } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Role = 'guest' | 'owner';

interface RoleSelectionPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export function RoleSelectionPage({ searchParams }: RoleSelectionPageProps) {
  const [preferredRole, setPreferredRole] = useState<Role | null>(null);

  const buildUrl = (base: string) => {
    if (!searchParams || Object.keys(searchParams).length === 0) return base;
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
      } else if (value !== undefined) {
        params.append(key, value);
      }
    });
    const queryString = params.toString();
    return queryString ? `${base}?${queryString}` : base;
  };

  useEffect(() => {
    const savedRole = localStorage.getItem('preferred-role') as Role | null;
    if (!savedRole) return;
    try {
      const parsed = JSON.parse(savedRole) as { role?: Role };
      if (parsed?.role) setPreferredRole(parsed.role);
    } catch {
      setPreferredRole(savedRole);
    }
  }, []);

  const handleRoleSelect = (role: Role) => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    localStorage.setItem(
      'preferred-role',
      JSON.stringify({
        role,
        expires: expiry.toISOString(),
      }),
    );
    setPreferredRole(role);
  };

  return (
    <GuestPageFrame className="pb-10 sm:pb-12">
      <section className="pg-hero-band relative isolate overflow-hidden border-b border-border/70 py-8 sm:py-10 lg:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-48 w-[30rem] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl"
        />

        <div className="pg-container-sm relative space-y-6">
          <div className="pg-appear mx-auto max-w-2xl space-y-5 text-center">
            <div className="flex justify-center">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pg-chip bg-background/90 shadow-[var(--pg-shadow-xs)]">
                  Sign in
                </span>
                <span className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Guest or owner
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="pg-hero-title mx-auto max-w-[14ch] text-foreground">
                Choose how to continue.
              </h1>
              <p className="pg-lead mx-auto max-w-[48ch]">
                Guests manage bookings. Restaurant teams open the operations workspace.
              </p>
            </div>
          </div>
        </div>
      </section>

      <GuestContent narrow className="space-y-4 py-6 sm:py-8">
        <GuestPanel className="pg-appear grid gap-5 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
              <Users className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="pg-card-title">I am a guest</h2>
                {preferredRole === 'guest' ? (
                  <Badge variant="guest-chip-outline" className="pg-chip">
                    Saved
                  </Badge>
                ) : null}
              </div>
              <p className="pg-body text-sm">
                Get a magic link for reservations, receipts, and profile details.
              </p>
            </div>
          </div>

          <Button
            asChild
            variant="guest-primary"
            size="guest-lg"
            className="pg-action pg-focus-ring pg-touch w-full justify-between"
          >
            <Link href={buildUrl('/auth/signin')} onClick={() => handleRoleSelect('guest')}>
              Continue as guest
              <ArrowRight aria-hidden data-icon="inline-end" />
            </Link>
          </Button>
        </GuestPanel>

        <div className="grid gap-4 sm:grid-cols-2">
          <GuestPanel className="grid gap-4 p-5">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
                <Building2 className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">I run a restaurant</h2>
                  {preferredRole === 'owner' ? (
                    <Badge variant="guest-chip-outline" className="pg-chip">
                      Saved
                    </Badge>
                  ) : null}
                </div>
                <p className="pg-caption">Open bookings, tables, settings, and team tools.</p>
              </div>
            </div>
            <Button
              asChild
              variant="guest-outline"
              size="guest-lg"
              className="pg-action pg-focus-ring pg-touch w-full justify-between"
            >
              <a href={buildUrl('/app/auth/signin')} onClick={() => handleRoleSelect('owner')}>
                Owner sign-in
                <ArrowRight aria-hidden data-icon="inline-end" />
              </a>
            </Button>
          </GuestPanel>

          <GuestPanel className="grid gap-4 p-5">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
                <Search className="size-4 text-primary" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1.5">
                <h2 className="text-base font-semibold text-foreground">Just browsing</h2>
                <p className="pg-caption">Explore restaurants before signing in.</p>
              </div>
            </div>
            <Button
              asChild
              variant="guest-outline"
              size="guest-lg"
              className="pg-action pg-focus-ring pg-touch w-full justify-between"
            >
              <Link href="/restaurants">
                Browse restaurants
                <ArrowRight aria-hidden data-icon="inline-end" />
              </Link>
            </Button>
          </GuestPanel>
        </div>
      </GuestContent>
    </GuestPageFrame>
  );
}

export default RoleSelectionPage;
