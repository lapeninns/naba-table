'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { SettingsDialog } from '@/components/features/restaurant-settings/shared';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';

import { TableInventoryCapacityFields } from './TableInventoryCapacityFields';
import { TableInventoryClassificationFields } from './TableInventoryClassificationFields';
import {
  buildTableFormDraft,
  getFirstInvalidTableField,
  parseTableFormPayload,
  type TableFormErrors,
  type TableFormField,
} from './tableInventoryFormDomain';
import { type TableFormState, type TableZone } from './tableInventoryModel';
import { TableInventoryPlacementFields } from './TableInventoryPlacementFields';

import type { TableInventory } from '@/services/ops/tables';

const TABLE_FORM_ID = 'table-inventory-form';
const DETAIL_FIELDS: ReadonlyArray<TableFormField> = ['section', 'notes'];

function focusField(field: TableFormField) {
  window.setTimeout(() => {
    document.getElementById(field)?.focus();
  }, 0);
}

export type TableInventoryFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: TableInventory | null;
  onSubmit: (payload: TableFormState) => void;
  isSaving: boolean;
  zones: Pick<TableZone, 'id' | 'name' | 'active'>[];
  isZonesLoading: boolean;
  /** Zone to preselect for a new table. */
  preferredZoneId?: string | null;
  /** Server-side table number error, e.g. a duplicate number (HTTP 409). */
  tableNumberError?: string | null;
};

/**
 * Add or edit one table. Saves on "Save table"; a failed save keeps the dialog open with the
 * details still filled in. Mount it with a fresh `key` per opening so it starts from the table.
 */
export function TableInventoryForm({
  open,
  onOpenChange,
  table,
  onSubmit,
  isSaving,
  zones,
  isZonesLoading,
  preferredZoneId = null,
  tableNumberError = null,
}: TableInventoryFormProps) {
  const [draft] = useState(() => buildTableFormDraft(table, zones, preferredZoneId));
  const [zoneId, setZoneId] = useState<string | undefined>(draft.zoneId);
  const [category, setCategory] = useState(draft.category);
  const [seatingType, setSeatingType] = useState(draft.seatingType);
  const [mobility, setMobility] = useState(draft.mobility);
  const [status, setStatus] = useState(draft.status);
  const [active, setActive] = useState(draft.active);
  const [detailsOpen, setDetailsOpen] = useState(
    () => table?.status === 'out_of_service' || Boolean(table?.notes || table?.section),
  );
  const [errors, setErrors] = useState<TableFormErrors>({});

  // Zones can arrive after the dialog opens (first load, or a zone just added).
  useEffect(() => {
    if (zoneId || zones.length === 0) return;
    setZoneId(buildTableFormDraft(null, zones, preferredZoneId).zoneId);
  }, [preferredZoneId, zoneId, zones]);

  useEffect(() => {
    if (tableNumberError) {
      focusField('tableNumber');
    }
  }, [tableNumberError]);

  const shownErrors: TableFormErrors = tableNumberError
    ? { ...errors, tableNumber: errors.tableNumber ?? tableNumberError }
    : errors;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const result = parseTableFormPayload(new FormData(event.currentTarget), {
      zoneId,
      category,
      seatingType,
      mobility,
      status,
      active,
    });

    if (!result.ok) {
      setErrors(result.errors);
      const first = getFirstInvalidTableField(result.errors);
      if (first) {
        if (DETAIL_FIELDS.includes(first)) setDetailsOpen(true);
        focusField(first);
      }
      return;
    }

    setErrors({});
    onSubmit(result.payload);
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={table ? `Edit table ${table.tableNumber}` : 'Add table'}
      description="Saves as soon as you select Save table."
      size="lg"
      testId="table-inventory-dialog"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={TABLE_FORM_ID} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save table'}
          </Button>
        </>
      }
    >
      <FormRoot id={TABLE_FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <TableInventoryCapacityFields table={table} errors={shownErrors} />
        <TableInventoryPlacementFields
          active={active}
          isZonesLoading={isZonesLoading}
          setActive={setActive}
          setZoneId={setZoneId}
          zoneId={zoneId}
          zones={zones}
          zoneError={shownErrors.zoneId}
        />
        <TableInventoryClassificationFields
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          category={category}
          mobility={mobility}
          seatingType={seatingType}
          setCategory={setCategory}
          setMobility={setMobility}
          setSeatingType={setSeatingType}
          setStatus={setStatus}
          status={status}
          table={table}
          errors={shownErrors}
        />
      </FormRoot>
    </SettingsDialog>
  );
}
