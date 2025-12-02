import { redirect } from "next/navigation";

import { OnboardingStepper } from "@/components/features/onboarding/OnboardingStepper";
import { ONBOARDING_STEPS } from "@/components/features/onboarding/steps";
import { ensureCsrfCookie } from "@/server/security/csrf";

import { TablesClient } from "./TablesClient";

type Props = {
  searchParams: Promise<{ rid?: string }>;
};

export default async function OnboardingTablesPage({ searchParams }: Props) {
  await ensureCsrfCookie();
  const params = await searchParams;
  const restaurantId = params?.rid;

  if (!restaurantId) {
    redirect("/onboarding/profile");
  }

  return (
    <div className="space-y-6">
      <OnboardingStepper current={5} steps={ONBOARDING_STEPS} />
      <TablesClient restaurantId={restaurantId} />
    </div>
  );
}
