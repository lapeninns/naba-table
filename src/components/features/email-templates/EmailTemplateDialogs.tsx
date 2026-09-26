'use client';

import { Loader2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setInvalid(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        {/* Room for the close button, which sits over the header's top-right corner. */}
        <DialogHeader className="pr-10">
          <DialogTitle>Send a test of {template.title}</DialogTitle>
          <DialogDescription>
            Sends <b className="text-foreground">{variant.name || 'this variant'}</b> as it looks in
            the preview, including unsaved changes, with the sample booking details. No guest is
            emailed.
          </DialogDescription>
        </DialogHeader>
        {firstProblem ? (
          <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-2.5 rounded-lg border-2 border-foreground px-3.5 py-3">
            <TriangleAlert className="mt-0.5 size-4" aria-hidden />
            <div>
              <p className="font-semibold">This variant has a problem</p>
              <p className="text-sm text-muted-foreground">
                {firstProblem} Fix it first so the test shows what guests would get.
              </p>
            </div>
          </div>
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
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={Boolean(firstProblem) || isSendingTest}
            onClick={() => void send()}
          >
            {isSendingTest ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isSendingTest ? 'Sending test…' : 'Send test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setUnderstood(false);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset {template.title} to the Nabatable defaults?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <ul className="grid list-disc gap-1.5 pl-5">
              <li>
                Your {custom} custom {custom === 1 ? 'variant is' : 'variants are'} deleted
                {isDirty ? ', along with your unsaved changes' : ''}.
              </li>
              <li>Emails sent from now on use the {defaults} default variants.</li>
              <li>This cannot be undone.</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
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
        <AlertDialogFooter>
          <AlertDialogCancel>Keep my copy</AlertDialogCancel>
          <AlertDialogAction
            disabled={!understood || isResetting}
            className="bg-destructive/10 text-destructive hover:bg-destructive/15"
            onClick={(event) => {
              event.preventDefault();
              void editor.reset().then((done) => done && onOpenChange(false));
            }}
          >
            {isResetting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Reset to defaults
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            It is removed from this draft now and from sending when you save. You can discard the
            draft to get it back before saving.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive/10 text-destructive hover:bg-destructive/15"
            onClick={editor.deleteVariant}
          >
            Delete variant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
