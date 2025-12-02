import { redirect } from "next/navigation";

import { OnboardingStepper } from "@/components/features/onboarding/OnboardingStepper";
import { ONBOARDING_STEPS } from "@/components/features/onboarding/steps";
import { ensureCsrfCookie } from "@/server/security/csrf";

import { HoursClient } from "./HoursClient";

type Props = {
  searchParams: Promise<{ rid?: string }>;
};

export default async function OnboardingHoursPage({ searchParams }: Props) {
  await ensureCsrfCookie();
  const params = await searchParams;
  const restaurantId = params?.rid;

  if (!restaurantId) {
    redirect("/onboarding/profile");
  }

  return (
    <div className="space-y-6">
      <OnboardingStepper current={3} steps={ONBOARDING_STEPS} />
      <HoursClient restaurantId={restaurantId} />
    </div>
  );
}
