import {
  GuestContent,
  GuestSectionHeader,
  GuestPanel,
  GuestPanelHeader,
  GuestPrimaryButton,
  GuestSecondaryButton,
} from 'nabatable-platform';
import { Users, Clock } from 'lucide-react';

export const BookingPage = () => (
  <div className="guest-theme w-[42rem] bg-background">
    <GuestContent narrow className="!py-6">
      <GuestSectionHeader
        eyebrow="Your reservation"
        title="The Crown & Anchor"
        description="Saturday 14 June · Table 12 confirmed for a party of 4."
        actions={<GuestPrimaryButton href="/bookings/BR-4821/edit">Manage booking</GuestPrimaryButton>}
      />
      <GuestPanel className="overflow-hidden">
        <GuestPanelHeader title="Booking details" eyebrow="Reference BR-4821" />
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="pg-kicker text-[0.68rem]">Time</p>
            <p className="text-sm font-semibold text-foreground">8:00 PM</p>
          </div>
          <div className="space-y-1">
            <p className="pg-kicker text-[0.68rem]">Guests</p>
            <p className="text-sm font-semibold text-foreground">Priya Nair · 4 covers</p>
          </div>
          <div className="space-y-1">
            <p className="pg-kicker text-[0.68rem]">Turn time</p>
            <p className="text-sm font-semibold text-foreground">2 hours</p>
          </div>
        </div>
      </GuestPanel>
    </GuestContent>
  </div>
);

export const NarrowStack = () => (
  <div className="guest-theme w-[34rem] bg-background">
    <GuestContent narrow className="!py-6">
      <GuestSectionHeader
        eyebrow="Up next"
        title="Two tables waiting"
        description="Confirm or release holds before the dinner service fills up."
      />
      <GuestPanel className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Tom Hill · Party of 2</p>
          <p className="pg-caption flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden /> Fri 7:30 PM · Table 4
          </p>
        </div>
        <GuestSecondaryButton href="/bookings/BR-4822">Review</GuestSecondaryButton>
      </GuestPanel>
      <GuestPanel className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Aisha Khan · Party of 6</p>
          <p className="pg-caption flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden /> Sat 6:00 PM · Tables 1–2
          </p>
        </div>
        <GuestSecondaryButton href="/bookings/BR-4823">Review</GuestSecondaryButton>
      </GuestPanel>
    </GuestContent>
  </div>
);
