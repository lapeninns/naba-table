'use client';

import Link from 'next/link';
import {
  createContext,
  useContext,
  useMemo,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { GbpDriftProvider as RegistryGbpDriftProvider } from './gbp-drift/GbpDriftProvider';
import {
  deriveGbpDriftStatus,
  EMPTY_GBP_DRIFT_SECTION_STATUSES,
  mergeGbpDriftSectionStatuses,
  type GbpDriftSectionStatus,
  type GbpDriftStatus,
} from './gbpDriftStatus';
import { useRestaurantSettingsContext } from './shell/useRestaurantSettingsContext';

import type { DualSyncSectionKey } from '@/server/dual-sync';

const GBP_REVIEW_HREF = opsHref('/settings/restaurant/google-business-profile#gbp-sync-review');

export { deriveGbpDriftStatus } from './gbpDriftStatus';

type GbpDriftContextValue = {
  readonly status: GbpDriftStatus;
  readonly reviewHref: string;
};

const FALLBACK_STATUS = deriveGbpDriftStatus({
  restaurantId: null,
  connection: null,
  dualSyncState: null,
});

const GbpDriftContext = createContext<GbpDriftContextValue>({
  status: FALLBACK_STATUS,
  reviewHref: GBP_REVIEW_HREF,
});

export type GbpDriftProviderProps = {
  readonly restaurantId?: string | null;
  readonly children: ReactNode;
};

export function GbpDriftProvider({
  restaurantId: explicitRestaurantId,
  children,
}: GbpDriftProviderProps) {
  const settingsContext = useRestaurantSettingsContext();
  const restaurantId = explicitRestaurantId ?? settingsContext.restaurantId;
  const connectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const { stateQuery } = useOpsDualSync({ restaurantId });

  const status = useMemo(
    () =>
      deriveGbpDriftStatus({
        restaurantId,
        connection: connectionQuery.data,
        connectionLoading: connectionQuery.isLoading,
        connectionError: connectionQuery.error,
        dualSyncState: stateQuery.data,
        dualSyncLoading: stateQuery.isLoading,
        dualSyncError: stateQuery.error,
      }),
    [
      connectionQuery.data,
      connectionQuery.error,
      connectionQuery.isLoading,
      restaurantId,
      stateQuery.data,
      stateQuery.error,
      stateQuery.isLoading,
    ],
  );

  const value = useMemo<GbpDriftContextValue>(
    () => ({ status, reviewHref: GBP_REVIEW_HREF }),
    [status],
  );

  return (
    <GbpDriftContext.Provider value={value}>
      <RegistryGbpDriftProvider restaurantId={restaurantId}>{children}</RegistryGbpDriftProvider>
    </GbpDriftContext.Provider>
  );
}

export function useGbpDriftStatus() {
  return useContext(GbpDriftContext);
}

export function useGbpDriftSectionStatus(
  sectionKeys: DualSyncSectionKey | ReadonlyArray<DualSyncSectionKey>,
): GbpDriftSectionStatus {
  const { status } = useGbpDriftStatus();
  const keys = Array.isArray(sectionKeys) ? sectionKeys : [sectionKeys];
  return mergeGbpDriftSectionStatuses(
    status.sectionStatuses ?? EMPTY_GBP_DRIFT_SECTION_STATUSES,
    keys,
  );
}

export function getGbpDriftNavBadge(status: GbpDriftStatus): string | null {
  if (status.kind === 'connected_with_review') {
    return String(status.needsReviewCount);
  }
  if (status.kind === 'connected_outdated') {
    return 'Check';
  }
  if (status.kind === 'not_connected') {
    return 'Link';
  }
  return null;
}

export function getGbpDriftSectionBadge(sectionStatus: GbpDriftSectionStatus): string | null {
  if (sectionStatus.needsReviewCount > 0) {
    return `${sectionStatus.needsReviewCount} Google`;
  }
  if (sectionStatus.pendingCount > 0) {
    return 'Pending Google';
  }
  return null;
}

export function GbpDriftStatusPill({
  className,
}: Pick<ComponentPropsWithoutRef<typeof Button>, 'className'>) {
  const { status, reviewHref } = useGbpDriftStatus();

  if (status.kind === 'no_profile' || status.kind === 'unknown') {
    return null;
  }

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn('h-7 px-2 text-xs font-medium', className)}
    >
      <Link href={reviewHref}>
        <Badge variant={status.badgeTone} className="mr-1.5 px-1.5 py-0">
          GBP
        </Badge>
        {status.shortLabel}
      </Link>
    </Button>
  );
}

export function GbpDriftReviewLink({
  sectionStatus,
  className,
  label,
}: {
  readonly sectionStatus: GbpDriftSectionStatus;
  readonly className?: string;
  readonly label?: string;
}) {
  const { reviewHref } = useGbpDriftStatus();
  const badge = getGbpDriftSectionBadge(sectionStatus);

  if (!badge) {
    return null;
  }

  return (
    <Button asChild variant="outline" size="sm" className={cn('w-fit', className)}>
      <Link href={reviewHref}>
        <Badge variant={sectionStatus.failedCount > 0 ? 'destructive' : 'metric'}>{badge}</Badge>
        {label ?? 'Review in Google workspace'}
      </Link>
    </Button>
  );
}
