'use client';

import { Loader2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import { SettingsDialog } from '@/components/features/restaurant-settings/shared/SettingsDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { variantProblems } from './model/emailTemplateEditorModel';

import type { OpsEmailTemplatesEditor } from '@/hooks/ops/useOpsEmailTemplatesEditor';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendTestDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: OpsEmailTemplatesEditor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [toEmail, setToEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const { template, templateKey, variant, isSendingTest } = editor;
  if (!template || !templateKey || !variant) return null;

  const firstProblem = Object.values(variantProblems(variant, templateKey))[0] ?? null;

  const send = async () => {
    if (!EMAIL_PATTERN.test(toEmail.trim())) {
      setInvalid(true);
      return;
    }
    if (await editor.sendTest(toEmail)) onOpenChange(false);
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setInvalid(false);
        onOpenChange(next);
      }}
      title={`Send a test of ${template.title}`}
      description={
        <>
          Sends <b className="text-foreground">{variant.name || 'this variant'}</b> as it looks in
          the preview, including unsaved changes, with the sample booking details. No guest is
          emailed.
        </>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={Boolean(firstProblem) || isSendingTest}
            aria-busy={isSendingTest || undefined}
            onClick={() => void send()}
          >
            {isSendingTest ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isSendingTest ? 'Sending test…' : 'Send test'}
          </Button>
        </>
      }
    >
      {firstProblem ? (
        <Alert variant="warning" role="note" className="[&>svg]:size-4">
          <TriangleAlert aria-hidden />
          <AlertTitle>This variant has a problem</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {firstProblem} Fix it first so the test shows what guests would get.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="email-template-test-to">Send to</Label>
        <Input
          id="email-template-test-to"
          type="email"
          autoComplete="email"
          placeholder="name@yourvenue.co.uk"
          value={toEmail}
          disabled={Boolean(firstProblem) || isSendingTest}
          aria-invalid={invalid || undefined}
          aria-describedby="email-template-test-to-note"
          onChange={(event) => {
            setToEmail(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void send();
            }
          }}
        />
        <p
          id="email-template-test-to-note"
          className={
            invalid
              ? 'flex items-start gap-1.5 text-xs font-semibold text-destructive'
              : 'text-xs text-muted-foreground'
          }
        >
          {invalid ? (
            <>
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              Enter an email address, like name@yourvenue.co.uk.
            </>
          ) : (
            'One address. Use an inbox you can check now.'
          )}
        </p>
      </div>
    </SettingsDialog>
  );
}

export function ResetTemplateDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: OpsEmailTemplatesEditor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [understood, setUnderstood] = useState(false);
  const { template, isDirty, isResetting } = editor;
  if (!template) return null;
  const custom = template.variants.length;
  const defaults = template.defaultVariants.length;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setUnderstood(false);
        onOpenChange(next);
      }}
      title={`Reset ${template.title} to the Nabatable defaults?`}
      description="This cannot be undone."
      cancelLabel="Keep my copy"
      confirmLabel="Reset to defaults"
      pendingLabel="Resetting…"
      tone="destructive"
      pending={isResetting}
      confirmDisabled={!understood}
      keepOpenOnConfirm
      onConfirm={() => {
        void editor.reset().then((done) => {
          if (done) {
            setUnderstood(false);
            onOpenChange(false);
          }
        });
      }}
    >
      <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
        <li>
          Your {custom} custom {custom === 1 ? 'variant is' : 'variants are'} deleted
          {isDirty ? ', along with your unsaved changes' : ''}.
        </li>
        <li>Emails sent from now on use the {defaults} default variants.</li>
      </ul>
      <div className="flex min-h-11 items-start gap-2.5">
        <Checkbox
          id="email-template-reset-ack"
          checked={understood}
          onCheckedChange={(checked) => setUnderstood(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor="email-template-reset-ack" className="font-normal leading-snug">
          I understand that my custom copy for this email will be deleted.
        </Label>
      </div>
    </ConfirmDialog>
  );
}

export function DeleteVariantDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: OpsEmailTemplatesEditor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const name = editor.variant?.name || 'this variant';
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${name}?`}
      description="It is removed from this draft now and from sending when you save. You can discard the draft to get it back before saving."
      confirmLabel="Delete variant"
      tone="destructive"
      onConfirm={editor.deleteVariant}
    />
  );
}
