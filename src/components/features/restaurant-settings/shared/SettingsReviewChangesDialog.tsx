'use client';

import { Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { SettingsDialog } from './SettingsDialog';
import { pluralise } from './settingsSaveSequence';

export type SettingsChange = {
  label: string;
  /** Saved value; omit for something added. */
  was?: string;
  now: string;
};

export type SettingsChangeGroup = {
  id: string;
  title: string;
  changes: SettingsChange[];
};

type SettingsReviewChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly SettingsChangeGroup[];
  onUndoGroup: (groupId: string) => void;
  onSave: () => void;
};

/** "Was → now" list of every unsaved change on the page, grouped by section. */
export function SettingsReviewChangesDialog({
  open,
  onOpenChange,
  groups,
  onUndoGroup,
  onSave,
}: SettingsReviewChangesDialogProps) {
  const visibleGroups = groups.filter((group) => group.changes.length > 0);
  const count = visibleGroups.reduce((total, group) => total + group.changes.length, 0);

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Review changes"
      description={`${pluralise(count, 'change')}. Nothing is live until you save.`}
      testId="settings-review-changes"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button
            type="button"
            disabled={count === 0}
            onClick={() => {
              onOpenChange(false);
              onSave();
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      {visibleGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unsaved changes.</p>
      ) : (
        visibleGroups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`review-${group.id}`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 id={`review-${group.id}`} className="text-sm font-semibold text-foreground">
                {group.title}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Undo section ${group.title}`}
                onClick={() => onUndoGroup(group.id)}
              >
                <Undo2 data-icon="inline-start" aria-hidden />
                Undo section
              </Button>
            </div>
            <ul className="flex flex-col divide-y divide-border/60 rounded-md border border-border/60">
              {group.changes.map((change, index) => (
                <li key={`${change.label}-${index}`} className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="text-sm font-medium text-foreground">{change.label}</span>
                  <span className="break-words text-xs text-muted-foreground">
                    {change.was !== undefined ? (
                      <>
                        <span className="font-mono line-through decoration-muted-foreground/60">
                          {change.was}
                        </span>
                        <span aria-hidden> → </span>
                        <span className="sr-only"> changed to </span>
                      </>
                    ) : null}
                    <span className="font-mono text-foreground">{change.now}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </SettingsDialog>
  );
}
