import { GuestPrimaryButton, GuestSecondaryButton } from '@/components/guest/ui';
import { Heading } from '@/components/ui/typography';
import { getGreeting } from '@/guest/lib/formatters';

export function GuestDashboardHeader({ firstName }: { firstName: string }) {
  return (
    <header className="grid gap-4 border-b border-border/70 pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="pg-kicker">
          {getGreeting()}, {firstName}
        </p>
        <Heading variant="section" as="h1">
          Your bookings
        </Heading>
        <p className="pg-body max-w-[58ch]">
          Manage upcoming reservations, open receipts, and update the profile details used for
          future bookings.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <GuestPrimaryButton href="/restaurants">Book a table</GuestPrimaryButton>
        <GuestSecondaryButton href="/guest/bookings">All bookings</GuestSecondaryButton>
      </div>
    </header>
  );
}
