'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPinned } from 'lucide-react';
import Link from 'next/link';

import {
  RestaurantSettingsCommandCenter,
  SettingsCard,
} from '@/components/features/restaurant-settings/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTableInventoryService } from '@/contexts/ops-services';
import { useOpsMenuHierarchy } from '@/hooks/ops/useOpsMenuHierarchy';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { queryKeys } from '@/lib/query/keys';

import { buildSetupCards, statusLabel, statusVariant, type SetupCard } from './buildSetupCards';
import { useRestaurantSettingsContext } from '../shell/useRestaurantSettingsContext';

function SetupChecklistCard({ card }: { card: SetupCard }) {
  const Icon = card.Icon;
  return (
    <SettingsCard
      title={card.title}
      description={card.description}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">{card.detail}</p>
          <Button asChild size="sm" className="shrink-0">
            <Link href={card.href}>{card.cta}</Link>
          </Button>
        </div>
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </div>
        <Badge variant={statusVariant(card.status)}>{statusLabel(card.status)}</Badge>
      </div>
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

  const profileComplete = Boolean(
    detailsQuery.data?.name &&
    detailsQuery.data?.slug &&
    detailsQuery.data?.timezone &&
    detailsQuery.data?.contactPhone,
  );
  const hasWeeklyHours = Boolean(hoursQuery.data?.weekly?.some((row) => !row.isClosed));
  const hasServicePeriods = Boolean(servicePeriodsQuery.data?.length);
  const availabilityComplete = hasWeeklyHours && hasServicePeriods;
  const tableSummary = tablesQuery.data?.summary;
  const tablesComplete = Boolean(
    tableSummary && tableSummary.totalTables > 0 && tableSummary.availableTables > 0,
  );
  const menuCount = menuQuery.data?.menus.length ?? 0;
  const pendingInvites = teamQuery.data?.length ?? 0;
  const isLoadingRequired =
    detailsQuery.isLoading ||
    hoursQuery.isLoading ||
    servicePeriodsQuery.isLoading ||
    tablesQuery.isLoading;
  const completedRequired = [profileComplete, availabilityComplete, tablesComplete].filter(
    Boolean,
  ).length;
  const cards = buildSetupCards({
    profileComplete,
    availabilityComplete,
    tablesComplete,
    availableTables: tableSummary?.availableTables ?? 0,
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
          value: isLoadingRequired ? 'Loading' : `${completedRequired}/3 complete`,
          description: 'profile, availability, seating',
          variant: completedRequired === 3 ? 'default' : 'secondary',
          Icon: CheckCircle2,
        },
        {
          label: 'Optional setup',
          value: 'Google / Menu / Team',
          description: 'use when needed',
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
      {isLoadingRequired ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <SetupChecklistCard key={card.key} card={card} />
        ))}
      </div>
    </RestaurantSettingsCommandCenter>
  );
}
