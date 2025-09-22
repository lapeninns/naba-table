"use client";

import React from "react";
import { bookingHelpers } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";
import { Label } from "@/components/reserve/ui-primitives";

export const Field: React.FC<{
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ id, label, required, error, children, className }) => (
  <div className={bookingHelpers.cn("grid w-full items-center gap-1.5", className)}>
    <Label htmlFor={id} className="flex items-center">
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}
    </Label>
    {children}
    {error && (
      <p className="flex items-center gap-1 text-sm text-red-600">
        <Icon.AlertCircle className="h-4 w-4" />
        {error}
      </p>
    )}
  </div>
);
