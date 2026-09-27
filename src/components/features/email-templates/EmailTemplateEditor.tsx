'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Lock,
  MoreHorizontal,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import {
  SETTINGS_CARD_DESCRIPTION_CLASS,
  SETTINGS_CARD_TITLE_CLASS,
  SETTINGS_TABS_LIST_CLASS,
  SETTINGS_TABS_TRIGGER_CLASS,
} from '@/components/features/restaurant-settings/shared/compactSettingsClasses';
import { SettingsOverflowFrame } from '@/components/features/restaurant-settings/shared/SettingsOverflowFrame';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS,
  getUnknownRestaurantEmailTemplateTokens,
} from '@/lib/restaurants/email-templates';
import { cn } from '@/lib/utils';

import { EmailTemplateField, emailTemplateFieldId } from './EmailTemplateField';
import {
  CTA_DESTINATIONS,
  FIELD_LABELS,
  TEMPLATE_VARIABLES,
  copyFieldsFor,
  findDuplicateLiveVariant,
  hasProblems,
  insertToken,
  templateSupportsAsk,
  templateSupportsCue,
  variantProblems,
  type CopyField,
  type VariantField,
} from './model/emailTemplateEditorModel';

import type { OpsEmailTemplatesEditor } from '@/hooks/ops/useOpsEmailTemplatesEditor';

export const EMAIL_TEMPLATE_LIVE_SWITCH_ID = 'email-template-live';

function Notice({
  icon,
  title,
  children,
  strong = false,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  /** Something guests are affected by (a warning), rather than information. */
  strong?: boolean;
}) {
  return (
    // Shown while editing, not in response to an action, so it is not announced as an alert.
    // Information stays neutral (muted box); only guest-affecting warnings use amber (RR11).
    <Alert
      variant={strong ? 'warning' : 'default'}
      role="note"
      className={cn(
        '[&>svg]:size-4',
        !strong && 'border-border/60 bg-muted/40 [&>svg]:text-muted-foreground',
      )}
    >
      {icon}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-muted-foreground">{children}</AlertDescription>
    </Alert>
  );
}

function EditorCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-background">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5">
        {/* The action stays in the header row, end-aligned; it wraps (still end-aligned) only
            when the title column would drop below 10rem (RR5). */}
        <div className="min-w-0 flex-[1_1_10rem]">
          <h3 className={SETTINGS_CARD_TITLE_CLASS}>{title}</h3>
          <p className={cn('mt-0.5', SETTINGS_CARD_DESCRIPTION_CLASS)}>{description}</p>
        </div>
        {action ? (
          <div className="ms-auto flex max-w-full shrink-0 items-center">{action}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function rotationCopy(live: number): ReactNode {
  if (live > 1) {
    return (
      <>
        Each booking gets one of the <b className="text-foreground">{live}</b> live variants, picked
        from its booking ID, so a resend uses the same wording. Each variant goes to about 1 in{' '}
        {live} guests.
      </>
    );
  }
  if (live === 1) {
    return 'One live variant: every guest gets this wording. Add a variant to test different wording.';
  }
  return 'No live variants.';
}

export function EmailTemplateEditor({
  editor,
  onRequestDelete,
}: {
  editor: OpsEmailTemplatesEditor;
  onRequestDelete: () => void;
}) {
  const { template, templateKey, variant, variants, canEdit, showAllProblems, restaurantName } =
    editor;
  const [focusedField, setTarget] = useState<CopyField>('intro');
  const [guideOpen, setGuideOpen] = useState(false);

  if (!template || !templateKey || !variant) return null;

  // A field this email does not show (after switching emails) falls back to the message.
  const target = copyFieldsFor(templateKey).includes(focusedField) ? focusedField : 'intro';
  const readOnly = !canEdit;
  const live = variants.filter((item) => item.isActive).length;
  const problems = variantProblems(variant, templateKey);
  const duplicate = findDuplicateLiveVariant(variants, variant);
  const recommended = new Set(
    template.recommendedVariables.map((token) => token.replace(/^\{\{|\}\}$/g, '')),
  );
  const chips = [
    ...TEMPLATE_VARIABLES.filter((item) => recommended.has(item.key)),
    ...TEMPLATE_VARIABLES.filter((item) => !recommended.has(item.key)),
  ];
  const index = variants.indexOf(variant);

  // Empty and overlong fields are flagged after a save attempt; unknown variables straight away.
  const errorFor = (field: VariantField) => {
    const message = problems[field];
    if (!message) return null;
    return showAllProblems || getUnknownRestaurantEmailTemplateTokens(variant[field]).length
      ? message
      : null;
  };

  const field = (name: VariantField) => (
    <EmailTemplateField
      key={`${variant.id}-${name}`}
      field={name}
      value={variant[name]}
      error={errorFor(name)}
      readOnly={readOnly}
      onChange={(value) => editor.editField(name, value)}
      onFocus={name === 'name' ? undefined : () => setTarget(name as CopyField)}
    />
  );

  const insert = (key: string) => {
    const element = document.getElementById(emailTemplateFieldId(target)) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    const value = variant[target];
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? start;
    const next = insertToken(value, start, end, `{{${key}}}`);
    editor.editField(target, next.value);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <>
      {readOnly ? null : (
        <div
          className="sticky top-0 z-10 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b bg-background/95 px-4 py-2.5 backdrop-blur [@media(max-height:500px)]:py-1.5"
          role="group"
          aria-label="Insert a variable"
        >
          <span className="shrink-0 text-xs text-muted-foreground">
            Insert into <b className="font-semibold text-foreground">{FIELD_LABELS[target]}</b>
          </span>
          {/* Fine pointers: the chips wrap. Touch: 44px chips on one sideways-scrolling row with
              edge fades, so the sticky bar stays short above the keyboard (RR2, RR3). */}
          <SettingsOverflowFrame className="flex-[1_1_10rem]">
            <div
              data-slot="email-template-variable-chips"
              className="flex flex-wrap gap-1.5 [@media(pointer:coarse)]:flex-nowrap [@media(pointer:coarse)]:overflow-x-auto [@media(pointer:coarse)]:[scrollbar-width:none]"
            >
              {chips.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  title={`${item.description} · preview: ${item.sample}${recommended.has(item.key) ? ' · recommended for this email' : ''}`}
                  // Keep focus (and the caret) in the field being edited.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insert(item.key)}
                  className={cn(
                    'h-7 min-h-0 min-w-0 shrink-0 px-2 font-mono text-xs [@media(pointer:coarse)]:h-11',
                    recommended.has(item.key)
                      ? 'font-semibold'
                      : 'font-normal text-muted-foreground',
                  )}
                >
                  {`{{${item.key}}}`}
                </Button>
              ))}
            </div>
          </SettingsOverflowFrame>
        </div>
      )}

      <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pb-6 pt-3">
        {readOnly ? (
          <Notice icon={<Lock />} title="View only">
            You can read {restaurantName}’s email copy. Owners and managers can change it or send
            tests.
          </Notice>
        ) : null}
        {live === 0 ? (
          <Notice icon={<TriangleAlert />} title="No variant is live" strong>
            Guests get the Nabatable default {template.title} copy, not the copy below. Set at least
            one variant live to use your own wording.
          </Notice>
        ) : null}

        <EditorCard
          title="Variants"
          description={rotationCopy(live)}
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!editor.canAddVariant}
              onClick={editor.addVariant}
            >
              <Plus aria-hidden />
              Add variant
              <span className="font-mono text-xs text-muted-foreground">
                {variants.length}/{MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS}
              </span>
            </Button>
          }
        >
          <Tabs value={variant.id} onValueChange={editor.selectVariant}>
            {/* Sideways-scrolling variant strip: edge fades show hidden variants and the
                current one is kept in view (RR2). */}
            <SettingsOverflowFrame revealKey={variant.id} className="mt-3">
              <TabsList
                aria-label="Variants"
                className={cn(SETTINGS_TABS_LIST_CLASS, 'px-4 sm:px-5')}
              >
                {variants.map((item) => {
                  const flagged =
                    hasProblems(variantProblems(item, templateKey)) &&
                    (showAllProblems || item.id === variant.id);
                  return (
                    <TabsTrigger
                      key={item.id}
                      value={item.id}
                      className={cn(SETTINGS_TABS_TRIGGER_CLASS, 'gap-2')}
                    >
                      {/* Long names truncate (full name on hover) instead of widening the strip. */}
                      <span className="max-w-48 truncate" title={item.name || undefined}>
                        {item.name || 'Untitled variant'}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          item.isActive ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {item.isActive ? 'Live' : 'Paused'}
                      </span>
                      {flagged ? (
                        <span
                          className="size-1.5 rounded-full bg-destructive"
                          role="img"
                          aria-label="Has problems"
                        />
                      ) : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </SettingsOverflowFrame>
            <TabsContent value={variant.id} className="mt-0 grid gap-4 px-4 pb-4 pt-3.5 sm:px-5">
              {/* Narrow: the name takes the full row; Live and the actions menu share the next row,
                  the menu end-aligned. Wider: all three on one row. */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 @md:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="col-span-2 min-w-0 @md:col-span-1">{field('name')}</div>
                <div className="flex min-h-11 items-center gap-2">
                  <Switch
                    id={EMAIL_TEMPLATE_LIVE_SWITCH_ID}
                    checked={variant.isActive}
                    disabled={readOnly}
                    onCheckedChange={editor.setLive}
                    className="min-h-0 min-w-0"
                  />
                  <Label htmlFor={EMAIL_TEMPLATE_LIVE_SWITCH_ID}>
                    {variant.isActive ? 'Live' : 'Paused'}
                  </Label>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={readOnly}
                      aria-label={`More actions for ${variant.name || 'this variant'}`}
                    >
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    collisionPadding={16}
                    className="w-64 max-w-[calc(100vw-2rem)]"
                  >
                    <DropdownMenuItem
                      disabled={!editor.canAddVariant}
                      onSelect={editor.duplicateVariant}
                      className="items-start"
                    >
                      <Copy aria-hidden className="mt-0.5" />
                      <span>
                        Duplicate
                        <span className="block text-xs text-muted-foreground">
                          {editor.canAddVariant
                            ? 'Starts paused, so it does not send until you set it live.'
                            : `Limit of ${MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS} variants reached.`}
                        </span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index <= 0} onSelect={() => editor.moveVariant(-1)}>
                      <ArrowUp aria-hidden />
                      Move earlier
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={index >= variants.length - 1}
                      onSelect={() => editor.moveVariant(1)}
                    >
                      <ArrowDown aria-hidden />
                      Move later
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={variants.length <= 1}
                      onSelect={onRequestDelete}
                      className="items-start"
                    >
                      <Trash2 aria-hidden className="mt-0.5" />
                      <span>
                        Delete variant
                        <span className="block text-xs text-muted-foreground">
                          {variants.length <= 1
                            ? 'An email needs at least one variant.'
                            : 'Removed when you save.'}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {duplicate ? (
                <Notice icon={<TriangleAlert />} title={`Same copy as ${duplicate.name}`} strong>
                  Both are live with identical wording, so the rotation compares nothing. Change the
                  wording or pause one.
                </Notice>
              ) : null}
            </TabsContent>
          </Tabs>
        </EditorCard>

        <EditorCard title="Inbox" description="What the guest sees before opening the email.">
          <div className="grid gap-4 px-4 pb-4 pt-3.5 sm:px-5 @xl:grid-cols-2">
            {field('subject')}
            {field('preheader')}
          </div>
        </EditorCard>

        <EditorCard
          title="Email body"
          description="The layout, booking details and links are set by Nabatable. You edit the wording."
        >
          <div className="grid gap-4 px-4 pb-4 pt-3.5 sm:px-5">
            {template.authoringHints.length ? (
              <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2 w-fit font-medium"
                  >
                    Writing guidance for this email
                    <ChevronDown
                      aria-hidden
                      className={cn('transition-transform', guideOpen && 'rotate-180')}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="grid list-disc gap-1 pb-1 pl-5 text-sm text-muted-foreground">
                    {template.authoringHints.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
            {field('headline')}
            {field('intro')}
            {templateSupportsCue(templateKey) ? field('cue') : null}
            {templateSupportsAsk(templateKey) ? field('ask') : null}
            <div className="grid gap-4 @xl:grid-cols-2">
              {field('ctaLabel')}
              <div className="grid content-start gap-1.5">
                <span className="text-sm font-medium">Button link</span>
                <p className="flex min-h-9 items-center gap-2 rounded-md bg-muted px-2.5 py-2 text-sm">
                  <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {CTA_DESTINATIONS[templateKey]}
                </p>
                <p className="text-xs text-muted-foreground">
                  Set by Nabatable for each booking. It cannot be changed here.
                </p>
              </div>
            </div>
          </div>
        </EditorCard>
      </div>
    </>
  );
}
