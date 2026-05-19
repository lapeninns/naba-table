'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

import {
  MONTH_OPTIONS,
  buildAvailabilityRules,
  createEmptyOccasionForm,
  createRuleDraft,
  describeRuleDraft,
  formatAvailabilitySummary,
  isServiceWindowOccasion,
  toRuleDrafts,
  type OccasionFormErrors,
  type OccasionFormState,
  type RuleDraft,
} from './availabilityOccasionsModel';
import { ConfirmDialog } from './ConfirmDialog';
import { TurnBandsEditor, describeTurnBands, type TurnBandRowError } from './TurnBandsEditor';

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
    const nextOrder =
      sortedOccasions.length > 0
        ? Math.max(...sortedOccasions.map((item) => item.displayOrder)) + 10
        : 10;
    setEditingKey(null);
    setForm({ ...createEmptyOccasionForm(), displayOrder: nextOrder });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openForEdit = (occasion: OpsOccasion) => {
    setEditingKey(occasion.key);
    setForm({
      key: occasion.key,
      label: occasion.label,
      shortLabel: occasion.shortLabel,
      description: occasion.description ?? '',
      defaultDurationMinutes: occasion.defaultDurationMinutes,
      displayOrder: occasion.displayOrder,
      availabilityRules: toRuleDrafts(occasion.availability),
      isActive: occasion.isActive,
      turnBands: (turnBands?.[occasion.key] ?? []).map((band) => ({ ...band })),
    });
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

    const errors: OccasionFormErrors = {};
    if (!form.label.trim()) {
      errors.label = 'Label is required';
    }
    if (!editingKey && !form.key.trim()) {
      errors.key = 'Key is required';
    }
    if (!editingKey && form.key.trim() && !/^[a-z0-9_-]+$/.test(form.key.trim())) {
      errors.key = 'Use lowercase letters, numbers, dashes, and underscores';
    }

    const availabilityBuild = buildAvailabilityRules(form.availabilityRules);
    if (!availabilityBuild.valid) {
      errors.availability = availabilityBuild.error;
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || !availabilityBuild.valid) {
      return;
    }

    const submittedKey = editingKey ?? form.key.trim();

    if (editingKey) {
      onChange(
        sortedOccasions.map((occasion) =>
          occasion.key === editingKey
            ? {
                ...occasion,
                label: form.label.trim(),
                shortLabel: form.shortLabel.trim() || form.label.trim(),
                description: form.description.trim() || null,
                availability: availabilityBuild.rules,
                defaultDurationMinutes: form.defaultDurationMinutes,
                displayOrder: form.displayOrder,
                isActive: form.isActive,
              }
            : occasion,
        ),
      );
    } else {
      onChange([
        ...sortedOccasions,
        {
          key: form.key.trim(),
          label: form.label.trim(),
          shortLabel: form.shortLabel.trim() || form.label.trim(),
          description: form.description.trim() || null,
          availability: availabilityBuild.rules,
          defaultDurationMinutes: form.defaultDurationMinutes,
          displayOrder: form.displayOrder,
          isActive: form.isActive,
          isBuiltin: false,
          createdAt: null,
          updatedAt: null,
          deletedAt: null,
          createdBy: null,
          updatedBy: null,
        },
      ]);
    }

    if (onTurnBandsChange && submittedKey) {
      onTurnBandsChange(submittedKey, form.turnBands);
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

  const updateRule = (ruleId: string, patch: Partial<RuleDraft>) => {
    setForm((current) => ({
      ...current,
      availabilityRules: current.availabilityRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule,
      ),
    }));
  };

  const replaceRuleKind = (ruleId: string, kind: RuleDraft['kind']) => {
    setForm((current) => ({
      ...current,
      availabilityRules: current.availabilityRules.map((rule) =>
        rule.id === ruleId ? { ...createRuleDraft(kind), id: rule.id } : rule,
      ),
    }));
  };

  const removeRule = (ruleId: string) => {
    setForm((current) => {
      const nextRules = current.availabilityRules.filter((rule) => rule.id !== ruleId);
      return {
        ...current,
        availabilityRules: nextRules.length > 0 ? nextRules : [createRuleDraft('anytime')],
      };
    });
  };

  const addSpecificDate = (ruleId: string) => {
    setForm((current) => ({
      ...current,
      availabilityRules: current.availabilityRules.map((rule) => {
        if (rule.id !== ruleId || !rule.pendingDate) {
          return rule;
        }
        return {
          ...rule,
          specificDates: Array.from(new Set([...rule.specificDates, rule.pendingDate])).sort(),
          pendingDate: '',
        };
      }),
    }));
  };

  const removeSpecificDate = (ruleId: string, date: string) => {
    setForm((current) => ({
      ...current,
      availabilityRules: current.availabilityRules.map((rule) =>
        rule.id === ruleId
          ? { ...rule, specificDates: rule.specificDates.filter((value) => value !== date) }
          : rule,
      ),
    }));
  };

  const toggleMonth = (ruleId: string, month: number) => {
    setForm((current) => ({
      ...current,
      availabilityRules: current.availabilityRules.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }
        const hasMonth = rule.months.includes(month);
        return {
          ...rule,
          months: hasMonth
            ? rule.months.filter((value) => value !== month)
            : [...rule.months, month].sort((left, right) => left - right),
        };
      }),
    }));
  };

  return (
    <section id="booking-occasions" className="scroll-mt-28 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Booking types</p>
          <p className="text-sm text-muted-foreground">
            Control the guest-facing booking types without leaving the availability workflow.
          </p>
        </div>
        <Button type="button" onClick={openForCreate}>
          New booking type
        </Button>
      </div>

      {sortedOccasions.length === 0 ? (
        <OpsEmptyState
          title="No booking types configured yet"
          description="Add the booking moments guests can choose from during reservation."
          className="min-h-[180px] bg-muted/20 px-6 py-10"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Label</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dining duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOccasions.map((occasion) => {
                const isServiceWindow = isServiceWindowOccasion(occasion.key);
                return (
                  <TableRow
                    key={occasion.key}
                    id={`occasion-row-${occasion.key}`}
                    className="scroll-mt-28"
                  >
                    <TableCell className="space-y-1 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{occasion.label}</span>
                        {isServiceWindow ? (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            Service window
                          </Badge>
                        ) : null}
                        {occasion.isBuiltin ? <Badge variant="secondary">Builtin</Badge> : null}
                      </div>
                      <p className="text-xs font-normal text-muted-foreground">
                        {occasion.shortLabel}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatAvailabilitySummary(occasion.availability)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`occasion-${occasion.key}-active`}
                          aria-label={`Toggle ${occasion.label}`}
                          checked={occasion.isActive}
                          onCheckedChange={(checked) => toggleOccasion(occasion.key, checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {occasion.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {describeTurnBands(
                        turnBands?.[occasion.key],
                        `${occasion.defaultDurationMinutes} min (default)`,
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => openForEdit(occasion)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={occasion.isBuiltin}
                        onClick={() => handleDelete(occasion)}
                        className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (!open ? closeDialog() : setDialogOpen(true))}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingKey ? 'Edit booking type' : 'New booking type'}</DialogTitle>
            <DialogDescription>
              {editingKey && isServiceWindowOccasion(editingKey)
                ? 'This booking type also defines a service window. Adjust its label, turn times, and related settings here — the window itself (day-by-day on/off and start/end) lives in the Weekly schedule tab above.'
                : 'Define how the booking type appears in booking flows and when guests can select it.'}
            </DialogDescription>
          </DialogHeader>
          <FormRoot className="space-y-5" onSubmit={handleSubmit}>
            {!editingKey ? (
              <div className="space-y-1">
                <Label htmlFor="availability-occasion-key">Key</Label>
                <Input
                  id="availability-occasion-key"
                  value={form.key}
                  onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
                  placeholder="e.g., birthday"
                  aria-invalid={Boolean(formErrors.key)}
                />
                {formErrors.key ? (
                  <p className="text-xs text-destructive">{formErrors.key}</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="availability-occasion-label">Label</Label>
                <Input
                  id="availability-occasion-label"
                  value={form.label}
                  onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                  aria-invalid={Boolean(formErrors.label)}
                />
                {formErrors.label ? (
                  <p className="text-xs text-destructive">{formErrors.label}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="availability-occasion-short">Short label</Label>
                <Input
                  id="availability-occasion-short"
                  value={form.shortLabel}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, shortLabel: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="availability-occasion-description">Description</Label>
              <Textarea
                id="availability-occasion-description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="availability-occasion-duration">Default table time (minutes)</Label>
                <Input
                  id="availability-occasion-duration"
                  type="number"
                  min={1}
                  value={form.defaultDurationMinutes}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      defaultDurationMinutes: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="availability-occasion-order">Display order</Label>
                <Input
                  id="availability-occasion-order"
                  type="number"
                  value={form.displayOrder}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, displayOrder: Number(event.target.value) }))
                  }
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Availability rules</p>
                  <p className="text-sm text-muted-foreground">
                    Describe when guests should be able to choose this occasion.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      availabilityRules: [...current.availabilityRules, createRuleDraft('anytime')],
                    }))
                  }
                >
                  <Plus className="mr-2 size-4" />
                  Add rule
                </Button>
              </div>

              <div className="space-y-3">
                {form.availabilityRules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">Rule {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRule(rule.id)}
                        disabled={form.availabilityRules.length === 1}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Remove
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <Label>Rule type</Label>
                      <Select
                        value={rule.kind}
                        onValueChange={(value) =>
                          replaceRuleKind(rule.id, value as RuleDraft['kind'])
                        }
                      >
                        <SelectTrigger aria-label={`Rule ${index + 1} type`}>
                          <SelectValue placeholder="Choose a rule type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="anytime">Always available</SelectItem>
                          <SelectItem value="time_window">Only during a time window</SelectItem>
                          <SelectItem value="month_only">Only in selected months</SelectItem>
                          <SelectItem value="date_range">Only in a date range</SelectItem>
                          <SelectItem value="specific_dates">Only on specific dates</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {rule.kind === 'anytime' ? (
                      <p className="text-sm text-muted-foreground">
                        Guests can choose this occasion at any time the restaurant is taking
                        bookings.
                      </p>
                    ) : null}

                    {rule.kind === 'time_window' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Start time</Label>
                          <Input
                            type="time"
                            value={rule.start}
                            onChange={(event) => updateRule(rule.id, { start: event.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>End time</Label>
                          <Input
                            type="time"
                            value={rule.end}
                            onChange={(event) => updateRule(rule.id, { end: event.target.value })}
                          />
                        </div>
                      </div>
                    ) : null}

                    {rule.kind === 'month_only' ? (
                      <div className="space-y-2">
                        <Label>Available months</Label>
                        <div className="flex flex-wrap gap-2">
                          {MONTH_OPTIONS.map((month) => {
                            const selected = rule.months.includes(month.value);
                            return (
                              <Button
                                key={month.value}
                                type="button"
                                variant={selected ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => toggleMonth(rule.id, month.value)}
                              >
                                {month.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {rule.kind === 'date_range' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Start date</Label>
                          <Input
                            type="date"
                            value={rule.rangeStart}
                            onChange={(event) =>
                              updateRule(rule.id, { rangeStart: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>End date</Label>
                          <Input
                            type="date"
                            value={rule.rangeEnd}
                            onChange={(event) =>
                              updateRule(rule.id, { rangeEnd: event.target.value })
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    {rule.kind === 'specific_dates' ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="min-w-[180px] flex-1 space-y-1">
                            <Label>Add date</Label>
                            <Input
                              type="date"
                              value={rule.pendingDate}
                              onChange={(event) =>
                                updateRule(rule.id, { pendingDate: event.target.value })
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addSpecificDate(rule.id)}
                          >
                            Add date
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rule.specificDates.map((date) => (
                            <Button
                              key={date}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeSpecificDate(rule.id, date)}
                              className="h-auto rounded-full px-3 py-1 text-sm text-foreground hover:border-destructive/40 hover:bg-destructive/5"
                            >
                              {date}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <p className="text-xs text-muted-foreground">
                      Preview: {describeRuleDraft(rule)}
                    </p>
                  </div>
                ))}
              </div>

              {formErrors.availability ? (
                <p className="text-xs text-destructive">{formErrors.availability}</p>
              ) : null}

              <div className="rounded-md border border-dashed border-border/70 bg-background/80 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Guest-facing summary
                </p>
                <p className="mt-1 text-sm text-foreground">{availabilityPreview}</p>
              </div>
            </div>

            {onTurnBandsChange ? (
              <div className="space-y-3 rounded-lg border border-border/70 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Dining durations by party size
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {editingKey && isServiceWindowOccasion(editingKey)
                      ? `How long tables are held for each party size inside the ${form.label || editingKey} service window. Leave empty to fall back to `
                      : 'Override the default duration above with per-party-size bands. Leave empty to fall back to '}
                    <span className="font-medium text-foreground">
                      {form.defaultDurationMinutes} min
                    </span>
                    .
                  </p>
                </div>
                <TurnBandsEditor
                  bands={form.turnBands}
                  defaults={editingKey ? (turnBandDefaults?.[editingKey] ?? []) : undefined}
                  errors={editingKey ? turnBandErrors?.[editingKey] : undefined}
                  fallbackLabel={`Defaults to ${form.defaultDurationMinutes} min for every party size.`}
                  onChange={(next) => setForm((prev) => ({ ...prev, turnBands: next }))}
                  dense
                />
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Switch
                id="availability-occasion-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="availability-occasion-active" className="text-sm">
                Active
              </Label>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit">{editingKey ? 'Update occasion' : 'Add occasion'}</Button>
            </DialogFooter>
          </FormRoot>
        </DialogContent>
      </Dialog>

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
