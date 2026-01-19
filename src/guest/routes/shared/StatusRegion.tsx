"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type StatusRegionProps = {
  children: React.ReactNode;
  focus?: boolean;
  live?: "polite" | "assertive";
  className?: string;
};

export function StatusRegion({ children, focus = false, live = "polite", className }: StatusRegionProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focus && ref.current) {
      ref.current.focus({ preventScroll: false });
    }
  }, [focus]);

  return (
    <div
      ref={ref}
      role="status"
      aria-live={live}
      tabIndex={focus ? -1 : undefined}
      className={cn("outline-none", className)}
    >
      {children}
    </div>
  );
}
