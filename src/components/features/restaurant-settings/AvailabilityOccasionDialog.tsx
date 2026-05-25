import { type Dispatch, type FormEvent, type SetStateAction } from 'react';

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

import { AvailabilityOccasionDetailsFields } from './AvailabilityOccasionDetailsFields';
import { AvailabilityOccasionRulesSection } from './AvailabilityOccasionRulesSection';
import {
  isServiceWindowOccasion,
  type OccasionFormErrors,
  type OccasionFormState,
} from './availabilityOccasionsModel';
import { AvailabilityOccasionTurnBandsSection } from './AvailabilityOccasionTurnBandsSection';

import type { TurnBandRowError } from './turnBandsDomain';
import type { TurnBandsPayload } from '@/services/ops/restaurants';

type AvailabilityOccasionDialogProps = {
  availabilityPreview: string;
  editingKey: string | null;
  form: OccasionFormState;
  formErrors: OccasionFormErrors;
  open: boolean;
  showTurnBands: boolean;
  turnBandDefaults?: TurnBandsPayload;
  turnBandErrors?: Record<string, TurnBandRowError[]>;
  onFormChange: Dispatch<SetStateAction<OccasionFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AvailabilityOccasionDialog({
  availabilityPreview,
  editingKey,
  form,
  formErrors,
  open,
  showTurnBands,
  turnBandDefaults,
  turnBandErrors,
  onFormChange,
  onOpenChange,
  onSubmit,
}: AvailabilityOccasionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingKey ? 'Edit booking type' : 'New booking type'}</DialogTitle>
          <DialogDescription>
            {editingKey && isServiceWindowOccasion(editingKey)
              ? 'This booking type also defines a service window. Adjust its label, turn times, and related settings here — the window itself (day-by-day on/off and start/end) lives in the Weekly schedule tab above.'
              : 'Define how the booking type appears in booking flows and when guests can select it.'}
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-5" onSubmit={onSubmit}>
          <AvailabilityOccasionDetailsFields
            editingKey={editingKey}
            form={form}
            formErrors={formErrors}
            onFormChange={onFormChange}
          />

          <AvailabilityOccasionRulesSection
            availabilityPreview={availabilityPreview}
            form={form}
            formErrors={formErrors}
            onFormChange={onFormChange}
          />

          <AvailabilityOccasionTurnBandsSection
            editingKey={editingKey}
            form={form}
            showTurnBands={showTurnBands}
            turnBandDefaults={turnBandDefaults}
            turnBandErrors={turnBandErrors}
            onFormChange={onFormChange}
          />

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingKey ? 'Update occasion' : 'Add occasion'}</Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}
