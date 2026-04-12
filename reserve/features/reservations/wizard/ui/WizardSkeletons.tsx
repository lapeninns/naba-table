'use client';

import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

export function PlanStepSkeleton() {
  return (
    <div className="luminous-panel mx-auto w-full max-w-[80vw] px-6 py-6 sm:px-8 sm:py-8 space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-[var(--luminous-radius)]" />
        <Skeleton className="h-4 w-72 rounded-[var(--luminous-radius)]" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-[var(--luminous-radius-panel)]" />
        <Skeleton className="h-64 w-full rounded-[var(--luminous-radius-panel)]" />
      </div>
      <Skeleton className="h-48 w-full rounded-[var(--luminous-radius-panel)]" />
    </div>
  );
}

export function DetailsStepSkeleton() {
  return (
    <div className="luminous-panel mx-auto w-full max-w-[80vw] px-6 py-6 sm:px-8 sm:py-8 space-y-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-52 rounded-[var(--luminous-radius)]" />
        <Skeleton className="h-4 w-80 rounded-[var(--luminous-radius)]" />
      </div>
      <div className="luminous-card space-y-4 rounded-[var(--luminous-radius)] p-5">
        <Skeleton className="h-5 w-36 rounded-[var(--luminous-radius)]" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-[var(--luminous-radius)]" />
          <Skeleton className="h-10 w-full rounded-[var(--luminous-radius)]" />
          <Skeleton className="h-10 w-full rounded-[var(--luminous-radius)]" />
        </div>
      </div>
      <div className="luminous-card space-y-4 rounded-[var(--luminous-radius)] p-5">
        <Skeleton className="h-5 w-32 rounded-[var(--luminous-radius)]" />
        <Skeleton className="h-12 w-full rounded-[var(--luminous-radius)]" />
        <Skeleton className="h-28 w-full rounded-[var(--luminous-radius)]" />
      </div>
    </div>
  );
}

export function ReviewStepSkeleton() {
  return (
    <div className="luminous-panel mx-auto w-full max-w-[80vw] px-6 py-6 sm:px-8 sm:py-8 space-y-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-[var(--luminous-radius)]" />
        <Skeleton className="h-4 w-64 rounded-[var(--luminous-radius)]" />
      </div>
      <Skeleton className="h-4 w-48 rounded-[var(--luminous-radius)]" />
      <div className="luminous-card grid gap-4 rounded-[var(--luminous-radius)] p-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-[var(--luminous-radius)]" />
            <Skeleton className="h-4 w-40 rounded-[var(--luminous-radius)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConfirmationStepSkeleton() {
  return (
    <div className="luminous-panel mx-auto w-full max-w-[80vw] px-6 py-6 sm:px-8 sm:py-8 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-8 w-52 rounded-[var(--luminous-radius)]" />
        </div>
        <Skeleton className="h-4 w-72 rounded-[var(--luminous-radius)]" />
      </div>
      <Skeleton className="h-4 w-80 rounded-[var(--luminous-radius)]" />
      <div className="luminous-card rounded-[var(--luminous-radius)] p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24 rounded-[var(--luminous-radius)]" />
              <Skeleton className="h-4 w-36 rounded-[var(--luminous-radius)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
