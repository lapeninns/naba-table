'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ServicePeriodFormValue = {
  id?: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
};

export type ServicePeriodsFormProps = {
  value: ServicePeriodFormValue[];
  disabled?: boolean;
  onChange: (next: ServicePeriodFormValue[]) => void;
};

const DAY_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'All days' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function updateRow(values: ServicePeriodFormValue[], index: number, patch: Partial<ServicePeriodFormValue>) {
  return values.map((row, idx) => (idx === index ? { ...row, ...patch } : row));
}

export function ServicePeriodsForm({ value, disabled = false, onChange }: ServicePeriodsFormProps) {
  const handleAdd = () => {
    onChange([
      ...value,
      {
        id: undefined,
        name: 'New period',
        dayOfWeek: null,
        startTime: '17:00',
        endTime: '21:00',
      },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Service periods help define seating windows (e.g. lunch vs dinner). Leave empty if you don’t use time slots.
        </p>
        <Button type="button" size="sm" onClick={handleAdd} disabled={disabled}>
          Add period
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="min-w-full divide-y divide-border" role="grid">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">Name</th>
              <th scope="col" className="px-4 py-3 text-left">Day</th>
              <th scope="col" className="px-4 py-3 text-left">Start</th>
              <th scope="col" className="px-4 py-3 text-left">End</th>
              <th scope="col" className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70 text-sm">
            {value.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No service periods configured.
                </td>
              </tr>
            ) : (
              value.map((period, index) => (
                <tr key={period.id ?? `period-${index}`}>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <Label htmlFor={`period-${index}-name`} className="sr-only">
                        Period name
                      </Label>
                      <Input
                        id={`period-${index}-name`}
                        value={period.name}
                        onChange={(event) =>
                          onChange(updateRow(value, index, { name: event.target.value }))
                        }
                        disabled={disabled}
                        placeholder="Period name"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <Label htmlFor={`period-${index}-day`} className="sr-only">
                        Day of week
                      </Label>
                      <select
                        id={`period-${index}-day`}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        value={period.dayOfWeek ?? ''}
                        onChange={(event) =>
                          onChange(
                            updateRow(value, index, {
                              dayOfWeek: event.target.value === '' ? null : Number(event.target.value),
                            }),
                          )
                        }
                        disabled={disabled}
                      >
                        {DAY_OPTIONS.map((option) => (
                          <option key={option.label} value={option.value ?? ''}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <Label htmlFor={`period-${index}-start`} className="sr-only">
                        Start time
                      </Label>
                      <Input
                        id={`period-${index}-start`}
                        type="time"
                        step={900}
                        value={period.startTime}
                        onChange={(event) =>
                          onChange(updateRow(value, index, { startTime: event.target.value }))
                        }
                        disabled={disabled}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <Label htmlFor={`period-${index}-end`} className="sr-only">
                        End time
                      </Label>
                      <Input
                        id={`period-${index}-end`}
                        type="time"
                        step={900}
                        value={period.endTime}
                        onChange={(event) =>
                          onChange(updateRow(value, index, { endTime: event.target.value }))
                        }
                        disabled={disabled}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleRemove(index)}
                      disabled={disabled}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
