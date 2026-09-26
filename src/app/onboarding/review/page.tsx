import { OnboardingWizardPage } from '@/components/features/onboarding/OnboardingWizardPage';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Review',
  description: 'Confirm settings and launch.',
};

export default function OnboardingReviewPage() {
  return <OnboardingWizardPage initialState={{ step: 6 }} />;
}
