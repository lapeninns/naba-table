import { format } from 'date-fns';

export function parseLocalDateOnly(dateOnly: string): Date {
  // dateOnly is expected to be `yyyy-MM-dd`. Using a time suffix avoids UTC parsing surprises.
  return new Date(`${dateOnly}T00:00:00`);
}

export function formatTimeParam(timestampMs: number): string {
  return format(new Date(timestampMs), 'HH:mm');
}

