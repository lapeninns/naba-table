'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type {
  GoogleBusinessProfileConnection,
  GoogleBusinessProfileFieldVerification,
} from '@/services/ops/restaurants';

const GBP_DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function formatGoogleBusinessProfileDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function formatGoogleBusinessProfileDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export function formatGoogleBusinessProfileTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return value;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return value;
  }

  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const baseHour = hours % 12 || 12;
  const minuteText = String(minutes).padStart(2, '0');
  return `${baseHour}:${minuteText} ${meridiem}`;
}

export function formatGoogleBusinessProfileDay(day: number | null): string | null {
  if (day === null || day < 0 || day >= GBP_DAY_LABELS.length) {
    return null;
  }

  return GBP_DAY_LABELS[day] ?? null;
}

export function getGoogleBusinessProfileConnectionStatusLabel(
  status: GoogleBusinessProfileConnection['status'],
): string {
  switch (status) {
    case 'linked':
      return 'Linked';
    case 'authorized':
      return 'Authorized';
    case 'pending_auth':
      return 'Awaiting Google';
    case 'reauth_required':
      return 'Reconnect required';
    case 'sync_error':
      return 'Needs attention';
    default:
      return 'Not connected';
  }
}

export function getGoogleBusinessProfileConnectionStatusVariant(
  status: GoogleBusinessProfileConnection['status'],
) {
  switch (status) {
    case 'linked':
      return 'default' as const;
    case 'authorized':
      return 'secondary' as const;
    case 'reauth_required':
    case 'sync_error':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

export function GoogleBusinessProfileVerificationBadge(props: {
  verification?: GoogleBusinessProfileFieldVerification | null;
  className?: string;
}) {
  const verification = props.verification;
  if (!verification) {
    return null;
  }

  const isVerified = verification.isVerified && verification.syncStatus === 'synced';

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide',
        isVerified
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
        props.className,
      )}
    >
      {isVerified ? 'Verified' : 'Drifted'}
    </Badge>
  );
}
