'use client';

import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type OverrideFormValue = {
  id?: string;
  effectiveDate: string;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
  notes: string;
};

export type OverridesTableProps = {
  value: OverrideFormValue[];
  disabled?: boolean;
  onChange: (next: OverrideFormValue[]) => void;
};

function updateRow(values: OverrideFormValue[], index: number, patch: Partial<OverrideFormValue>) {
  return values.map((row, idx) => (idx === index ? { ...row, ...patch } : row));
}

function buildNewOverride(): OverrideFormValue {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return {
    effectiveDate: `${year}-${month}-${day}`,
    isClosed: false,
    opensAt: '12:00',
    closesAt: '21:00',
    notes: '',
  };
}

export function OverridesTable({ value, disabled = false, onChange }: OverridesTableProps) {
  const sortedOverrides = useMemo(
    () => [...value].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)),
    [value],
  );

  const handleAdd = () => {
    onChange([...value, buildNewOverride()]);
  };

  const handleRemove = (effectiveDate: string, index: number) => {
    const target = sortedOverrides[index];
    if (!target) return;
    const originalIndex = value.findIndex(
      (item) => item.effectiveDate === target.effectiveDate && item.id === target.id,
    );
    onChange(value.filter((_, idx) => idx !== originalIndex));
  };

  const handleRowChange = (index: number, patch: Partial<OverrideFormValue>) => {
    const target = sortedOverrides[index];
    if (!target) return;
    const originalIndex = value.findIndex(
      (item) => item.effectiveDate === target.effectiveDate && item.id === target.id,
    );
    if (originalIndex === -1) return;
    onChange(updateRow(value, originalIndex, patch));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add overrides for holidays or special events. Closed days leave open/close blank.
        </p>
        <Button type="button" size="sm" onClick={handleAdd} disabled={disabled}>
          Add override
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="min-w-full divide-y divide-border" role="grid">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">Date</th>
              <th scope="col" className="px-4 py-3 text-left">Open</th>
              <th scope="col" className="px-4 py-3 text-left">Close</th>
              <th scope="col" className="px-4 py-3 text-left">Closed</th>
              <th scope="col" className="px-4 py-3 text-left">Notes</th>
              <th scope="col" className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70 text-sm">
            {sortedOverrides.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No overrides configured.
                </td>
              </tr>
            ) : (
              sortedOverrides.map((override, index) => {
                const isClosed = override.isClosed;
                return (
                  <tr key={override.id ?? `override-${override.effectiveDate}-${index}`}>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <Label htmlFor={`override-${index}-date`} className="sr-only">
                          Effective date
                        </Label>
                        <Input
                          id={`override-${index}-date`}
                          type="date"
                          value={override.effectiveDate}
                          onChange={(event) => handleRowChange(index, { effectiveDate: event.target.value })}
                          disabled={disabled}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <Label htmlFor={`override-${index}-open`} className="sr-only">
                          Open time
                        </Label>
                        <Input
                          id={`override-${index}-open`}
                          type="time"
                          step={900}
                          value={override.opensAt}
                          onChange={(event) => handleRowChange(index, { opensAt: event.target.value })}
                          disabled={disabled || isClosed}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <Label htmlFor={`override-${index}-close`} className="sr-only">
                          Close time
                        </Label>
                        <Input
                          id={`override-${index}-close`}
                          type="time"
                          step={900}
                          value={override.closesAt}
                          onChange={(event) => handleRowChange(index, { closesAt: event.target.value })}
                          disabled={disabled || isClosed}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`override-${index}-closed`}
                          checked={override.isClosed}
                          onCheckedChange={(checked) =>
                            handleRowChange(index, {
                              isClosed: Boolean(checked),
                              opensAt: Boolean(checked) ? '' : override.opensAt,
                              closesAt: Boolean(checked) ? '' : override.closesAt,
                            })
                          }
                          disabled={disabled}
                        />
                        <Label htmlFor={`override-${index}-closed`} className="text-sm">
                          Closed
                        </Label>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <Label htmlFor={`override-${index}-notes`} className="sr-only">
                          Notes
                        </Label>
                        <Input
                          id={`override-${index}-notes`}
                          placeholder="Optional notes"
                          value={override.notes}
                          onChange={(event) => handleRowChange(index, { notes: event.target.value })}
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
                        onClick={() => handleRemove(override.effectiveDate, index)}
                        disabled={disabled}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
