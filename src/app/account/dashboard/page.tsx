import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { InfoCard } from '@/components/guest-account/InfoCard';
import { HeaderActions, PageShell } from '@/components/guest-account/PageShell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import config from '@/config';
import { getOrCreateProfile } from '@/lib/profile/server';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import { DashboardOverviewClient } from './DashboardOverviewClient';
import { prefetchUpcomingBookings } from '../_lib/bookings-prefetch';
import { computeProfileCompletion, initialsForDisplay, resolveDisplayName } from '../_lib/personalization';

import type { ProfileResponse } from '@/lib/profile/schema';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withRedirectedFrom('/signin', '/dashboard'));
  }

  let profile: ProfileResponse | null = null;
  try {
    profile = await getOrCreateProfile(supabase, user);
  } catch (error) {
    console.error('[dashboard][profile] failed to resolve profile', error);
  }

  const displayName = resolveDisplayName(profile, user.email ?? null);
  const profileCompletion = computeProfileCompletion(profile);
  const primaryEmail = profile?.email ?? user.email ?? null;
  const primaryPhone = profile?.phone ?? null;

  const queryClient = new QueryClient();
  await prefetchUpcomingBookings(queryClient);
  const dehydratedState = dehydrate(queryClient);
  const supportEmail = config.email?.supportEmail ?? 'support@example.com';

  return (
    <PageShell
      eyebrow="Guest home"
      title="Dashboard"
      description={`Welcome back${displayName ? `, ${displayName}` : ''}. Manage reservations, stay on top of updates, and keep your details ready.`}
      actions={
        <HeaderActions
          primary={{ href: '/reserve', label: 'Book now' }}
          secondary={{ href: '/my-bookings', label: 'View bookings', variant: 'outline' }}
        />
      }
    >
      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <WelcomeCard
            name={displayName}
            email={primaryEmail}
            phone={primaryPhone}
            supportEmail={supportEmail}
            profileCompletion={profileCompletion}
          />
          <HydrationBoundary state={dehydratedState}>
            <DashboardOverviewClient supportEmail={supportEmail} profileEmail={primaryEmail} />
          </HydrationBoundary>
        </div>
        <div className="space-y-4">
          <InfoCard
            title="Reservation checklist"
            description="Quick reminders that keep check-in smooth and updates flowing."
          >
            <ul className="list-disc space-y-2 pl-5">
              <li>Add arrival notes so the restaurant can personalize your table.</li>
              <li>Use the same email and phone you share on the day of your visit.</li>
              <li>Enable reminders so timing changes never get missed.</li>
            </ul>
          </InfoCard>
          <InfoCard
            title="Managing changes"
            description="Guidance for reschedules and cancellations."
          >
            <ul className="list-disc space-y-2 pl-5">
              <li>Share preferred times or party sizes when requesting changes.</li>
              <li>Check confirmation emails for cutoff windows and policies.</li>
              <li>Cancelled visits stay here for your records.</li>
            </ul>
          </InfoCard>
          <InfoCard
            title="Need help?"
            description="We can help with adjustments before cutoff windows when available."
            footer={
              <div className="flex flex-col gap-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Contact support</span>
                <a
                  className="text-primary underline decoration-primary/60 underline-offset-4"
                  href={`mailto:${supportEmail}`}
                >
                  {supportEmail}
                </a>
              </div>
            }
          >
            <ul className="list-disc space-y-2 pl-5">
              <li>Include your booking reference and requested change.</li>
              <li>Share time-sensitive updates as early as possible.</li>
              <li>We'll reply from the address above - add it to your safe list.</li>
            </ul>
          </InfoCard>
        </div>
      </div>
    </PageShell>
  );
}

type WelcomeCardProps = {
  name: string;
  email: string | null;
  phone: string | null;
  supportEmail: string;
  profileCompletion: { percent: number; missing: string[] };
};

function WelcomeCard({ name, email, phone, supportEmail, profileCompletion }: WelcomeCardProps) {
  const initials = initialsForDisplay(name);
  const completion = Math.min(Math.max(profileCompletion.percent, 0), 100);

  return (
    <div className="rounded-3xl border border-primary/20 bg-white/85 p-6 shadow-sm ring-1 ring-primary/5 sm:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-primary">Your reservation hub</p>
              <h2 className="text-2xl font-semibold text-slate-900">Welcome back, {name}</h2>
              <p className="text-sm text-slate-600">
                Quickly start a new reservation, review what is coming up, or tidy up your contact details.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {email ? <Badge variant="outline">{email}</Badge> : <Badge variant="secondary">Add your email</Badge>}
                {phone ? <Badge variant="outline">{phone}</Badge> : <Badge variant="secondary">Add a phone number</Badge>}
                <Badge variant={profileCompletion.missing.length ? 'secondary' : 'default'}>
                  {profileCompletion.percent}% profile ready
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/my-bookings">View bookings</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profile/manage">Update profile</Link>
            </Button>
            <Button variant="ghost" asChild>
              <a href={`mailto:${supportEmail}`}>Email support</a>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Profile readiness</p>
            <p className="text-sm text-slate-600">Keep your contact details current so confirmations land fast.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-sm">
            <Progress value={completion} aria-label="Profile completion" />
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{completion}% complete</span>
              <span>{profileCompletion.missing.length ? `Missing: ${profileCompletion.missing.join(', ')}` : 'All set'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
