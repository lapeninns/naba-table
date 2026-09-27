'use client';

import { useId } from 'react';

import { SettingsSegmentedControl } from '@/components/features/restaurant-settings/shared/SettingsSegmentedControl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import {
  RUN_SHEET_SORT_DIR_LABELS,
  type BookingSortDir,
  type BookingSortKey,
  type RunSheetColumnToggle,
  type RunSheetGroupMode,
  type RunSheetPreferences,
} from './opsBookingsPrintViewDomain';

const GROUP_OPTIONS: { value: RunSheetGroupMode; label: string; description?: string }[] = [
  {
    value: 'service',
    label: 'By service',
    description: 'Lunch and dinner, each with its own totals',
  },
  { value: 'status', label: 'By status', description: 'Seated, then upcoming, then finished' },
  { value: 'none', label: 'No grouping' },
];

const COLUMN_OPTIONS: { key: RunSheetColumnToggle; label: string; description?: string }[] = [
  { key: 'tick', label: 'Arrival tick box', description: 'Blank box for the host to tick by hand' },
  { key: 'status', label: 'Status' },
  { key: 'diet', label: 'Allergies and dietary' },
  { key: 'notes', label: 'Notes' },
  { key: 'ref', label: 'Booking reference' },
  {
    key: 'phone',
    label: 'Guest phone number',
    description: 'Off by default. A printed number leaves the system on paper.',
  },
];

const SECTION_LABEL = 'mb-2 block text-xs font-semibold text-muted-foreground';

type OpsRunSheetOptionsProps = {
  preferences: RunSheetPreferences;
  sortKey: BookingSortKey;
  sortDir: BookingSortDir;
  onSortKeyChange: (value: BookingSortKey) => void;
  onSortDirChange: (value: BookingSortDir) => void;
  onChange: (patch: Partial<RunSheetPreferences>) => void;
  onReset: () => void;
  className?: string;
};

export function OpsRunSheetOptions({
  preferences,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
  onChange,
  onReset,
  className,
}: OpsRunSheetOptionsProps) {
  const id = useId();
  const dirLabels = RUN_SHEET_SORT_DIR_LABELS[sortKey];

  return (
    <div className={cn('divide-y divide-border', className)}>
      <div className="pb-4">
        <Label htmlFor={`${id}-sort`} className={SECTION_LABEL}>
          Sort rows by
        </Label>
        <Select value={sortKey} onValueChange={(value) => onSortKeyChange(value as BookingSortKey)}>
          <SelectTrigger id={`${id}-sort`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="time">Time</SelectItem>
            <SelectItem value="party">Party size</SelectItem>
            <SelectItem value="name">Guest name</SelectItem>
          </SelectContent>
        </Select>
        <SettingsSegmentedControl
          className="mt-2 w-full"
          itemClassName="flex-1"
          size="sm"
          ariaLabel="Sort direction"
          value={sortDir}
          onValueChange={onSortDirChange}
          options={[
            { value: 'asc', label: dirLabels.asc },
            { value: 'desc', label: dirLabels.desc },
          ]}
        />
      </div>

      <div className="py-4">
        <span id={`${id}-group`} className={SECTION_LABEL}>
          Group rows
        </span>
        <ToggleGroup
          type="single"
          orientation="vertical"
          aria-labelledby={`${id}-group`}
          value={preferences.groupMode}
          onValueChange={(next) => {
            const option = GROUP_OPTIONS.find((candidate) => candidate.value === next);
            if (option) onChange({ groupMode: option.value });
          }}
          className="grid gap-1.5"
        >
          {GROUP_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              className="h-auto min-h-9 w-full flex-col items-start justify-start gap-0.5 rounded-md border border-border px-3 py-2 text-left text-sm font-normal data-[state=on]:border-primary data-[state=on]:bg-primary/5"
            >
              <span className="font-medium">{option.label}</span>
              {option.description ? (
                <span className="whitespace-normal text-xs leading-snug text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <fieldset className="py-4">
        <legend className={SECTION_LABEL}>Columns</legend>
        <div className="space-y-1">
          {COLUMN_OPTIONS.map((option) => (
            <Label
              key={option.key}
              htmlFor={`${id}-col-${option.key}`}
              className="flex min-h-9 cursor-pointer items-start gap-2.5 py-1.5 text-sm font-normal leading-normal"
            >
              <Checkbox
                id={`${id}-col-${option.key}`}
                className="mt-0.5"
                checked={preferences.columns[option.key]}
                onCheckedChange={(checked) =>
                  onChange({
                    columns: { ...preferences.columns, [option.key]: checked === true },
                  })
                }
              />
              <span>
                <span className="font-medium">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </Label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-4 py-4">
        <div>
          <span className={SECTION_LABEL}>
            Paper
          </span>
          <SettingsSegmentedControl
            className="w-full"
            itemClassName="flex-1"
            size="sm"
            ariaLabel="Paper"
            value={preferences.paper}
            onValueChange={(paper) => onChange({ paper })}
            options={[
              { value: 'portrait', label: 'A4 portrait' },
              { value: 'landscape', label: 'A4 landscape' },
            ]}
          />
        </div>
        <div>
          <span className={SECTION_LABEL}>Row spacing</span>
          <SettingsSegmentedControl
            className="w-full"
            itemClassName="flex-1"
            size="sm"
            ariaLabel="Row spacing"
            value={preferences.density}
            onValueChange={(density) => onChange({ density })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-4">
        <span className="text-xs text-muted-foreground">
          Changes apply to the preview straight away.
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
