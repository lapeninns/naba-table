import {
  Accessibility,
  AlarmClock,
  Ban,
  CalendarDays,
  CircleCheck,
  Clock,
  Hourglass,
  Loader2,
  Lock,
  StickyNote,
  TriangleAlert,
  UserRound,
} from 'lucide-react';

import type { TableStateKind } from './model/floorPlanState';
import type { FloorBookingTagKind } from './model/floorPlanTypes';
import type { LucideIcon } from 'lucide-react';

type StateStyle = {
  label: string;
  icon: LucideIcon;
  /** Tile surface + border. */
  tile: string;
  /** Icon / status text colour. */
  tone: string;
  /** Small swatch for the key and list rows. */
  swatch: string;
  /** Timeline bar. */
  bar: string;
};

export const STATE_STYLES: Record<TableStateKind, StateStyle> = {
  free: {
    label: 'Free',
    icon: CircleCheck,
    tile: 'border-success/60 bg-card',
    tone: 'text-success',
    swatch: 'bg-success',
    bar: 'bg-success/20 text-foreground',
  },
  due: {
    label: 'Due soon',
    icon: Clock,
    tile: 'border-warning bg-warning/10',
    tone: 'text-warning-foreground dark:text-warning',
    swatch: 'bg-warning',
    bar: 'border border-warning bg-warning/15 text-foreground',
  },
  late: {
    label: 'Late',
    icon: AlarmClock,
    tile: 'border-warning bg-warning/15',
    tone: 'text-warning-foreground dark:text-warning',
    swatch: 'bg-warning',
    bar: 'border border-warning bg-warning/15 text-foreground',
  },
  seated: {
    label: 'Seated',
    icon: UserRound,
    tile: 'border-primary bg-primary/10',
    tone: 'text-primary',
    swatch: 'bg-primary',
    bar: 'bg-primary text-primary-foreground',
  },
  over: {
    label: 'Over time',
    icon: Hourglass,
    tile: 'border-destructive bg-destructive/10',
    tone: 'text-destructive',
    swatch: 'bg-destructive',
    bar: 'bg-destructive text-primary-foreground',
  },
  booked: {
    label: 'Booked',
    icon: CalendarDays,
    tile: 'border-border bg-muted/60',
    tone: 'text-muted-foreground',
    swatch: 'bg-muted-foreground',
    bar: 'border border-border bg-muted text-foreground',
  },
  held: {
    label: 'Held while booking',
    icon: Lock,
    tile: 'border-dashed border-muted-foreground/60 bg-muted/40',
    tone: 'text-muted-foreground',
    swatch: 'bg-muted-foreground/60',
    bar: 'border border-dashed border-muted-foreground bg-muted text-foreground',
  },
  out_of_service: {
    label: 'Out of service',
    icon: Ban,
    tile: 'border-dashed border-border bg-muted/30 text-muted-foreground',
    tone: 'text-muted-foreground',
    swatch: 'bg-border',
    bar: 'bg-muted text-muted-foreground',
  },
  saving: {
    label: 'Saving',
    icon: Loader2,
    tile: 'border-dashed border-primary bg-primary/5',
    tone: 'text-primary [&>svg]:animate-spin',
    swatch: 'bg-primary/50',
    bar: 'bg-primary/40 text-foreground',
  },
};

export const KEY_STATES: TableStateKind[] = [
  'free',
  'due',
  'seated',
  'over',
  'held',
  'out_of_service',
];

export const TAG_ICONS: Record<FloorBookingTagKind, LucideIcon> = {
  allergy: TriangleAlert,
  access: Accessibility,
  note: StickyNote,
};

export const TAG_TONES: Record<FloorBookingTagKind, string> = {
  allergy: 'border-destructive/40 bg-destructive/10 text-destructive',
  access: 'border-info/40 bg-info/10 text-info',
  note: 'border-border bg-muted text-muted-foreground',
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Unconfirmed',
  pending_allocation: 'Awaiting table',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};
