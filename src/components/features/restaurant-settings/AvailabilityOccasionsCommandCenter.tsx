'use client';

import { CalendarClock, ClipboardList, Clock3 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AvailabilityScheduleManager } from '@/components/features/restaurant-settings/AvailabilityScheduleManager';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { cn } from '@/lib/utils';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import { getGbpDriftSectionBadge, useGbpDriftSectionStatus } from './GbpDriftProvider';
import { SettingsCard, SettingsSectionNav, SETTINGS_COMMAND_CENTER_LAYOUT_CLASS } from './shared';
import {
  BookingRulesSubform,
  COMMON_TIMEZONES,
  type RestaurantDetailsFormValues,
} from '../../../../components/ops/restaurants/RestaurantDetailsForm';

type AvailabilityOccasionsCommandCenterProps = {
  restaurantId: string | null;
  initialWorkspace?: AvailabilityWorkspace;
};

type AvailabilityWorkspace = 'rules' | 'schedule' | 'booking-types';

const EMPTY_VALUES: RestaurantDetailsFormValues = {
  name: '',
  slug: '',
  timezone: COMMON_TIMEZONES[0],
  contactEmail: null,
  contactPhone: null,
  address: null,
  businessDescription: null,
  managerDailySummaryEnabled: false,
  managerNotificationPhone: null,
  googleMapUrl: null,
  googleReviewUrl: null,
  bookingPolicy: null,
  reservationIntervalMinutes: DEFAULT_RESERVATION_INTERVAL_MINUTES,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 15,
};

function toDetailsFormValues(
  data: ReturnType<typeof useOpsRestaurantDetails>['data'],
): RestaurantDetailsFormValues {
  if (!data) {
    return EMPTY_VALUES;
  }

  return {
    name: data.name,
    slug: data.slug ?? '',
    timezone: data.timezone ?? COMMON_TIMEZONES[0],
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    address: data.address,
    businessDescription: data.businessDescription,
    managerDailySummaryEnabled: data.managerDailySummaryEnabled,
    managerNotificationPhone: data.managerNotificationPhone,
    googleMapUrl: data.googleMapUrl,
    googleReviewUrl: data.googleReviewUrl,
    bookingPolicy: data.bookingPolicy,
    reservationIntervalMinutes: data.reservationIntervalMinutes,
    reservationDefaultDurationMinutes: data.reservationDefaultDurationMinutes,
    reservationLastSeatingBufferMinutes: data.reservationLastSeatingBufferMinutes,
    reservationLifecycleGraceMinutes: data.reservationLifecycleGraceMinutes,
  };
}

