'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ConfirmDialog } from '../ConfirmDialog';
import { useRestaurantSettingsSaveBarSlot } from '../RestaurantSettingsSaveBarSlot';
import { SETTINGS_SAVE_COPY } from './compactSettingsClasses';
import {
  formatSettingsSectionList,
  pluralise,
  SETTINGS_SAVE_CONFLICT_CODE,
  type SettingsSaveFailure,
  type SettingsSaveProgress,
} from './settingsSaveSequence';

export type SettingsSaveUnit = { singular: string; plural: string };

export const SETTINGS_CHANGE_UNIT: SettingsSaveUnit = {
  singular: 'unsaved change',
  plural: 'unsaved changes',
};

export type SettingsSaveBarProps = {
  /** Unsaved changes, counted in `unit`. The bar is hidden while it is 0 and nothing is saving. */
  changeCount: number;
  unit?: SettingsSaveUnit;
  /** Names of the sections with unsaved changes. */
  sectionNames: readonly string[];
  /** Blocking validation issues; Save then moves focus to the first one instead of saving. */
  issueCount: number;
  progress: SettingsSaveProgress | null;
  failure: SettingsSaveFailure | null;
  onSave: () => void;
  /** Runs after the staff member confirms the discard. */
  onDiscard: () => void;
  onShowFirstIssue: () => void;
  onReview?: () => void;
};

/** Fixed copy for a conflicting save. The server's own error text is never shown. */
export const SETTINGS_SAVE_CONFLICT_MESSAGE =
  'Someone else changed these settings. Reload to see the latest, then reapply your edits.';

const BAR_CLASS =
  'z-20 flex shrink-0 flex-col gap-2 border-t border-border/60 bg-background/95 px-[var(--ops-shell-gutter)] py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-[backdrop-filter]:bg-background/90 sm:flex-row sm:items-center sm:justify-between sm:gap-4';

const LINK_BUTTON_CLASS =
  'h-auto min-h-0 p-0 align-baseline text-xs font-medium underline underline-offset-2 [@media(pointer:coarse)]:min-h-11';

/**
 * The one save bar of a settings page with a page-wide draft (Profile, Availability,
 * Discovery). Docked below the settings scroll area when rendered inside the settings shell.
 * Saving never shows a bare spinner, and a partial failure names what saved, what did not and
 * the safe reason code.
 */
export function SettingsSaveBar(props: SettingsSaveBarProps) {
  const slot = useRestaurantSettingsSaveBarSlot();
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const visible = props.changeCount > 0 || props.progress !== null || props.failure !== null;

  const bar = useMemo(
    () =>
      visible ? (
        <SettingsSaveBarRegion {...props} onRequestDiscard={() => setConfirmDiscardOpen(true)} />
      ) : null,
    [props, visible],
  );

  useLayoutEffect(() => {
    if (!slot) {
      return;
    }
    slot.setSaveBar(bar);
  }, [bar, slot]);

  useLayoutEffect(() => {
    if (!slot) {
      return;
    }
    return () => slot.setSaveBar(null);
  }, [slot]);

  const unit = props.unit ?? SETTINGS_CHANGE_UNIT;

  return (
    <>
      {slot ? null : bar ? <div className="sticky bottom-0">{bar}</div> : null}
      <ConfirmDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        title="Discard all changes?"
        description={`${pluralise(props.changeCount, unit.singular, unit.plural)} will be lost. Saved settings stay as they are.`}
        confirmLabel={SETTINGS_SAVE_COPY.discard}
        tone="destructive"
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          props.onDiscard();
        }}
      />
    </>
  );
}

function SettingsSaveBarRegion({
  changeCount,
  unit = SETTINGS_CHANGE_UNIT,
  sectionNames,
  issueCount,
  progress,
  failure,
  onSave,
  onShowFirstIssue,
  onReview,
  onRequestDiscard,
}: SettingsSaveBarProps & { onRequestDiscard: () => void }) {
  const isSaving = progress !== null;
  const blocked = !isSaving && failure === null && issueCount > 0;
  const changes = pluralise(changeCount, unit.singular, unit.plural);

  let message: ReactNode;
  if (progress) {
    message = (
      <>
        <p className="text-sm font-medium text-foreground">
          Saving {progress.step} of {progress.total}: {progress.sectionName}…
        </p>
        <p className="text-xs text-muted-foreground">Keep this page open until it’s confirmed.</p>
      </>
    );
  } else if (failure) {
    message = (
      <>
        <p className="flex items-start gap-1.5 text-sm font-medium text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            {failure.failedSection} not saved.{' '}
            {failure.reasonCode === SETTINGS_SAVE_CONFLICT_CODE
              ? SETTINGS_SAVE_CONFLICT_MESSAGE
              : 'Your edits are still here.'}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {failure.saved.length > 0 ? `Saved: ${formatSettingsSectionList(failure.saved)}. ` : null}
          {failure.notAttempted.length > 0
            ? `Not attempted: ${formatSettingsSectionList(failure.notAttempted)}. `
            : null}
          Reason code <span className="font-mono text-foreground">{failure.reasonCode}</span>
        </p>
      </>
    );
  } else if (blocked) {
    message = (
      <>
        <p className="flex items-start gap-1.5 text-sm font-medium text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>{pluralise(issueCount, 'issue')} to fix before saving</span>
        </p>
        <p className="text-xs text-muted-foreground">
          <Button
            type="button"
            variant="link"
            className={LINK_BUTTON_CLASS}
            onClick={onShowFirstIssue}
          >
            Show first issue
          </Button>{' '}
          · {changes}
        </p>
      </>
    );
  } else {
    message = (
      <>
        <p className="text-sm font-medium text-foreground">{changes}</p>
        <p className="text-xs text-muted-foreground">
          {sectionNames.join(' · ')}
          {onReview ? (
            <>
              {sectionNames.length > 0 ? ' · ' : null}
              <Button type="button" variant="link" className={LINK_BUTTON_CLASS} onClick={onReview}>
                Review changes
              </Button>
            </>
          ) : null}
        </p>
      </>
    );
  }

  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      data-slot="settings-save-bar"
      className={BAR_CLASS}
    >
      <div className="flex min-w-0 flex-col gap-0.5" role="status" aria-live="polite">
        {message}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
        <Button type="button" variant="outline" onClick={onRequestDiscard} disabled={isSaving}>
          Discard
        </Button>
        <Button
          type="button"
          onClick={blocked ? onShowFirstIssue : onSave}
          disabled={isSaving}
          aria-disabled={blocked || undefined}
          aria-describedby={blocked ? 'settings-save-blocked-reason' : undefined}
          aria-busy={isSaving || undefined}
          className={cn(blocked && 'opacity-60')}
        >
          {isSaving ? (
            <Loader2
              data-icon="inline-start"
              className="animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : null}
          {isSaving ? SETTINGS_SAVE_COPY.saving : failure ? 'Try again' : 'Save changes'}
        </Button>
        {blocked ? (
          <span id="settings-save-blocked-reason" className="sr-only">
            Fix the issues first
          </span>
        ) : null}
      </div>
    </div>
  );
}
