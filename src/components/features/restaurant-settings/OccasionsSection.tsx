'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useOccasionService } from '@/contexts/ops-services';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { queryKeys } from '@/lib/query/keys';

import { ConfirmDialog } from './ConfirmDialog';
import { SettingsCard } from './shared';

import type { OpsOccasion } from '@/services/ops/occasions';

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

export function OccasionsSection() {
  const occasionService = useOccasionService();
  const queryClient = useQueryClient();
  const occasionQuery = useOpsOccasions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OpsOccasion | null>(null);

  const occasions = useMemo(() => occasionQuery.data ?? [], [occasionQuery.data]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.opsOccasions.list() });

  const createMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const availability = safeParseAvailability(payload.availability);
      return occasionService.createOccasion({
        key: payload.key.trim(),
        label: payload.label.trim(),
        shortLabel: payload.shortLabel.trim() || payload.label.trim(),
        description: payload.description.trim() || null,
        availability,
        defaultDurationMinutes: payload.defaultDurationMinutes,
        displayOrder: payload.displayOrder,
        isActive: payload.isActive,
      });
    },
    onSuccess: async () => {
      await invalidate();
      closeDialog();
    },
    onError: (error: unknown) => {
      console.error('[occasions] create failed', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, payload }: { key: string; payload: FormState }) => {
      const availability = safeParseAvailability(payload.availability);
      return occasionService.updateOccasion(key, {
        label: payload.label.trim(),
        shortLabel: payload.shortLabel.trim() || payload.label.trim(),
        description: payload.description.trim() || null,
        availability,
        defaultDurationMinutes: payload.defaultDurationMinutes,
        displayOrder: payload.displayOrder,
        isActive: payload.isActive,
      });
    },
    onSuccess: async () => {
      await invalidate();
      closeDialog();
    },
    onError: (error: unknown) => {
      console.error('[occasions] update failed', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => occasionService.deleteOccasion(key),
    onSuccess: async () => {
      await invalidate();
      setPendingDelete(null);
    },
    onError: (error: unknown) => {
      console.error('[occasions] delete failed', error);
    },
  });

  const toggleMutation = useMutation<
    unknown,
    unknown,
    { key: string; isActive: boolean },
    { previous?: OpsOccasion[] }
  >({
    mutationFn: async ({ key, isActive }) => occasionService.updateOccasion(key, { isActive }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.opsOccasions.list() });
      const previous = queryClient.getQueryData<OpsOccasion[]>(queryKeys.opsOccasions.list());
      if (previous) {
        queryClient.setQueryData<OpsOccasion[]>(queryKeys.opsOccasions.list(), (current) =>
          (current ?? []).map((occasion) =>
            occasion.key === variables.key
              ? { ...occasion, isActive: variables.isActive }
              : occasion,
          ),
        );
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.opsOccasions.list(), context.previous);
      }
      console.error('[occasions] toggle failed', error);
    },
    onSettled: invalidate,
  });

  const openForCreate = () => {
    const nextOrder =
      occasions.length > 0 ? Math.max(...occasions.map((item) => item.displayOrder)) + 10 : 10;
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
    if (!form.label.trim()) errors.label = 'Label is required';
    if (!editingKey && !form.key.trim()) errors.key = 'Key is required';
    if (!editingKey && !/^[a-z0-9_-]+$/.test(form.key.trim()))
      errors.key = 'Use lowercase letters, numbers, dashes, underscores';

    const availabilityResult = tryValidateAvailability(form.availability);
    if (!availabilityResult.valid) {
      errors.availability = availabilityResult.error;
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (editingKey) {
      updateMutation.mutate({ key: editingKey, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (occasion: OpsOccasion) => {
    if (occasion.isBuiltin) {
      return;
    }
    setPendingDelete(occasion);
  };

  return (
    <SettingsCard
      title="Booking types"
      description="Control which booking types are available to staff and guests."
      headerAction={<Button onClick={openForCreate}>New booking type</Button>}
    >
      {occasionQuery.isLoading ? (
        <LoadingRows />
      ) : occasions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No booking types configured yet.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Label</TableHead>
                <TableHead>Short</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {occasions.map((occasion) => (
                <TableRow key={occasion.key}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {occasion.label}
                    {occasion.isBuiltin && <Badge variant="secondary">Builtin</Badge>}
                  </TableCell>
                  <TableCell>{occasion.shortLabel}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        aria-label={`Toggle ${occasion.label}`}
                        checked={occasion.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ key: occasion.key, isActive: checked })
                        }
                      />
                      <span className="text-sm text-muted-foreground">
                        {occasion.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{occasion.defaultDurationMinutes} min</TableCell>
                  <TableCell className="text-right space-x-2">
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (!open ? closeDialog() : setDialogOpen(true))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingKey ? 'Edit booking type' : 'New booking type'}</DialogTitle>
            <DialogDescription>
              Define how the booking type appears in booking flows.
            </DialogDescription>
          </DialogHeader>
          <FormRoot className="space-y-4" onSubmit={handleSubmit}>
            {!editingKey && (
              <div className="space-y-1">
                <Label htmlFor="occasion-key">Key</Label>
                <Input
                  id="occasion-key"
                  value={form.key}
                  onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
                  placeholder="e.g., birthday"
                  aria-invalid={Boolean(formErrors.key)}
                />
                {formErrors.key && <p className="text-xs text-destructive">{formErrors.key}</p>}
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="occasion-label">Label</Label>
              <Input
                id="occasion-label"
                value={form.label}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                aria-invalid={Boolean(formErrors.label)}
              />
              {formErrors.label && <p className="text-xs text-destructive">{formErrors.label}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="occasion-short">Short label</Label>
              <Input
                id="occasion-short"
                value={form.shortLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, shortLabel: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="occasion-description">Description</Label>
              <Textarea
                id="occasion-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="occasion-duration">Default duration (minutes)</Label>
                <Input
                  id="occasion-duration"
                  type="number"
                  min={1}
                  value={form.defaultDurationMinutes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, defaultDurationMinutes: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="occasion-order">Display order</Label>
                <Input
                  id="occasion-order"
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, displayOrder: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="occasion-availability">Availability rules (JSON array)</Label>
              <Textarea
                id="occasion-availability"
                value={form.availability}
                onChange={(e) => setForm((prev) => ({ ...prev, availability: e.target.value }))}
                rows={5}
                aria-invalid={Boolean(formErrors.availability)}
              />
              {formErrors.availability && (
                <p className="text-xs text-destructive">{formErrors.availability}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {
                  'Use rules like { kind: "anytime" } or time_window/month_only/specific_dates. Leave empty for always available.'
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="occasion-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="occasion-active" className="text-sm">
                Active
              </Label>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingKey ? 'Save changes' : 'Create'}
              </Button>
            </DialogFooter>
          </FormRoot>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        title="Delete booking type?"
        description={
          pendingDelete
            ? `"${pendingDelete.label}" will be removed from staff and guest booking type options. This cannot be undone.`
            : undefined
        }
        confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete booking type'}
        cancelLabel="Keep booking type"
        tone="destructive"
        onConfirm={() => {
          if (!pendingDelete || deleteMutation.isPending) {
            return;
          }
          deleteMutation.mutate(pendingDelete.key);
        }}
      />
    </SettingsCard>
  );
}

function safeParseAvailability(raw: string): unknown[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(
      '[OccasionsSection] failed to parse availability, defaulting to empty array',
      error,
    );
    return [];
  }
}

function tryValidateAvailability(raw: string): { valid: true } | { valid: false; error: string } {
  if (!raw.trim()) return { valid: true };
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
  if (!value) return defaultAvailability;
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.warn('[OccasionsSection] failed to stringify availability', error);
    return defaultAvailability;
  }
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}
