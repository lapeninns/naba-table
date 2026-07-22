import { type Dispatch, type SetStateAction } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/typography';

import type { OccasionFormErrors, OccasionFormState } from './availabilityOccasionsModel';

type AvailabilityOccasionDetailsFieldsProps = {
  editingKey: string | null;
  form: OccasionFormState;
  formErrors: OccasionFormErrors;
  onFormChange: Dispatch<SetStateAction<OccasionFormState>>;
};

export function AvailabilityOccasionDetailsFields({
  editingKey,
  form,
  formErrors,
  onFormChange,
}: AvailabilityOccasionDetailsFieldsProps) {
  return (
    <>
      {!editingKey ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="availability-occasion-key">Key</Label>
          <Input
            id="availability-occasion-key"
            value={form.key}
            onChange={(event) => onFormChange((prev) => ({ ...prev, key: event.target.value }))}
            placeholder="e.g., birthday"
            aria-invalid={Boolean(formErrors.key)}
          />
          {formErrors.key ? (
            <Text variant="caption" className="text-destructive">
              {formErrors.key}
            </Text>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="availability-occasion-label">Label</Label>
          <Input
            id="availability-occasion-label"
            value={form.label}
            onChange={(event) => onFormChange((prev) => ({ ...prev, label: event.target.value }))}
            aria-invalid={Boolean(formErrors.label)}
          />
          {formErrors.label ? (
            <Text variant="caption" className="text-destructive">
              {formErrors.label}
            </Text>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="availability-occasion-short">Short label</Label>
          <Input
            id="availability-occasion-short"
            value={form.shortLabel}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, shortLabel: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="availability-occasion-description">Description</Label>
        <Textarea
          id="availability-occasion-description"
          value={form.description}
          onChange={(event) =>
            onFormChange((prev) => ({ ...prev, description: event.target.value }))
          }
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="availability-occasion-duration">Default table time (minutes)</Label>
          <Input
            id="availability-occasion-duration"
            type="number"
            min={1}
            value={form.defaultDurationMinutes}
            onChange={(event) =>
              onFormChange((prev) => ({
                ...prev,
                defaultDurationMinutes: Number(event.target.value),
              }))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="availability-occasion-order">Display order</Label>
          <Input
            id="availability-occasion-order"
            type="number"
            value={form.displayOrder}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, displayOrder: Number(event.target.value) }))
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="availability-occasion-active"
          checked={form.isActive}
          onCheckedChange={(checked) => onFormChange((prev) => ({ ...prev, isActive: checked }))}
        />
        <Label htmlFor="availability-occasion-active" className="text-sm">
          Active
        </Label>
      </div>
    </>
  );
}
