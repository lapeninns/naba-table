'use client';

import { AlertTriangle, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { availabilityFieldId } from './availabilityPageValidation';

import type { ReactNode } from 'react';

/** 44px targets on touch screens; 36px controls stay compact on desktop. */
export const TOUCH_TARGET_CLASS =
  '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

export function FieldErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return <p id={id} className="sr-only" />;
  }
  return (
    <p id={id} className="flex items-start gap-1.5 text-xs font-medium text-destructive">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

type AvailabilityTimeFieldProps = {
  errorKey: string;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
};

/** 24-hour time input with its error below, linked through `aria-describedby`. */
export function AvailabilityTimeField({
  errorKey,
  label,
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: AvailabilityTimeFieldProps) {
  const id = availabilityFieldId(errorKey);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        step={300}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={`${id}-error`}
        className={cn('tabular-nums', TOUCH_TARGET_CLASS)}
      />
      <FieldErrorText id={`${id}-error`} message={error} />
    </div>
  );
}

type MinutesStepperProps = {
  errorKey: string;
  label: ReactNode;
  /** Plain label for the step buttons' accessible names. */
  labelText: string;
  value: string;
  step: number;
  min: number;
  max: number;
  hint?: ReactNode;
  error?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
};

/** Whole minutes with − / + buttons. The typed value is kept as text until it is saved. */
export function MinutesStepper({
  errorKey,
  label,
  labelText,
  value,
  step,
  min,
  max,
  hint,
  error,
  placeholder,
  onChange,
  onBlur,
}: MinutesStepperProps) {
  const id = availabilityFieldId(errorKey);
  const current = Number.parseInt(value, 10);
  const stepBy = (delta: number) => {
    const base = Number.isFinite(current) ? current : min;
    onChange(String(Math.min(max, Math.max(min, base + delta))));
    onBlur();
  };
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={TOUCH_TARGET_CLASS}
          aria-label={`Decrease ${labelText.toLowerCase()} by ${step} minutes`}
          onClick={() => stepBy(-step)}
        >
          <Minus aria-hidden />
        </Button>
        <Input
          id={id}
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={`${id}-hint ${id}-error`}
          className={cn('w-20 text-center tabular-nums', TOUCH_TARGET_CLASS)}
        />
        <span className="text-sm text-muted-foreground">min</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={TOUCH_TARGET_CLASS}
          aria-label={`Increase ${labelText.toLowerCase()} by ${step} minutes`}
          onClick={() => stepBy(step)}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">
        {hint}
      </p>
      <FieldErrorText id={`${id}-error`} message={error} />
    </div>
  );
}
