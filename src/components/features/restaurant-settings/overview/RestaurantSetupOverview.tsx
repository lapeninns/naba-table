'use client';

import { useQuery } from '@tanstack/react-query';

import {
  RestaurantSettingsCommandCenter,
  SETTINGS_CARD_CLASS,
  SettingsCard,
  SettingsLoadErrorAlert,
  SettingsRefreshErrorAlert,
  SETTINGS_REFRESH_ERROR_READ_ONLY_COPY,
  SettingsStatusFacts,
  type SettingsStatusBadgeVariant,
} from '@/components/features/restaurant-settings/shared';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTableInventoryService } from '@/contexts/ops-services';
import { useOpsMenuHierarchy } from '@/hooks/ops/useOpsMenuHierarchy';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';
import { cn } from '@/lib/utils';

import {
  deriveRestaurantSetupOverviewState,
  getFailedSourcesForRow,
  isRequiredSetupLoading,
  type SetupCheckSource,
} from './restaurantSetupOverviewDomain';
import { SetupChecklistCard } from './SetupChecklistCard';
import { SetupProgressPanel } from './SetupProgressPanel';
import { RESTAURANT_SETTINGS_OVERVIEW_ROUTE } from '../routes';
import { useRestaurantSettingsContext } from '../shell/useRestaurantSettingsContext';

import type { ReadinessSummary, SetupCard } from './buildSetupCards';

type SetupSourceQuery = {
  data?: unknown;
  error?: unknown;
  isError?: boolean;
  isFetching?: boolean;
  refetch?: () => Promise<unknown>;
};

const SOURCE_LABELS: Record<SetupCheckSource, string> = {
  profile: 'Profile',
  operatingHours: 'Operating hours',
  servicePeriods: 'Service periods',
  tables: 'Tables',
  menu: 'Menu',
  team: 'Team invitations',
};

const SOURCE_ORDER = Object.keys(SOURCE_LABELS) as SetupCheckSource[];

function getReadinessBadgeVariant(
  readiness: Pick<ReadinessSummary, 'ready' | 'hasFailedCheck'>,
): SettingsStatusBadgeVariant {
  if (readiness.hasFailedCheck) {
    return 'status-cancelled';
  }
  return readiness.ready ? 'status-confirmed' : 'status-pending';
}

function SetupOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">
        Loading setup status…
      </span>
      <Card variant="compact" className={cn(SETTINGS_CARD_CLASS, 'flex flex-col gap-3 p-4 sm:p-5')}>
        <Skeleton className="h-5 w-56 max-w-full" />
        <Skeleton className="h-1.5 w-full" />
      </Card>
      <Card
        variant="compact"
        className={cn(SETTINGS_CARD_CLASS, 'flex flex-col gap-3 p-4 sm:p-5')}
        data-testid="setup-steps-skeleton"
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </Card>
    </div>
  );
}

type SetupStepListProps = {
  id: string;
  title: string;
  description: string;
  cards: SetupCard[];
  nextKey?: string | null;
  failedSources: ReadonlySet<SetupCheckSource>;
  queries: Record<SetupCheckSource, SetupSourceQuery>;
};

function SetupStepList({
  id,
  title,
  description,
  cards,
  nextKey = null,
  failedSources,
  queries,
}: SetupStepListProps) {
  return (
    <SettingsCard
      region
      titleId={`${id}-heading`}
      title={title}
      description={description}
      data-testid={id}
      // Checklist rows carry their own padding and dividers.
      contentClassName="p-0 sm:px-0"
    >
      {/* A container, so each row lays out by the card's width, not the viewport's. */}
      <ul className="@container divide-y divide-border/60">
        {cards.map((card) => {
          const rowSources = getFailedSourcesForRow(card.key, failedSources);
          return (
            <SetupChecklistCard
              key={card.key}
              card={card}
              isNextStep={card.key === nextKey}
              isChecking={rowSources.some((source) => queries[source].isFetching)}
              onCheckAgain={
                rowSources.length > 0
                  ? () => rowSources.forEach((source) => void queries[source].refetch?.())
                  : undefined
              }
            />
          );
        })}
      </ul>
    </SettingsCard>
  );
}

