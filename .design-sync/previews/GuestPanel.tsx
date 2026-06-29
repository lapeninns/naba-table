import { GuestPanel, GuestPanelHeader, GuestPrimaryButton, GuestGhostButton } from 'nabatable-platform';
import { CalendarDays, Users, Clock } from 'lucide-react';

export const BookingSummary = () => (
  <div className="guest-theme w-96">
    <GuestPanel className="overflow-hidden">
      <GuestPanelHeader
        eyebrow="Your reservation"
        title="The Crown & Anchor"
        description="Saturday 14 June · Confirmed"
      />
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="pg-kicker text-[0.68rem]">Time</p>
          <p className="text-sm font-semibold text-foreground">8:00 PM</p>
        </div>
        <div className="space-y-1">
          <p className="pg-kicker text-[0.68rem]">Party</p>
          <p className="text-sm font-semibold text-foreground">4 guests · Table 12</p>
        </div>
        <div className="space-y-1">
          <p className="pg-kicker text-[0.68rem]">Booked by</p>
          <p className="text-sm font-semibold text-foreground">Priya Nair</p>
        </div>
        <div className="space-y-1">
          <p className="pg-kicker text-[0.68rem]">Reference</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">BR-4821</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border/60 px-6 py-4">
        <GuestPrimaryButton href="/bookings/BR-4821/edit">Change booking</GuestPrimaryButton>
        <GuestGhostButton href="/bookings/BR-4821/cancel">Cancel</GuestGhostButton>
      </div>
    </GuestPanel>
  </div>
);

export const Metrics = () => (
  <div className="guest-theme grid grid-cols-3 gap-3 w-96">
    <GuestPanel className="flex flex-col gap-2 p-4">
      <span className="flex size-9 items-center justify-center rounded-full border border-border/80 bg-background text-primary">
        <Users className="size-4" aria-hidden />
      </span>
      <p className="pg-kicker text-[0.68rem]">Covers tonight</p>
      <p className="font-[var(--pg-font-mono)] text-2xl font-semibold tabular-nums text-foreground">84</p>
    </GuestPanel>
    <GuestPanel className="flex flex-col gap-2 p-4">
      <span className="flex size-9 items-center justify-center rounded-full border border-border/80 bg-background text-primary">
        <CalendarDays className="size-4" aria-hidden />
      </span>
      <p className="pg-kicker text-[0.68rem]">Bookings</p>
      <p className="font-[var(--pg-font-mono)] text-2xl font-semibold tabular-nums text-foreground">21</p>
    </GuestPanel>
    <GuestPanel className="flex flex-col gap-2 p-4">
      <span className="flex size-9 items-center justify-center rounded-full border border-border/80 bg-background text-primary">
        <Clock className="size-4" aria-hidden />
      </span>
      <p className="pg-kicker text-[0.68rem]">Avg turn</p>
      <p className="font-[var(--pg-font-mono)] text-2xl font-semibold tabular-nums text-foreground">96m</p>
    </GuestPanel>
  </div>
);

export const Interactive = () => (
  <div className="guest-theme w-80">
    <GuestPanel interactive className="flex flex-col gap-3 p-5">
      <span className="flex size-12 items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-primary">
        <CalendarDays className="size-5" aria-hidden />
      </span>
      <h3 className="pg-card-title">Find a table</h3>
      <p className="pg-body text-sm">Real-time availability for parties of 2 to 10 across all services.</p>
    </GuestPanel>
  </div>
);
