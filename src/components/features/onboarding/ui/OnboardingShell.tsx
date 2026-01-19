'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { OnboardingProgress } from './OnboardingProgress';

import type { ProgressStep } from './OnboardingProgress';
import type { OnboardingStep } from '../types';

export function OnboardingShell({
  steps,
  current,
  title,
  children,
}: {
  steps: ProgressStep[];
  current: OnboardingStep;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Restaurant onboarding</p>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            We will guide you through a few quick steps to launch your restaurant on Nab a Table.
          </p>
        </div>

        <OnboardingProgress steps={steps} current={current} />

        <Card className="border-border/80 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">{steps.find((step) => step.id === current)?.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
