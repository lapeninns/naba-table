import { OnboardingWizard } from '@/components/features/onboarding/OnboardingWizard';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Restaurant profile',
  description: 'Add restaurant basics for onboarding.',
};

export default function OnboardingProfilePage() {
  return <OnboardingWizard initialState={{ step: 2 }} />;
}
