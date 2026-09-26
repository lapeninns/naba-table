import { OnboardingWizardPage } from '@/components/features/onboarding/OnboardingWizardPage';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Onboarding · Tables',
  description: 'Add zones and tables for seating.',
};

export default function OnboardingTablesPage() {
  return <OnboardingWizardPage initialState={{ step: 5 }} />;
}
