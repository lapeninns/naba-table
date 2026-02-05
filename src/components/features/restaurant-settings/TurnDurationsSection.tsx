'use client';

import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTurnBands, useOpsUpdateTurnBands } from '@/hooks/ops/useOpsTurnBands';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';

import type { TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

type TurnDurationsSectionProps = {
  restaurantId: string | null;
};

type RowError = {
  maxPartySize?: string;
  durationMinutes?: string;
};

type OptionMeta = {
  key: string;
  label: string;
  description?: string | null;
  displayOrder?: number | null;
};

function normalizePayload(payload: TurnBandsPayload): TurnBandsPayload {
  const normalized: TurnBandsPayload = {};
  Object.entries(payload ?? {}).forEach(([key, rows]) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const cleaned = rows
      .map((row) => ({
        maxPartySize: Number(row.maxPartySize),
        durationMinutes: Number(row.durationMinutes),
      }))
      .filter((row) => Number.isFinite(row.maxPartySize) && Number.isFinite(row.durationMinutes))
      .sort((a, b) => a.maxPartySize - b.maxPartySize);
    if (cleaned.length > 0) {
      normalized[key] = cleaned;
    }
  });
  return normalized;
}

function serializePayload(payload: TurnBandsPayload): string {
  const normalized = normalizePayload(payload);
  const sortedKeys = Object.keys(normalized).sort();
  const sorted: TurnBandsPayload = {};
  sortedKeys.forEach((key) => {
    sorted[key] = normalized[key] ?? [];
  });
  return JSON.stringify(sorted);
}

function validatePayload(payload: TurnBandsPayload): { ok: boolean; errors: Record<string, RowError[]> } {
  const errors: Record<string, RowError[]> = {};

  Object.entries(payload ?? {}).forEach(([optionKey, rows]) => {
    if (!rows || rows.length === 0) return;
    const optionErrors: RowError[] = [];
    const seenSizes = new Map<number, number[]>();

    rows.forEach((row, index) => {
      const rowErrors: RowError = {};
      const size = Number(row.maxPartySize);
      const duration = Number(row.durationMinutes);

      if (!Number.isInteger(size) || size <= 0) {
        rowErrors.maxPartySize = 'Enter a positive whole number.';
      } else {
        const occurrences = seenSizes.get(size) ?? [];
        occurrences.push(index);
        seenSizes.set(size, occurrences);
      }

      if (!Number.isInteger(duration) || duration <= 0) {
        rowErrors.durationMinutes = 'Enter a positive whole number.';
      }

      optionErrors[index] = rowErrors;
    });

    seenSizes.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((index) => {
          optionErrors[index] = {
            ...optionErrors[index],
            maxPartySize: 'Max party size must be unique.',
          };
        });
      }
    });

    if (optionErrors.some((error) => Object.keys(error).length > 0)) {
      errors[optionKey] = optionErrors;
    }
  });

  return { ok: Object.keys(errors).length === 0, errors };
}

function sortRows(rows: TurnBandInput[]): TurnBandInput[] {
  return [...rows].sort((a, b) => a.maxPartySize - b.maxPartySize);
}

