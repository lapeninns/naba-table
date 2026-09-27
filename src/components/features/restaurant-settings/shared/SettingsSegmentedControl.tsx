'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import {
  SETTINGS_SEGMENT_GROUP_CLASS,
  SETTINGS_SEGMENT_ITEM_CLASS,
  SETTINGS_SEGMENT_ITEM_SM_CLASS,
} from './compactSettingsClasses';

import type { ReactNode } from 'react';

export type SettingsSegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Shown as tabular numbers after the label, e.g. a filter's result count. */
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string;
};

export type SettingsSegmentedControlProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SettingsSegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
  itemClassName?: string;
  size?: 'default' | 'sm';
  disabled?: boolean;
  id?: string;
};

/**
 * The one pick-one-of-N control for settings filters and modes: a single-select toggle group on a
 * muted track. One tab stop with arrow-key movement; it never deselects to an empty value.
 */
export function SettingsSegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  itemClassName,
  size = 'default',
  disabled,
  id,
}: SettingsSegmentedControlProps<T>) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      data-slot="settings-segmented-control"
      className={cn(SETTINGS_SEGMENT_GROUP_CLASS, className)}
      onValueChange={(next) => {
        // Radix reports '' when the pressed item is clicked again; a segment always has a value.
        if (!next || next === value) {
          return;
        }
        const option = options.find((candidate) => candidate.value === next);
        if (option) {
          onValueChange(option.value);
        }
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={option.ariaLabel}
          className={cn(
            SETTINGS_SEGMENT_ITEM_CLASS,
            size === 'sm' && SETTINGS_SEGMENT_ITEM_SM_CLASS,
            itemClassName,
          )}
        >
          {option.icon}
          <span>{option.label}</span>
          {option.count !== undefined ? ' ' : null}
          {option.count !== undefined ? (
            <span className="tabular-nums text-muted-foreground" data-slot="segment-count">
              {option.count}
            </span>
          ) : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
