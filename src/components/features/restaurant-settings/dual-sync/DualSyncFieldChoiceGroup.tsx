'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { DualSyncFieldActionAvailability } from './dualSyncFieldRowDomain';
import type { DualSyncDecisionAction } from '@/server/dual-sync';

export interface DualSyncFieldChoiceGroupProps {
  readonly fieldKey: string;
  readonly fieldLabel: string;
  readonly availability: DualSyncFieldActionAvailability;
  readonly selectedAction: DualSyncDecisionAction | null;
  readonly disabled: boolean;
  readonly onChangeAction: (next: DualSyncDecisionAction) => void;
  /** Id of the text that explains unavailable options (the field's blocked reasons). */
  readonly describedBy?: string;
}

const CHOICES: ReadonlyArray<{
  readonly action: DualSyncDecisionAction;
  readonly label: string;
}> = [
  { action: 'export_to_google', label: 'Send to Google' },
  { action: 'import_from_google', label: 'Use Google’s' },
  { action: 'ignore', label: 'Ignore' },
];

function isChoiceAvailable(
  action: DualSyncDecisionAction,
  availability: DualSyncFieldActionAvailability,
): boolean {
  if (action === 'export_to_google') return availability.canExport;
  if (action === 'import_from_google') return availability.canImport;
  return true;
}

/**
 * Native radio group for one field: Send to Google / Use Google's / Ignore. Options the field
 * does not support stay visible but disabled, and the blocked reason is linked as a description.
 */
export function DualSyncFieldChoiceGroup({
  fieldKey,
  fieldLabel,
  availability,
  selectedAction,
  disabled,
  onChangeAction,
  describedBy,
}: DualSyncFieldChoiceGroupProps) {
  const name = `dual-sync-choice-${fieldKey}`;

  return (
    <fieldset className="min-w-0" aria-describedby={describedBy}>
      <legend className="sr-only">{`What to do with ${fieldLabel}`}</legend>
      <div className="flex flex-wrap gap-1">
        {CHOICES.map((choice) => {
          const optionDisabled = disabled || !isChoiceAvailable(choice.action, availability);
          return (
            <Label key={choice.action} className="relative">
              <Input
                type="radio"
                name={name}
                value={choice.action}
                checked={selectedAction === choice.action}
                disabled={optionDisabled}
                onChange={() => onChangeAction(choice.action)}
                className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none border-0 p-0 opacity-0 shadow-none disabled:cursor-not-allowed"
              />
              <span
                className={cn(
                  'flex min-h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors motion-reduce:transition-none',
                  'peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
                  'peer-disabled:opacity-50',
                  '[@media(pointer:coarse)]:min-h-11',
                )}
              >
                {choice.label}
              </span>
            </Label>
          );
        })}
      </div>
    </fieldset>
  );
}
