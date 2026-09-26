import { OnboardingWizardPage } from '@/components/features/onboarding/OnboardingWizardPage';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Operating hours',
  description: 'Set weekly operating hours.',
};

export default function OnboardingHoursPage() {
  return <OnboardingWizardPage initialState={{ step: 3 }} />;
}