export function TurnDurationsSection({ restaurantId }: TurnDurationsSectionProps) {
  const turnBandsQuery = useOpsTurnBands(restaurantId);
  const updateMutation = useOpsUpdateTurnBands(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const occasionsQuery = useOpsOccasions();

  const [draft, setDraft] = useState<TurnBandsPayload>({});
  const [errors, setErrors] = useState<Record<string, RowError[]>>({});

  const baselineSerialized = useMemo(
    () => serializePayload(turnBandsQuery.data?.bands ?? {}),
    [turnBandsQuery.data?.bands],
  );
  const draftSerialized = useMemo(() => serializePayload(draft), [draft]);
  const isDirty = baselineSerialized !== draftSerialized;

  useEffect(() => {
    if (!restaurantId || !turnBandsQuery.data) return;
    if (isDirty) return;
    setDraft(turnBandsQuery.data.bands ?? {});
    setErrors({});
  }, [restaurantId, turnBandsQuery.data, isDirty]);

  const optionMeta = useMemo(() => {
    const map = new Map<string, OptionMeta>();
    (occasionsQuery.data ?? []).forEach((occasion) => {
      map.set(occasion.key, {
        key: occasion.key,
        label: occasion.label ?? occasion.key,
        description: occasion.description ?? null,
        displayOrder: occasion.displayOrder ?? null,
      });
    });
    return map;
  }, [occasionsQuery.data]);

  const optionKeys = useMemo(() => {
    const keys = new Set<string>();
    (servicePeriodsQuery.data ?? []).forEach((period) => keys.add(period.bookingOption));
    Object.keys(turnBandsQuery.data?.bands ?? {}).forEach((key) => keys.add(key));
    keys.add('lunch');
    keys.add('dinner');
    return Array.from(keys);
  }, [servicePeriodsQuery.data, turnBandsQuery.data?.bands]);

  const optionList = useMemo(() => {
    const defaults = turnBandsQuery.data?.defaults ?? {};
    return optionKeys
      .map((key) => {
        const meta = optionMeta.get(key);
        return {
          key,
          label: meta?.label ?? key.replace(/(^|_)([a-z])/g, (_, _p, letter) => letter.toUpperCase()),
          description: meta?.description ?? null,
          displayOrder: meta?.displayOrder ?? null,
          defaults: defaults[key] ?? [],
        };
      })
      .sort((a, b) => {
        const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label);
      });
  }, [optionKeys, optionMeta, turnBandsQuery.data?.defaults]);

  const updateRow = useCallback((optionKey: string, index: number, field: keyof TurnBandInput, value: number) => {
    setDraft((prev) => {
      const rows = [...(prev[optionKey] ?? [])];
      const current = rows[index] ?? { maxPartySize: 0, durationMinutes: 0 };
      rows[index] = { ...current, [field]: value };
      return { ...prev, [optionKey]: rows };
    });
  }, []);

  const applySortedRows = useCallback((optionKey: string) => {
    setDraft((prev) => {
      const rows = prev[optionKey];
      if (!rows || rows.length < 2) return prev;
      return { ...prev, [optionKey]: sortRows(rows) };
    });
  }, []);

  const addRow = useCallback((optionKey: string, defaults: TurnBandInput[]) => {
    setDraft((prev) => {
      const rows = prev[optionKey] ?? [];
      const last = rows[rows.length - 1];
      const defaultSeed = defaults[0] ?? null;
      const nextMax = last?.maxPartySize ? last.maxPartySize + 2 : defaultSeed?.maxPartySize ?? 2;
      const nextDuration = last?.durationMinutes ?? defaultSeed?.durationMinutes ?? 0;
      const updated = [...rows, { maxPartySize: nextMax, durationMinutes: nextDuration }];
      return { ...prev, [optionKey]: sortRows(updated) };
    });
    setErrors((prev) => ({ ...prev, [optionKey]: [] }));
  }, []);

  const removeRow = useCallback((optionKey: string, index: number) => {
    setDraft((prev) => {
      const rows = [...(prev[optionKey] ?? [])];
      rows.splice(index, 1);
      if (rows.length === 0) {
        const next = { ...prev };
        delete next[optionKey];
        return next;
      }
      return { ...prev, [optionKey]: rows };
    });
    setErrors((prev) => ({ ...prev, [optionKey]: [] }));
  }, []);

  const resetAll = useCallback(async () => {
    if (!restaurantId) return;
    if (!window.confirm('Reset all custom durations back to defaults?')) {
      return;
    }
    try {
      const snapshot = await updateMutation.mutateAsync({});
      setDraft(snapshot.bands ?? {});
      setErrors({});
    } catch (error) {
      console.error('[turn-durations] reset failed', error);
    }
  }, [restaurantId, updateMutation]);

  const handleSave = useCallback(async () => {
    if (!restaurantId) return;
    const payload = normalizePayload(draft);
    const validation = validatePayload(payload);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    try {
      const snapshot = await updateMutation.mutateAsync(payload);
      setDraft(snapshot.bands ?? {});
      setErrors({});
    } catch (error) {
      console.error('[turn-durations] save failed', error);
    }
  }, [draft, restaurantId, updateMutation]);

  useGlobalShortcuts([
    {
      key: 's',
      meta: true,
      ctrl: true,
      preventDefault: true,
      enabled: isDirty,
      handler: () => void handleSave(),
    },
  ]);

  if (!restaurantId) {
    return (
      <Alert>
        <AlertTitle>Select a restaurant</AlertTitle>
        <AlertDescription>Choose a restaurant to edit reservation durations.</AlertDescription>
      </Alert>
    );
  }

  if (turnBandsQuery.isLoading || servicePeriodsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const loadError = turnBandsQuery.error ?? servicePeriodsQuery.error;
  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load durations</AlertTitle>
        <AlertDescription>
          {loadError instanceof Error ? loadError.message : 'Please try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <TooltipProvider>
      <section className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">Reservation Durations</h3>
              <HelpTooltip
                ariaLabel="Reservation duration help"
                description="Turn bands set the dining duration by party size. These defaults apply to availability windows and booking end times."
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Adjust how long tables are held for each booking option. Changes apply immediately to new bookings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={resetAll} disabled={updateMutation.isPending}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
              Reset to defaults
            </Button>
            <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
              Save changes
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {optionList.map((option) => {
            const rows = draft[option.key] ?? [];
            const rowErrors = errors[option.key] ?? [];
            const hasOverrides = rows.length > 0;
            const defaultsSummary =
              option.defaults.length > 0
                ? option.defaults.map((band) => `<=${band.maxPartySize}: ${band.durationMinutes} min`).join(', ')
                : 'Defaults follow lunch/dinner service bands.';

            return (
              <div key={option.key} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">{option.label}</h4>
                    {option.description ? (
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addRow(option.key, option.defaults)}
                    >
                      <Plus className="mr-2 h-4 w-4" aria-hidden />
                      Add band
                    </Button>
                    {!hasOverrides && option.defaults.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, [option.key]: sortRows(option.defaults) }))
                        }
                      >
                        Use defaults
                      </Button>
                    ) : null}
                  </div>
                </div>

                {!hasOverrides ? (
                  <Alert className="mt-3">
                    <AlertTitle>Defaults in use</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground">
                      {defaultsSummary}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-12 gap-3 text-xs font-medium text-muted-foreground">
                      <span className="col-span-5">Max party size</span>
                      <span className="col-span-5">Duration (minutes)</span>
                      <span className="col-span-2 text-right">Actions</span>
                    </div>

                    {rows.map((row, index) => {
                      const error = rowErrors[index] ?? {};
                      const sizeId = `${option.key}-size-${index}`;
                      const durationId = `${option.key}-duration-${index}`;
                      return (
                        <div key={`${option.key}-${index}`} className="grid grid-cols-12 items-start gap-3">
                          <div className="col-span-5 space-y-1">
                            <Label className="sr-only" htmlFor={sizeId}>
                              Max party size
                            </Label>
                            <Input
                              id={sizeId}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={Number.isFinite(row.maxPartySize) ? row.maxPartySize : ''}
                              aria-invalid={Boolean(error.maxPartySize)}
                              onChange={(event) => updateRow(option.key, index, 'maxPartySize', Number(event.target.value))}
                              onBlur={() => applySortedRows(option.key)}
                            />
                            {error.maxPartySize ? (
                              <p className="text-xs text-destructive">{error.maxPartySize}</p>
                            ) : null}
                          </div>

                          <div className="col-span-5 space-y-1">
                            <Label className="sr-only" htmlFor={durationId}>
                              Duration in minutes
                            </Label>
                            <Input
                              id={durationId}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={Number.isFinite(row.durationMinutes) ? row.durationMinutes : ''}
                              aria-invalid={Boolean(error.durationMinutes)}
                              onChange={(event) =>
                                updateRow(option.key, index, 'durationMinutes', Number(event.target.value))
                              }
                            />
                            {error.durationMinutes ? (
                              <p className="text-xs text-destructive">{error.durationMinutes}</p>
                            ) : null}
                          </div>

                          <div className="col-span-2 flex items-center justify-end pt-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRow(option.key, index)}
                              aria-label="Remove band"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </TooltipProvider>
  );
}
