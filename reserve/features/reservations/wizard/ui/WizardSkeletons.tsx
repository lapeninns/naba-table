'use client';

import React from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function WizardStepSkeletonShell({ children }: { children: React.ReactNode }) {
  return (
    <Card className="pg-panel mx-auto w-full overflow-hidden border-border/80 bg-background/92 shadow-[var(--pg-shadow-floating)]">
      {children}
    </Card>
  );
}

function WizardStepSkeletonHeader({
  titleWidth = 'max-w-52',
  descriptionWidth = 'max-w-80',
}: {
  titleWidth?: string;
  descriptionWidth?: string;
}) {
  return (
    <CardHeader className="pg-wizard-card-header border-b border-border/70 px-4 py-4 sm:px-6">
      <div className="space-y-2">
        <Skeleton className={`h-7 w-full ${titleWidth}`} />
        <Skeleton className={`h-4 w-full ${descriptionWidth}`} />
      </div>
    </CardHeader>
  );
}

function FieldPanelSkeleton({
  className,
  bodyHeight = 'h-12',
}: {
  className?: string;
  bodyHeight?: string;
}) {
  return (
    <div className={`pg-panel border-border/80 bg-background/86 p-4 sm:p-5 ${className ?? ''}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className={`${bodyHeight} w-full rounded-[var(--pg-radius-md)]`} />
        <Skeleton className="h-4 w-full max-w-64" />
      </div>
    </div>
  );
}

function WizardHeroSkeleton() {
  return (
    <header className="pg-panel border-border/80 bg-background/90 px-4 py-4 text-center shadow-[var(--pg-shadow-edge)] sm:px-5">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
        <div className="space-y-2">
          <Skeleton className="mx-auto h-3 w-20" />
          <Skeleton className="mx-auto h-7 w-56 max-w-full" />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Skeleton className="h-9 w-36 rounded-full" />
          <Skeleton className="h-9 w-44 rounded-full" />
        </div>
      </div>
    </header>
  );
}

export function BookingWizardShellSkeleton({
  layoutElement = 'div',
}: {
  layoutElement?: 'main' | 'div';
}) {
  const Container = layoutElement === 'main' ? 'main' : 'div';

  return (
    <Container className="pg-page w-full px-4 py-5 font-sans text-foreground sm:py-7 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-[calc(var(--pg-radius-xl)+0.5rem)] border border-border/70 bg-background/78 p-3 shadow-[var(--pg-shadow-sm)] backdrop-blur-sm sm:gap-5 sm:p-4">
        <WizardHeroSkeleton />
        <PlanStepSkeleton />
      </div>
    </Container>
  );
}

export function PlanStepSkeleton() {
  return (
    <WizardStepSkeletonShell>
      <WizardStepSkeletonHeader titleWidth="max-w-52" descriptionWidth="max-w-96" />
      <CardContent className="space-y-4 px-4 pb-5 pt-4 sm:space-y-5 sm:px-6 sm:pb-6 sm:pt-5 lg:px-7 lg:pb-7">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
          <FieldPanelSkeleton className="order-1 md:col-span-3 lg:col-span-3" />
          <FieldPanelSkeleton className="order-2 md:col-span-3 lg:col-span-4" />
          <FieldPanelSkeleton className="order-3 md:col-span-6 lg:col-span-5" />
          <div className="pg-panel order-4 border-border/80 bg-background/86 md:col-span-6 lg:col-span-12">
            <div className="flex items-center justify-between px-4 py-4 sm:px-5">
              <Skeleton className="h-5 w-full max-w-72" />
              <Skeleton className="size-4 rounded-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </WizardStepSkeletonShell>
  );
}

export function DetailsStepSkeleton() {
  return (
    <WizardStepSkeletonShell>
      <WizardStepSkeletonHeader titleWidth="max-w-56" descriptionWidth="max-w-80" />
      <CardContent className="space-y-4 px-4 pb-5 pt-4 sm:space-y-5 sm:px-6 sm:pb-6 sm:pt-5 lg:px-7 lg:pb-7">
        <section className="pg-panel space-y-4 border-border/80 bg-background/86 p-4 sm:p-5">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full md:col-span-2" />
          </div>
        </section>
        <section className="pg-panel space-y-4 border-border/80 bg-background/86 p-4 sm:p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-28 w-full" />
        </section>
      </CardContent>
    </WizardStepSkeletonShell>
  );
}

export function ReviewStepSkeleton() {
  return (
    <WizardStepSkeletonShell>
      <WizardStepSkeletonHeader titleWidth="max-w-48" descriptionWidth="max-w-64" />
      <CardContent className="space-y-5 px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-7 lg:pb-7">
        <Skeleton className="h-4 w-full max-w-48" />
        <div className="pg-panel grid gap-4 border-border/80 bg-background/86 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full max-w-40" />
            </div>
          ))}
        </div>
      </CardContent>
    </WizardStepSkeletonShell>
  );
}

export function ConfirmationStepSkeleton() {
  return (
    <WizardStepSkeletonShell>
      <CardHeader className="pg-wizard-card-header space-y-4 border-b border-border/70 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-8 w-full max-w-52" />
        </div>
        <Skeleton className="h-4 w-full max-w-72" />
      </CardHeader>
      <CardContent className="space-y-5 px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-7 lg:pb-7">
        <Skeleton className="h-4 w-full max-w-80" />
        <div className="pg-panel border-border/80 bg-background/86 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full max-w-36" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </WizardStepSkeletonShell>
  );
}
