import { SkeletonTitle, SkeletonText } from 'nabatable-platform';

export const SectionHeaderLoading = () => (
  <div className="flex flex-col gap-3 w-80 rounded-lg border p-4">
    <SkeletonTitle className="h-7 w-48 rounded-md bg-slate-300" />
    <SkeletonText className="h-4 w-56 rounded-md bg-slate-300" />
  </div>
);

export const BookingCardLoading = () => (
  <div className="flex flex-col gap-3 w-80 rounded-lg border p-4">
    <SkeletonTitle className="h-7 w-56 rounded-md bg-slate-300" />
    <SkeletonText className="h-4 w-40 rounded-md bg-slate-300" />
    <SkeletonText className="h-4 w-32 rounded-md bg-slate-300" />
  </div>
);

export const DefaultWidth = () => (
  <div className="flex flex-col gap-2 w-72 rounded-lg border p-4">
    <span className="text-xs text-muted-foreground">Loading service…</span>
    <SkeletonTitle className="h-7 w-56 rounded-md bg-slate-300" />
  </div>
);
