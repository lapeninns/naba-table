'use client';

import { Loader2 } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMinimumDelay } from '@/hooks/use-minimum-delay';

import type { BookingSortDir, BookingSortKey } from './utils';

export type BookingsListControlsProps = {
  sortKey: BookingSortKey;
  sortDir: BookingSortDir;
  onSortKeyChange: (value: BookingSortKey) => void;
  onSortDirChange: (value: BookingSortDir) => void;
  isRefetching?: boolean;
  dataUpdatedAt?: number | null;
};

function formatLastSynced(dataUpdatedAt: number | null | undefined) {
  if (!dataUpdatedAt) return null;
  const ageSeconds = Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000));
  if (ageSeconds < 10) return 'Last synced just now';
  if (ageSeconds < 60) return `Last synced ${ageSeconds}s ago`;
  const ageMinutes = Math.floor(ageSeconds / 60);
  if (ageMinutes < 60) return `Last synced ${ageMinutes}m ago`;
  const ageHours = Math.floor(ageMinutes / 60);
  return `Last synced ${ageHours}h ago`;
}

export function BookingsListControls({
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
  isRefetching,
  dataUpdatedAt,
}: BookingsListControlsProps) {
  const showRefetching = useMinimumDelay(Boolean(isRefetching), {
    delayMs: 120,
    minDurationMs: 250,
  });
  const lastSyncedLabel = formatLastSynced(dataUpdatedAt);
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <span className="text-sm font-medium text-muted-foreground">Sort</span>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Select value={sortKey} onValueChange={(val) => onSortKeyChange(val as BookingSortKey)}>
            <SelectTrigger className="h-9 w-full rounded bg-card sm:w-[150px]" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="party">Party Size</SelectItem>
              <SelectItem value="name">Guest Name</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortDir} onValueChange={(val) => onSortDirChange(val as BookingSortDir)}>
            <SelectTrigger
              className="h-9 w-full rounded bg-card sm:w-[130px]"
              aria-label="Sort direction"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {showRefetching ? (
        <output
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Syncing latest changes...
        </output>
      ) : lastSyncedLabel ? (
        <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
          {lastSyncedLabel}
        </p>
      ) : null}
    </>
  );
}
