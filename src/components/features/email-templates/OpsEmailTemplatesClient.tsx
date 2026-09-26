'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsEmailTemplatesEditor } from '@/hooks/ops/useOpsEmailTemplatesEditor';
import { cn } from '@/lib/utils';

import { EmailTemplateCommitBar } from './EmailTemplateCommitBar';
import { DeleteVariantDialog, ResetTemplateDialog, SendTestDialog } from './EmailTemplateDialogs';
import { EMAIL_TEMPLATE_LIVE_SWITCH_ID, EmailTemplateEditor } from './EmailTemplateEditor';
import { emailTemplateFieldId } from './EmailTemplateField';
import { EmailTemplateHeader, type EmailTemplatesTab } from './EmailTemplateHeader';
import { EmailTemplateList } from './EmailTemplateList';
import { EmailTemplatePreview } from './EmailTemplatePreview';

import type { SaveBlocker } from './model/emailTemplateEditorModel';
import type { RestaurantBookingEmailTemplateKey } from '@/lib/restaurants/email-templates';

type Pane = 'list' | 'editor';
type OpenDialog = 'test' | 'reset' | 'delete' | null;

function focusBlocker(blocker: SaveBlocker) {
  const id =
    blocker.kind === 'field'
      ? emailTemplateFieldId(blocker.field)
      : blocker.kind === 'duplicate'
        ? emailTemplateFieldId('headline')
        : EMAIL_TEMPLATE_LIVE_SWITCH_ID;
  // After the variant with the problem has rendered.
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

function LoadingWorkspace() {
  return (
    <div className="grid h-full min-h-0 gap-0 md:grid-cols-[252px_minmax(0,1fr)]" aria-busy="true">
      <div className="hidden space-y-3 border-r p-3 md:block">
        <Skeleton className="h-9" />
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-12" />
        ))}
      </div>
      <div className="space-y-3 bg-muted/40 p-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-32" />
        <Skeleton className="h-44" />
        <Skeleton className="h-64" />
      </div>
      <span className="sr-only" role="status">
        Loading email templates…
      </span>
    </div>
  );
}

/**
 * Email templates settings workspace: pick an email, edit its variants' wording, preview the
 * server-rendered email and save one email at a time. Fills the settings content area; the
 * layout follows the workspace's own width (container queries), not the viewport's.
 */
export function OpsEmailTemplatesClient() {
  const editor = useOpsEmailTemplatesEditor();
  const [pane, setPane] = useState<Pane>('list');
  const [tab, setTab] = useState<EmailTemplatesTab>('edit');
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);

  const save = async () => {
    const outcome = await editor.save();
    if (outcome.status === 'blocked') {
      setTab('edit');
      focusBlocker(outcome.blocker);
    }
  };

  // Cmd/Ctrl+S saves the open email.
  const onSaveShortcut = useEffectEvent(() => void save());
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSaveShortcut();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectTemplate = (key: RestaurantBookingEmailTemplateKey) => {
    editor.selectTemplate(key);
    setPane('editor');
  };

  // Each email opens at the top of its editor, once the pane is showing.
  const openedKey = editor.templateKey;
  useEffect(() => {
    if (editorScrollRef.current) editorScrollRef.current.scrollTop = 0;
  }, [openedKey, pane]);

  if (editor.memberships.length === 0) {
    return (
      <OpsEmptyState
        title="No restaurant access"
        description="You need access to at least one restaurant to manage guest-facing email templates."
      />
    );
  }

  if (editor.templatesQuery.isError && !editor.templatesQuery.data) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <TriangleAlert className="mx-auto size-5" aria-hidden />
          <h2 className="text-lg font-semibold">Email templates didn’t load</h2>
          <p className="text-sm text-muted-foreground">
            Nothing has changed for guests. Try again in a moment.
          </p>
          <Button type="button" onClick={() => void editor.templatesQuery.refetch()}>
            <RefreshCw aria-hidden />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!editor.template) return <LoadingWorkspace />;

  // One column (narrow): the list or the email; the email shows Edit or Preview.
  // Two columns: list beside the email, Edit or Preview. Three columns: everything at once.
  const onList = pane === 'list';
  const previewing = tab === 'preview';
  const singleColumnEmail = onList ? 'hidden' : 'block';

  return (
    <div className="@container h-full min-h-0 min-w-0">
      <div
        className={cn(
          'grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto]',
          "[grid-template-areas:'head''ed''bar']",
          "@2xl:grid-cols-[252px_minmax(0,1fr)] @2xl:[grid-template-areas:'list_head''list_ed''list_bar']",
          "@6xl:grid-cols-[272px_minmax(0,1fr)_minmax(380px,42%)] @6xl:[grid-template-areas:'list_head_head''list_ed_pv''list_bar_pv']",
        )}
      >
        <aside
          aria-label="Email templates"
          className={cn(
            'min-h-0 border-r bg-background [grid-area:1/1/-1/-1] @2xl:grid @2xl:[grid-area:list]',
            onList ? 'grid' : 'hidden',
          )}
        >
          <EmailTemplateList editor={editor} onSelect={selectTemplate} />
        </aside>

        <div className={cn('min-w-0 [grid-area:head] @2xl:block', singleColumnEmail)}>
          <EmailTemplateHeader
            editor={editor}
            tab={tab}
            onTabChange={setTab}
            onBack={() => setPane('list')}
            onSendTest={() => setDialog('test')}
            onReset={() => setDialog('reset')}
          />
        </div>

        <section
          ref={editorScrollRef}
          aria-label="Edit copy"
          className={cn(
            '@container min-h-0 overflow-y-auto bg-muted/40 [grid-area:ed] @6xl:block',
            !onList && !previewing ? 'block' : 'hidden',
            previewing ? '@2xl:hidden' : '@2xl:block',
          )}
        >
          <EmailTemplateEditor editor={editor} onRequestDelete={() => setDialog('delete')} />
        </section>

        <aside
          aria-label="Preview"
          className={cn(
            'min-h-0 [grid-area:ed] @6xl:grid @6xl:border-l @6xl:[grid-area:pv]',
            !onList && previewing ? 'grid' : 'hidden',
            previewing ? '@2xl:grid' : '@2xl:hidden',
          )}
        >
          <EmailTemplatePreview editor={editor} />
        </aside>

        <div className={cn('min-w-0 [grid-area:bar] @2xl:block', singleColumnEmail)}>
          <EmailTemplateCommitBar editor={editor} onSave={() => void save()} />
        </div>
      </div>

      <SendTestDialog
        editor={editor}
        open={dialog === 'test'}
        onOpenChange={(open) => setDialog(open ? 'test' : null)}
      />
      <ResetTemplateDialog
        editor={editor}
        open={dialog === 'reset'}
        onOpenChange={(open) => setDialog(open ? 'reset' : null)}
      />
      <DeleteVariantDialog
        editor={editor}
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
      />
    </div>
  );
}
