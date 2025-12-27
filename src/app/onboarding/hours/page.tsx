import { OnboardingWizard } from '@/components/features/onboarding/OnboardingWizard';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Operating hours',
  description: 'Set weekly operating hours.',
};

export default function OnboardingHoursPage() {
  return <OnboardingWizard initialState={{ step: 3 }} />;
}
