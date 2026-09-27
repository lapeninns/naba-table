import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  SETTINGS_CARD_CLASS,
  SETTINGS_CARD_CONTENT_CLASS,
  SETTINGS_CARD_HEADER_CLASS,
} from './compactSettingsClasses';

export type SettingsSectionSkeletonProps = {
  /** Screen-reader label, e.g. "Loading profile". Not shown visually. */
  label: string;
  /** `section`: purpose line and one card. `workspace`: full-height list and canvas split. */
  variant?: 'section' | 'workspace';
  /**
   * `section` only: draw a placeholder for the page's purpose line. Pass false when the skeleton
   * renders inside RestaurantSettingsCommandCenter, which already shows the real one.
   */
  purposeLine?: boolean;
  className?: string;
};

/** Loading placeholder shaped like a settings page, so the loaded page does not jump. */
export function SettingsSectionSkeleton({
  label,
  variant = 'section',
  purposeLine = true,
  className,
}: SettingsSectionSkeletonProps) {
  if (variant === 'workspace') {
    return (
      <div
        role="status"
        aria-busy="true"
        data-slot="settings-section-skeleton"
        data-variant="workspace"
        className={cn('flex min-h-0 flex-1 flex-col md:flex-row', className)}
      >
        <span className="sr-only">{label}</span>
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/60 px-[var(--ops-shell-gutter)] py-4 md:w-72 md:border-b-0 md:border-r">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
        <div className="flex min-h-64 min-w-0 flex-1 flex-col gap-3 px-[var(--ops-shell-gutter)] py-4">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="min-h-48 w-full flex-1" />
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      data-slot="settings-section-skeleton"
      data-variant="section"
      className={cn('flex min-w-0 flex-col gap-4', className)}
    >
      <span className="sr-only">{label}</span>
      {purposeLine ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : null}
      <Card variant="compact" className={SETTINGS_CARD_CLASS}>
        <div className={cn(SETTINGS_CARD_HEADER_CLASS, 'flex flex-col gap-2')}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
        <div className={cn(SETTINGS_CARD_CONTENT_CLASS, 'flex flex-col gap-3')}>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </Card>
    </div>
  );
}
