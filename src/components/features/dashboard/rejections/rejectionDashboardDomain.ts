import type { OpsStrategicPenaltyKey } from '@/types/ops';

export type RangePresetKey = '24h' | '7d';

export type RangeState = {
  key: RangePresetKey;
  from: string;
  bucket: 'hour' | 'day';
};

export const RANGE_PRESETS: Array<{
  key: RangePresetKey;
  label: string;
  durationMs: number;
  bucket: 'hour' | 'day';
}> = [
  { key: '24h', label: 'Last 24 hours', durationMs: 24 * 60 * 60 * 1000, bucket: 'hour' },
  { key: '7d', label: 'Last 7 days', durationMs: 7 * 24 * 60 * 60 * 1000, bucket: 'day' },
];

export const PENALTY_LABELS: Record<OpsStrategicPenaltyKey, string> = {
  slack: 'Slack',
  scarcity: 'Scarcity',
  future_conflict: 'Future conflict',
  structural: 'Structural',
  unknown: 'Unknown',
};

export const PENALTY_BADGE_VARIANTS: Record<OpsStrategicPenaltyKey, string> = {
  slack: 'bg-primary/10 text-primary',
  scarcity: 'bg-primary/10 text-primary',
  future_conflict: 'bg-destructive/10 text-destructive',
  structural: 'bg-primary/10 text-primary',
  unknown: 'bg-muted text-muted-foreground',
};

export function computeRangeState(key: RangePresetKey): RangeState {
  const preset = RANGE_PRESETS.find((candidate) => candidate.key === key) ?? RANGE_PRESETS[0];
  const from = new Date(Date.now() - preset.durationMs).toISOString();
  return {
    key: preset.key,
    from,
    bucket: preset.bucket,
  };
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${value.toFixed(1)}%`;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatPenaltyValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  return value.toFixed(2);
}
