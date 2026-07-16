'use client';

import { MailCheck, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Button } from '@/components/ui/button';
import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsRestaurantSmsDeliveryFeed } from '@/hooks/ops/useOpsRestaurantSmsDeliveryFeed';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import {
  OpsSmsDeliveryFilters,
  OpsSmsDeliveryHeaderMeta,
  OpsSmsDeliveryLog,
  OpsSmsDeliveryStaleAlert,
  OpsSmsDeliverySummaryCards,
} from './components';

import type {
  OpsSmsDeliveryRange,
  SmsDeliveryChannelFilter,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';

type OpsSmsDeliveryClientProps = {
  initialRestaurantId?: string | null;
  initialRange?: OpsSmsDeliveryRange;
  initialPage?: number;
  initialPageSize?: number;
  initialStatuses?: SmsDeliveryStatus[];
  initialChannel?: SmsDeliveryChannelFilter;
};

export function OpsSmsDeliveryClient({
  initialRestaurantId = null,
  initialRange = '7d',
  initialPage = 1,
  initialPageSize = 50,
  initialStatuses = [],
  initialChannel = 'all',
}: OpsSmsDeliveryClientProps) {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const { restaurantService } = useOpsServices();
  const membershipIds = useMemo(
    () => new Set(memberships.map((membership) => membership.restaurantId)),
    [memberships],
  );

  const [restaurantId, setRestaurantId] = useState<string | null>(() => {
    if (initialRestaurantId && membershipIds.has(initialRestaurantId)) return initialRestaurantId;
    return activeRestaurantId ?? memberships[0]?.restaurantId ?? null;
  });
  const [range, setRange] = useState<OpsSmsDeliveryRange>(initialRange);
  const [page, setPage] = useState<number>(Math.max(1, initialPage));
  const [pageSize, setPageSize] = useState<number>(Math.max(1, Math.min(200, initialPageSize)));
  const [selectedStatuses, setSelectedStatuses] = useState<SmsDeliveryStatus[]>(initialStatuses);
  const [channel, setChannel] = useState<SmsDeliveryChannelFilter>(initialChannel);
  const [availableRestaurants, setAvailableRestaurants] = useState<
    Array<{ id: string; name: string; timezone?: string | null }>
  >([]);

  useEffect(() => {
    if (!restaurantId && memberships.length > 0) {
      setRestaurantId(memberships[0]?.restaurantId ?? null);
    }
  }, [memberships, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    if (restaurantId !== activeRestaurantId) {
      setActiveRestaurantId(restaurantId);
    }
  }, [activeRestaurantId, restaurantId, setActiveRestaurantId]);

  useEffect(() => {
    let cancelled = false;
    void restaurantService
      .listRestaurants()
      .then((restaurants) => {
        if (cancelled) return;
        setAvailableRestaurants(
          restaurants
            .filter((restaurant) => membershipIds.has(restaurant.id))
            .map((restaurant) => ({
              id: restaurant.id,
              name: restaurant.name,
              timezone: restaurant.timezone,
            })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableRestaurants(
          memberships.map((membership) => ({
            id: membership.restaurantId,
            name: membership.restaurantName,
            timezone: null,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [membershipIds, memberships, restaurantService]);

  const restaurantDetails = useOpsRestaurantDetails(restaurantId);
  const timezone = restaurantDetails.data?.timezone ?? 'UTC';

  const feedQuery = useOpsRestaurantSmsDeliveryFeed({
    restaurantId,
    range,
    page,
    pageSize,
    statuses: selectedStatuses,
    channel,
  });

  const { feed, unavailable, apiError } = feedQuery;
  const currentRestaurantName = restaurantDetails.data?.name ?? null;

  if (memberships.length === 0) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <OpsEmptyState
            title="No restaurant access yet"
            description="Ask an owner or manager to send you an invitation so you can manage bookings."
            action={
              <Button asChild variant="secondary">
                <Link href={opsHref('/dashboard')} prefetch={false}>
                  Return to ops home
                </Link>
              </Button>
            }
          />
        </section>
      </OpsPageShell>
    );
  }

  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsPageHeader
        title="Message Delivery"
        subtitle="Track queued/sent/delivered/failed booking SMS and WhatsApp in one place."
        meta={
          <OpsSmsDeliveryHeaderMeta
            availableRestaurants={availableRestaurants}
            restaurantId={restaurantId}
            currentRestaurantName={currentRestaurantName}
            timezone={timezone}
            onRestaurantChange={(value) => {
              setRestaurantId(value);
              setPage(1);
            }}
          />
        }
        secondaryActions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={opsHref('/communications-delivery/email')} prefetch={false}>
                <MailCheck data-icon="inline-start" aria-hidden />
                Email Delivery
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void feedQuery.refetch();
              }}
              disabled={feedQuery.isFetching}
            >
              <RefreshCw
                data-icon="inline-start"
                className={cn(feedQuery.isFetching && 'animate-spin')}
                aria-hidden
              />
              Refresh
            </Button>
          </>
        }
      />

      <OpsSmsDeliveryStaleAlert stuckInFlight={feed?.summary.stuckInFlight ?? 0} />

      <OpsSmsDeliverySummaryCards isLoading={feedQuery.isLoading} summary={feed?.summary ?? null} />

      <OpsSmsDeliveryFilters
        range={range}
        pageSize={pageSize}
        channel={channel}
        selectedStatuses={selectedStatuses}
        onRangeChange={(nextRange) => {
          setRange(nextRange);
          setPage(1);
        }}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
        onChannelChange={(nextChannel) => {
          setChannel(nextChannel);
          setPage(1);
        }}
        onClearStatuses={() => {
          setSelectedStatuses([]);
          setPage(1);
        }}
        onToggleStatus={(status) => {
          setSelectedStatuses((current) => {
            const exists = current.includes(status);
            return exists ? current.filter((item) => item !== status) : [...current, status];
          });
          setPage(1);
        }}
      />

      <OpsSmsDeliveryLog
        unavailable={unavailable}
        apiError={apiError}
        errorMessage={feedQuery.error?.message ?? null}
        feed={feed ?? null}
        timezone={timezone}
        page={page}
        onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
        onNextPage={() => setPage((current) => current + 1)}
      />
    </OpsPageShell>
  );
}
