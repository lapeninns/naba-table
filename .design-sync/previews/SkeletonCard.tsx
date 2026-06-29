import { SkeletonCard, SkeletonTitle, SkeletonText } from 'nabatable-platform';

export const FloorPlanLoading = () => (
  <div className="w-80 flex flex-col gap-3 rounded-xl border p-4">
    <span className="text-xs text-muted-foreground">Loading floor plan…</span>
    <SkeletonCard className="h-44 w-full rounded-xl bg-slate-300" />
  </div>
);

export const BookingTileLoading = () => (
  <div className="w-80 flex flex-col gap-3 rounded-xl border p-4">
    <SkeletonTitle className="h-7 w-40 rounded-md bg-slate-300" />
    <SkeletonCard className="h-32 w-full rounded-xl bg-slate-300" />
    <SkeletonText className="h-4 w-48 rounded-md bg-slate-300" />
  </div>
);

export const CoversGridLoading = () => (
  <div className="grid grid-cols-2 gap-3 w-80">
    <SkeletonCard className="h-28 w-full rounded-xl bg-slate-300" />
    <SkeletonCard className="h-28 w-full rounded-xl bg-slate-300" />
  </div>
);
