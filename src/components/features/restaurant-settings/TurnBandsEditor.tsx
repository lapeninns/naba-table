'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/typography';

import { describeTurnBands, type TurnBandRowError } from './turnBandsDomain';

import type { TurnBandInput } from '@/services/ops/restaurants';

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
        : (fallbackLabel ?? 'Defaults will apply until bands are configured.'),
    [effectiveDefaults, fallbackLabel],
  );

  const handleUpdate = (index: number, field: keyof TurnBandInput, rawValue: string) => {
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
    const nextMax = last?.maxPartySize ? last.maxPartySize + 2 : (defaultSeed?.maxPartySize ?? 2);
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRow}
          disabled={disabled}
        >
          <Plus data-icon="inline-start" aria-hidden />
          Add band
        </Button>
        {!hasOverrides && effectiveDefaults.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUseDefaults}
            disabled={disabled}
          >
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
          <div
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-2 text-xs font-medium text-muted-foreground"
            aria-hidden
          >
            <span>Max party size</span>
            <span>Duration (minutes)</span>
            <span className="sr-only">Actions</span>
          </div>

          {bands.map((row, index) => {
            const error = errors?.[index] ?? {};
            const sizeId = `turn-band-size-${index}`;
            const durationId = `turn-band-duration-${index}`;
            return (
              <div
                key={index}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-2 items-start"
              >
                <div className="min-w-0 space-y-1">
                  <Label className="sr-only" htmlFor={sizeId}>
                    Max party size
                  </Label>
                  <Input
                    id={sizeId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    disabled={disabled}
                    value={
                      Number.isFinite(row.maxPartySize) && row.maxPartySize !== 0
                        ? row.maxPartySize
                        : ''
                    }
                    aria-invalid={Boolean(error.maxPartySize)}
                    aria-describedby={error.maxPartySize ? `${sizeId}-error` : undefined}
                    onChange={(event) => handleUpdate(index, 'maxPartySize', event.target.value)}
                    onBlur={handleSortOnBlur}
                  />
                  {error.maxPartySize ? (
                    <Text
                      id={`${sizeId}-error`}
                      variant="caption"
                      className="text-destructive"
                      role="alert"
                    >
                      {error.maxPartySize}
                    </Text>
                  ) : null}
                </div>

                <div className="min-w-0 space-y-1">
                  <Label className="sr-only" htmlFor={durationId}>
                    Duration in minutes
                  </Label>
                  <Input
                    id={durationId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    disabled={disabled}
                    value={
                      Number.isFinite(row.durationMinutes) && row.durationMinutes !== 0
                        ? row.durationMinutes
                        : ''
                    }
                    aria-invalid={Boolean(error.durationMinutes)}
                    aria-describedby={error.durationMinutes ? `${durationId}-error` : undefined}
                    onChange={(event) => handleUpdate(index, 'durationMinutes', event.target.value)}
                  />
                  {error.durationMinutes ? (
                    <Text
                      id={`${durationId}-error`}
                      variant="caption"
                      className="text-destructive"
                      role="alert"
                    >
                      {error.durationMinutes}
                    </Text>
                  ) : null}
                </div>

                <div className="flex items-start justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => handleRemoveRow(index)}
                    aria-label={`Remove band ${index + 1}`}
                  >
                    <Trash2 aria-hidden />
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
