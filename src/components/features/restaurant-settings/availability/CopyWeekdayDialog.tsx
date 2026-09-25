'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { SettingsDialog } from '../shared/SettingsDialog';
import { pluralise } from '../shared/settingsSaveSequence';
import { DAYS_OF_WEEK } from '../types';
import { WEEK_ORDER } from './availabilityPageDraft';

type CopyWeekdayDialogProps = {
  fromDay: number | null;
  onOpenChange: (open: boolean) => void;
  onCopy: (fromDay: number, toDays: number[]) => void;
};

export function CopyWeekdayDialog({ fromDay, onOpenChange, onCopy }: CopyWeekdayDialogProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [lastFromDay, setLastFromDay] = useState(fromDay);
  if (fromDay !== lastFromDay) {
    setLastFromDay(fromDay);
    setSelected([]);
  }
  if (fromDay === null) {
    return null;
  }
  const dayName = DAYS_OF_WEEK[fromDay];
  return (
    <SettingsDialog
      open
      onOpenChange={onOpenChange}
      title={`Copy ${dayName}’s times`}
      description="Copies open or closed, opening hours, lunch and dinner. Notes and slot options stay as they are."
      testId="availability-copy-day-dialog"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selected.length === 0}
            onClick={() => onCopy(fromDay, selected)}
          >
            {selected.length > 0 ? `Copy to ${pluralise(selected.length, 'day')}` : 'Choose days'}
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">Copy to</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WEEK_ORDER.map((day) => {
            const id = `availability-copy-day-${day}`;
            const isSource = day === fromDay;
            return (
              <div key={day} className="flex min-h-11 items-center gap-2">
                <Checkbox
                  id={id}
                  checked={isSource || selected.includes(day)}
                  disabled={isSource}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked === true ? [...current, day] : current.filter((item) => item !== day),
                    )
                  }
                />
                <Label htmlFor={id}>{DAYS_OF_WEEK[day]}</Label>
              </div>
            );
          })}
        </div>
      </fieldset>
    </SettingsDialog>
  );
}
