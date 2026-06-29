import { GuestGhostButton } from 'nabatable-platform';

export const Single = () => (
  <div className="guest-theme">
    <GuestGhostButton href="/bookings/BR-4821">View booking</GuestGhostButton>
  </div>
);

export const Actions = () => (
  <div className="guest-theme flex flex-wrap items-center gap-3">
    <GuestGhostButton href="/bookings/BR-4821">View details</GuestGhostButton>
    <GuestGhostButton href="/bookings/BR-4821/edit">Change time</GuestGhostButton>
    <GuestGhostButton href="/help">Need help?</GuestGhostButton>
  </div>
);

export const InContext = () => (
  <div className="guest-theme flex flex-col gap-2 w-80 rounded-2xl border border-border/70 bg-card p-5">
    <p className="text-sm font-semibold text-foreground">Table 12 · Saturday 8:00 PM</p>
    <p className="text-sm text-muted-foreground">Party of 4 · Window booth</p>
    <div className="mt-2">
      <GuestGhostButton href="/bookings/BR-4821/cancel">Cancel reservation</GuestGhostButton>
    </div>
  </div>
);
