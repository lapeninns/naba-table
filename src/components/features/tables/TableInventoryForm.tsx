'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormRoot } from '@/components/ui/form';

import { TableInventoryCapacityFields } from './TableInventoryCapacityFields';
import { TableInventoryClassificationFields } from './TableInventoryClassificationFields';
import {
  buildTableFormDraft,
  getSelectedTableZone,
  parseTableFormPayload,
} from './tableInventoryFormDomain';
import { type TableFormState, type TableZone } from './tableInventoryModel';
import { TableInventoryPlacementFields } from './TableInventoryPlacementFields';

import type { TableInventory } from '@/services/ops/tables';

export function TableInventoryForm({
  table,
  onClose,
  onSubmit,
  isSaving,
  zones,
  isZonesLoading,
  isFirstTable,
}: {
  table: TableInventory | null;
  onClose: () => void;
  onSubmit: (payload: TableFormState) => void;
  isSaving: boolean;
  zones: Pick<TableZone, 'id' | 'name' | 'active'>[];
  isZonesLoading: boolean;
  isFirstTable: boolean;
}) {
  const [zoneId, setZoneId] = useState<string | undefined>(table?.zoneId);
  const [category, setCategory] = useState<TableInventory['category']>(table?.category ?? 'dining');
  const [seatingType, setSeatingType] = useState<TableInventory['seatingType']>(
    table?.seatingType ?? 'standard',
  );
  const [mobility, setMobility] = useState<TableInventory['mobility']>(
    table?.mobility ?? 'movable',
  );
  const [status, setStatus] = useState<TableInventory['status']>(table?.status ?? 'available');
  const [active, setActive] = useState<boolean>(table?.active ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const isZoneSelectDisabled = zones.length === 0;

  useEffect(() => {
    const draft = buildTableFormDraft(table, zones);
    setZoneId(draft.zoneId);
    setCategory(draft.category);
    setSeatingType(draft.seatingType);
    setMobility(draft.mobility);
    setStatus(draft.status);
    setActive(draft.active);
    setFormError(null);
  }, [table, zones]);

  const selectedZone = getSelectedTableZone(zones, zoneId);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = parseTableFormPayload(new FormData(event.currentTarget), {
      zoneId,
      category,
      seatingType,
      mobility,
      status,
      active,
    });

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    onSubmit(result.payload);
  };

  return (
    <FormRoot onSubmit={handleSubmit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{table ? 'Edit table' : 'Add new table'}</DialogTitle>
        <DialogDescription>
          {isFirstTable
            ? 'Start with table number and capacity. You can add more zones and advanced details later.'
            : 'Configure seating capacity and availability for this table.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 max-h-[70vh] overflow-y-auto pr-4">
        <TableInventoryCapacityFields table={table} />
        <TableInventoryPlacementFields
          active={active}
          isZoneSelectDisabled={isZoneSelectDisabled}
          isZonesLoading={isZonesLoading}
          selectedZone={selectedZone}
          setActive={setActive}
          setZoneId={setZoneId}
          zoneId={zoneId}
          zones={zones}
        />
        <TableInventoryClassificationFields
          category={category}
          isFirstTable={isFirstTable}
          mobility={mobility}
          seatingType={seatingType}
          setCategory={setCategory}
          setMobility={setMobility}
          setSeatingType={setSeatingType}
          setStatus={setStatus}
          status={status}
          table={table}
        />
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Table was not saved</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || isZoneSelectDisabled}>
          {isSaving ? 'Saving...' : 'Save table'}
        </Button>
      </DialogFooter>
    </FormRoot>
  );
}