function BookingRulesCard({ restaurantId }: { restaurantId: string | null }) {
  const detailsQuery = useOpsRestaurantDetails(restaurantId);
  const [isDirty, setIsDirty] = useState(false);
  // Memoize derived form defaults so unrelated route renders do not hand the subform a fresh object.
  const initialValues = useMemo(() => toDetailsFormValues(detailsQuery.data), [detailsQuery.data]);

  useRegisterOpsUnsavedChanges(
    'restaurant-booking-rules',
    isDirty,
    'You have unsaved booking rule changes. Leave without saving them?',
  );

  if (!restaurantId) {
    return (
      <SettingsCard
        title="Booking rules"
        description="Select a restaurant to manage reservation timing rules and booking policy."
      >
        <p className="text-sm text-muted-foreground">
          Choose a restaurant using the sidebar switcher to update booking rules.
        </p>
      </SettingsCard>
    );
  }

  if (detailsQuery.isLoading && !detailsQuery.data) {
    return (
      <SettingsCard
        title="Booking rules"
        description="Loading restaurant-level reservation timing rules."
      >
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </SettingsCard>
    );
  }

  if (detailsQuery.error) {
    return (
      <SettingsCard
        title="Booking rules"
        description="Manage reservation timing rules and booking policy."
      >
        <Alert variant="destructive">
          <AlertTitle>Unable to load booking rules</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{detailsQuery.error.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => detailsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </SettingsCard>
    );
  }

  return (
    <div id="booking-rules" className="scroll-mt-28">
      <SettingsCard
        title="Booking rules"
        description="Set the restaurant-level reservation slot rhythm, default duration, seating buffer, lifecycle grace, and guest-facing booking policy."
      >
        <BookingRulesSubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          onDirtyChange={setIsDirty}
        />
      </SettingsCard>
    </div>
  );
}

export function AvailabilityOccasionsCommandCenter({
  restaurantId,
  initialWorkspace = 'rules',
}: AvailabilityOccasionsCommandCenterProps) {
  const [activeWorkspace, setActiveWorkspace] = useState<AvailabilityWorkspace>(initialWorkspace);
  const reduceMotion = useReducedMotion();
  const availabilityGbpStatus = useGbpDriftSectionStatus(['operatingHours', 'servicePeriods']);
  const availabilityBadge = getGbpDriftSectionBadge(availabilityGbpStatus);

  useEffect(() => {
    setActiveWorkspace(initialWorkspace);
  }, [initialWorkspace]);

  useEffect(() => {
    const hash =
      window.location.hash.slice(1) ||
      (initialWorkspace === 'rules'
        ? 'booking-rules'
        : initialWorkspace === 'schedule'
          ? 'availability-schedule'
          : 'booking-occasions');
    const scrollToTarget = () => {
      const target = document.getElementById(hash);
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return Boolean(target);
    };
    window.requestAnimationFrame(() => {
      if (!scrollToTarget()) {
        window.setTimeout(scrollToTarget, 0);
      }
    });
  }, [initialWorkspace]);
  const selectWorkspace = useCallback((workspace: AvailabilityWorkspace) => {
    setActiveWorkspace(workspace);
    const hash =
      workspace === 'rules'
        ? 'booking-rules'
        : workspace === 'schedule'
          ? 'availability-schedule'
          : 'booking-occasions';
    window.history.replaceState(null, '', `#${hash}`);
  }, []);

  return (
    <section className={SETTINGS_COMMAND_CENTER_LAYOUT_CLASS} aria-label="Availability sections">
      <SettingsSectionNav
        title="Availability sections"
        description="Work top-down: rules first, then the weekly schedule and booking types."
        items={[
          {
            label: 'Booking rules',
            description:
              'Reservation rhythm, default duration, seating buffer, and booking policy.',
            href: '#booking-rules',
            Icon: ClipboardList,
            isActive: activeWorkspace === 'rules',
            onSelect: () => selectWorkspace('rules'),
          },
          {
            label: 'Schedule',
            description: 'Weekly hours, service windows, and date overrides.',
            href: '#availability-schedule',
            Icon: CalendarClock,
            isActive: activeWorkspace === 'schedule',
            badge: availabilityBadge ?? undefined,
            onSelect: () => selectWorkspace('schedule'),
          },
          {
            label: 'Booking types',
            description: 'Lunch, dinner, and turn-time rules by party size.',
            href: '#booking-occasions',
            Icon: Clock3,
            isActive: activeWorkspace === 'booking-types',
            onSelect: () => selectWorkspace('booking-types'),
          },
        ]}
      />
      <div className="flex min-w-0 flex-col gap-6">
        <motion.div
          hidden={activeWorkspace !== 'rules'}
          aria-hidden={activeWorkspace !== 'rules'}
          className={cn(
            'will-change-auto',
            activeWorkspace !== 'rules' && 'hidden',
            activeWorkspace === 'rules' && 'motion-safe:will-change-transform',
          )}
          initial={false}
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: activeWorkspace === 'rules' ? 1 : 0,
                  y: activeWorkspace === 'rules' ? 0 : 8,
                }
          }
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <BookingRulesCard restaurantId={restaurantId} />
        </motion.div>
        <motion.div
          hidden={activeWorkspace === 'rules'}
          aria-hidden={activeWorkspace === 'rules'}
          className={cn(
            'will-change-auto',
            activeWorkspace === 'rules' && 'hidden',
            activeWorkspace !== 'rules' && 'motion-safe:will-change-transform',
          )}
          initial={false}
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: activeWorkspace === 'rules' ? 0 : 1,
                  y: activeWorkspace === 'rules' ? 8 : 0,
                }
          }
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <AvailabilityScheduleManager
            restaurantId={restaurantId}
            activeWorkspace={activeWorkspace === 'booking-types' ? 'booking-types' : 'schedule'}
          />
        </motion.div>
      </div>
    </section>
  );
}
