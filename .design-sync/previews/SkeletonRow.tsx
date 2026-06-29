import { SkeletonRow, SkeletonTitle } from 'nabatable-platform';

export const BookingListLoading = () => (
  <div className="w-80 flex flex-col gap-2 rounded-xl border p-4">
    <SkeletonTitle className="mb-1 h-6 w-40 rounded-md bg-slate-300" />
    <SkeletonRow className="h-10 w-full rounded-lg bg-slate-300" />
    <SkeletonRow className="h-10 w-full rounded-lg bg-slate-300" />
    <SkeletonRow className="h-10 w-full rounded-lg bg-slate-300" />
    <SkeletonRow className="h-10 w-full rounded-lg bg-slate-300" />
  </div>
);

export const WaitlistLoading = () => (
  <div className="w-72 flex flex-col gap-2 rounded-xl border p-4">
    <span className="text-xs text-muted-foreground">Loading waitlist…</span>
    <SkeletonRow className="h-10 w-full rounded-lg bg-slate-300" />
    <SkeletonRow className="h-10 w-full rounded-lg bg-slate-300" />
  </div>
);

export const DefaultRow = () => (
  <div className="w-80 flex flex-col gap-2 rounded-xl border p-4">
    <SkeletonRow className="h-10 w-full rounded-lg bg-slate-300" />
  </div>
);
