import { cn } from "@/lib/utils";

const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "animate-pulse rounded-[var(--radius-md)] bg-[color:var(--color-surface-muted,rgba(148,163,184,0.3))]",
      className,
    )}
  />
);

export { Skeleton };
