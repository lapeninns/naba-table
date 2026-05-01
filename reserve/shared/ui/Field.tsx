'use client';

import { AlertCircle } from 'lucide-react';

import { cn } from '@shared/lib/cn';
import { Label } from '@shared/ui/label';

import type { PropsWithChildren, ReactNode } from 'react';

export type FieldProps = PropsWithChildren<{
  id: string;
  label: string | ReactNode;
  required?: boolean;
  error?: string;
  className?: string;
}>;

export function Field({ id, label, required, error, className, children }: FieldProps) {
  return (
    <div className={cn('grid w-full items-center gap-1.5', className)}>
      <Label htmlFor={id} className="flex items-center">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
