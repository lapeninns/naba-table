import { ChevronRight } from 'lucide-react';
import { type Dispatch, type SetStateAction } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { FieldErrorText, MinutesStepper } from './availability/AvailabilityFields';
import { AvailabilityOccasionDetailsFields } from './AvailabilityOccasionDetailsFields';
import { AvailabilityOccasionRulesSection } from './AvailabilityOccasionRulesSection';
import {
  isServiceWindowOccasion,
  type OccasionFormErrors,
  type OccasionFormState,
} from './availabilityOccasionsModel';
import { SettingsDialog } from './shared/SettingsDialog';
import { TurnBandsEditor } from './TurnBandsEditor';

import type { TurnBandRowError } from './turnBandsDomain';
import type { TurnBandsPayload } from '@/services/ops/restaurants';

type AvailabilityOccasionDialogProps = {
  availabilityPreview: string;
  editingKey: string | null;
  form: OccasionFormState;
  formErrors: OccasionFormErrors;
  open: boolean;
  turnBandDefaults?: TurnBandsPayload;
  turnBandErrors?: TurnBandRowError[];
  onFormChange: Dispatch<SetStateAction<OccasionFormState>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
};

const disclosureSummaryClass =
  'inline-flex cursor-pointer list-none items-center gap-1.5 py-1 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden';

/**
 * Add or edit a booking type. Changes go into the Availability page draft and are saved with
 * the page.
 */
export function AvailabilityOccasionDialog({
  availabilityPreview,
  editingKey,
  form,
  formErrors,
  open,
  turnBandDefaults,
  turnBandErrors,
  onFormChange,
  onOpenChange,
  onSubmit,
}: AvailabilityOccasionDialogProps) {
  const rulesOpen =
    Boolean(formErrors.availability) ||
    form.availabilityRules.some((rule) => rule.kind !== 'anytime');
  const bandError = turnBandErrors?.some((row) => Object.keys(row).length > 0)
    ? 'Each party size needs a whole number of guests and minutes, and each party size must be different.'
    : undefined;
  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editingKey ? `Edit ${form.label || 'booking type'}` : 'Add booking type'}
      description="Changes apply when you save the page."
      testId="availability-booking-type-dialog"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit}>
            {editingKey ? 'Update booking type' : 'Add booking type'}
          </Button>
        </>
      }
    >
      <AvailabilityOccasionDetailsFields
        part="essentials"
        editingKey={editingKey}
        form={form}
        formErrors={formErrors}
        onFormChange={onFormChange}
      />
      <div className="flex items-center gap-3">
        <Switch
          id="availability-occasion-active"
          checked={form.isActive}
          onCheckedChange={(checked) => onFormChange((prev) => ({ ...prev, isActive: checked }))}
        />
        <Label htmlFor="availability-occasion-active">Guests and staff can book this</Label>
      </div>
      {editingKey && isServiceWindowOccasion(editingKey) && !form.isActive ? (
        <p className="rounded-md bg-muted/60 px-3 py-2.5 text-sm">
          <span className="font-medium">{form.label} is off.</span>{' '}
          <span className="text-muted-foreground">
            Your {form.label.toLowerCase()} meal times still decide which times guests can request.
          </span>
        </p>
      ) : null}
      <MinutesStepper
        errorKey="occasion-duration"
        label="Table time"
        labelText="Table time"
        value={String(form.defaultDurationMinutes)}
        step={15}
        min={1}
        max={1440}
        hint="Used for any party size without its own table time below."
        onChange={(value) =>
          onFormChange((prev) => ({ ...prev, defaultDurationMinutes: Number(value) }))
        }
        onBlur={() => {}}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">
          Table time by party size
        </legend>
        <TurnBandsEditor
          bands={form.turnBands}
          defaults={editingKey ? (turnBandDefaults?.[editingKey] ?? []) : undefined}
          errors={turnBandErrors}
          fallbackLabel={`No party-size table times. Every party gets ${form.defaultDurationMinutes} min.`}
          onChange={(next) => onFormChange((prev) => ({ ...prev, turnBands: next }))}
          dense
        />
        <FieldErrorText id="availability-occasion-bands-error" message={bandError} />
      </fieldset>
      <details className="group" open={rulesOpen || undefined}>
        <summary className={disclosureSummaryClass}>
          <ChevronRight
            className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden
          />
          When guests can choose it
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Available only when every rule matches.</p>
          <AvailabilityOccasionRulesSection
            availabilityPreview={availabilityPreview}
            form={form}
            formErrors={formErrors}
            onFormChange={onFormChange}
          />
        </div>
      </details>
      <details className="group" open={Boolean(formErrors.key) || undefined}>
        <summary className={disclosureSummaryClass}>
          <ChevronRight
            className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden
          />
          Advanced
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <AvailabilityOccasionDetailsFields
            part="advanced"
            editingKey={editingKey}
            form={form}
            formErrors={formErrors}
            onFormChange={onFormChange}
          />
        </div>
      </details>
    </SettingsDialog>
  );
}
