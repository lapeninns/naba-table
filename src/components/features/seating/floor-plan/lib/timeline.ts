import type { TableTimelineSegment } from '@/types/ops';

export function parseTimeToMinutes(timeStr: string | null): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function formatMinutes(totalMinutes: number) {
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function getTableStateAtTime(segments: TableTimelineSegment[], timestampMs: number): TableTimelineSegment {
  const segment = segments.find((s) => {
    const start = new Date(s.start).getTime();
    const end = new Date(s.end).getTime();
    return timestampMs >= start && timestampMs < end;
  });

  if (segment) return segment;

  // Default available segment if none found.
  return {
    start: new Date(timestampMs).toISOString(),
    end: new Date(timestampMs + 60 * 60 * 1000).toISOString(),
    state: 'available',
    serviceKey: 'other',
    booking: null,
    hold: null,
  };
}

