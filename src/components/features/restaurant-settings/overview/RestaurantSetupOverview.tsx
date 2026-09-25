'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTableInventoryService } from '@/contexts/ops-services';
import { useOpsMenuHierarchy } from '@/hooks/ops/useOpsMenuHierarchy';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { queryKeys } from '@/lib/query/keys';

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

import type { SetupCard } from './buildSetupCards';

type SetupSourceQuery = {
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

function SetupOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">
        Loading setup status…
      </span>
      <Card className="flex flex-col gap-3 p-4 sm:p-5">
        <Skeleton className="h-5 w-56 max-w-full" />
        <Skeleton className="h-1.5 w-full" />
      </Card>
      <Card className="flex flex-col gap-3 p-4 sm:p-5" data-testid="setup-steps-skeleton">
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
  const headingId = `${id}-heading`;
  return (
    <Card role="region" aria-labelledby={headingId} data-testid={id} className="overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b border-border/60 px-4 py-3 sm:px-5">
        <h2 id={headingId} className="text-base font-semibold leading-6 text-foreground">
          {title}
        </h2>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <ul className="divide-y divide-border/60">
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
    </Card>
  );
}

export function RestaurantSetupOverview() {
  const { restaurantId } = useRestaurantSettingsContext();
  const tableService = useTableInventoryService();

  const detailsQuery = useOpsRestaurantDetails(restaurantId);
  const hoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const menuQuery = useOpsMenuHierarchy(restaurantId);
  const teamQuery = useOpsTeamInvitations({
    restaurantId: restaurantId ?? '',
    status: 'pending',
  });
  const tablesQuery = useQuery({
    queryKey: restaurantId
      ? queryKeys.opsTables.list(restaurantId, { includeSummary: true })
      : ['ops', 'tables', 'setup-overview', 'none'],
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required to load table setup');
      }
      return tableService.list(restaurantId, { includeSummary: true });
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });

  const queries: Record<SetupCheckSource, SetupSourceQuery> = {
    profile: detailsQuery,
    operatingHours: hoursQuery,
    servicePeriods: servicePeriodsQuery,
    tables: tablesQuery,
    menu: menuQuery,
    team: teamQuery,
  };
  const failedSources = new Set(SOURCE_ORDER.filter((source) => queries[source].isError));

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
    pendingInvites: teamQuery.data?.length ?? 0,
    failedSources,
  });

  return (
    <RestaurantSettingsCommandCenter
      title={RESTAURANT_SETTINGS_OVERVIEW_ROUTE.title}
      description={RESTAURANT_SETTINGS_OVERVIEW_ROUTE.description}
    >
      {failedSources.size > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Some setup checks could not load</AlertTitle>
          <AlertDescription>
            <p>
              {[...failedSources].map((source) => SOURCE_LABELS[source]).join(', ')} could not be
              checked, so their status below may be out of date. Saved settings are unchanged.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 [@media(pointer:coarse)]:min-h-11"
              onClick={() => failedSources.forEach((source) => void queries[source].refetch?.())}
            >
              <RefreshCw data-icon="inline-start" aria-hidden />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
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
