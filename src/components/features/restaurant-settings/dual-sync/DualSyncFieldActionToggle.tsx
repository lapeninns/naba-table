'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { DualSyncFieldActionAvailability } from './dualSyncFieldRowDomain';
import type { DualSyncDecisionAction } from '@/server/dual-sync';

export interface DualSyncFieldActionToggleProps {
  readonly availability: DualSyncFieldActionAvailability;
  readonly selectedAction: DualSyncDecisionAction | null;
  readonly disabled: boolean;
  readonly onChangeAction: (next: DualSyncDecisionAction | null) => void;
}

export function DualSyncFieldActionToggle({
  availability,
  selectedAction,
  disabled,
  onChangeAction,
}: DualSyncFieldActionToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={selectedAction ?? ''}
      onValueChange={(value) => {
        if (!value) {
          onChangeAction(null);
          return;
        }
        onChangeAction(value as DualSyncDecisionAction);
      }}
      className="justify-start gap-2"
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem
        value="import_from_google"
        disabled={!availability.canImport || disabled}
        aria-label="Import from Google"
      >
        Import from Google
      </ToggleGroupItem>
      <ToggleGroupItem
        value="export_to_google"
        disabled={!availability.canExport || disabled}
        aria-label="Send to Google"
      >
        Send to Google
      </ToggleGroupItem>
      <ToggleGroupItem value="ignore" disabled={disabled} aria-label="Ignore field">
        Ignore
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
