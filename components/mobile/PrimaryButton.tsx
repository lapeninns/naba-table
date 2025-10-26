"use client";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Button>;

export default function PrimaryButton({ className, children, ...props }: Props) {
  return (
    <Button
      variant="default"
      size="default"
      className={cn(
        "rounded-[var(--radius-md)] text-button",
        "transition-transform duration-100 ease-out",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

