'use client';

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  buildRestaurantEmailTemplateVariantSignature,
  getUnknownRestaurantEmailTemplateTokens,
} from '@/lib/restaurants/email-templates';
import { cn } from '@/lib/utils';

import type { EmailTemplatesActivePane } from '@/hooks/ops/useOpsEmailTemplatesPageState';
import type {
  RestaurantBookingEmailTemplateKey,
  RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';
import type { RestaurantEmailTemplate } from '@/services/ops/restaurants';

type EmailTemplatesEditorPaneProps = {
  restaurantName: string;
  canEdit: boolean;
  baseTemplate: RestaurantEmailTemplate | null;
  currentVariants: RestaurantEmailTemplateVariant[];
  currentVariant: RestaurantEmailTemplateVariant | null;
  selectedVariantId: string | null;
  activeVariantCount: number;
  isCurrentDirty: boolean;
  testEmail: string;
  onTestEmailChange: (value: string) => void;
  activePane: EmailTemplatesActivePane;
  isSaving: boolean;
  isResetting: boolean;
  isSendingTest: boolean;
  onBackToList: () => void;
  onOpenPreview: () => void;
  onDiscardCurrent: () => void;
  onSave: () => void;
  onAddVariant: () => void;
  onMoveVariant: (variantId: string, direction: -1 | 1) => void;
  onDeleteVariant: (variantId: string) => void;
  onSelectVariant: (variantId: string) => void;
  onResetTemplate: (templateKey: RestaurantBookingEmailTemplateKey) => void;
  onSendTest: () => void;
  onUpdateVariant: (
    variantId: string,
    updater: (variant: RestaurantEmailTemplateVariant) => RestaurantEmailTemplateVariant,
  ) => void;
};

type TemplateCopyField =
  | 'subject'
  | 'preheader'
  | 'headline'
  | 'intro'
  | 'cue'
  | 'ask'
  | 'ctaLabel';

const TEMPLATE_FIELD_LIMITS: Record<TemplateCopyField, number> = {
  subject: 140,
  preheader: 180,
  headline: 140,
  intro: 280,
  cue: 180,
  ask: 180,
  ctaLabel: 60,
};

const TEMPLATE_FIELD_LABELS: Record<TemplateCopyField, string> = {
  subject: 'Subject',
  preheader: 'Preheader',
  headline: 'Headline',
  intro: 'Message body',
  cue: 'Photo cue',
  ask: 'Review ask',
  ctaLabel: 'CTA label',
};

function templateSupportsCueField(
  templateKey: RestaurantBookingEmailTemplateKey | null | undefined,
) {
  return templateKey === 'confirmation' || templateKey === 'reminder_24h';
}

function templateSupportsAskField(
  templateKey: RestaurantBookingEmailTemplateKey | null | undefined,
) {
  return templateKey === 'review_request';
}

function appendToken(currentValue: string, token: string) {
  return currentValue ? `${currentValue}${currentValue.endsWith(' ') ? '' : ' '}${token}` : token;
}

function getCounterTone(length: number, limit: number) {
  const remaining = limit - length;
  if (remaining <= 10) return 'text-destructive';
  if (remaining <= 25) return 'text-primary';
  return 'text-muted-foreground';
}

export function EmailTemplatesEditorPane({
  restaurantName,
  canEdit,
  baseTemplate,
  currentVariants,
  currentVariant,
  selectedVariantId,
  activeVariantCount,
  isCurrentDirty,
  testEmail,
  onTestEmailChange,
  activePane,
  isSaving,
  isResetting,
  isSendingTest,
  onBackToList,
  onOpenPreview,
  onDiscardCurrent,
  onSave,
  onAddVariant,
  onMoveVariant,
  onDeleteVariant,
  onSelectVariant,
  onResetTemplate,
  onSendTest,
  onUpdateVariant,
}: EmailTemplatesEditorPaneProps) {
  const [tokenTarget, setTokenTarget] = useState<TemplateCopyField>('intro');

  const variantWarnings = useMemo(() => {
    if (!currentVariant) {
      return {
        duplicateActiveVariantName: null as string | null,
        unknownTokensByField: {} as Record<TemplateCopyField, string[]>,
      };
    }

    const unknownTokensByField: Record<TemplateCopyField, string[]> = {
      subject: getUnknownRestaurantEmailTemplateTokens(currentVariant.subject),
      preheader: getUnknownRestaurantEmailTemplateTokens(currentVariant.preheader),
      headline: getUnknownRestaurantEmailTemplateTokens(currentVariant.headline),
      intro: getUnknownRestaurantEmailTemplateTokens(currentVariant.intro),
      cue: getUnknownRestaurantEmailTemplateTokens(currentVariant.cue),
      ask: getUnknownRestaurantEmailTemplateTokens(currentVariant.ask),
      ctaLabel: getUnknownRestaurantEmailTemplateTokens(currentVariant.ctaLabel),
    };

    const duplicateActiveVariantName = currentVariant.isActive
      ? (currentVariants.find(
          (variant) =>
            variant.id !== currentVariant.id &&
            variant.isActive &&
            buildRestaurantEmailTemplateVariantSignature(variant) ===
              buildRestaurantEmailTemplateVariantSignature(currentVariant),
        )?.name ?? null)
      : null;

    return { duplicateActiveVariantName, unknownTokensByField };
  }, [currentVariant, currentVariants]);

  const insertVariable = (token: string) => {
    if (!currentVariant) {
      return;
    }

    onUpdateVariant(currentVariant.id, (variant) => ({
      ...variant,
      [tokenTarget]: appendToken(variant[tokenTarget], token),
    }));
  };

  const showCueField = templateSupportsCueField(baseTemplate?.key);
  const showAskField = templateSupportsAskField(baseTemplate?.key);

  return (
    <main className="min-w-0">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={onBackToList}
              aria-label="Back to template list"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">
                {baseTemplate?.title ?? 'Select a template'}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {baseTemplate?.description ??
                  `Choose a template to edit copy for ${restaurantName}.`}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="lg:hidden"
              onClick={onOpenPreview}
              disabled={!baseTemplate}
              aria-label="Open preview"
            >
              <Eye className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onDiscardCurrent}
              disabled={!canEdit || !isCurrentDirty}
              className="hidden sm:inline-flex"
            >
              Discard
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={!canEdit || !isCurrentDirty || isSaving}
            >
              {isSaving ? (
                <RotateCcw className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </Button>
          </div>
        </div>

        {isCurrentDirty ? (
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-primary">
            <AlertCircle className="size-4" />
            Unsaved edits in this template.
          </div>
        ) : null}
      </header>

      <div>
        <div className="flex w-full flex-col gap-6 px-4 py-5 md:px-6 md:py-8">
          {!canEdit ? (
            <Alert variant="info" className="border-primary/20 bg-primary/10">
              <Info className="size-4" />
              <AlertTitle>View only</AlertTitle>
              <AlertDescription>
                You can review {restaurantName}&apos;s template setup here, but only owners and
                managers can change copy or send tests.
              </AlertDescription>
            </Alert>
          ) : null}

          {baseTemplate ? (
            <Alert className="border-primary/20 bg-primary/10 text-foreground">
              <Sparkles className="size-4 text-primary" />
              <AlertTitle>A/B testing is live</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  {activeVariantCount} active{' '}
                  {activeVariantCount === 1 ? 'variant is' : 'variants are'} rotating for future
                  sends.
                </p>
                <p className="text-xs text-muted-foreground">
                  Keep variants focused and distinct so you can compare engagement without changing
                  delivery rules or booking data.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          {baseTemplate && currentVariant ? (
            <>
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr),20rem]">
                <Alert className="border-primary/20 bg-primary/10 text-foreground">
                  <Sparkles className="size-4 text-primary" />
                  <AlertTitle>Template guidance</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p className="text-sm text-foreground">
                      Recommended variables for {baseTemplate.title.toLowerCase()}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {baseTemplate.recommendedVariables.map((token) => (
                        <Badge
                          key={token}
                          variant="secondary"
                          className="rounded-full bg-primary/10 text-primary"
                        >
                          {token}
                        </Badge>
                      ))}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {baseTemplate.authoringHints.map((hint) => (
                        <p key={hint}>{hint}</p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="rounded-[1.5rem] border border-border bg-background px-4 py-4 shadow-sm">
                  <div className="text-sm font-semibold text-foreground">Token insertion</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click inside a field to change the insertion target, then tap a variable chip.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {baseTemplate.availableVariables.map((token) => {
                      const recommended = baseTemplate.recommendedVariables.includes(token);
                      return (
                        <Button
                          key={token}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => insertVariable(token)}
                          disabled={!canEdit}
                          className={cn(
                            'rounded-full font-mono text-[11px]',
                            recommended && 'border-primary/30 bg-primary/10 text-primary',
                          )}
                        >
                          {token}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Current insertion target:{' '}
                    <span className="font-medium text-foreground">
                      {TEMPLATE_FIELD_LABELS[tokenTarget]}
                    </span>
                  </p>
                </div>
              </section>

              {variantWarnings.duplicateActiveVariantName ? (
                <Alert variant="destructive">
                  <AlertTitle>Duplicate live variant copy</AlertTitle>
                  <AlertDescription>
                    This active variant matches {variantWarnings.duplicateActiveVariantName}. Change
                    the delivery copy or pause one version so your A/B rotation stays meaningful.
                  </AlertDescription>
                </Alert>
              ) : null}

              <section className="rounded-[1.5rem] border border-border bg-background shadow-sm">
                <div className="border-b border-border px-4 py-4 md:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">Variants</div>
                      <p className="text-xs text-muted-foreground">
                        Tabs keep each test branch isolated while you edit one version at a time.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onAddVariant}
                      disabled={!canEdit || currentVariants.length >= 5}
                    >
                      <Plus className="size-4" />
                      Add variant
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
                    {currentVariants
                      .slice()
                      .sort((left, right) => left.order - right.order)
                      .map((variant) => {
                        const active = selectedVariantId === variant.id;

                        return (
                          <Button
                            key={variant.id}
                            type="button"
                            variant="ghost"
                            onClick={() => onSelectVariant(variant.id)}
                            className={cn(
                              'relative h-auto whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium',
                              active
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80',
                            )}
                          >
                            <span>{variant.name}</span>
                            {!variant.isActive ? (
                              <Badge
                                variant="outline"
                                className="ml-2 border-border bg-background text-[11px] text-muted-foreground"
                              >
                                Paused
                              </Badge>
                            ) : null}
                            {active ? (
                              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                            ) : null}
                          </Button>
                        );
                      })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveVariant(currentVariant.id, -1)}
                      disabled={
                        !canEdit ||
                        currentVariants.findIndex((variant) => variant.id === currentVariant.id) ===
                          0
                      }
                    >
                      <ChevronLeft className="size-4" />
                      Earlier
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveVariant(currentVariant.id, 1)}
                      disabled={
                        !canEdit ||
                        currentVariants.findIndex((variant) => variant.id === currentVariant.id) ===
                          currentVariants.length - 1
                      }
                    >
                      Later
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 px-4 py-5 md:px-5 md:py-6">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),220px]">
                    <div className="space-y-2">
                      <Label htmlFor="email-template-variant-name">Internal name</Label>
                      <Input
                        id="email-template-variant-name"
                        value={currentVariant.name}
                        onChange={(event) =>
                          onUpdateVariant(currentVariant.id, (variant) => ({
                            ...variant,
                            name: event.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        className="h-11 rounded-xl border-border"
                      />
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-foreground">Status</div>
                          <p className="text-xs text-muted-foreground">
                            {currentVariant.isActive ? 'Active in rotation' : 'Paused for sends'}
                          </p>
                        </div>
                        <Switch
                          id={`variant-active-${currentVariant.id}`}
                          checked={currentVariant.isActive}
                          aria-label={`Toggle ${currentVariant.name} active status`}
                          onCheckedChange={(checked) =>
                            onUpdateVariant(currentVariant.id, (variant) => ({
                              ...variant,
                              isActive: checked,
                            }))
                          }
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="email-template-subject">Subject line</Label>
                        <span
                          className={cn(
                            'text-xs',
                            getCounterTone(
                              currentVariant.subject.length,
                              TEMPLATE_FIELD_LIMITS.subject,
                            ),
                          )}
                        >
                          {currentVariant.subject.length}/{TEMPLATE_FIELD_LIMITS.subject}
                        </span>
                      </div>
                      <Input
                        id="email-template-subject"
                        value={currentVariant.subject}
                        onFocus={() => setTokenTarget('subject')}
                        onChange={(event) =>
                          onUpdateVariant(currentVariant.id, (variant) => ({
                            ...variant,
                            subject: event.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        className="h-11 rounded-xl border-border text-sm font-medium"
                      />
                      {variantWarnings.unknownTokensByField.subject.length > 0 ? (
                        <p className="text-xs text-destructive">
                          Unknown variables:{' '}
                          {variantWarnings.unknownTokensByField.subject
                            .map((token) => `{{${token}}}`)
                            .join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Inbox subject line shown before the email opens.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="email-template-preheader">Preheader</Label>
                        <span
                          className={cn(
                            'text-xs',
                            getCounterTone(
                              currentVariant.preheader.length,
                              TEMPLATE_FIELD_LIMITS.preheader,
                            ),
                          )}
                        >
                          {currentVariant.preheader.length}/{TEMPLATE_FIELD_LIMITS.preheader}
                        </span>
                      </div>
                      <Input
                        id="email-template-preheader"
                        value={currentVariant.preheader}
                        onFocus={() => setTokenTarget('preheader')}
                        onChange={(event) =>
                          onUpdateVariant(currentVariant.id, (variant) => ({
                            ...variant,
                            preheader: event.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        className="h-11 rounded-xl border-border"
                      />
                      {variantWarnings.unknownTokensByField.preheader.length > 0 ? (
                        <p className="text-xs text-destructive">
                          Unknown variables:{' '}
                          {variantWarnings.unknownTokensByField.preheader
                            .map((token) => `{{${token}}}`)
                            .join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Preview text used by inbox clients and notifications.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="email-template-headline">Hero headline</Label>
                      <span
                        className={cn(
                          'text-xs',
                          getCounterTone(
                            currentVariant.headline.length,
                            TEMPLATE_FIELD_LIMITS.headline,
                          ),
                        )}
                      >
                        {currentVariant.headline.length}/{TEMPLATE_FIELD_LIMITS.headline}
                      </span>
                    </div>
                    <Input
                      id="email-template-headline"
                      value={currentVariant.headline}
                      onFocus={() => setTokenTarget('headline')}
                      onChange={(event) =>
                        onUpdateVariant(currentVariant.id, (variant) => ({
                          ...variant,
                          headline: event.target.value,
                        }))
                      }
                      disabled={!canEdit}
                      className="h-11 rounded-xl border-border text-sm font-medium"
                    />
                    {variantWarnings.unknownTokensByField.headline.length > 0 ? (
                      <p className="text-xs text-destructive">
                        Unknown variables:{' '}
                        {variantWarnings.unknownTokensByField.headline
                          .map((token) => `{{${token}}}`)
                          .join(', ')}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="email-template-intro">Message body</Label>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'text-xs',
                            getCounterTone(
                              currentVariant.intro.length,
                              TEMPLATE_FIELD_LIMITS.intro,
                            ),
                          )}
                        >
                          {currentVariant.intro.length}/{TEMPLATE_FIELD_LIMITS.intro}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Info className="size-3.5" />
                          Click a field to change token target
                        </div>
                      </div>
                    </div>
                    <Textarea
                      id="email-template-intro"
                      value={currentVariant.intro}
                      onFocus={() => setTokenTarget('intro')}
                      onChange={(event) =>
                        onUpdateVariant(currentVariant.id, (variant) => ({
                          ...variant,
                          intro: event.target.value,
                        }))
                      }
                      disabled={!canEdit}
                      className="min-h-[220px] rounded-2xl border-border text-sm leading-6"
                    />
                    {variantWarnings.unknownTokensByField.intro.length > 0 ? (
                      <p className="text-xs text-destructive">
                        Unknown variables:{' '}
                        {variantWarnings.unknownTokensByField.intro
                          .map((token) => `{{${token}}}`)
                          .join(', ')}
                      </p>
                    ) : null}
                  </div>

                  {showCueField ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="email-template-cue">Photo cue</Label>
                        <span
                          className={cn(
                            'text-xs',
                            getCounterTone(currentVariant.cue.length, TEMPLATE_FIELD_LIMITS.cue),
                          )}
                        >
                          {currentVariant.cue.length}/{TEMPLATE_FIELD_LIMITS.cue}
                        </span>
                      </div>
                      <Textarea
                        id="email-template-cue"
                        value={currentVariant.cue}
                        onFocus={() => setTokenTarget('cue')}
                        onChange={(event) =>
                          onUpdateVariant(currentVariant.id, (variant) => ({
                            ...variant,
                            cue: event.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        className="min-h-[120px] rounded-2xl border-border text-sm leading-6"
                      />
                      <p className="text-xs text-muted-foreground">
                        Gentle pre-visit priming only. Keep this secondary to the operational
                        booking message.
                      </p>
                      {variantWarnings.unknownTokensByField.cue.length > 0 ? (
                        <p className="text-xs text-destructive">
                          Unknown variables:{' '}
                          {variantWarnings.unknownTokensByField.cue
                            .map((token) => `{{${token}}}`)
                            .join(', ')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {showAskField ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="email-template-ask">Review ask</Label>
                        <span
                          className={cn(
                            'text-xs',
                            getCounterTone(currentVariant.ask.length, TEMPLATE_FIELD_LIMITS.ask),
                          )}
                        >
                          {currentVariant.ask.length}/{TEMPLATE_FIELD_LIMITS.ask}
                        </span>
                      </div>
                      <Textarea
                        id="email-template-ask"
                        value={currentVariant.ask}
                        onFocus={() => setTokenTarget('ask')}
                        onChange={(event) =>
                          onUpdateVariant(currentVariant.id, (variant) => ({
                            ...variant,
                            ask: event.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        className="min-h-[120px] rounded-2xl border-border text-sm leading-6"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use this for the direct post-visit ask, like encouraging a photo alongside
                        the guest&apos;s review.
                      </p>
                      {variantWarnings.unknownTokensByField.ask.length > 0 ? (
                        <p className="text-xs text-destructive">
                          Unknown variables:{' '}
                          {variantWarnings.unknownTokensByField.ask
                            .map((token) => `{{${token}}}`)
                            .join(', ')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {baseTemplate.supportsCtaLabel ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="email-template-cta-label">Call-to-action label</Label>
                        <span
                          className={cn(
                            'text-xs',
                            getCounterTone(
                              currentVariant.ctaLabel.length,
                              TEMPLATE_FIELD_LIMITS.ctaLabel,
                            ),
                          )}
                        >
                          {currentVariant.ctaLabel.length}/{TEMPLATE_FIELD_LIMITS.ctaLabel}
                        </span>
                      </div>
                      <Input
                        id="email-template-cta-label"
                        value={currentVariant.ctaLabel}
                        onFocus={() => setTokenTarget('ctaLabel')}
                        onChange={(event) =>
                          onUpdateVariant(currentVariant.id, (variant) => ({
                            ...variant,
                            ctaLabel: event.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        className="h-11 max-w-sm rounded-xl border-border"
                      />
                      {variantWarnings.unknownTokensByField.ctaLabel.length > 0 ? (
                        <p className="text-xs text-destructive">
                          Unknown variables:{' '}
                          {variantWarnings.unknownTokensByField.ctaLabel
                            .map((token) => `{{${token}}}`)
                            .join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          The destination URL stays system-controlled. Only the label changes here.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-border bg-background px-4 py-5 shadow-sm md:px-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <Label htmlFor="email-template-test-address">Send a test email</Label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Input
                        id="email-template-test-address"
                        type="email"
                        value={testEmail}
                        onChange={(event) => onTestEmailChange(event.target.value)}
                        placeholder="Send a test email to..."
                        disabled={!canEdit}
                        className="h-11 min-w-[260px] rounded-xl border-border"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onSendTest}
                        disabled={!canEdit || isSendingTest}
                      >
                        {isSendingTest ? <RotateCcw className="size-4 animate-spin" /> : null}
                        <span>{isSendingTest ? 'Sending...' : 'Send test'}</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      System shell, booking facts, and destination URLs stay locked. Delivery copy,
                      subject, and preheader change here.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onResetTemplate(baseTemplate.key)}
                      disabled={!canEdit || baseTemplate.status === 'default' || isResetting}
                    >
                      {isResetting ? <RotateCcw className="size-4 animate-spin" /> : null}
                      <span>Reset template</span>
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => onDeleteVariant(currentVariant.id)}
                      disabled={!canEdit || currentVariants.length <= 1}
                    >
                      <Trash2 className="size-4" />
                      <span>Delete variant</span>
                    </Button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <OpsEmptyState
              title="Choose a template"
              description="Choose a template from the left to start editing."
              className={cn(
                'min-h-[320px] rounded-[1.5rem] bg-muted/40 px-6',
                activePane === 'editor' && 'animate-in fade-in slide-in-from-right-2 duration-200',
              )}
            />
          )}
        </div>
      </div>
    </main>
  );
}
