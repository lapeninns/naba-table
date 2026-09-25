import { type Dispatch, type SetStateAction } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { FieldErrorText } from './availability/AvailabilityFields';

import type { OccasionFormErrors, OccasionFormState } from './availabilityOccasionsModel';

type AvailabilityOccasionDetailsFieldsProps = {
  /** `essentials`: name and short name. `advanced`: description, key and display order. */
  part: 'essentials' | 'advanced';
  editingKey: string | null;
  form: OccasionFormState;
  formErrors: OccasionFormErrors;
  onFormChange: Dispatch<SetStateAction<OccasionFormState>>;
};

/** Machine name suggested from the name, in the characters the key allows. */
export function suggestOccasionKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function AvailabilityOccasionDetailsFields({
  part,
  editingKey,
  form,
  formErrors,
  onFormChange,
}: AvailabilityOccasionDetailsFieldsProps) {
  if (part === 'essentials') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="availability-occasion-label">Name</Label>
          <Input
            id="availability-occasion-label"
            value={form.label}
            onChange={(event) => {
              const label = event.target.value;
              onFormChange((prev) => ({
                ...prev,
                label,
                // Until someone types a key, suggest one from the name.
                key:
                  !editingKey && (prev.key === '' || prev.key === suggestOccasionKey(prev.label))
                    ? suggestOccasionKey(label)
                    : prev.key,
              }));
            }}
            aria-invalid={Boolean(formErrors.label) || undefined}
            aria-describedby="availability-occasion-label-error"
          />
          <FieldErrorText id="availability-occasion-label-error" message={formErrors.label} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="availability-occasion-short">
            Short name <span className="font-normal text-muted-foreground">Optional</span>
          </Label>
          <Input
            id="availability-occasion-short"
            value={form.shortLabel}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, shortLabel: event.target.value }))
            }
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="availability-occasion-description">
          Description <span className="font-normal text-muted-foreground">Optional</span>
        </Label>
        <Input
          id="availability-occasion-description"
          value={form.description}
          onChange={(event) =>
            onFormChange((prev) => ({ ...prev, description: event.target.value }))
          }
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="availability-occasion-key">Key</Label>
          <Input
            id="availability-occasion-key"
            value={editingKey ?? form.key}
            readOnly={Boolean(editingKey)}
            onChange={(event) => onFormChange((prev) => ({ ...prev, key: event.target.value }))}
            aria-invalid={Boolean(formErrors.key) || undefined}
            aria-describedby="availability-occasion-key-hint availability-occasion-key-error"
            className="font-mono"
          />
          <p id="availability-occasion-key-hint" className="text-xs text-muted-foreground">
            {editingKey ? 'Can’t be changed.' : 'Machine name. Can’t be changed later.'}
          </p>
          <FieldErrorText id="availability-occasion-key-error" message={formErrors.key} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="availability-occasion-order">Display order</Label>
          <Input
            id="availability-occasion-order"
            type="number"
            inputMode="numeric"
            value={form.displayOrder}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, displayOrder: Number(event.target.value) }))
            }
            className="tabular-nums"
          />
        </div>
      </div>
    </>
  );
}
