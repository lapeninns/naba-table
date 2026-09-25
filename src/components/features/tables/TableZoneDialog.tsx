'use client';

import { useState, type FormEvent } from 'react';

import { SettingsDialog } from '@/components/features/restaurant-settings/shared';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  parseZoneFormPayload,
  ZONE_FORM_LIMITS,
  type ZoneFormErrors,
  type ZoneFormPayload,
} from './tableInventoryFormDomain';
import { describedBy, TableFieldError } from './TableInventoryParts';

import type { TableZone } from './tableInventoryModel';

const ZONE_FORM_ID = 'table-zone-form';

type TableZoneDialogProps = {
  editingZone: TableZone | null;
  isSaving: boolean;
  open: boolean;
  /** Opened from "Add table" with no zones: the table dialog follows once the zone is added. */
  continuesToTable?: boolean;
  /** Order for a new zone: after the existing zones. */
  nextSortOrder?: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ZoneFormPayload) => void;
};

function getSaveLabel(isEditing: boolean, continuesToTable: boolean) {
  if (isEditing) return 'Save zone';
  return continuesToTable ? 'Add zone and continue' : 'Add zone';
}

export function TableZoneDialog({
  editingZone,
  isSaving,
  open,
  continuesToTable = false,
  nextSortOrder = 0,
  onOpenChange,
  onSubmit,
}: TableZoneDialogProps) {
  const [errors, setErrors] = useState<ZoneFormErrors>({});

  const handleOpenChange = (next: boolean) => {
    if (!next) setErrors({});
    onOpenChange(next);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const result = parseZoneFormPayload(new FormData(event.currentTarget));
    if (!result.ok) {
      setErrors(result.errors);
      const field = result.errors.zoneName ? 'zoneName' : 'zoneSortOrder';
      window.setTimeout(() => document.getElementById(field)?.focus(), 0);
      return;
    }
    setErrors({});
    onSubmit(result.payload);
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={editingZone ? 'Edit zone' : 'Add zone'}
      description={
        continuesToTable && !editingZone
          ? 'Tables belong to a zone. Add one, then add your table.'
          : 'Zones group tables, such as Main dining room or Terrace.'
      }
      testId="table-zone-dialog"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={ZONE_FORM_ID} disabled={isSaving}>
            {isSaving ? 'Saving…' : getSaveLabel(Boolean(editingZone), continuesToTable)}
          </Button>
        </>
      }
    >
      <FormRoot
        // Remount per zone so the fields start from that zone.
        key={editingZone?.id ?? 'new-zone'}
        id={ZONE_FORM_ID}
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="zoneName">Zone name</Label>
          <Input
            id="zoneName"
            name="zoneName"
            defaultValue={editingZone?.name ?? ''}
            placeholder="e.g. Main dining room"
            maxLength={ZONE_FORM_LIMITS.nameMax}
            autoComplete="off"
            aria-invalid={errors.zoneName ? true : undefined}
            aria-describedby={describedBy(errors.zoneName && 'zoneName-error')}
          />
          <TableFieldError id="zoneName-error" message={errors.zoneName} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="zoneSortOrder">Order in lists</Label>
          <Input
            id="zoneSortOrder"
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={ZONE_FORM_LIMITS.sortOrderMin}
            max={ZONE_FORM_LIMITS.sortOrderMax}
            defaultValue={editingZone?.sortOrder ?? nextSortOrder}
            className="max-w-32 tabular-nums"
            aria-invalid={errors.sortOrder ? true : undefined}
            aria-describedby={describedBy(
              'zoneSortOrder-hint',
              errors.sortOrder && 'zoneSortOrder-error',
            )}
          />
          <p id="zoneSortOrder-hint" className="text-xs leading-5 text-muted-foreground">
            Lower numbers appear first.
          </p>
          <TableFieldError id="zoneSortOrder-error" message={errors.sortOrder} />
        </div>
      </FormRoot>
    </SettingsDialog>
  );
}
