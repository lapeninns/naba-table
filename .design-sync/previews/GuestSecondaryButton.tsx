import { GuestSecondaryButton, GuestPrimaryButton } from 'nabatable-platform';

export const Single = () => (
  <div className="guest-theme rounded-2xl bg-muted/50 p-6">
    <GuestSecondaryButton href="/bookings/BR-4821/edit">Change time</GuestSecondaryButton>
  </div>
);

export const PairedWithPrimary = () => (
  <div className="guest-theme flex flex-col gap-3 rounded-2xl bg-muted/50 p-6 sm:flex-row sm:flex-wrap">
    <GuestPrimaryButton href="/reserve">Reserve a table</GuestPrimaryButton>
    <GuestSecondaryButton href="/availability">Check availability</GuestSecondaryButton>
  </div>
);

export const BookingActions = () => (
  <div className="guest-theme flex flex-col gap-2 w-80 rounded-2xl border border-border/70 bg-muted/40 p-5">
    <p className="text-sm font-semibold text-foreground">Reservation BR-4821</p>
    <p className="text-sm text-muted-foreground">Tom Hill · Party of 2 · Fri 7:30 PM</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <GuestSecondaryButton href="/bookings/BR-4821/edit">Modify booking</GuestSecondaryButton>
      <GuestSecondaryButton href="/bookings/BR-4821/add-guests">Add guests</GuestSecondaryButton>
    </div>
  </div>
);
