import { Badge } from 'nabatable-platform';

export const StatusVariants = () => (
  <div className="flex flex-wrap gap-2">
    <Badge variant="status-confirmed">Confirmed</Badge>
    <Badge variant="status-pending">Pending</Badge>
    <Badge variant="status-completed">Seated</Badge>
    <Badge variant="status-cancelled">No-show</Badge>
  </div>
);

export const CoreVariants = () => (
  <div className="flex flex-wrap gap-2">
    <Badge>Default</Badge>
    <Badge variant="secondary">VIP</Badge>
    <Badge variant="destructive">Overdue</Badge>
    <Badge variant="outline">Walk-in</Badge>
    <Badge variant="metric">12 covers</Badge>
  </div>
);

export const GuestChips = () => (
  <div className="flex flex-wrap gap-2">
    <Badge variant="guest-chip">Window seat</Badge>
    <Badge variant="guest-chip-outline">Birthday</Badge>
    <Badge variant="guest-chip">High chair</Badge>
  </div>
);
