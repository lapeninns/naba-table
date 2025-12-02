import { OnboardingProviders } from './OnboardingProviders';

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Onboarding · Nab a Table',
  description: 'Complete your restaurant setup in a few guided steps.',
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Onboarding</p>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Set up your restaurant</h1>
            <p className="text-sm text-muted-foreground">
              We&apos;ll guide you through profile, hours, services, and table setup. You can save and continue anytime.
            </p>
          </div>
        </header>
        <OnboardingProviders>{children}</OnboardingProviders>
      </div>
    </main>
  );
}
