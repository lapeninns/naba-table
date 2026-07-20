import { ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';

import { AccountSessionsPanel } from '@/components/features/account-sessions/AccountSessionsPanel';
import { GuestContent, GuestPageFrame, GuestSecondaryButton } from '@/components/guest/ui';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Devices & sessions · Nab a Table',
  description: 'Review the devices and recent sessions connected to your account.',
};

export default async function GuestAccountSecurityPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/signin?redirectedFrom=/guest/profile/security');
  }

  return (
    <GuestPageFrame className="pb-12 sm:pb-16">
      <GuestContent className="space-y-6 py-7 sm:space-y-7 sm:py-10">
        <header className="grid gap-4 border-b border-border/70 pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ShieldCheck className="size-4" aria-hidden />
              Account security
            </div>
            <h1 className="font-[var(--pg-font-display)] text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Devices & sessions
            </h1>
            <p className="pg-body max-w-[62ch]">
              See where your account is signed in and when each session was last used.
            </p>
          </div>
          <GuestSecondaryButton href="/guest/profile">Back to profile</GuestSecondaryButton>
        </header>

        <AccountSessionsPanel />
      </GuestContent>
    </GuestPageFrame>
  );
}
