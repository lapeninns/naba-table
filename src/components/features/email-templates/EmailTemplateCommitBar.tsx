'use client';

import { SettingsSaveBar } from '@/components/features/restaurant-settings/shared/SettingsSaveBar';

import type { SettingsSaveFailure } from '@/components/features/restaurant-settings/shared/settingsSaveSequence';
import type { OpsEmailTemplatesEditor } from '@/hooks/ops/useOpsEmailTemplatesEditor';

const EMAIL_UNIT = { singular: 'unsaved email', plural: 'unsaved emails' };

/**
 * The settings save bar for the open email. Hidden while the email has no unsaved changes;
 * docked in the settings shell's save-bar slot. Emails save one at a time, so the bar counts and
 * saves only the open one, and names any other email that still has unsaved changes.
 */
export function EmailTemplateCommitBar({
  editor,
  onSave,
}: {
  editor: OpsEmailTemplatesEditor;
  onSave: () => void;
}) {
  const { template, canEdit, isDirty, isSaving, saveReasonCode, blockers, showAllProblems } =
    editor;
  if (!template) return null;

  const isCustom = template.status === 'custom';
  const dirty = canEdit && isDirty;
  const firstBlocker = dirty && showAllProblems ? (blockers[0] ?? null) : null;
  const failure: SettingsSaveFailure | null =
    canEdit && saveReasonCode
      ? { failedSection: template.title, saved: [], notAttempted: [], reasonCode: saveReasonCode }
      : null;

  const details = [
    `Not live yet. Guests get the ${isCustom ? 'last saved' : 'default'} copy until you save.`,
  ];
  if (editor.otherDirtyTitles.length) {
    details.push(`Also unsaved: ${editor.otherDirtyTitles.join(', ')}.`);
  }

  return (
    <SettingsSaveBar
      changeCount={dirty ? 1 : 0}
      unit={EMAIL_UNIT}
      sectionNames={details}
      issueCount={firstBlocker ? blockers.length : 0}
      progress={isSaving ? { step: 1, total: 1, sectionName: template.title } : null}
      failure={failure}
      onSave={onSave}
      onDiscard={editor.discard}
      // Saving again re-runs the check, opens the variant with the problem and focuses it.
      onShowFirstIssue={onSave}
      saveLabel={`Save ${template.title}`}
      summary={
        firstBlocker
          ? editor.describeBlocker(firstBlocker)
          : `Unsaved changes to ${template.title}.`
      }
    />
  );
}
