'use client';

import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@shared/ui/card';

export function PlanStepSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </CardContent>
    </Card>
  );
}

export function DetailsStepSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent className="space-y-6 md:space-y-8">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Skeleton className="h-5 w-36" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </section>
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-28 w-full" />
        </section>
      </CardContent>
    </Card>
  );
}

export function ReviewStepSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-6">
        <Skeleton className="h-4 w-48" />
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ConfirmationStepSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-8 w-52" />
        </div>
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-6">
        <Skeleton className="h-4 w-80" />
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
