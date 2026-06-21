'use client';

import { Plus, Trash2 } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { RestaurantSettingsDatePickerField } from './RestaurantSettingsDatePickerField';
import { type OverrideErrors, type OverrideRow } from './types';

type AvailabilityOverridesEditorProps = {
  onAdd: () => void;
  onChange: (index: number, patch: Partial<OverrideRow>) => void;
  onRemove: (index: number) => void;
  rows: OverrideRow[];
  rowErrors: OverrideErrors;
};

export function AvailabilityOverridesEditor({
  onAdd,
  onChange,
  onRemove,
  rowErrors,
  rows,
}: AvailabilityOverridesEditorProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Holiday and one-off overrides</p>
          <p className="text-sm text-muted-foreground">
            Add closures, shortened service, or extended trading for specific dates.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="size-4" />
          Add override
        </Button>
      </div>

      {rows.length === 0 ? (
        <OpsEmptyState
          title="No date overrides yet"
          description="Add special closures or modified hours when the regular weekly pattern does not apply."
          className="min-h-[180px] bg-muted/20 px-6 py-10"
        />
      ) : (
        rows.map((row, index) => {
          const errors = rowErrors[index] ?? {};
          return (
            <div
              key={row.id ?? `${row.effectiveDate}-${index}`}
              className="rounded-xl border border-border/70 bg-card/30 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Override {index + 1}</p>
                  <p className="text-sm text-muted-foreground">
                    Override the default schedule for one calendar date.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`override-${index}-open`}
                    className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Open
                  </Label>
                  <Switch
                    id={`override-${index}-open`}
                    checked={!row.isClosed}
                    onCheckedChange={(checked) => onChange(index, { isClosed: !checked })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[190px_minmax(0,200px)_minmax(0,1fr)]">
                <RestaurantSettingsDatePickerField
                  id={`override-${index}-date`}
                  label="Date"
                  value={row.effectiveDate}
                  onChange={(effectiveDate) => onChange(index, { effectiveDate })}
                  error={errors.effectiveDate}
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <Label
                      htmlFor={`override-${index}-opens-at`}
                      className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      Opens
                    </Label>
                    <Input
                      id={`override-${index}-opens-at`}
                      name={`override-${index}-opens-at`}
                      type="time"
                      value={row.opensAt}
                      disabled={row.isClosed}
                      onChange={(event) => onChange(index, { opensAt: event.target.value })}
                      aria-invalid={Boolean(errors.opensAt)}
                      className={cn('mt-1', errors.opensAt && 'border-destructive')}
                    />
                    {errors.opensAt ? (
                      <p className="mt-1 text-xs text-destructive">{errors.opensAt}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label
                      htmlFor={`override-${index}-closes-at`}
                      className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      Closes
                    </Label>
                    <Input
                      id={`override-${index}-closes-at`}
                      name={`override-${index}-closes-at`}
                      type="time"
                      value={row.closesAt}
                      disabled={row.isClosed}
                      onChange={(event) => onChange(index, { closesAt: event.target.value })}
                      aria-invalid={Boolean(errors.closesAt)}
                      className={cn('mt-1', errors.closesAt && 'border-destructive')}
                    />
                    {errors.closesAt ? (
                      <p className="mt-1 text-xs text-destructive">{errors.closesAt}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid gap-3 lg:grid-cols-[140px_minmax(0,1fr)]">
                    <div>
                      <Label
                        htmlFor={`override-${index}-interval`}
                        className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        Interval (min)
                      </Label>
                      <Input
                        id={`override-${index}-interval`}
                        name={`override-${index}-interval`}
                        type="number"
                        min={1}
                        max={180}
                        value={row.reservationIntervalMinutes}
                        disabled={row.isClosed}
                        onChange={(event) =>
                          onChange(index, { reservationIntervalMinutes: event.target.value })
                        }
                        aria-invalid={Boolean(errors.reservationIntervalMinutes)}
                        className={cn(
                          'mt-1',
                          errors.reservationIntervalMinutes && 'border-destructive',
                        )}
                      />
                      {errors.reservationIntervalMinutes ? (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.reservationIntervalMinutes}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <Label
                        htmlFor={`override-${index}-slot-times`}
                        className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        Slot times
                      </Label>
                      <Input
                        id={`override-${index}-slot-times`}
                        name={`override-${index}-slot-times`}
                        value={row.reservationSlotTimes}
                        placeholder="12:00, 12:30, 13:00"
                        disabled={row.isClosed}
                        onChange={(event) =>
                          onChange(index, { reservationSlotTimes: event.target.value })
                        }
                        aria-invalid={Boolean(errors.reservationSlotTimes)}
                        className={cn('mt-1', errors.reservationSlotTimes && 'border-destructive')}
                      />
                      {errors.reservationSlotTimes ? (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.reservationSlotTimes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <Label
                      htmlFor={`override-${index}-notes`}
                      className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      Notes
                    </Label>
                    <Input
                      id={`override-${index}-notes`}
                      name={`override-${index}-notes`}
                      value={row.notes}
                      placeholder="Christmas Eve or private event"
                      onChange={(event) => onChange(index, { notes: event.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
