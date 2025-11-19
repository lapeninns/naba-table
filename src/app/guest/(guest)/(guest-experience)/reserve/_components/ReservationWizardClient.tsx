'use client';

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { ReservationWizard } from "@features/reservations/wizard/ui/ReservationWizard";

type ReservationWizardClientProps = {
  restaurantSlug?: string | null;
  returnPath?: string;
};

export function ReservationWizardClient({
  restaurantSlug,
  returnPath = '/thank-you',
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

  const initialDetails = useMemo(
    () => (restaurantSlug ? { restaurantSlug } : undefined),
    [restaurantSlug],
  );

  return (
    <ReservationWizard
      initialDetails={initialDetails}
      returnPath={returnPath}
      dependencies={{ navigator }}
    />
  );
}
