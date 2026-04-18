'use client';

import { useMemo, useState, type FormEvent } from 'react';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

import type { OpsOccasion } from '@/services/ops/occasions';
import type { OccasionDefinition } from '@reserve/shared/occasions';

const defaultAvailability = '[\n  {"kind": "anytime"}\n]';

const emptyForm = {
  key: '',
  label: '',
  shortLabel: '',
  description: '',
  defaultDurationMinutes: 90,
  displayOrder: 10,
  availability: defaultAvailability,
  isActive: true,
};

type FormState = typeof emptyForm;
type FormErrors = Partial<Record<keyof FormState, string>>;

type AvailabilityOccasionsEditorProps = {
  occasions: OpsOccasion[];
  onChange: (next: OpsOccasion[]) => void;
};

export function AvailabilityOccasionsEditor({
  occasions,
  onChange,
}: AvailabilityOccasionsEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const sortedOccasions = useMemo(
    () => [...occasions].sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0)),
    [occasions],
  );

  const openForCreate = () => {
    const nextOrder =
      sortedOccasions.length > 0
        ? Math.max(...sortedOccasions.map((item) => item.displayOrder)) + 10
        : 10;
    setEditingKey(null);
    setForm({ ...emptyForm, displayOrder: nextOrder });
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
      availability: formatAvailability(occasion.availability),
      isActive: occasion.isActive,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm({ ...emptyForm });
    setEditingKey(null);
    setFormErrors({});
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: FormErrors = {};
    if (!form.label.trim()) {
      errors.label = 'Label is required';
    }
    if (!editingKey && !form.key.trim()) {
      errors.key = 'Key is required';
    }
    if (!editingKey && !/^[a-z0-9_-]+$/.test(form.key.trim())) {
      errors.key = 'Use lowercase letters, numbers, dashes, underscores';
    }

    const availabilityResult = tryValidateAvailability(form.availability);
    if (!availabilityResult.valid) {
      errors.availability = availabilityResult.error;
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    if (editingKey) {
      onChange(
        sortedOccasions.map((occasion) =>
          occasion.key === editingKey
            ? {
                ...occasion,
                label: form.label.trim(),
                shortLabel: form.shortLabel.trim() || form.label.trim(),
                description: form.description.trim() || null,
                availability: safeParseAvailability(form.availability),
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
          availability: safeParseAvailability(form.availability),
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

    closeDialog();
  };

  const handleDelete = (occasion: OpsOccasion) => {
    if (occasion.isBuiltin) {
      return;
    }
    const confirmed = window.confirm(`Delete occasion "${occasion.label}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    onChange(sortedOccasions.filter((item) => item.key !== occasion.key));
  };

  const toggleOccasion = (targetKey: string, nextActive: boolean) => {
    onChange(
      sortedOccasions.map((occasion) =>
        occasion.key === targetKey ? { ...occasion, isActive: nextActive } : occasion,
      ),
    );
  };

  return (
    <section id="booking-occasions" className="scroll-mt-28 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Booking occasions</p>
          <p className="text-sm text-muted-foreground">
            Control the guest-facing occasion tags without leaving the availability workflow.
          </p>
        </div>
        <Button type="button" onClick={openForCreate}>
          New occasion
        </Button>
      </div>

      {sortedOccasions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No occasions configured yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the booking moments guests can choose from during reservation.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Label</TableHead>
                <TableHead>Short</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOccasions.map((occasion) => (
                <TableRow key={occasion.key}>
                  <TableCell className="flex items-center gap-2 font-medium">
                    {occasion.label}
                    {occasion.isBuiltin ? <Badge variant="secondary">Builtin</Badge> : null}
                  </TableCell>
                  <TableCell>{occasion.shortLabel}</TableCell>
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
                  <TableCell>{occasion.defaultDurationMinutes} min</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => openForEdit(occasion)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={occasion.isBuiltin}
                      onClick={() => handleDelete(occasion)}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (!open ? closeDialog() : setDialogOpen(true))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingKey ? 'Edit occasion' : 'New occasion'}</DialogTitle>
            <DialogDescription>Define how the occasion appears in booking flows.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
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
                {formErrors.key ? <p className="text-xs text-destructive">{formErrors.key}</p> : null}
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="availability-occasion-label">Label</Label>
              <Input
                id="availability-occasion-label"
                value={form.label}
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                aria-invalid={Boolean(formErrors.label)}
              />
              {formErrors.label ? <p className="text-xs text-destructive">{formErrors.label}</p> : null}
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
                <Label htmlFor="availability-occasion-duration">Default duration (minutes)</Label>
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
            <div className="space-y-1">
              <Label htmlFor="availability-occasion-rules">Availability rules (JSON array)</Label>
              <Textarea
                id="availability-occasion-rules"
                value={form.availability}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, availability: event.target.value }))
                }
                rows={5}
                aria-invalid={Boolean(formErrors.availability)}
              />
              {formErrors.availability ? (
                <p className="text-xs text-destructive">{formErrors.availability}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Use rules like <code>{'{"kind":"anytime"}'}</code> or{' '}
                <code>time_window</code>, <code>month_only</code>, and{' '}
                <code>specific_dates</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="availability-occasion-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
              <Label htmlFor="availability-occasion-active" className="text-sm">
                Active
              </Label>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit">{editingKey ? 'Update draft' : 'Add draft'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function safeParseAvailability(raw: string): OccasionDefinition['availability'] {
  if (!raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function tryValidateAvailability(raw: string): { valid: true } | { valid: false; error: string } {
  if (!raw.trim()) {
    return { valid: true };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { valid: false, error: 'Availability must be a JSON array' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Availability must be valid JSON' };
  }
}

function formatAvailability(value: unknown): string {
  if (!value) {
    return defaultAvailability;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return defaultAvailability;
  }
}
