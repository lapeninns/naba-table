'use client';

import { useState, type FormEvent } from 'react';

import { SettingsDialog } from '@/components/features/restaurant-settings/shared';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  parseZoneFormPayload,
  ZONE_FORM_LIMITS,
  type ZoneFormErrors,
  type ZoneFormPayload,
} from './tableInventoryFormDomain';
import { getZoneSuccessorId } from './tableRoomDomain';
import { describedBy, TableFieldError } from './TableRoomParts';

import type { TableZone } from './tableInventoryModel';

const ZONE_FORM_ID = 'table-zone-form';
const AT_THE_END = '__end__';

type TableZoneDialogProps = {
  editingZone: TableZone | null;
  /** Zones in page order, for the name check and the position choice. */
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'name'>>;
  isSaving: boolean;
  open: boolean;
  /** Opened from "Add table" with no zones: the new table follows once the zone is added. */
  continuesToTable?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ZoneFormPayload) => void;
};

function getSaveLabel(isEditing: boolean, continuesToTable: boolean) {
  if (isEditing) return 'Save zone';
  return continuesToTable ? 'Add zone and continue' : 'Add zone';
}

/** Mount with a fresh `key` per opening so the fields start from the zone. */
export function TableZoneDialog({
  editingZone,
  zones,
  isSaving,
  open,
  continuesToTable = false,
  onOpenChange,
  onSubmit,
}: TableZoneDialogProps) {
  const [name, setName] = useState(editingZone?.name ?? '');
  const [position, setPosition] = useState(
    () => (editingZone ? getZoneSuccessorId(zones, editingZone.id) : null) ?? AT_THE_END,
  );
  const [errors, setErrors] = useState<ZoneFormErrors>({});
  const others = zones.filter((zone) => zone.id !== editingZone?.id);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const result = parseZoneFormPayload(
      { name, beforeZoneId: position === AT_THE_END ? null : position },
      zones,
      editingZone?.id ?? null,
    );
    if (!result.ok) {
      setErrors(result.errors);
      window.setTimeout(() => document.getElementById('zoneName')?.focus(), 0);
      return;
    }
    setErrors({});
    onSubmit(result.payload);
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingZone ? `Edit ${editingZone.name}` : 'Add zone'}
      description={
        continuesToTable && !editingZone
          ? 'Tables belong to a zone. Add one, then add your table.'
          : 'An area of your room, such as Terrace or Private dining.'
      }
      testId="table-zone-dialog"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={ZONE_FORM_ID} disabled={isSaving}>
            {isSaving ? 'Saving…' : getSaveLabel(Boolean(editingZone), continuesToTable)}
          </Button>
        </>
      }
    >
      <FormRoot id={ZONE_FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-1">
          <Label htmlFor="zoneName" className="text-[13px]">
            Zone name
          </Label>
          <Input
            id="zoneName"
            name="zoneName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Main dining room"
            maxLength={ZONE_FORM_LIMITS.nameMax}
            autoComplete="off"
            aria-invalid={errors.zoneName ? true : undefined}
            aria-describedby={describedBy(errors.zoneName && 'zoneName-error')}
          />
          <TableFieldError id="zoneName-error" message={errors.zoneName} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="zonePosition" className="text-[13px]">
            Position on this page
          </Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger id="zonePosition" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {others.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  Before {zone.name}
                </SelectItem>
              ))}
              <SelectItem value={AT_THE_END}>At the end</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FormRoot>
    </SettingsDialog>
  );
}
