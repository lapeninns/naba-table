'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPinned } from 'lucide-react';

import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { useTableInventoryService } from '@/contexts/ops-services';
import { useOpsMenuHierarchy } from '@/hooks/ops/useOpsMenuHierarchy';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { queryKeys } from '@/lib/query/keys';

import { statusLabel } from './buildSetupCards';
import {
  deriveRestaurantSetupOverviewState,
  isRequiredSetupLoading,
} from './restaurantSetupOverviewDomain';
import { SetupChecklistCard } from './SetupChecklistCard';
import { SetupProgressPanel } from './SetupProgressPanel';
import { useRestaurantSettingsContext } from '../shell/useRestaurantSettingsContext';

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

  const tableSummary = tablesQuery.data?.summary;
  const menuCount = menuQuery.data?.menus.length ?? 0;
  const pendingInvites = teamQuery.data?.length ?? 0;

  const isLoadingRequired = isRequiredSetupLoading({
    profileLoading: detailsQuery.isLoading,
    operatingHoursLoading: hoursQuery.isLoading,
    servicePeriodsLoading: servicePeriodsQuery.isLoading,
    tablesLoading: tablesQuery.isLoading,
  });
  const { cards, requiredSetup, optionalSetup } = deriveRestaurantSetupOverviewState({
    profile: detailsQuery.data,
    operatingHours: hoursQuery.data,
    servicePeriods: servicePeriodsQuery.data,
    tableSummary,
    menuCount,
    pendingInvites,
  });

  return (
    <RestaurantSettingsCommandCenter
      eyebrow="Setup overview"
      title="Restaurant setup"
      description="Review the settings that control whether this restaurant is ready for bookings."
      metrics={[
        {
          label: 'Required setup',
          value: isLoadingRequired
            ? 'Loading'
            : `${requiredSetup.complete}/${requiredSetup.total} complete`,
          description: 'profile, availability, seating',
          variant: requiredSetup.complete === requiredSetup.total ? 'default' : 'secondary',
          Icon: CheckCircle2,
        },
        {
          label: 'Optional setup',
          value: optionalSetup.value,
          description: optionalSetup.description,
          variant: 'outline',
          Icon: MapPinned,
        },
      ]}
      railTitle="Setup flow"
      railDescription="Complete the required cards first, then connect optional tools."
      railItems={cards.slice(0, 3).map((card) => ({
        label: card.title,
        description: card.detail,
        href: card.href,
        Icon: card.Icon,
        badge: statusLabel(card.status),
      }))}
      footer="Profile, availability, and tables are the required setup path for accepting bookings."
    >
      {!isLoadingRequired && <SetupProgressPanel requiredSetup={requiredSetup} />}

      {isLoadingRequired ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => (
          <SetupChecklistCard key={card.key} card={card} index={index} />
        ))}
      </div>
    </RestaurantSettingsCommandCenter>
  );
}
