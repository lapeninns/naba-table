import { OnboardingWizardPage } from '@/components/features/onboarding/OnboardingWizardPage';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Service periods',
  description: 'Define service windows for bookings.',
};

export default function OnboardingServicesPage() {
  return <OnboardingWizardPage initialState={{ step: 4 }} />;
}
