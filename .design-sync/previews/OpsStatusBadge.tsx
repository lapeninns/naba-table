import { OpsStatusBadge } from 'nabatable-platform';

export const Tones = () => (
  <div className="flex flex-wrap items-center gap-2 max-w-md">
    <OpsStatusBadge tone="neutral" label="Booked" />
    <OpsStatusBadge tone="success" label="Seated" />
    <OpsStatusBadge tone="info" label="Confirmed" />
    <OpsStatusBadge tone="warning" label="Overdue" />
    <OpsStatusBadge tone="danger" label="No-show" />
    <OpsStatusBadge tone="muted" label="Cancelled" />
  </div>
);

export const BookingRow = () => (
  <div className="flex flex-col gap-2 w-80">
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-semibold">T12 · Priya Nair · 4 covers</span>
      <OpsStatusBadge tone="success" label="Seated" />
    </div>
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-semibold">T4 · Tom Hill · 2 covers</span>
      <OpsStatusBadge tone="info" label="Confirmed" />
    </div>
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-semibold">T7 · Walk-in · 3 covers</span>
      <OpsStatusBadge tone="warning" label="Overdue 12m" />
    </div>
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-semibold">T1 · Aisha Khan · 6 covers</span>
      <OpsStatusBadge tone="danger" label="No-show" />
    </div>
  </div>
);

export const ServiceStates = () => (
  <div className="flex flex-wrap items-center gap-2 max-w-md">
    <OpsStatusBadge tone="muted" label="Pending" />
    <OpsStatusBadge tone="neutral" label="Walk-in" />
    <OpsStatusBadge tone="success" label="On time" />
    <OpsStatusBadge tone="warning" label="Turn due" />
    <OpsStatusBadge tone="danger" label="Cancelled" />
  </div>
);
