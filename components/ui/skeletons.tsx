import { Skeleton } from './skeleton';

import type { ComponentProps } from 'react';

export function SkeletonText(props: ComponentProps<typeof Skeleton>) {
  return <Skeleton className="h-4 w-32" {...props} />;
}

export function SkeletonTitle(props: ComponentProps<typeof Skeleton>) {
  return <Skeleton className="h-7 w-48" {...props} />;
}

export function SkeletonCard(props: ComponentProps<typeof Skeleton>) {
  return <Skeleton className="h-48 w-full rounded-xl" {...props} />;
}

export function SkeletonRow(props: ComponentProps<typeof Skeleton>) {
  return <Skeleton className="h-10 w-full rounded-lg" {...props} />;
}

export function SkeletonTable(props: { rows?: number }) {
  const rows = props.rows ?? 5;
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <div className="grid grid-cols-4 gap-4 border-b border-border/60 bg-muted/40 px-4 py-3">
        <SkeletonText className="w-20" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-24" />
        <SkeletonText className="w-12 justify-self-end" />
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="grid grid-cols-4 gap-4 px-4 py-3">
            <SkeletonText className="w-28" />
            <SkeletonText className="w-16" />
            <SkeletonText className="w-24" />
            <SkeletonText className="w-16 justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCalendarGrid() {
  return (
    <div className="grid grid-cols-7 gap-2 rounded-xl border border-border/60 p-3">
      {Array.from({ length: 35 }).map((_, idx) => (
        <Skeleton key={idx} className="aspect-square w-full rounded-lg" />
      ))}
    </div>
  );
}
