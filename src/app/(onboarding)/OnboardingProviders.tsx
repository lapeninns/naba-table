'use client';

import { OpsServicesProvider } from '@/contexts/ops-services';

import type { ReactNode } from 'react';

type OnboardingProvidersProps = {
  children: ReactNode;
};

export function OnboardingProviders({ children }: OnboardingProvidersProps) {
  return <OpsServicesProvider>{children}</OpsServicesProvider>;
}
