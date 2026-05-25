import type {
  TableTimelineResponse,
  TableTimelineSegment,
  TableTimelineSegmentState,
} from '@/types/ops';

export type TimelineService = 'all' | 'lunch' | 'dinner';

export type SelectedSegment = {
  table: TableTimelineResponse['tables'][number]['table'];
  segment: TableTimelineSegment;
};

export const SERVICE_OPTIONS: Array<{ value: TimelineService; label: string }> = [
  { value: 'all', label: 'All services' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

export const STATUS_OPTIONS: Array<{
  value: TableTimelineSegmentState;
  label: string;
  dot: string;
  pill: string;
}> = [
  {
    value: 'reserved',
    label: 'Reserved',
    dot: 'bg-success',
    pill: 'bg-success text-success-foreground shadow-sm',
  },
  {
    value: 'hold',
    label: 'Hold',
    dot: 'bg-warning',
    pill: 'bg-warning text-warning-foreground shadow-sm',
  },
  {
    value: 'available',
    label: 'Available',
    dot: 'bg-muted',
    pill: 'bg-background border border-border text-foreground',
  },
  {
    value: 'out_of_service',
    label: 'Out of service',
    dot: 'bg-muted-foreground',
    pill: 'bg-muted text-muted-foreground shadow-sm',
  },
];

export const DEFAULT_STATUS_FILTERS: TableTimelineSegmentState[] = [
  'reserved',
  'hold',
  'available',
  'out_of_service',
];

export const STATUS_META: Record<
  TableTimelineSegmentState,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    chip: string;
    muted: string;
  }
> = {
  reserved: {
    label: 'Reserved',
    bg: 'bg-success/10',
    border: 'border-success/20',
    text: 'text-foreground',
    chip: 'bg-success text-success-foreground',
    muted: 'text-muted-foreground',
  },
  hold: {
    label: 'Hold',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    text: 'text-foreground',
    chip: 'bg-warning text-warning-foreground',
    muted: 'text-muted-foreground',
  },
  available: {
    label: 'Available',
    bg: 'bg-background',
    border: 'border-border',
    text: 'text-foreground',
    chip: 'bg-muted text-foreground',
    muted: 'text-muted-foreground',
  },
  out_of_service: {
    label: 'Out of service',
    bg: 'bg-muted',
    border: 'border-border',
    text: 'text-foreground',
    chip: 'bg-muted text-muted-foreground',
    muted: 'text-muted-foreground',
  },
};

export const TIME_SLOTS = Array.from({ length: 12 }, (_, idx) => {
  const hour = 17 + Math.floor(idx / 2);
  const minutes = idx % 2 === 0 ? '00' : '30';
  return `${hour}:${minutes}`;
});

export const SLOT_WIDTH_PX = 120;
export const START_HOUR = 17;

export function parseHHMM(time: string) {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return { hours, minutes };
}

export function minutesSinceStart(time: string) {
  const { hours, minutes } = parseHHMM(time);
  return (hours - START_HOUR) * 60 + minutes;
}

export function timeToPositionPx(time: string) {
  return (minutesSinceStart(time) / 30) * SLOT_WIDTH_PX;
}

export function toHHMM(timestamp: string) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function clampToServiceWindow(value: number, start: string, end: string) {
  return Math.min(Math.max(value, timeToPositionPx(start)), timeToPositionPx(end));
}

export function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
