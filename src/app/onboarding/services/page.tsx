import { OnboardingWizard } from '@/components/features/onboarding/OnboardingWizard';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Service periods',
  description: 'Define service windows for bookings.',
};

export default function OnboardingServicesPage() {
  return <OnboardingWizard initialState={{ step: 4 }} />;
}