export function RestaurantSetupOverview() {
  const { restaurantId } = useRestaurantSettingsContext();
  const tableService = useTableInventoryService();

  const detailsQuery = useOpsRestaurantDetails(restaurantId);
  const hoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const menuQuery = useOpsMenuHierarchy(restaurantId);
  // Same cache entries as the Team and Tables pages and their prefetchers. The 'all' list is
  // the 'pending' list plus other statuses, and the tables list includes the summary by default.
  const teamQuery = useOpsTeamInvitations({
    restaurantId: restaurantId ?? '',
    status: 'all',
  });
  const tablesQuery = useQuery({
    queryKey: queryKeys.opsTables.list(restaurantId ?? 'none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required to load table setup');
      }
      return tableService.list(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.tables,
  });

  const queries: Record<SetupCheckSource, SetupSourceQuery> = {
    profile: detailsQuery,
    operatingHours: hoursQuery,
    servicePeriods: servicePeriodsQuery,
    tables: tablesQuery,
    menu: menuQuery,
    team: teamQuery,
  };
  const erroredSources = SOURCE_ORDER.filter((source) => queries[source].isError);
  // A failed source with no data cannot be checked; one with data keeps its last loaded status
  // on screen (R11) and only gets the refresh notice.
  const blockingSources = erroredSources.filter((source) => queries[source].data == null);
  const refreshSources = erroredSources.filter((source) => queries[source].data != null);
  const failedSources: ReadonlySet<SetupCheckSource> = new Set(blockingSources);
  const retrySources = (sources: readonly SetupCheckSource[]) =>
    sources.forEach((source) => void queries[source].refetch?.());

  const isLoadingRequired = isRequiredSetupLoading({
    profileLoading: detailsQuery.isLoading,
    operatingHoursLoading: hoursQuery.isLoading,
    servicePeriodsLoading: servicePeriodsQuery.isLoading,
    tablesLoading: tablesQuery.isLoading,
  });

  const { requiredCards, optionalCards, readiness } = deriveRestaurantSetupOverviewState({
    profile: detailsQuery.data,
    operatingHours: hoursQuery.data,
    servicePeriods: servicePeriodsQuery.data,
    tableSummary: tablesQuery.data?.summary,
    menuCount: menuQuery.data?.menus.length ?? 0,
    pendingInvites: teamQuery.data?.filter((invite) => invite.status === 'pending').length ?? 0,
    failedSources,
  });

  return (
    <RestaurantSettingsCommandCenter
      title={RESTAURANT_SETTINGS_OVERVIEW_ROUTE.title}
      description={RESTAURANT_SETTINGS_OVERVIEW_ROUTE.description}
      status={
        isLoadingRequired ? undefined : (
          // Same slot and treatment as Tables: the progress count as a status Badge.
          <SettingsStatusFacts
            badge={{
              label: <span className="tabular-nums">{readiness.progressLabel}</span>,
              variant: getReadinessBadgeVariant(readiness),
            }}
          />
        )
      }
    >
      {blockingSources.length > 0 ? (
        <SettingsLoadErrorAlert
          title="Some setup checks could not load"
          message={`${blockingSources.map((source) => SOURCE_LABELS[source]).join(', ')} could not be checked, so their status below may be out of date. Saved settings are unchanged.`}
          error={queries[blockingSources[0]].error}
          retrying={blockingSources.some((source) => queries[source].isFetching)}
          onRetry={() => retrySources(blockingSources)}
        />
      ) : null}
      {refreshSources.length > 0 ? (
        <SettingsRefreshErrorAlert
          error={queries[refreshSources[0]].error}
          onRetry={() => retrySources(refreshSources)}
          message={SETTINGS_REFRESH_ERROR_READ_ONLY_COPY}
        />
      ) : null}

      {isLoadingRequired ? (
        <SetupOverviewSkeleton />
      ) : (
        <>
          <SetupProgressPanel readiness={readiness} />
          <SetupStepList
            id="setup-required-steps"
            title="Required before guests can book"
            description="Each step shows what was checked."
            cards={requiredCards}
            nextKey={readiness.nextKey}
            failedSources={failedSources}
            queries={queries}
          />
          <SetupStepList
            id="setup-optional-steps"
            title="Optional"
            description="Helps guests find you and your team share the work. Bookings work without these."
            cards={optionalCards}
            failedSources={failedSources}
            queries={queries}
          />
        </>
      )}
    </RestaurantSettingsCommandCenter>
  );
}
