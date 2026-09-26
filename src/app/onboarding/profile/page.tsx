import { OnboardingWizardPage } from '@/components/features/onboarding/OnboardingWizardPage';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Restaurant profile',
  description: 'Add restaurant basics for onboarding.',
};

export default function OnboardingProfilePage() {
  return <OnboardingWizardPage initialState={{ step: 2 }} />;
}
