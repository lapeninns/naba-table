import { OnboardingWizardPage } from '@/components/features/onboarding/OnboardingWizardPage';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Sign up · Nab a Table',
  description: 'Create your restaurant owner account and launch onboarding.',
};

export default function SignupPage() {
  return <OnboardingWizardPage />;
}
