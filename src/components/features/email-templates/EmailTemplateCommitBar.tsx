'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { OpsEmailTemplatesEditor } from '@/hooks/ops/useOpsEmailTemplatesEditor';
import type { ReactNode } from 'react';

function Message({ title, detail }: { title: ReactNode; detail?: ReactNode }) {
  return (
    <>
      <b className="font-semibold">{title}</b>
      {detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
    </>
  );
}

/** Pinned under the editor: what guests get right now, and the save for this email. */
export function EmailTemplateCommitBar({
  editor,
  onSave,
}: {
  editor: OpsEmailTemplatesEditor;
  onSave: () => void;
}) {
  const { template, canEdit, isDirty, isSaving, saveError, blockers, showAllProblems } = editor;
  if (!template) return null;
  const isCustom = template.status === 'custom';
  const live = editor.variants.filter((variant) => variant.isActive).length;

  let message: ReactNode;
  if (!canEdit) {
    message = <Message title="View only." detail="Changes are made by owners and managers." />;
  } else if (isSaving) {
    message = (
      <Message
        title={`Saving ${template.title}…`}
        detail="Guests keep getting the previous copy until the save is confirmed."
      />
    );
  } else if (saveError) {
    message = (
      <Message
        title={<>Not saved. {saveError}</>}
        detail="Your draft is still here. Nothing has changed for guests."
      />
    );
  } else if (isDirty && showAllProblems && blockers[0]) {
    message = (
      <Message
        title={
          blockers.length === 1
            ? 'Fix 1 problem before saving.'
            : `Fix ${blockers.length} problems before saving.`
        }
        detail={editor.describeBlocker(blockers[0])}
      />
    );
  } else if (isDirty) {
    message = (
      <Message
        title={`Unsaved changes to ${template.title}.`}
        detail={`Not live yet. Guests get the ${isCustom ? 'last saved' : 'default'} copy until you save.`}
      />
    );
  } else {
    message = (
      <Message
        title={isCustom ? 'Custom copy saved.' : 'Using Nabatable default copy.'}
        detail={
          !isCustom
            ? 'Edit any field to start a custom version.'
            : live
              ? 'Emails sent from then on use it.'
              : 'Every variant is paused, so guests get the default copy.'
        }
      />
    );
  }

  return (
    <div
      role="region"
      aria-label="Save changes"
      className="flex max-h-[40vh] flex-wrap items-center gap-x-3 gap-y-2 overflow-y-auto border-t bg-background px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
    >
      <p className="min-w-0 flex-[1_1_260px] text-sm" role="status">
        {message}
        {canEdit && editor.otherDirtyTitles.length ? (
          <span className="block text-xs text-muted-foreground">
            Also unsaved: {editor.otherDirtyTitles.join(', ')}.
          </span>
        ) : null}
      </p>
      {canEdit ? (
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || isSaving}
            onClick={editor.discard}
          >
            Discard
          </Button>
          <Button type="button" disabled={!isDirty || isSaving} onClick={onSave}>
            {isSaving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isSaving ? 'Saving…' : saveError ? 'Try again' : `Save ${template.title}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
