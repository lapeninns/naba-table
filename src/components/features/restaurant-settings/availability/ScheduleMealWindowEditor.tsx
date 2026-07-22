'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import type { DayServiceConfig } from '../servicePeriodsMapper';

type ScheduleMealWindowEditorProps = {
  disabled: boolean;
  errors?: { end?: string; start?: string };
  idPrefix: string;
  label: string;
  meal: DayServiceConfig['lunch'];
  onChange: (field: 'startTime' | 'endTime', value: string) => void;
  onToggle: (value: boolean) => void;
};

export function ScheduleMealWindowEditor({
  disabled,
  errors,
  idPrefix,
  label,
  meal,
  onChange,
  onToggle,
}: ScheduleMealWindowEditorProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Text variant="label">{label}</Text>
          <Text variant="caption">Booked inside the operating window.</Text>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-enabled`} className="text-xs text-muted-foreground">
            Active
          </Label>
          <Switch
            id={`${idPrefix}-enabled`}
            checked={meal.enabled}
            disabled={disabled}
            onCheckedChange={onToggle}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label
            htmlFor={`${idPrefix}-start`}
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >
            Start
          </Label>
          <Input
            id={`${idPrefix}-start`}
            name={`${idPrefix}-start`}
            type="time"
            value={meal.startTime}
            disabled={disabled || !meal.enabled}
            onChange={(event) => onChange('startTime', event.target.value)}
            aria-invalid={Boolean(errors?.start)}
            className={cn('mt-1', errors?.start && 'border-destructive')}
          />
          {errors?.start ? (
            <Text variant="caption" className="mt-1 text-destructive">
              {errors.start}
            </Text>
          ) : null}
        </div>
        <div>
          <Label
            htmlFor={`${idPrefix}-end`}
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >
            End
          </Label>
          <Input
            id={`${idPrefix}-end`}
            name={`${idPrefix}-end`}
            type="time"
            value={meal.endTime}
            disabled={disabled || !meal.enabled}
            onChange={(event) => onChange('endTime', event.target.value)}
            aria-invalid={Boolean(errors?.end)}
            className={cn('mt-1', errors?.end && 'border-destructive')}
          />
          {errors?.end ? (
            <Text variant="caption" className="mt-1 text-destructive">
              {errors.end}
            </Text>
          ) : null}
        </div>
      </div>
    </div>
  );
}
