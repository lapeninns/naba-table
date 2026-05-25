'use client';

import { type ReactNode } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Label className="text-xs font-medium uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function SwitchField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 p-3">
      <Label className="text-sm font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function NutritionRangeInputs({
  lowerValue,
  upperValue,
  unit,
  onLowerChange,
  onUpperChange,
}: {
  lowerValue: string;
  upperValue: string;
  unit: string;
  onLowerChange: (value: string) => void;
  onUpperChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Input
        type="number"
        min="0"
        value={lowerValue}
        onChange={(event) => onLowerChange(event.target.value)}
        placeholder={`Lower ${unit}`}
      />
      <Input
        type="number"
        min="0"
        value={upperValue}
        onChange={(event) => onUpperChange(event.target.value)}
        placeholder={`Upper ${unit}`}
      />
    </div>
  );
}

export function MultiCheckboxGroup({
  label,
  options,
  values,
  onChange,
  getOptionLabel = (option) => option,
  className,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  onChange: (value: string, checked: boolean) => void;
  getOptionLabel?: (value: string) => string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Label
            key={option}
            className="flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
          >
            <Checkbox
              checked={values.includes(option)}
              onCheckedChange={(checked) => onChange(option, checked === true)}
            />
            <span>{getOptionLabel(option)}</span>
          </Label>
        ))}
      </div>
    </div>
  );
}
