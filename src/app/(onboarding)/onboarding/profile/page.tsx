
import { OnboardingStepper } from '@/components/features/onboarding/OnboardingStepper';
import { ONBOARDING_STEPS } from '@/components/features/onboarding/steps';
import { ensureCsrfCookie } from '@/server/security/csrf';

import { ProfileClient } from './ProfileClient';

type Props = {
  searchParams: Promise<{ rid?: string }>;
};

export default async function OnboardingProfilePage({ searchParams }: Props) {
  await ensureCsrfCookie();
  const params = await searchParams;
  const restaurantId = params?.rid ?? null;

  return (
    <div className="space-y-6">
      <OnboardingStepper current={2} steps={ONBOARDING_STEPS} />
      <ProfileClient restaurantId={restaurantId} />
    </div>
  );
}
