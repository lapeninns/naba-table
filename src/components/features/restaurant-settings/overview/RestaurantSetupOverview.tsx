'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPinned } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

import {
  RestaurantSettingsCommandCenter,
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
import { cn } from '@/lib/utils';

import { buildSetupCards, statusLabel, type SetupCard } from './buildSetupCards';
import { useRestaurantSettingsContext } from '../shell/useRestaurantSettingsContext';

function SetupChecklistCard({ card, index }: { card: SetupCard; index: number }) {
  const Icon = card.Icon;
  
  // Determine status styles
  const statusStyles = {
    complete: {
      border: 'border-emerald-500/30 hover:border-emerald-500/50',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.03)] hover:shadow-[0_0_25px_rgba(16,185,129,0.08)]',
      icon: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      badge: 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20',
    },
    attention: {
      border: 'border-amber-500/30 hover:border-amber-500/50',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.03)] hover:shadow-[0_0_25px_rgba(245,158,11,0.08)]',
      icon: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      badge: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20',
    },
    optional: {
      border: 'border-border/70 hover:border-primary/45',
      glow: 'hover:shadow-[0_0_20px_rgba(99,102,241,0.06)]',
      icon: 'text-primary bg-primary/10 border-primary/20',
      badge: 'bg-muted/30 text-muted-foreground border-border/40',
    },
  }[card.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={cn(
        'group flex flex-col justify-between rounded-xl border p-5 transition-all duration-300 ease-out bg-card/60 backdrop-blur-sm',
        statusStyles.border,
        statusStyles.glow,
      )}
    >
      <div className="space-y-4">
        {/* Header: Icon & Status Badge */}
        <div className="flex items-center justify-between">
          <div className={cn(
            'inline-flex size-10 items-center justify-center rounded-xl border transition-colors duration-300',
            statusStyles.icon
          )}>
            <Icon className="size-5 transition-transform duration-300 group-hover:scale-110" aria-hidden />
          </div>
          <Badge variant="outline" className={cn('px-2.5 py-0.5 text-xs font-semibold rounded-full border', statusStyles.badge)}>
            {statusLabel(card.status)}
          </Badge>
        </div>

        {/* Title and Description */}
        <div className="space-y-1.5">
          <h3 className="text-base font-bold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary">
            {card.title}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground font-normal min-h-[36px]">
            {card.description}
          </p>
        </div>
      </div>

      {/* Footer / CTA Actions */}
      <div className="mt-5 pt-4 border-t border-border/40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground/80 flex-1 font-medium">
          {card.detail}
        </p>
        <Button asChild size="sm" className="shrink-0 font-medium group-hover:translate-x-0.5 transition-transform duration-200">
          <Link href={card.href}>{card.cta}</Link>
        </Button>
      </div>
    </motion.div>
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
  const percentComplete = Math.round((completedRequired / 3) * 100);

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
      {/* Visual Onboarding Progress Dashboard */}
      {!isLoadingRequired && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6"
        >
          {/* Decorative blur backdrop glow */}
          <div className="absolute -right-20 -top-20 size-60 rounded-full bg-primary/10 blur-3xl" aria-hidden />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Onboarding Progress
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {completedRequired === 3 
                  ? "Your restaurant is ready to take bookings!" 
                  : "Let's set up your booking platform"}
              </h2>
              <p className="text-xs text-muted-foreground max-w-xl">
                Complete the three required steps (Public Profile, Availability, and Tables) to generate your booking widget and start welcoming guests.
              </p>
            </div>
            <div className="shrink-0 flex items-baseline gap-1 text-right">
              <span className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {percentComplete}%
              </span>
              <span className="text-xs font-medium text-muted-foreground">complete</span>
            </div>
          </div>

          {/* Glowing Animated Progress Bar */}
          <div className="mt-5 relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentComplete}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-500 via-primary to-indigo-500"
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{completedRequired} of 3 required steps complete</span>
            <span>{completedRequired === 3 ? "All systems operational" : "Pending activation"}</span>
          </div>
        </motion.div>
      )}

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
