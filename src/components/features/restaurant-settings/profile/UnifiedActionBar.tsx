'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ProfileSectionDefinition } from './profileSections';
import type { ProfileDirtySection } from '../restaurantProfileModel';

type UnifiedActionBarProps = {
  dirtyFormSections: readonly (ProfileDirtySection & { formId: string })[];
  discoveryDirty: boolean;
  activeSection: ProfileSectionDefinition;
  lastSavedAt: string | null;
  onSaveAll: () => void;
  onCancelActive?: () => void;
  gbpDriftCount?: number;
  onCompareWithGoogle?: () => void;
  className?: string;
};

function formatSavedAt(value: string | null): string {
  if (!value) {
    return 'No saved timestamp yet';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export function UnifiedActionBar({
  dirtyFormSections,
  discoveryDirty,
  activeSection,
  lastSavedAt,
  onSaveAll,
  onCancelActive,
  gbpDriftCount = 0,
  onCompareWithGoogle,
  className,
}: UnifiedActionBarProps) {
  const profileDirtyCount = dirtyFormSections.length;
  const unsavedSectionCount = profileDirtyCount + (discoveryDirty ? 1 : 0);
  const activeDirtySection = dirtyFormSections.find(
    (section) => section.key === activeSection.dirtyKey,
  );
  const discoveryIsActive = activeSection.id === 'discovery';

  if (unsavedSectionCount === 0) {
    return (
      <div
        role="status"
        className={cn(
          'rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground',
          className,
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Last profile save: <span className="text-foreground">{formatSavedAt(lastSavedAt)}</span>
            . Save controls appear here when a profile section has a draft.
          </p>
          {gbpDriftCount > 0 && onCompareWithGoogle ? (
            <Button type="button" variant="outline" size="sm" onClick={onCompareWithGoogle}>
              Compare with Google
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const title = `${unsavedSectionCount} unsaved profile section${unsavedSectionCount === 1 ? '' : 's'}`;
  const description =
    discoveryDirty && profileDirtyCount > 0
      ? 'Save profile forms from this bar. Discovery panels save individually in the section below.'
      : discoveryDirty
        ? 'Save each discovery panel below when you are ready.'
        : 'Save profile changes without leaving this settings workspace.';

  return (
    <Alert
      className={cn(
        'sticky bottom-0 z-10 border-primary/30 bg-background/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85',
        className,
      )}
    >
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{description}</span>
        <div className="flex flex-wrap items-center gap-2">
          {activeDirtySection ? (
            <>
              <Button type="submit" form={activeDirtySection.formId} size="sm">
                {activeDirtySection.actionLabel}
              </Button>
              {onCancelActive ? (
                <Button type="button" variant="outline" size="sm" onClick={onCancelActive}>
                  Cancel changes
                </Button>
              ) : null}
            </>
          ) : null}
          {profileDirtyCount > 1 ? (
            <Button
              type="button"
              variant={activeDirtySection ? 'outline' : 'default'}
              size="sm"
              onClick={onSaveAll}
            >
              Save all
            </Button>
          ) : null}
          {gbpDriftCount > 0 && onCompareWithGoogle ? (
            <Button type="button" variant="outline" size="sm" onClick={onCompareWithGoogle}>
              Compare with Google
            </Button>
          ) : null}
          {discoveryDirty && discoveryIsActive && !activeDirtySection ? (
            <span className="text-xs text-muted-foreground">
              Use each panel&apos;s save action.
            </span>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
