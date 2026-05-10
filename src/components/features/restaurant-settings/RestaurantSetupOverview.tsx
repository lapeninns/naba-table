'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  LayoutGrid,
  LinkIcon,
  MapPinned,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTableInventoryService } from '@/contexts/ops-services';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { queryKeys } from '@/lib/query/keys';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { RestaurantSettingsCommandCenter, SETTINGS_COMPACT_ROUTE_STACK_CLASS } from './shared';

import type { LucideIcon } from 'lucide-react';

type ReadinessStatus = 'complete' | 'needs-attention' | 'not-started';

type SetupCard = {
  title: string;
  description: string;
  href: string;
  status: ReadinessStatus;
  checklist: string[];
  optional?: boolean;
  Icon: LucideIcon;
};

type SetupWorkspace = 'required' | 'optional';

const STATUS_LABELS: Record<ReadinessStatus, string> = {
  complete: 'Complete',
  'needs-attention': 'Needs attention',
  'not-started': 'Not started',
};

const STATUS_ICONS: Record<ReadinessStatus, LucideIcon> = {
  complete: CheckCircle2,
  'needs-attention': AlertTriangle,
  'not-started': Circle,
};

const SETUP_RAIL_ITEMS = [
  {
    label: 'Public profile',
    description: 'Guest-facing identity, contact, location, and booking page URL.',
    href: opsHref('/settings/restaurant/profile'),
    Icon: LinkIcon,
  },
  {
    label: 'Availability',
    description: 'Booking rules, weekly hours, service windows, and booking types.',
    href: opsHref('/settings/restaurant/availability'),
    Icon: CalendarClock,
  },
  {
    label: 'Tables',
    description: 'Zones, active tables, covers, and capacity readiness.',
    href: opsHref('/settings/restaurant/tables'),
    Icon: LayoutGrid,
  },
  {
    label: 'Menu',
    description: 'Food and drink catalogues guests can browse after launch.',
    href: opsHref('/settings/restaurant/menu'),
    Icon: UtensilsCrossed,
  },
  {
    label: 'Team',
    description: 'Invites and access for managers and hosts.',
    href: opsHref('/settings/restaurant/team'),
    Icon: Users,
  },
  {
    label: 'Google',
    description: 'Optional import and comparison support from Google.',
    href: opsHref('/settings/restaurant/google-business-profile'),
    Icon: MapPinned,
  },
] satisfies Parameters<typeof RestaurantSettingsCommandCenter>[0]['railItems'];

