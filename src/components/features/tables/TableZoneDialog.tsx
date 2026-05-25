import { type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { parseZoneFormPayload, type ZoneFormPayload } from './tableInventoryFormDomain';

import type { TableZone } from './tableInventoryModel';

type TableZoneDialogProps = {
  editingZone: TableZone | null;
  isSaving: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ZoneFormPayload) => void;
};

export function TableZoneDialog({
  editingZone,
  isSaving,
  open,
  onOpenChange,
  onSubmit,
}: TableZoneDialogProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = parseZoneFormPayload(new FormData(event.currentTarget));
    if (!payload) {
      return;
    }
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <FormRoot onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{editingZone ? 'Edit zone' : 'Add zone'}</DialogTitle>
            <DialogDescription>
              Zones help segment your dining room into manageable sections.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="zoneName">Zone name *</Label>
              <Input
                id="zoneName"
                name="zoneName"
                defaultValue={editingZone?.name ?? ''}
                placeholder="e.g. Main Dining"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zoneSortOrder">Sort order</Label>
              <Input
                id="zoneSortOrder"
                name="sortOrder"
                type="number"
                defaultValue={editingZone?.sortOrder ?? 0}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first in the list. Defaults to 0.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save zone'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}
