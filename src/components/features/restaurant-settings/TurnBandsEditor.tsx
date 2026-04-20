'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { TurnBandInput } from '@/services/ops/restaurants';

export type TurnBandRowError = {
  maxPartySize?: string;
  durationMinutes?: string;
};

type TurnBandsEditorProps = {
  bands: TurnBandInput[];
  defaults?: TurnBandInput[];
  fallbackLabel?: string;
  onChange: (next: TurnBandInput[]) => void;
  errors?: TurnBandRowError[];
  disabled?: boolean;
  dense?: boolean;
};

const sortRows = (rows: TurnBandInput[]): TurnBandInput[] =>
  [...rows].sort((a, b) => a.maxPartySize - b.maxPartySize);

export function describeTurnBands(bands: TurnBandInput[] | undefined, fallback: string): string {
  if (!bands || bands.length === 0) return fallback;
  return bands
    .map((band) => `≤${band.maxPartySize}: ${band.durationMinutes} min`)
    .join(' · ');
}

export function validateTurnBandRows(rows: TurnBandInput[]): {
  ok: boolean;
  errors: TurnBandRowError[];
} {
  if (!rows || rows.length === 0) {
    return { ok: true, errors: [] };
  }

  const errors: TurnBandRowError[] = rows.map(() => ({}));
  const seenSizes = new Map<number, number[]>();

  rows.forEach((row, index) => {
    const size = Number(row.maxPartySize);
    const duration = Number(row.durationMinutes);

    if (!Number.isInteger(size) || size <= 0) {
      errors[index].maxPartySize = 'Enter a positive whole number.';
    } else {
      const occurrences = seenSizes.get(size) ?? [];
      occurrences.push(index);
      seenSizes.set(size, occurrences);
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      errors[index].durationMinutes = 'Enter a positive whole number.';
    }
  });

  seenSizes.forEach((indices) => {
    if (indices.length > 1) {
      indices.forEach((index) => {
        errors[index] = {
          ...errors[index],
          maxPartySize: 'Max party size must be unique.',
        };
      });
    }
  });

  const ok = errors.every((entry) => Object.keys(entry).length === 0);
  return { ok, errors };
}

export function TurnBandsEditor({
  bands,
  defaults,
  fallbackLabel,
  onChange,
  errors,
  disabled = false,
  dense = false,
}: TurnBandsEditorProps) {
  const hasOverrides = bands.length > 0;
  const effectiveDefaults = useMemo(() => defaults ?? [], [defaults]);

  const defaultsSummary = useMemo(
    () =>
      effectiveDefaults.length > 0
        ? describeTurnBands(effectiveDefaults, fallbackLabel ?? 'No defaults configured')
        : fallbackLabel ?? 'Defaults will apply until bands are configured.',
    [effectiveDefaults, fallbackLabel],
  );

  const handleUpdate = (
    index: number,
    field: keyof TurnBandInput,
    rawValue: string,
  ) => {
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    const next = bands.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: parsed } : row,
    );
    onChange(next);
  };

  const handleSortOnBlur = () => {
    if (bands.length < 2) return;
    onChange(sortRows(bands));
  };

  const handleAddRow = () => {
    const last = bands[bands.length - 1];
    const defaultSeed = effectiveDefaults[0] ?? null;
    const nextMax = last?.maxPartySize ? last.maxPartySize + 2 : defaultSeed?.maxPartySize ?? 2;
    const nextDuration = last?.durationMinutes ?? defaultSeed?.durationMinutes ?? 90;
    onChange(sortRows([...bands, { maxPartySize: nextMax, durationMinutes: nextDuration }]));
  };

  const handleRemoveRow = (index: number) => {
    const next = bands.filter((_, rowIndex) => rowIndex !== index);
    onChange(next);
  };

  const handleUseDefaults = () => {
    onChange(sortRows(effectiveDefaults));
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleAddRow} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add band
        </Button>
        {!hasOverrides && effectiveDefaults.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleUseDefaults} disabled={disabled}>
            Use defaults
          </Button>
        ) : null}
        {hasOverrides ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={disabled}>
            Clear overrides
          </Button>
        ) : null}
      </div>

      {!hasOverrides ? (
        <Alert>
          <AlertTitle>Defaults in use</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            {defaultsSummary}
          </AlertDescription>
        </Alert>
      ) : (
        <div className={dense ? 'space-y-2' : 'space-y-3'}>
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
            <span className="col-span-5">Max party size</span>
            <span className="col-span-5">Duration (minutes)</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>

          {bands.map((row, index) => {
            const error = errors?.[index] ?? {};
            const sizeId = `turn-band-size-${index}`;
            const durationId = `turn-band-duration-${index}`;
            return (
              <div key={index} className="grid grid-cols-12 items-start gap-2">
                <div className="col-span-5 space-y-1">
                  <Label className="sr-only" htmlFor={sizeId}>
                    Max party size
                  </Label>
                  <Input
                    id={sizeId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    disabled={disabled}
                    value={Number.isFinite(row.maxPartySize) && row.maxPartySize !== 0 ? row.maxPartySize : ''}
                    aria-invalid={Boolean(error.maxPartySize)}
                    onChange={(event) => handleUpdate(index, 'maxPartySize', event.target.value)}
                    onBlur={handleSortOnBlur}
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
                    disabled={disabled}
                    value={Number.isFinite(row.durationMinutes) && row.durationMinutes !== 0 ? row.durationMinutes : ''}
                    aria-invalid={Boolean(error.durationMinutes)}
                    onChange={(event) => handleUpdate(index, 'durationMinutes', event.target.value)}
                  />
                  {error.durationMinutes ? (
                    <p className="text-xs text-destructive">{error.durationMinutes}</p>
                  ) : null}
                </div>

                <div className="col-span-2 flex items-center justify-end pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => handleRemoveRow(index)}
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
}
