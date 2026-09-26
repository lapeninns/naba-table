import { loadOnboardingResume } from '@/server/onboarding/resume';

import { OnboardingWizard } from './OnboardingWizard';

import type { OnboardingState } from './types';

/**
 * Server entry for every onboarding route: resolves the session and restaurant to resume
 * (see `loadOnboardingResume`) and renders the client wizard with it.
 */
export async function OnboardingWizardPage({
  initialState,
}: {
  initialState?: Partial<OnboardingState>;
}) {
  const resume = await loadOnboardingResume();
  return <OnboardingWizard initialState={initialState} resume={resume} />;
}
