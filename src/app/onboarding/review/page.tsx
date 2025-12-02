import { OnboardingWizard } from '@/components/features/onboarding/OnboardingWizard';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Review',
  description: 'Confirm settings and launch.',
};

export default function OnboardingReviewPage() {
  return <OnboardingWizard initialState={{ step: 6 }} />;
}
