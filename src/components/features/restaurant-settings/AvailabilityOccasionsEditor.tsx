'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

import { TOUCH_TARGET_CLASS } from './availability/AvailabilityFields';
import { BOOKING_TYPES_MANAGED_NOTE } from './availability/availabilitySaveErrorCopy';
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
  isServiceWindowOccasion,
  type OccasionFormErrors,
  type OccasionFormState,
} from './availabilityOccasionsModel';
import { ConfirmDialog } from './ConfirmDialog';
import { useSettingsDiscardGuard } from './shared/useSettingsDiscardGuard';
import { validateTurnBandRows, type TurnBandRowError } from './turnBandsDomain';

import type { OpsOccasion } from '@/services/ops/occasions';
import type { TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

/**
 * "1–2 guests 75 min · 3–4 guests 90 min · larger groups 90 min". Parties bigger than every
 * band get the last band's time, as the booking server resolves it.
 */
export function describeTableTimes(
  bands: readonly TurnBandInput[] | undefined,
  defaultBands: readonly TurnBandInput[] | undefined,
  defaultDurationMinutes: number,
): string {
  const own = [...(bands ?? [])].sort((a, b) => Number(a.maxPartySize) - Number(b.maxPartySize));
  const source = own.length > 0 ? own : [...(defaultBands ?? [])];
  if (source.length === 0) {
    return `all party sizes ${defaultDurationMinutes} min`;
  }
  let previous = 0;
  const parts = source.map((band) => {
    const max = Number(band.maxPartySize);
    const range = previous + 1 === max ? `${max}` : `${previous + 1}–${max}`;
    previous = max;
    return `${range} guests ${band.durationMinutes} min`;
  });
  parts.push(`larger groups ${source[source.length - 1]!.durationMinutes} min`);
  return `${parts.join(' · ')}${own.length === 0 ? ' (Nabatable default)' : ''}`;
}

type AvailabilityOccasionsEditorProps = {
  occasions: OpsOccasion[];
  savedOccasions: readonly OpsOccasion[];
  savedTurnBands: TurnBandsPayload;
  onChange: (next: OpsOccasion[]) => void;
  turnBands: TurnBandsPayload;
  turnBandDefaults?: TurnBandsPayload;
  onTurnBandsChange: (optionKey: string, next: TurnBandInput[]) => void;
  /** Opens a booking type's dialog from elsewhere on the page (Needs attention). */
  editRequest?: { key: string; nonce: number } | null;
  /**
   * Nabatable platform admin: may add, edit, turn off and remove booking types (a global
   * catalog). Otherwise the rows are read-only and only this restaurant's table times can change.
   */
  canEditCatalog?: boolean;
};

export function AvailabilityOccasionsEditor({
  occasions,
  savedOccasions,
  savedTurnBands,
  onChange,
  turnBands,
  turnBandDefaults,
  onTurnBandsChange,
  editRequest,
  canEditCatalog = true,
}: AvailabilityOccasionsEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<OccasionFormState>(() => createEmptyOccasionForm());
  const [initialForm, setInitialForm] = useState<OccasionFormState | null>(null);
  const [formErrors, setFormErrors] = useState<OccasionFormErrors>({});
  const [bandErrors, setBandErrors] = useState<TurnBandRowError[] | undefined>(undefined);
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
      : 'Finish the rule details to preview how guests will see this booking type.';
  }, [form.availabilityRules]);

  const openForCreate = () => {
    const nextForm = createOccasionFormForCreate(sortedOccasions);
    setEditingKey(null);
    setForm(nextForm);
    setInitialForm(nextForm);
    setFormErrors({});
    setBandErrors(undefined);
    setDialogOpen(true);
  };

  const openForEdit = (occasion: OpsOccasion) => {
    const nextForm = createOccasionFormForEdit(
      occasion,
      (turnBands[occasion.key] ?? []).map((band) => ({ ...band })),
    );
    setEditingKey(occasion.key);
    setForm(nextForm);
    setInitialForm(nextForm);
    setFormErrors({});
    setBandErrors(undefined);
    setDialogOpen(true);
  };

  // Each request carries a new nonce; the ref keeps later draft changes from reopening it.
  const handledRequestRef = useRef<number | null>(null);
  useEffect(() => {
    if (!editRequest || handledRequestRef.current === editRequest.nonce) return;
    handledRequestRef.current = editRequest.nonce;
    const occasion = occasions.find((item) => item.key === editRequest.key);
    if (occasion) {
      openForEdit(occasion);
    }
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setInitialForm(null);
    setEditingKey(null);
    setFormErrors({});
    setBandErrors(undefined);
  };

  const isFormDirty =
    dialogOpen && initialForm !== null && JSON.stringify(form) !== JSON.stringify(initialForm);
  const { guardOpenChange } = useSettingsDiscardGuard(
    'availability-booking-type-dialog',
    isFormDirty,
    'Discard your changes to this booking type?',
  );

  const handleSubmit = () => {
    if (!canEditCatalog) {
      // Table times only: the booking type itself is not changed.
      const bands = validateTurnBandRows(form.turnBands);
      if (!bands.ok || !editingKey) {
        setBandErrors(bands.ok ? undefined : bands.errors);
        return;
      }
      onTurnBandsChange(editingKey, form.turnBands);
      closeDialog();
      return;
    }
    const result = buildOccasionSubmitResult(form, editingKey);
    const bands = validateTurnBandRows(form.turnBands);
    if (
      !result.ok ||
      !bands.ok ||
      (!editingKey && sortedOccasions.some((item) => item.key === form.key.trim()))
    ) {
      const errors = result.ok ? {} : { ...result.errors };
      if (!editingKey && sortedOccasions.some((item) => item.key === form.key.trim())) {
        errors.key = 'This key is already used';
      }
      setFormErrors(errors);
      setBandErrors(bands.ok ? undefined : bands.errors);
      return;
    }
    const occasion = editingKey
      ? sortedOccasions.find((item) => item.key === editingKey)
      : undefined;
    onChange(
      occasion
        ? sortedOccasions.map((item) =>
            item.key === editingKey ? updateOccasionFromSubmitValues(item, result.values) : item,
          )
        : [...sortedOccasions, createOccasionFromSubmitValues(result.values)],
    );
    onTurnBandsChange(result.submittedKey, form.turnBands);
    closeDialog();
  };

  const confirmDelete = () => {
    if (!pendingDeleteKey) return;
    onChange(sortedOccasions.filter((item) => item.key !== pendingDeleteKey));
    onTurnBandsChange(pendingDeleteKey, []);
    setPendingDeleteKey(null);
    document.querySelector<HTMLButtonElement>('[data-booking-type-add]')?.focus();
  };

  const pendingDeleteOccasion = pendingDeleteKey
    ? (sortedOccasions.find((item) => item.key === pendingDeleteKey) ?? null)
    : null;

  return (
    <div className="flex flex-col">
      {canEditCatalog ? (
        <div className="flex justify-end px-4 pb-3 sm:px-5">
          <Button
            type="button"
            variant="outline"
            className={TOUCH_TARGET_CLASS}
            onClick={openForCreate}
            data-booking-type-add
          >
            <Plus data-icon="inline-start" aria-hidden />
            Add booking type
          </Button>
        </div>
      ) : (
        <p
          className="px-4 pb-3 text-sm text-muted-foreground sm:px-5"
          data-testid="booking-types-managed-note"
        >
          {BOOKING_TYPES_MANAGED_NOTE} You can change the table times for each one.
        </p>
      )}
      {sortedOccasions.length === 0 ? (
        <div className="flex flex-col gap-1 border-t border-border/60 px-4 py-6 sm:px-5">
          <p className="font-medium text-foreground">No booking types</p>
          <p className="text-sm text-muted-foreground">
            Create Lunch and Dinner to start offering meal times.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {sortedOccasions.map((occasion) => {
            const saved = savedOccasions.find((item) => item.key === occasion.key);
            const state = !saved
              ? 'Added'
              : JSON.stringify(saved) !== JSON.stringify(occasion) ||
                  JSON.stringify(savedTurnBands[occasion.key] ?? []) !==
                    JSON.stringify(turnBands[occasion.key] ?? [])
                ? 'Edited'
                : null;
            const switchId = `availability-occasion-${occasion.key}-active`;
            return (
              <li
                key={occasion.key}
                className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span>{occasion.label}</span>
                    {isServiceWindowOccasion(occasion.key) ? (
                      <Badge variant="secondary">Required for meal times</Badge>
                    ) : null}
                    {occasion.isActive ? null : <Badge variant="outline">Off</Badge>}
                    {state ? <Badge variant="status-pending">{state}</Badge> : null}
                  </div>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Table time:</span>{' '}
                    {describeTableTimes(
                      turnBands[occasion.key],
                      turnBandDefaults?.[occasion.key],
                      occasion.defaultDurationMinutes,
                    )}
                  </p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Available:</span>{' '}
                    {formatAvailabilitySummary(occasion.availability)}
                  </p>
                </div>
                {canEditCatalog ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={switchId}
                      checked={occasion.isActive}
                      aria-label={`${occasion.label} available to book`}
                      onCheckedChange={(checked) =>
                        onChange(
                          sortedOccasions.map((item) =>
                            item.key === occasion.key ? { ...item, isActive: checked } : item,
                          ),
                        )
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {occasion.isActive ? 'On' : 'Off'}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {occasion.isActive ? 'Available to book' : 'Not available to book'}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={TOUCH_TARGET_CLASS}
                    aria-label={
                      canEditCatalog
                        ? `Edit ${occasion.label}`
                        : `Edit table times for ${occasion.label}`
                    }
                    onClick={() => openForEdit(occasion)}
                  >
                    {canEditCatalog ? 'Edit' : 'Table times'}
                  </Button>
                  {!canEditCatalog || occasion.isBuiltin ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={TOUCH_TARGET_CLASS}
                      aria-label={`Remove ${occasion.label}`}
                      onClick={() => setPendingDeleteKey(occasion.key)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AvailabilityOccasionDialog
        availabilityPreview={availabilityPreview}
        editingKey={editingKey}
        form={form}
        formErrors={formErrors}
        open={dialogOpen}
        turnBandDefaults={turnBandDefaults}
        turnBandErrors={bandErrors}
        onFormChange={setForm}
        onOpenChange={guardOpenChange((open) => (!open ? closeDialog() : setDialogOpen(true)))}
        onSubmit={handleSubmit}
        mode={canEditCatalog ? 'full' : 'tableTimes'}
      />

      <ConfirmDialog
        open={pendingDeleteKey != null}
        onOpenChange={(next) => {
          if (!next) setPendingDeleteKey(null);
        }}
        title={
          pendingDeleteOccasion ? `Remove ${pendingDeleteOccasion.label}?` : 'Remove booking type?'
        }
        description={
          pendingDeleteOccasion
            ? `${pendingDeleteOccasion.label} will be removed for every restaurant when you save. It can only be removed while no upcoming booking or meal time uses it; if one does, it is kept and the save tells you why. Past bookings keep their type. To keep it, choose Cancel or turn it off instead.`
            : undefined
        }
        confirmLabel="Remove booking type"
        tone="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
