'use client';

import { Building2, CheckCircle2 } from 'lucide-react';

import { GuestNavbar } from '@/components/layouts/GuestNavbar';
import { Badge } from '@/components/ui/badge';
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
  const currentStep = steps.find((step) => step.id === current);

  return (
    <div className="guest-theme pg-page min-h-[100dvh] text-foreground">
      <GuestNavbar />
      <main id="main-content" className="pb-16">
        <section className="pg-hero-band border-b border-border/70 py-8 sm:py-12">
          <div className="pg-container grid gap-6 lg:grid-cols-[7fr_5fr] lg:items-end">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="guest-chip" className="pg-chip">
                  Restaurant onboarding
                </Badge>
                <span className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Step {current} of {steps.length}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <h1 className="pg-hero-title max-w-[14ch]">{title}</h1>
                <p className="pg-lead max-w-[65ch]">
                  Configure the owner-side basics that power the public guest booking journey:
                  profile, hours, services, tables, and final review.
                </p>
              </div>
            </div>
            <Card className="pg-panel border-border/80 bg-background/90 shadow-[var(--pg-shadow-edge)]">
              <CardContent className="grid gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-muted text-primary">
                    <Building2 className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {currentStep?.title ?? 'Onboarding'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {currentStep?.description ?? 'Continue the setup flow.'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {['Remote-ready setup', 'Guest route powered', 'Review before launch'].map(
                    (item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                        {item}
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="pg-container flex flex-col gap-6 py-6 sm:py-8">
          <OnboardingProgress steps={steps} current={current} />

          <Card className="pg-panel overflow-hidden border-border/80 bg-background/95 shadow-[var(--pg-shadow-edge)]">
            <CardHeader className="border-b border-border/70 bg-muted/35 px-5 py-4 sm:px-6">
              <p className="pg-kicker">Current task</p>
              <CardTitle className="pg-card-title">{currentStep?.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 lg:p-8">{children}</CardContent>
          </Card>
        </div>
      </main>
      <footer className="border-t border-border/70 bg-background/80">
        <div className="pg-container py-5 text-sm text-muted-foreground">
          Public owner onboarding · Guest-facing design system
        </div>
      </footer>
    </div>
  );
}
