'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

import { AVAILABILITY_ANCHORS } from './availabilityAnchors';
import { AvailabilityOccasionDialog } from './AvailabilityOccasionDialog';
import {
  buildOccasionSubmitResult,
  createOccasionFormForCreate,
  createOccasionFormForEdit,
  createOccasionFromSubmitValues,
  updateOccasionFromSubmitValues,
} from './availabilityOccasionsDomain';
import {
  buildAvailabilityRules,
  createEmptyOccasionForm,
  formatAvailabilitySummary,
  type OccasionFormErrors,
  type OccasionFormState,
} from './availabilityOccasionsModel';
import { AvailabilityOccasionsTable } from './AvailabilityOccasionsTable';
import { ConfirmDialog } from './ConfirmDialog';

import type { TurnBandRowError } from './turnBandsDomain';
import type { OpsOccasion } from '@/services/ops/occasions';
import type { TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

type AvailabilityOccasionsEditorProps = {
  occasions: OpsOccasion[];
  onChange: (next: OpsOccasion[]) => void;
  turnBands?: TurnBandsPayload;
  turnBandDefaults?: TurnBandsPayload;
  turnBandErrors?: Record<string, TurnBandRowError[]>;
  onTurnBandsChange?: (optionKey: string, next: TurnBandInput[]) => void;
};

export function AvailabilityOccasionsEditor({
  occasions,
  onChange,
  turnBands,
  turnBandDefaults,
  turnBandErrors,
  onTurnBandsChange,
}: AvailabilityOccasionsEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<OccasionFormState>(() => createEmptyOccasionForm());
  const [formErrors, setFormErrors] = useState<OccasionFormErrors>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);

  const sortedOccasions = useMemo(
    () =>
      [...occasions].sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0)),
    [occasions],
  );
  const availabilityPreview = useMemo(() => {
    const result = buildAvailabilityRules(form.availabilityRules);
    return result.valid
      ? formatAvailabilitySummary(result.rules)
      : 'Finish the rule details to preview how guests will see this occasion.';
  }, [form.availabilityRules]);

  const openForCreate = () => {
    setEditingKey(null);
    setForm(createOccasionFormForCreate(sortedOccasions));
    setFormErrors({});
    setDialogOpen(true);
  };

  const openForEdit = (occasion: OpsOccasion) => {
    setEditingKey(occasion.key);
    setForm(
      createOccasionFormForEdit(
        occasion,
        (turnBands?.[occasion.key] ?? []).map((band) => ({ ...band })),
      ),
    );
    setFormErrors({});
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(createEmptyOccasionForm());
    setEditingKey(null);
    setFormErrors({});
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = buildOccasionSubmitResult(form, editingKey);
    if (!result.ok) {
      setFormErrors(result.errors);
      return;
    }

    setFormErrors({});

    if (editingKey) {
      onChange(
        sortedOccasions.map((occasion) =>
          occasion.key === editingKey
            ? updateOccasionFromSubmitValues(occasion, result.values)
            : occasion,
        ),
      );
    } else {
      onChange([...sortedOccasions, createOccasionFromSubmitValues(result.values)]);
    }

    if (onTurnBandsChange) {
      onTurnBandsChange(result.submittedKey, form.turnBands);
    }

    closeDialog();
  };

  const handleDelete = (occasion: OpsOccasion) => {
    if (occasion.isBuiltin) {
      return;
    }
    setPendingDeleteKey(occasion.key);
  };

  const confirmDelete = () => {
    if (!pendingDeleteKey) return;
    onChange(sortedOccasions.filter((item) => item.key !== pendingDeleteKey));
    if (onTurnBandsChange) {
      onTurnBandsChange(pendingDeleteKey, []);
    }
    setPendingDeleteKey(null);
  };

  const pendingDeleteOccasion = pendingDeleteKey
    ? (sortedOccasions.find((item) => item.key === pendingDeleteKey) ?? null)
    : null;

  const toggleOccasion = (targetKey: string, nextActive: boolean) => {
    onChange(
      sortedOccasions.map((occasion) =>
        occasion.key === targetKey ? { ...occasion, isActive: nextActive } : occasion,
      ),
    );
  };

  return (
    <section
      id={AVAILABILITY_ANCHORS.bookingOccasions}
      className="flex scroll-mt-28 flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Text variant="label">Booking types</Text>
          <Text variant="caption">
            Control the guest-facing booking types without leaving the availability workflow.
          </Text>
        </div>
        <Button type="button" onClick={openForCreate}>
          New booking type
        </Button>
      </div>

      <AvailabilityOccasionsTable
        occasions={sortedOccasions}
        turnBands={turnBands}
        onDelete={handleDelete}
        onEdit={openForEdit}
        onToggleActive={toggleOccasion}
      />

      <AvailabilityOccasionDialog
        availabilityPreview={availabilityPreview}
        editingKey={editingKey}
        form={form}
        formErrors={formErrors}
        open={dialogOpen}
        showTurnBands={Boolean(onTurnBandsChange)}
        turnBandDefaults={turnBandDefaults}
        turnBandErrors={turnBandErrors}
        onFormChange={setForm}
        onOpenChange={(open) => (!open ? closeDialog() : setDialogOpen(true))}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={pendingDeleteKey != null}
        onOpenChange={(next) => {
          if (!next) setPendingDeleteKey(null);
        }}
        title="Delete occasion?"
        description={
          pendingDeleteOccasion
            ? `"${pendingDeleteOccasion.label}" will be removed from the occasion list. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete occasion"
        tone="destructive"
        onConfirm={confirmDelete}
      />
    </section>
  );
}
