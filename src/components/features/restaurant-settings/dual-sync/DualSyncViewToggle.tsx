import { Button } from '@/components/ui/button';

export interface DualSyncViewToggleProps {
  readonly showDriftOnly: boolean;
  readonly onChange: (showDriftOnly: boolean) => void;
}

/** "Differences only / All fields" switch for the review step. */
export function DualSyncViewToggle({ showDriftOnly, onChange }: DualSyncViewToggleProps) {
  const options = [
    { label: 'Differences only', value: true },
    { label: 'All fields', value: false },
  ] as const;

  return (
    <div
      role="group"
      aria-label="Fields to show"
      className="inline-flex rounded-md border border-border bg-muted/40 p-0.5"
    >
      {options.map((option) => {
        const pressed = showDriftOnly === option.value;
        return (
          <Button
            key={option.label}
            type="button"
            size="sm"
            variant={pressed ? 'secondary' : 'ghost'}
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
            className="h-8 px-3 shadow-none aria-pressed:bg-background aria-pressed:shadow-sm [@media(pointer:coarse)]:min-h-11"
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
