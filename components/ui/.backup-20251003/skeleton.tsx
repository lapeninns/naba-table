import { cn } from "@/lib/utils";

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("skeleton rounded-[var(--radius-md)]", className)} />
);

export { Skeleton };
