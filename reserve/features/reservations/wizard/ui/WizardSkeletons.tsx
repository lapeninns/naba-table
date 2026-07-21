'use client';

import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@shared/lib/cn';

import type { WizardLayoutSurface } from './WizardLayout';

type LoadingSkeletonProps = {
  readonly className?: string;
};

function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return <Skeleton className={cn('pg-skeleton motion-reduce:animate-none', className)} />;
}

function WizardStepSkeletonShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <section
      role="status"
      aria-label="Loading booking step"
      aria-busy="true"
      data-wizard-skeleton-region="step"
      className="pg-panel mx-auto w-full overflow-hidden border-border/80 bg-background/92 shadow-[var(--pg-shadow-sm)]"
    >
      <div aria-hidden="true">{children}</div>
    </section>
  );
}

function WizardStepSkeletonHeader({
  titleWidth = 'max-w-52',
  descriptionWidth = 'max-w-80',
}: {
  readonly titleWidth?: string;
  readonly descriptionWidth?: string;
}) {
  return (
    <header className="space-y-2 border-b border-border/70 px-4 py-4 sm:px-5">
      <LoadingSkeleton className={cn('h-7 w-full', titleWidth)} />
      <LoadingSkeleton className={cn('h-4 w-full', descriptionWidth)} />
    </header>
  );
}

function FieldGroupSkeleton({
  className,
  bodyHeight = 'h-12',
}: {
  readonly className?: string;
  readonly bodyHeight?: string;
}) {
  return (
    <div className={cn('space-y-3 py-4 first:pt-0 last:pb-0', className)}>
      <div className="flex items-center gap-2">
        <LoadingSkeleton className="size-4 rounded-full" />
        <LoadingSkeleton className="h-5 w-28" />
      </div>
      <LoadingSkeleton className={cn(bodyHeight, 'w-full rounded-[var(--pg-radius-md)]')} />
      <LoadingSkeleton className="h-4 w-full max-w-64" />
    </div>
  );
}

function WizardVenueSkeleton() {
  return (
    <header
      data-wizard-skeleton-region="venue"
      className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-2">
        <LoadingSkeleton className="h-3 w-20" />
        <LoadingSkeleton className="h-7 w-56 max-w-full" />
      </div>
      <LoadingSkeleton className="h-8 w-40 max-w-full rounded-[var(--pg-radius-pill)]" />
    </header>
  );
}

function WizardProgressSkeleton() {
  return (
    <section
      data-wizard-skeleton-region="progress"
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border/70 pb-4 sm:gap-4"
    >
      <LoadingSkeleton className="size-10 rounded-full" />
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <LoadingSkeleton className="h-4 w-28" />
          <LoadingSkeleton className="h-3 w-12" />
        </div>
        <LoadingSkeleton className="h-2 w-full rounded-[var(--pg-radius-pill)]" />
      </div>
    </section>
  );
}

function WizardRailSkeleton() {
  return (
    <div
      data-wizard-skeleton-region="rail"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-40 mx-auto grid max-w-3xl grid-cols-1 gap-3 rounded-[var(--pg-radius-xl)] border border-border/80 bg-background/95 p-3 shadow-[var(--pg-shadow-nav)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="space-y-2">
        <LoadingSkeleton className="h-4 w-36 max-w-full" />
        <LoadingSkeleton className="h-3 w-52 max-w-full" />
      </div>
      <LoadingSkeleton className="h-11 w-full rounded-[var(--pg-radius-md)] sm:w-32" />
    </div>
  );
}

export function BookingWizardShellSkeleton({
  layoutElement = 'div',
  layoutSurface = 'guest',
}: {
  readonly layoutElement?: 'main' | 'div';
  readonly layoutSurface?: WizardLayoutSurface;
}) {
  const Container = layoutElement === 'main' ? 'main' : 'div';
  const isOpsSurface = layoutSurface === 'ops';

  return (
    <Container
      role="status"
      aria-label="Loading booking form"
      aria-busy="true"
      className={cn(
        'w-full font-sans text-foreground',
        isOpsSurface ? 'py-0' : 'pg-page px-[var(--pg-gutter)] py-[var(--pg-section-y-tight)]',
      )}
    >
      <div
        aria-hidden="true"
        data-wizard-skeleton-visual
        className={cn(
          'flex w-full flex-col gap-4 pb-28 sm:gap-5 sm:pb-24',
          isOpsSurface ? 'px-3 sm:px-4' : 'mx-auto max-w-6xl',
        )}
      >
        <WizardVenueSkeleton />
        <WizardProgressSkeleton />
        <PlanStepSkeleton />
        <WizardRailSkeleton />
      </div>
    </Container>
  );
}

export function PlanStepSkeleton() {
  return (
    <WizardStepSkeletonShell>
      <WizardStepSkeletonHeader titleWidth="max-w-52" descriptionWidth="max-w-96" />
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="grid grid-cols-1 divide-y divide-border/70 md:grid-cols-2 md:gap-x-6 md:divide-y-0">
          <FieldGroupSkeleton className="md:pr-3" />
          <FieldGroupSkeleton className="md:pl-3" />
          <FieldGroupSkeleton className="border-t border-border/70 md:col-span-2" />
          <div className="flex items-center justify-between gap-4 border-t border-border/70 py-4">
            <LoadingSkeleton className="h-5 w-full max-w-72" />
            <LoadingSkeleton className="size-5 shrink-0 rounded-full" />
          </div>
        </div>
      </div>
    </WizardStepSkeletonShell>
  );
}

export function DetailsStepSkeleton() {
  return (
    <WizardStepSkeletonShell>
      <WizardStepSkeletonHeader titleWidth="max-w-56" descriptionWidth="max-w-80" />
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-5 sm:py-5">
        <section className="space-y-4 pb-5">
          <LoadingSkeleton className="h-5 w-40" />
          <div className="grid gap-4 md:grid-cols-2">
            <LoadingSkeleton className="h-11 w-full" />
            <LoadingSkeleton className="h-11 w-full" />
            <LoadingSkeleton className="h-11 w-full md:col-span-2" />
          </div>
        </section>
        <section className="space-y-4 border-t border-border/70 pt-5">
          <LoadingSkeleton className="h-5 w-32" />
          <LoadingSkeleton className="h-12 w-full" />
          <LoadingSkeleton className="h-28 w-full" />
        </section>
      </div>
    </WizardStepSkeletonShell>
  );
}

export function ReviewStepSkeleton() {
  return (
    <WizardStepSkeletonShell>
      <WizardStepSkeletonHeader titleWidth="max-w-48" descriptionWidth="max-w-64" />
      <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
        <LoadingSkeleton className="h-4 w-full max-w-48" />
        <div className="grid gap-x-6 gap-y-5 border-y border-border/70 py-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <LoadingSkeleton className="h-3 w-24" />
              <LoadingSkeleton className="h-4 w-full max-w-40" />
            </div>
          ))}
        </div>
      </div>
    </WizardStepSkeletonShell>
  );
}