function hasValue(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function countCompleted(items: boolean[]) {
  return items.filter(Boolean).length;
}

function statusFromCounts(completed: number, total: number): ReadinessStatus {
  if (completed >= total) return 'complete';
  if (completed > 0) return 'needs-attention';
  return 'not-started';
}

function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge
      variant={
        status === 'complete' ? 'default' : status === 'needs-attention' ? 'metric' : 'outline'
      }
      className="w-fit gap-1.5"
    >
      <Icon data-icon="inline-start" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function ReadinessCard({ card }: { card: SetupCard }) {
  const Icon = card.Icon;

  return (
    <Card className={cn('border-border/70', card.optional && 'bg-muted/20')}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
              <Icon aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-lg">{card.title}</CardTitle>
              <CardDescription className="mt-1">{card.description}</CardDescription>
            </div>
          </div>
          <ReadinessBadge status={card.status} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {card.checklist.map((item) => (
            <li key={item} className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 rounded-full bg-muted-foreground/50"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Button asChild variant={card.optional ? 'outline' : 'default'} size="sm" className="w-fit">
          <Link href={card.href}>
            Open
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function RestaurantSetupOverview({ restaurantId }: { restaurantId: string | null }) {
  const [activeWorkspace, setActiveWorkspace] = useState<SetupWorkspace>('required');
  const profileQuery = useOpsRestaurantDetails(restaurantId);
  const hoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const occasionsQuery = useOpsOccasions();
  const tableService = useTableInventoryService();
  const tablesQuery = useQuery({
    queryKey: restaurantId
      ? queryKeys.opsTables.list(restaurantId)
      : (['ops', 'tables', 'setup-overview', 'no-restaurant'] as const),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required to load table readiness.');
      }
      return tableService.list(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });

  const cards = useMemo<SetupCard[]>(() => {
    const profile = profileQuery.data;
    const publicProfileChecks = [
      hasValue(profile?.name),
      hasValue(profile?.contactPhone) || hasValue(profile?.contactEmail),
      hasValue(profile?.address),
      hasValue(profile?.slug),
    ];
    const publicProfileStatus = statusFromCounts(
      countCompleted(publicProfileChecks),
      publicProfileChecks.length,
    );

    const weeklyHours = hoursQuery.data?.weekly ?? [];
    const openWeeklyRows = weeklyHours.filter(
      (row) => !row.isClosed && hasValue(row.opensAt) && hasValue(row.closesAt),
    );
    const availabilityChecks = [
      openWeeklyRows.length > 0,
      servicePeriodsQuery.data != null && servicePeriodsQuery.data.length > 0,
      (occasionsQuery.data ?? []).some((occasion) => occasion.isActive),
    ];
    const availabilityStatus = statusFromCounts(
      countCompleted(availabilityChecks),
      availabilityChecks.length,
    );

    const tableSummary = tablesQuery.data?.summary;
    const tables = tablesQuery.data?.tables ?? [];
    const activeTables = tables.filter((table) => table.active && table.zoneActive);
    const seatingChecks = [
      tables.length > 0,
      activeTables.length > 0,
      (tableSummary?.totalCapacity ?? 0) > 0,
    ];
    const seatingStatus = statusFromCounts(countCompleted(seatingChecks), seatingChecks.length);

    return [
      {
        title: 'Public profile',
        description: 'Add the public details guests use to identify and contact this restaurant.',
        href: opsHref('/settings/restaurant/profile'),
        status: publicProfileStatus,
        checklist: ['Restaurant name', 'Public contact/location', 'Booking page URL'],
        Icon: LinkIcon,
      },
      {
        title: 'Booking availability',
        description: 'Set when guests can book and how long tables are held.',
        href: opsHref('/settings/restaurant/availability'),
        status: availabilityStatus,
        checklist: ['Weekly hours', 'Booking rules', 'Booking types'],
        Icon: Clock3,
      },
      {
        title: 'Seating capacity',
        description: 'Add active tables so the system knows what can be booked.',
        href: opsHref('/settings/restaurant/tables'),
        status: seatingStatus,
        checklist: ['Active tables', 'Covers / capacity', 'Required table setup status'],
        Icon: CheckCircle2,
      },
      {
        title: 'Menu',
        description: 'Useful after launch for guest confidence, but not required to take bookings.',
        href: opsHref('/settings/restaurant/menu'),
        status: 'not-started',
        checklist: ['Food items', 'Drink items', 'Availability and sold-out state'],
        optional: true,
        Icon: Circle,
      },
      {
        title: 'Team',
        description: 'Invite managers and staff when more people need access.',
        href: opsHref('/settings/restaurant/team'),
        status: 'not-started',
        checklist: ['Pending invites', 'Staff access', 'Role review'],
        optional: true,
        Icon: Circle,
      },
      {
        title: 'Google Business Profile',
        description: 'Google is optional. Use it to import or compare public details faster.',
        href: opsHref('/settings/restaurant/google-business-profile'),
        status: 'not-started',
        checklist: ['Connect Google', 'Import public details', 'Compare profile differences'],
        optional: true,
        Icon: Circle,
      },
    ];
  }, [
    hoursQuery.data?.weekly,
    occasionsQuery.data,
    profileQuery.data,
    servicePeriodsQuery.data,
    tablesQuery.data?.summary,
    tablesQuery.data?.tables,
  ]);
  const selectWorkspace = useCallback((workspace: SetupWorkspace) => {
    setActiveWorkspace(workspace);
    window.history.replaceState(null, '', `#setup-${workspace}`);
  }, []);

  if (!restaurantId) {
    return (
      <Alert>
        <AlertTitle>Select a restaurant</AlertTitle>
        <AlertDescription>
          Pick a restaurant from the sidebar switcher to review setup readiness.
        </AlertDescription>
      </Alert>
    );
  }

  const isLoading =
    (profileQuery.isLoading && !profileQuery.data) ||
    (hoursQuery.isLoading && !hoursQuery.data) ||
    (servicePeriodsQuery.isLoading && !servicePeriodsQuery.data) ||
    (occasionsQuery.isLoading && !occasionsQuery.data) ||
    (tablesQuery.isLoading && !tablesQuery.data);

  if (isLoading) {
    return (
      <RestaurantSettingsCommandCenter
        eyebrow="Setup command center"
        title="Restaurant setup"
        description="Review the core settings that make this restaurant ready to take bookings, then jump into the route that needs attention."
        railTitle="Settings routes"
        railDescription="Use this setup map as the front door for the restaurant workspace."
        railItems={SETUP_RAIL_ITEMS}
      >
        <Skeleton className="h-28 w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </RestaurantSettingsCommandCenter>
    );
  }

  const requiredCards = cards.slice(0, 3);
  const optionalCards = cards.slice(3);
  const completeRequired = requiredCards.filter((card) => card.status === 'complete').length;
  const needsAttention = requiredCards.filter((card) => card.status !== 'complete').length;

  return (
    <RestaurantSettingsCommandCenter
      eyebrow="Setup command center"
      title="Restaurant setup"
      description="Complete the essentials below to make this restaurant ready for bookings. Menu, team, and Google details can follow once the booking foundation is sound."
      metrics={[
        {
          label: 'Required setup',
          value: `${completeRequired}/3 complete`,
          description: needsAttention > 0 ? `${needsAttention} need attention` : 'ready',
          variant: needsAttention > 0 ? 'metric' : 'default',
          Icon: ClipboardList,
        },
        {
          label: 'Optional routes',
          value: `${optionalCards.length} available`,
          description: 'launch support',
          variant: 'outline',
          Icon: Circle,
        },
        {
          label: 'Next step',
          value: needsAttention > 0 ? 'Finish essentials' : 'Review optional',
          description: 'guided from the cards below',
          variant: needsAttention > 0 ? 'secondary' : 'default',
          Icon: ArrowRight,
        },
      ]}
      railTitle="Settings routes"
      railDescription="Choose one setup group at a time, then jump into the route that owns the work."
      railItems={[
        {
          label: 'Required setup',
          description: 'Profile, availability, and tables needed before bookings feel ready.',
          href: '#setup-required',
          Icon: ClipboardList,
          badge: `${completeRequired}/3`,
          isActive: activeWorkspace === 'required',
          onSelect: () => selectWorkspace('required'),
        },
        {
          label: 'Optional launch support',
          description: 'Menu, team, and Google support the wider operating workflow.',
          href: '#setup-optional',
          Icon: Circle,
          badge: `${optionalCards.length}`,
          isActive: activeWorkspace === 'optional',
          onSelect: () => selectWorkspace('optional'),
        },
        ...SETUP_RAIL_ITEMS,
      ]}
      footer="Profile, availability, and tables are the booking-critical routes. Menu, team, and Google support the wider launch workflow."
    >
      <div className={SETTINGS_COMPACT_ROUTE_STACK_CLASS}>
        <section
          id="setup-required"
          hidden={activeWorkspace !== 'required'}
          className={cn(
            'scroll-mt-28 grid gap-4 lg:grid-cols-3',
            activeWorkspace !== 'required' && 'hidden',
          )}
          aria-label="Required setup"
        >
          {requiredCards.map((card) => (
            <ReadinessCard key={card.title} card={card} />
          ))}
        </section>

        <section
          id="setup-optional"
          hidden={activeWorkspace !== 'optional'}
          className={cn(
            'scroll-mt-28 grid gap-4 lg:grid-cols-3',
            activeWorkspace !== 'optional' && 'hidden',
          )}
          aria-label="Useful next steps"
        >
          {optionalCards.map((card) => (
            <ReadinessCard key={card.title} card={card} />
          ))}
        </section>
      </div>
    </RestaurantSettingsCommandCenter>
  );
}
