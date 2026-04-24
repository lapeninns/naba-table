import { CalendarCheck, KeyRound, ReceiptText, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';

import {
  GuestContent,
  GuestInsetCard,
  GuestPageFrame,
  GuestPanel,
  GuestPrimaryButton,
  GuestSecondaryButton,
} from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { getGuestBookingsLandingContent } from '@/guest/routes/auth-aware-content';
import { getGuestAuthState } from '@/guest/services/auth-state.server';

import type { LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a table · Nab a Table',
  description: 'Choose a restaurant and start a new booking, or sign in to view existing bookings.',
};

export const dynamic = 'force-dynamic';

export default async function BookingsLandingPage() {
  const { isAuthenticated } = await getGuestAuthState();
  const content = getGuestBookingsLandingContent(isAuthenticated);

  return (
    <GuestPageFrame className="pb-12 sm:pb-16">
      <GuestContent className="space-y-6 py-7 sm:space-y-7 sm:py-10">
        <header className="grid gap-4 border-b border-border/70 pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0 space-y-2">
            <p className="pg-kicker">Book a table</p>
            <h1 className="font-[var(--pg-font-display)] text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Start a new booking
            </h1>
            <p className="pg-body max-w-[58ch]">{content.headerDescription}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <GuestPrimaryButton href="/restaurants">Book a table</GuestPrimaryButton>
            <GuestSecondaryButton href={content.secondaryAction.href}>
              {content.secondaryAction.label}
            </GuestSecondaryButton>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[7fr_5fr] lg:items-start">
          <PrimaryBookingPanel
            icon={UtensilsCrossed}
            kicker="New booking"
            title="Choose a restaurant"
            description="Browse available restaurants, pick a date and time, then confirm your table."
            actionHref="/restaurants"
            actionLabel="Browse restaurants"
            featured
          />
          <PrimaryBookingPanel
            icon={CalendarCheck}
            kicker="Existing booking"
            title={content.existingTitle}
            description={content.existingDescription}
            actionHref={content.existingAction.href}
            actionLabel={content.existingAction.label}
          />
        </div>

        <GuestPanel className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[5fr_7fr] lg:items-center">
          <div className="space-y-2">
            <p className="pg-kicker">Have a message link?</p>
            <h2 className="pg-card-title">Open it from your email or SMS</h2>
            <p className="pg-body max-w-[58ch] text-sm">{content.messageLinkDescription}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <GuestInsetCard
              icon={KeyRound}
              value="Magic link"
              detail="No password needed."
              className="p-4"
            />
            <GuestInsetCard
              icon={CalendarCheck}
              value="Upcoming"
              detail="Live bookings first."
              className="p-4"
            />
            <GuestInsetCard
              icon={ReceiptText}
              value="Receipts"
              detail="Past visits saved."
              className="p-4"
            />
          </div>
        </GuestPanel>
      </GuestContent>
    </GuestPageFrame>
  );
}

function PrimaryBookingPanel({
  icon: Icon,
  kicker,
  title,
  description,
  actionHref,
  actionLabel,
  featured = false,
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  featured?: boolean;
}) {
  return (
    <GuestPanel className="flex h-full flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="pg-chip">{kicker}</span>
      </div>
      <div className="space-y-2">
        <h2 className="pg-card-title">{title}</h2>
        <p className="pg-body max-w-[52ch] text-sm">{description}</p>
      </div>
      <div className="mt-auto">
        <Button
          asChild
          variant={featured ? 'guest-primary' : 'guest-outline'}
          size="guest-lg"
          className="pg-action pg-focus-ring pg-touch w-full sm:w-auto"
        >
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
    </GuestPanel>
  );
}
