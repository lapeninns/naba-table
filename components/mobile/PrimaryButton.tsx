"use client";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = ButtonProps & { asChild?: boolean };

export default function PrimaryButton({ className, children, ...props }: Props) {
  return (
    <Button
      variant="primary"
      size="primary"
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

