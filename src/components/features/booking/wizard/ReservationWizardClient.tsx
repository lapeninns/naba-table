'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { PlanStepSkeleton } from '@features/reservations/wizard/ui/WizardSkeletons';

import type { RestaurantSummary } from '@/lib/restaurants/types';

const ReservationWizard = dynamic(
  () =>
    import('@features/reservations/wizard/ui/ReservationWizard').then((m) => m.ReservationWizard),
  {
    loading: () => (
      <div
        className="flex min-h-[40vh] items-center justify-center rounded-[var(--pg-radius-md)] bg-muted/30 p-4 sm:p-6"
        role="status"
        aria-busy
      >
        <div className="w-full max-w-4xl space-y-6 rounded-[var(--pg-radius-md)] border border-dashed border-border/70 bg-background/80 p-4 sm:p-6">
          <PlanStepSkeleton />
        </div>
      </div>
    ),
  },
);

type ReservationWizardClientProps = {
  restaurant?: Pick<RestaurantSummary, 'id' | 'slug' | 'name' | 'timezone' | 'address'> | null;
  restaurantSlug?: string | null;
  returnPath?: string;
};

export function ReservationWizardClient({
  restaurant,
  restaurantSlug,
  returnPath,
}: ReservationWizardClientProps) {
  const router = useRouter();

  const navigator = useMemo(
    () => ({
      push: (path: string) => router.push(path),
      replace: (path: string) => router.replace(path),
      back: () => router.back(),
    }),
    [router],
  );

  const slug = useMemo(
    () => restaurant?.slug ?? restaurantSlug ?? null,
    [restaurant, restaurantSlug],
  );

  const initialDetails = useMemo(() => {
    const normalizedSlug = slug?.trim();
    if (!normalizedSlug) {
      return undefined;
    }

    return {
      ...(restaurant?.id ? { restaurantId: restaurant.id } : {}),
      restaurantSlug: normalizedSlug,
      ...(restaurant?.name ? { restaurantName: restaurant.name } : {}),
      ...(restaurant?.timezone ? { restaurantTimezone: restaurant.timezone } : {}),
      ...(restaurant?.address ? { restaurantAddress: restaurant.address } : {}),
    };
  }, [restaurant, slug]);

  return (
    <ReservationWizard
      initialDetails={initialDetails}
      layoutElement="div"
      returnPath={returnPath}
      className="guest-theme bg-transparent"
      contentClassName="gap-4 sm:gap-5"
      navigationClassName="sm:px-0 lg:px-0"
      dependencies={{ navigator }}
    />
  );
}
