'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type WeeklyHourFormValue = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  notes: string;
};

export type WeeklyHoursFormProps = {
  timezone: string;
  value: WeeklyHourFormValue[];
  disabled?: boolean;
  onChange: (next: WeeklyHourFormValue[]) => void;
};

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function updateRow(values: WeeklyHourFormValue[], index: number, patch: Partial<WeeklyHourFormValue>) {
  return values.map((row, idx) => (idx === index ? { ...row, ...patch } : row));
}

export function WeeklyHoursForm({ timezone, value, disabled = false, onChange }: WeeklyHoursFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Times are shown in the restaurant’s local timezone ({timezone}).</p>
      <div className="overflow-hidden rounded-xl border">
        <table className="min-w-full divide-y divide-border" role="grid">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">Day</th>
              <th scope="col" className="px-4 py-3 text-left">Open</th>
              <th scope="col" className="px-4 py-3 text-left">Close</th>
              <th scope="col" className="px-4 py-3 text-left">Closed</th>
              <th scope="col" className="px-4 py-3 text-left">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70 text-sm">
            {value.map((entry, index) => {
              const dayLabel = WEEKDAY_LABELS[entry.dayOfWeek] ?? `Day ${entry.dayOfWeek}`;
              const isClosed = entry.isClosed;

              return (
                <tr key={entry.dayOfWeek} className={cn(isClosed ? 'bg-muted/40' : undefined)}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">{dayLabel}</th>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <Label htmlFor={`weekly-${entry.dayOfWeek}-open`} className="sr-only">
                        {dayLabel} open time
                      </Label>
                      <Input
                        id={`weekly-${entry.dayOfWeek}-open`}
                        type="time"
                        step={900}
                        value={entry.opensAt}
                        onChange={(event) => onChange(updateRow(value, index, { opensAt: event.target.value }))}
                        disabled={disabled || isClosed}
                        aria-disabled={disabled || isClosed}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <Label htmlFor={`weekly-${entry.dayOfWeek}-close`} className="sr-only">
                        {dayLabel} close time
                      </Label>
                      <Input
                        id={`weekly-${entry.dayOfWeek}-close`}
                        type="time"
                        step={900}
                        value={entry.closesAt}
                        onChange={(event) => onChange(updateRow(value, index, { closesAt: event.target.value }))}
                        disabled={disabled || isClosed}
                        aria-disabled={disabled || isClosed}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`weekly-${entry.dayOfWeek}-closed`}
                        checked={isClosed}
                        onCheckedChange={(checked) =>
                          onChange(
                            updateRow(value, index, {
                              isClosed: Boolean(checked),
                              opensAt: Boolean(checked) ? '' : entry.opensAt,
                              closesAt: Boolean(checked) ? '' : entry.closesAt,
                            }),
                          )
                        }
                        disabled={disabled}
                      />
                      <Label htmlFor={`weekly-${entry.dayOfWeek}-closed`} className="text-sm">
                        Closed
                      </Label>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <Label htmlFor={`weekly-${entry.dayOfWeek}-notes`} className="sr-only">
                        {dayLabel} notes
                      </Label>
                      <Input
                        id={`weekly-${entry.dayOfWeek}-notes`}
                        placeholder="Optional notes"
                        value={entry.notes}
                        onChange={(event) => onChange(updateRow(value, index, { notes: event.target.value }))}
                        disabled={disabled}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
