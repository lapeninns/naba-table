'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  MapPinned,
  Menu,
  Table2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import {
  RestaurantSettingsCommandCenter,
  SettingsCard,
} from '@/components/features/restaurant-settings/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTableInventoryService } from '@/contexts/ops-services';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsMenuHierarchy } from '@/hooks/ops/useOpsMenuHierarchy';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { queryKeys } from '@/lib/query/keys';
import { opsHref } from '@/lib/url/opsHref';

type SetupStatus = 'complete' | 'attention' | 'optional';

type SetupCard = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  status: SetupStatus;
  detail: string;
  Icon: LucideIcon;
};

function statusLabel(status: SetupStatus) {
  if (status === 'complete') return 'Complete';
  if (status === 'attention') return 'Needs attention';
  return 'Optional';
}

function statusVariant(status: SetupStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'complete') return 'default';
  if (status === 'attention') return 'secondary';
  return 'outline';
}

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
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const tableService = useTableInventoryService();
  const restaurantId = useMemo(
    () =>
      activeMembership?.restaurantId ??
      memberships.find((membership) => membership.restaurantId === activeRestaurantId)
        ?.restaurantId ??
      memberships[0]?.restaurantId ??
      null,
    [activeMembership?.restaurantId, activeRestaurantId, memberships],
  );

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

  const cards: SetupCard[] = [
    {
      key: 'profile',
      title: 'Public profile',
      description: 'Controls the guest-facing name, contact details, address, and booking page.',
      href: opsHref('/settings/restaurant/profile'),
      cta: 'Open profile',
      status: profileComplete ? 'complete' : 'attention',
      detail: profileComplete
        ? 'Core public details are present.'
        : 'Add name, booking URL, timezone, and public phone before go-live.',
      Icon: UserRound,
    },
    {
      key: 'availability',
      title: 'Booking availability',
      description: 'Controls booking rules, weekly hours, meal windows, and booking types.',
      href: opsHref('/settings/restaurant/availability#booking-rules'),
      cta: 'Open availability',
      status: availabilityComplete ? 'complete' : 'attention',
      detail: availabilityComplete
        ? 'Open hours and service windows are configured.'
        : 'Set weekly hours and at least one service window.',
      Icon: CalendarClock,
    },
    {
      key: 'tables',
      title: 'Seating capacity',
      description: 'Controls table inventory, active zones, and covers available for bookings.',
      href: opsHref('/settings/restaurant/tables#table-capacity-summary'),
      cta: 'Open tables',
      status: tablesComplete ? 'complete' : 'attention',
      detail: tablesComplete
        ? `${tableSummary?.availableTables ?? 0} service-ready tables are available.`
        : 'Add table numbers and capacity first; zones can come later.',
      Icon: Table2,
    },
    {
      key: 'google',
      title: 'Google Business Profile',
      description: 'Optional import and comparison workflow for public listing details.',
      href: opsHref('/settings/restaurant/google-business-profile#gbp-connection'),
      cta: 'Manage Google',
      status: 'optional',
      detail: 'Useful after the profile and availability basics are ready.',
      Icon: MapPinned,
    },
    {
      key: 'menu',
      title: 'Menu',
      description: 'Optional menu catalogue and Google publishing fields.',
      href: opsHref('/settings/restaurant/menu'),
      cta: 'Open menu',
      status: menuCount > 0 ? 'complete' : 'optional',
      detail:
        menuCount > 0
          ? `${menuCount} menu catalogue entries found.`
          : 'Add later when menus are ready.',
      Icon: Menu,
    },
    {
      key: 'team',
      title: 'Team',
      description: 'Optional staff invitations for reservation and settings access.',
      href: opsHref('/settings/restaurant/team'),
      cta: 'Open team',
      status: pendingInvites > 0 ? 'complete' : 'optional',
      detail:
        pendingInvites > 0
          ? `${pendingInvites} pending invite${pendingInvites === 1 ? '' : 's'}.`
          : 'Invite trusted staff when operations are ready.',
      Icon: Users,
    },
  ];

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
