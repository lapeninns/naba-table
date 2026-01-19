import { OnboardingWizard } from '@/components/features/onboarding/OnboardingWizard';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Sign up · Nab a Table',
  description: 'Create your restaurant owner account and launch onboarding.',
};

export default function SignupPage() {
  return <OnboardingWizard />;
}
