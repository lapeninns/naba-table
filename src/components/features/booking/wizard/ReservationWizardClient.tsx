'use client';

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { ReservationWizard } from "@features/reservations/wizard/ui/ReservationWizard";

import type { RestaurantSummary } from "@/lib/restaurants/types";

type ReservationWizardClientProps = {
  restaurant?: Pick<RestaurantSummary, "id" | "slug" | "name" | "timezone" | "address"> | null;
  restaurantSlug?: string | null;
  returnPath?: string;
};

export function ReservationWizardClient({
  restaurant,
  restaurantSlug,
  returnPath = '/guest/thank-you',
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

  const slug = useMemo(() => restaurant?.slug ?? restaurantSlug ?? null, [restaurant, restaurantSlug]);

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
      returnPath={returnPath}
      dependencies={{ navigator }}
    />
  );
}
