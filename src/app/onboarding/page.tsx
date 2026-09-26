import { OnboardingWizardPage } from '@/components/features/onboarding/OnboardingWizardPage';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Nab a Table',
  description: 'Configure your restaurant to start taking bookings.',
};

export default function OnboardingIndexPage() {
  return <OnboardingWizardPage />;
}
