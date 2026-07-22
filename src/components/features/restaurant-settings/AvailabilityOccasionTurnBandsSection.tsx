import { type Dispatch, type SetStateAction } from 'react';

import { Text } from '@/components/ui/typography';

import { isServiceWindowOccasion, type OccasionFormState } from './availabilityOccasionsModel';
import { TurnBandsEditor } from './TurnBandsEditor';

import type { TurnBandRowError } from './turnBandsDomain';
import type { TurnBandsPayload } from '@/services/ops/restaurants';

type AvailabilityOccasionTurnBandsSectionProps = {
  editingKey: string | null;
  form: OccasionFormState;
  showTurnBands: boolean;
  turnBandDefaults?: TurnBandsPayload;
  turnBandErrors?: Record<string, TurnBandRowError[]>;
  onFormChange: Dispatch<SetStateAction<OccasionFormState>>;
};

export function AvailabilityOccasionTurnBandsSection({
  editingKey,
  form,
  showTurnBands,
  turnBandDefaults,
  turnBandErrors,
  onFormChange,
}: AvailabilityOccasionTurnBandsSectionProps) {
  if (!showTurnBands) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 p-4">
      <div className="flex flex-col gap-1">
        <Text variant="label">Dining durations by party size</Text>
        <Text variant="caption">
          {editingKey && isServiceWindowOccasion(editingKey)
            ? `How long tables are held for each party size inside the ${form.label || editingKey} service window. Leave empty to fall back to `
            : 'Override the default duration above with per-party-size bands. Leave empty to fall back to '}
          <span className="font-medium text-foreground">{form.defaultDurationMinutes} min</span>.
        </Text>
      </div>
      <TurnBandsEditor
        bands={form.turnBands}
        defaults={editingKey ? (turnBandDefaults?.[editingKey] ?? []) : undefined}
        errors={editingKey ? turnBandErrors?.[editingKey] : undefined}
        fallbackLabel={`Defaults to ${form.defaultDurationMinutes} min for every party size.`}
        onChange={(next) => onFormChange((prev) => ({ ...prev, turnBands: next }))}
        dense
      />
    </div>
  );
}
