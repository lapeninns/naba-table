"use client";
import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

export default function CategoryTab({ icon, label, active, onClick, className }: Props) {
  return (
    <button
      role="tab"
      aria-selected={!!active}
      onClick={onClick}
      className={cn(
        "category-tab",
        "flex flex-col items-center gap-2 px-4 py-3 min-h-[var(--touch-target)]",
        active ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]",
        className,
      )}
    >
      {icon && <span aria-hidden className="category-tab__icon h-6 w-6">{icon}</span>}
      <span className="text-label">{label}</span>
      <span
        aria-hidden
        className={cn(
          "mt-1 h-0.5 w-full rounded-full",
          active ? "bg-[color:var(--color-primary)]" : "bg-transparent",
        )}
      />
    </button>
  );
}

