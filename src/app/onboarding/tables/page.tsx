import { OnboardingWizard } from '@/components/features/onboarding/OnboardingWizard';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Tables',
  description: 'Add zones and tables for seating.',
};

export default function OnboardingTablesPage() {
  return <OnboardingWizard initialState={{ step: 5 }} />;
}
