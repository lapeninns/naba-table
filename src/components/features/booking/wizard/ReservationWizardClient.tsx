'use client';

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { PlanStepSkeleton } from "@features/reservations/wizard/ui/WizardSkeletons";

const ReservationWizard = dynamic(
  () => import("@features/reservations/wizard/ui/ReservationWizard").then((m) => m.ReservationWizard),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center bg-muted/30 p-6" role="status" aria-busy>
        <div className="w-full max-w-2xl space-y-6 rounded-xl border border-dashed border-border/70 bg-background/80 p-6">
          <PlanStepSkeleton />
        </div>
      </div>
    ),
  },
);

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
