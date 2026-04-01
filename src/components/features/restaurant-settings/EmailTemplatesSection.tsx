'use client';

import {
  ChevronDown,
  ChevronUp,
  Eye,
  Layers3,
  Mail,
  Monitor,
  PenSquare,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useOpsPreviewRestaurantEmailTemplate,
  useOpsResetRestaurantEmailTemplate,
  useOpsRestaurantEmailTemplates,
  useOpsSendRestaurantEmailTemplateTest,
  useOpsUpdateRestaurantEmailTemplate,
} from '@/hooks/ops/useOpsRestaurantEmailTemplates';
import { MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS, type RestaurantBookingEmailTemplateKey, type RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';
import { cn } from '@/lib/utils';

import { SettingsCard } from './shared/SettingsCard';

import type { RestaurantEmailTemplate, RestaurantEmailTemplatesSnapshot } from '@/services/ops/restaurants';

type EmailTemplatesSectionProps = {
  restaurantId: string | null;
  restaurantName: string;
};

function createVariantId(templateKey: RestaurantBookingEmailTemplateKey) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${templateKey}-${crypto.randomUUID()}`;
  }

  return `${templateKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeVariantsForCompare(variants: RestaurantEmailTemplateVariant[]) {
  return JSON.stringify(
    [...variants]
      .sort((left, right) => left.order - right.order)
      .map((variant) => ({
        id: variant.id,
        name: variant.name,
        headline: variant.headline,
        intro: variant.intro,
        ctaLabel: variant.ctaLabel,
        isActive: variant.isActive,
        order: variant.order,
      })),
  );
}

function buildTemplateMap(snapshot: RestaurantEmailTemplatesSnapshot | undefined) {
  return new Map(
    snapshot?.groups.flatMap((group) => group.templates).map((template) => [template.key, template]) ?? [],
  );
}

function getStatusBadgeVariant(status: RestaurantEmailTemplate['status']) {
  return status === 'custom' ? 'secondary' : 'outline';
}

function getStatusLabel(status: RestaurantEmailTemplate['status']) {
  return status === 'custom' ? 'Customized' : 'Default';
}

function PreviewCanvas({
  html,
  device,
}: {
  html: string;
  device: 'desktop' | 'mobile';
}) {
  return (
    <div
      className={cn(
        'mx-auto overflow-hidden rounded-2xl border bg-background shadow-sm transition-all',
        device === 'mobile' ? 'w-[360px] max-w-full' : 'w-full',
      )}
    >
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 text-xs text-muted-foreground">
          {device === 'mobile' ? 'Mobile preview' : 'Desktop preview'}
        </span>
      </div>
      <iframe
        title={`${device} email preview`}
        srcDoc={html}
        className={cn('w-full bg-white', device === 'mobile' ? 'h-[700px]' : 'h-[760px]')}
      />
    </div>
  );
}

function VariantCountMeter({
  activeCount,
  totalCount,
}: {
  activeCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Layers3 className="size-3.5" />
      <span>
        {activeCount} active / {totalCount} total
      </span>
    </div>
  );
}

export function EmailTemplatesSection({ restaurantId, restaurantName }: EmailTemplatesSectionProps) {
  const templatesQuery = useOpsRestaurantEmailTemplates(restaurantId);
  const updateMutation = useOpsUpdateRestaurantEmailTemplate(restaurantId);
  const resetMutation = useOpsResetRestaurantEmailTemplate(restaurantId);
  const previewMutation = useOpsPreviewRestaurantEmailTemplate(restaurantId);
  const testSendMutation = useOpsSendRestaurantEmailTemplateTest(restaurantId);

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<RestaurantBookingEmailTemplateKey | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<RestaurantBookingEmailTemplateKey, RestaurantEmailTemplateVariant[]>>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [testEmail, setTestEmail] = useState('');

  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const templateMap = useMemo(() => buildTemplateMap(templatesQuery.data), [templatesQuery.data]);
  const allTemplates = useMemo(
    () => templatesQuery.data?.groups.flatMap((group) => group.templates) ?? [],
    [templatesQuery.data],
  );

  useEffect(() => {
    if (selectedTemplateKey && templateMap.has(selectedTemplateKey)) {
      return;
    }
    const firstTemplate = allTemplates[0];
    if (firstTemplate) {
      setSelectedTemplateKey(firstTemplate.key);
    }
  }, [allTemplates, selectedTemplateKey, templateMap]);

  const filteredGroups = useMemo(() => {
    if (!templatesQuery.data) return [];
    if (!deferredSearch) return templatesQuery.data.groups;

    return templatesQuery.data.groups
      .map((group) => ({
        ...group,
        templates: group.templates.filter((template) => {
          const haystack = `${group.title} ${template.title} ${template.description}`.toLowerCase();
          return haystack.includes(deferredSearch);
        }),
      }))
      .filter((group) => group.templates.length > 0);
  }, [deferredSearch, templatesQuery.data]);

  const baseTemplate = selectedTemplateKey ? templateMap.get(selectedTemplateKey) ?? null : null;
  const currentVariants = useMemo(() => {
    if (!selectedTemplateKey || !baseTemplate) return [];
    return drafts[selectedTemplateKey] ?? baseTemplate.variants;
  }, [baseTemplate, drafts, selectedTemplateKey]);

  const isCurrentDirty = useMemo(() => {
    if (!selectedTemplateKey || !baseTemplate) return false;
    return normalizeVariantsForCompare(currentVariants) !== normalizeVariantsForCompare(baseTemplate.variants);
  }, [baseTemplate, currentVariants, selectedTemplateKey]);

  const hasDirtyDrafts = useMemo(
    () =>
      Object.entries(drafts).some(([key, variants]) => {
        if (!variants) return false;
        const template = templateMap.get(key as RestaurantBookingEmailTemplateKey);
        if (!template) return false;
        return normalizeVariantsForCompare(variants) !== normalizeVariantsForCompare(template.variants);
      }),
    [drafts, templateMap],
  );

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasDirtyDrafts) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirtyDrafts]);

  useEffect(() => {
    if (!currentVariants.length) {
      setSelectedVariantId(null);
      return;
    }

    if (selectedVariantId && currentVariants.some((variant) => variant.id === selectedVariantId)) {
      return;
    }

    setSelectedVariantId(currentVariants[0]!.id);
  }, [currentVariants, selectedVariantId]);

  useEffect(() => {
    if (!restaurantId || !selectedTemplateKey || !currentVariants.length) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      previewMutation.mutate({
        templateKey: selectedTemplateKey,
        payload: {
          preferredVariantId: selectedVariantId ?? undefined,
          variants: currentVariants,
        },
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [currentVariants, previewMutation, restaurantId, selectedTemplateKey, selectedVariantId]);

  const currentVariant = currentVariants.find((variant) => variant.id === selectedVariantId) ?? null;

  const updateCurrentVariants = (
    updater: (variants: RestaurantEmailTemplateVariant[]) => RestaurantEmailTemplateVariant[],
  ) => {
    if (!selectedTemplateKey) return;
    setDrafts((current) => {
      const template = templateMap.get(selectedTemplateKey);
      const baseline = current[selectedTemplateKey] ?? template?.variants ?? [];
      return {
        ...current,
        [selectedTemplateKey]: updater(baseline),
      };
    });
  };

  const updateCurrentVariant = (
    variantId: string,
    updater: (variant: RestaurantEmailTemplateVariant) => RestaurantEmailTemplateVariant,
  ) => {
    updateCurrentVariants((variants) =>
      variants.map((variant) => (variant.id === variantId ? updater(variant) : variant)),
    );
  };

  const handleAddVariant = () => {
    if (!selectedTemplateKey || !baseTemplate || currentVariants.length >= MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS) {
      return;
    }

    const seed = currentVariant ?? currentVariants[currentVariants.length - 1] ?? baseTemplate.defaultVariants[0];
    const nextVariant: RestaurantEmailTemplateVariant = {
      ...seed,
      id: createVariantId(selectedTemplateKey),
      name: `Variant ${currentVariants.length + 1}`,
      order: currentVariants.length,
      isActive: true,
    };

    updateCurrentVariants((variants) => [...variants, nextVariant]);
    setSelectedVariantId(nextVariant.id);
  };

  const handleMoveVariant = (variantId: string, direction: -1 | 1) => {
    updateCurrentVariants((variants) => {
      const ordered = [...variants].sort((left, right) => left.order - right.order);
      const index = ordered.findIndex((variant) => variant.id === variantId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
        return variants;
      }

      const swapped = [...ordered];
      [swapped[index], swapped[targetIndex]] = [swapped[targetIndex]!, swapped[index]!];
      return swapped.map((variant, nextIndex) => ({ ...variant, order: nextIndex }));
    });
  };

  const handleDeleteVariant = (variantId: string) => {
    if (currentVariants.length <= 1) {
      toast.error('Each template needs at least one variant.');
      return;
    }

    updateCurrentVariants((variants) =>
      variants
        .filter((variant) => variant.id !== variantId)
        .map((variant, index) => ({ ...variant, order: index })),
    );

    if (selectedVariantId === variantId) {
      const nextVariant = currentVariants.find((variant) => variant.id !== variantId);
      setSelectedVariantId(nextVariant?.id ?? null);
    }
  };

  const handleDiscardDraft = () => {
    if (!selectedTemplateKey) return;
    setDrafts((current) => {
      const next = { ...current };
      delete next[selectedTemplateKey];
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedTemplateKey) return;

    try {
      await updateMutation.mutateAsync({
        templateKey: selectedTemplateKey,
        variants: currentVariants,
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[selectedTemplateKey];
        return next;
      });
      toast.success('Template saved', {
        description: 'Restaurant-specific copy variants are now live for future sends.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save template';
      toast.error('Save failed', { description: message });
    }
  };

  const handleResetTemplate = async (templateKey: RestaurantBookingEmailTemplateKey) => {
    const template = templateMap.get(templateKey);
    if (!template || template.status === 'default') {
      return;
    }

    const confirmed = window.confirm(`Reset "${template.title}" back to the system default variants?`);
    if (!confirmed) return;

    try {
      await resetMutation.mutateAsync({ templateKey });
      setDrafts((current) => {
        const next = { ...current };
        delete next[templateKey];
        return next;
      });
      toast.success('Template reset', {
        description: `${template.title} is using the default copy again.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reset template';
      toast.error('Reset failed', { description: message });
    }
  };

  const handleSendTest = async () => {
    if (!selectedTemplateKey) return;
    if (!testEmail.trim()) {
      toast.error('Enter a test email address first.');
      return;
    }

    try {
      const result = await testSendMutation.mutateAsync({
        templateKey: selectedTemplateKey,
        payload: {
          toEmail: testEmail.trim(),
          preferredVariantId: selectedVariantId ?? undefined,
          variants: currentVariants,
        },
      });
      toast.success('Test email sent', {
        description: `Delivered to ${testEmail.trim()} via ${result.provider}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send test email';
      toast.error('Test send failed', { description: message });
    }
  };

  if (!restaurantId) {
    return (
      <SettingsCard
        title="Email Templates"
        description="Select a restaurant to manage its booking email variants."
      >
        <p className="text-sm text-muted-foreground">
          Choose a restaurant using the sidebar switcher to browse and customize booking email copy.
        </p>
      </SettingsCard>
    );
  }

  if (templatesQuery.isLoading && !templatesQuery.data) {
    return (
      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr),380px]">
        <SettingsCard title="Template gallery" description="Loading template groups…">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </SettingsCard>
        <SettingsCard title="Editor" description="Loading selected template…">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </SettingsCard>
        <SettingsCard title="Preview" description="Loading live preview…">
          <Skeleton className="h-[720px] w-full" />
        </SettingsCard>
      </div>
    );
  }

  if (templatesQuery.error) {
    return (
      <SettingsCard title="Email Templates" description="Manage booking confirmation, reminder, and review copy.">
        <Alert variant="destructive">
          <AlertTitle>Unable to load email templates</AlertTitle>
          <AlertDescription>{templatesQuery.error.message}</AlertDescription>
        </Alert>
      </SettingsCard>
    );
  }

  return (
    <div className="space-y-4">
      {!templatesQuery.data?.canEdit ? (
        <Alert variant="info">
          <Sparkles className="size-4" />
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>
            You can review {restaurantName}&apos;s template setup here, but only owners and managers can change copy or send tests.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr),380px]">
        <SettingsCard
          title="Template Gallery"
          description="Browse guest-facing booking emails by journey stage."
          className="h-fit"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-search" className="sr-only">
                Search email templates
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="template-search"
                  name="template-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search templates…"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-5">
              {filteredGroups.map((group) => (
                <section key={group.key} className="space-y-2">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">{group.title}</div>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <div className="space-y-3">
                    {group.templates.map((template) => {
                      const active = selectedTemplateKey === template.key;
                      const draftForTemplate = drafts[template.key];
                      const isDirty =
                        Boolean(draftForTemplate) &&
                        normalizeVariantsForCompare(draftForTemplate ?? []) !== normalizeVariantsForCompare(template.variants);

                      return (
                        <div
                          key={template.key}
                          onClick={() => setSelectedTemplateKey(template.key)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedTemplateKey(template.key);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            'w-full rounded-2xl border p-4 text-left transition hover:border-primary/40 hover:bg-muted/30',
                            active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{template.title}</div>
                              <p className="text-xs leading-relaxed text-muted-foreground">{template.description}</p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(template.status)}>{getStatusLabel(template.status)}</Badge>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <VariantCountMeter
                              activeCount={(draftForTemplate ?? template.variants).filter((variant) => variant.isActive).length}
                              totalCount={(draftForTemplate ?? template.variants).length}
                            />
                            {isDirty ? <Badge variant="outline">Unsaved</Badge> : null}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant={active ? 'default' : 'outline'}>
                              <PenSquare />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedTemplateKey(template.key);
                              }}
                            >
                              <Eye />
                              Preview
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleResetTemplate(template.key);
                              }}
                              disabled={!templatesQuery.data?.canEdit || template.status === 'default' || resetMutation.isPending}
                            >
                              <RefreshCcw />
                              Reset
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              {filteredGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No templates match “{searchQuery}”.
                </div>
              ) : null}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title={baseTemplate?.title ?? 'Template Editor'}
          description={baseTemplate?.description ?? 'Choose a template to edit its copy variants.'}
          headerAction={
            baseTemplate ? (
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(baseTemplate.status)}>{getStatusLabel(baseTemplate.status)}</Badge>
                {isCurrentDirty ? <Badge variant="outline">Unsaved</Badge> : null}
              </div>
            ) : null
          }
          footer={
            baseTemplate ? (
              <div className="flex w-full flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="email-template-test-email" className="sr-only">
                    Test email address
                  </Label>
                  <Input
                    id="email-template-test-email"
                    name="email-template-test-email"
                    type="email"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    placeholder="Send a test email to…"
                    className="max-w-sm"
                    disabled={!templatesQuery.data?.canEdit}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSendTest()}
                    disabled={!templatesQuery.data?.canEdit || testSendMutation.isPending}
                  >
                    <Send />
                    {testSendMutation.isPending ? 'Sending…' : 'Send Test'}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    System layout, booking facts, delivery rules, and destination URLs stay locked. Only copy variants are editable here.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleDiscardDraft}
                      disabled={!templatesQuery.data?.canEdit || !isCurrentDirty}
                    >
                      Discard changes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleResetTemplate(baseTemplate.key)}
                      disabled={!templatesQuery.data?.canEdit || resetMutation.isPending || baseTemplate.status === 'default'}
                    >
                      <RefreshCcw />
                      Reset to default
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={!templatesQuery.data?.canEdit || updateMutation.isPending || !isCurrentDirty}
                    >
                      <Save />
                      {updateMutation.isPending ? 'Saving…' : 'Save template'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null
          }
        >
          {!baseTemplate || !currentVariant ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
              Select a template from the left to manage its variants.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">Variant manager</div>
                  <p className="text-xs text-muted-foreground">
                    Keep up to {MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS} variants active or inactive. Only active variants rotate in production.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddVariant}
                  disabled={!templatesQuery.data?.canEdit || currentVariants.length >= MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS}
                >
                  <Plus />
                  Add Variant
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[220px,minmax(0,1fr)]">
                <div className="space-y-3">
                  {currentVariants
                    .slice()
                    .sort((left, right) => left.order - right.order)
                    .map((variant, index, orderedVariants) => {
                      const active = selectedVariantId === variant.id;
                      return (
                        <div
                          key={variant.id}
                          onClick={() => setSelectedVariantId(variant.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedVariantId(variant.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            'w-full rounded-2xl border p-3 text-left transition',
                            active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 hover:bg-muted/30',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-foreground">{variant.name}</div>
                              <div className="text-xs text-muted-foreground">{variant.headline}</div>
                            </div>
                            <Badge variant={variant.isActive ? 'secondary' : 'outline'}>
                              {variant.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              disabled={!templatesQuery.data?.canEdit || index === 0}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMoveVariant(variant.id, -1);
                              }}
                            >
                              <ChevronUp />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              disabled={!templatesQuery.data?.canEdit || index === orderedVariants.length - 1}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMoveVariant(variant.id, 1);
                              }}
                            >
                              <ChevronDown />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="ml-auto"
                              disabled={!templatesQuery.data?.canEdit || currentVariants.length <= 1}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteVariant(variant.id);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="space-y-5 rounded-2xl border border-border/60 bg-background p-5">
                  <div className="grid gap-2">
                    <Label htmlFor="variant-name">Internal variant name</Label>
                    <Input
                      id="variant-name"
                      value={currentVariant.name}
                      onChange={(event) =>
                        updateCurrentVariant(currentVariant.id, (variant) => ({
                          ...variant,
                          name: event.target.value,
                        }))
                      }
                      disabled={!templatesQuery.data?.canEdit}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`variant-active-${currentVariant.id}`}
                        className="text-sm font-medium text-foreground"
                      >
                        Rotate this variant in production
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        Inactive variants stay in the editor but are skipped by live sends.
                      </div>
                    </div>
                    <Switch
                      id={`variant-active-${currentVariant.id}`}
                      checked={currentVariant.isActive}
                      onCheckedChange={(checked) =>
                        updateCurrentVariant(currentVariant.id, (variant) => ({
                          ...variant,
                          isActive: checked,
                        }))
                      }
                      disabled={!templatesQuery.data?.canEdit}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="variant-headline">Headline</Label>
                    <Input
                      id="variant-headline"
                      value={currentVariant.headline}
                      onChange={(event) =>
                        updateCurrentVariant(currentVariant.id, (variant) => ({
                          ...variant,
                          headline: event.target.value,
                        }))
                      }
                      disabled={!templatesQuery.data?.canEdit}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="variant-intro">Intro copy</Label>
                    <Textarea
                      id="variant-intro"
                      value={currentVariant.intro}
                      onChange={(event) =>
                        updateCurrentVariant(currentVariant.id, (variant) => ({
                          ...variant,
                          intro: event.target.value,
                        }))
                      }
                      className="min-h-[160px]"
                      disabled={!templatesQuery.data?.canEdit}
                    />
                  </div>

                  {baseTemplate.supportsCtaLabel ? (
                    <div className="grid gap-2">
                      <Label htmlFor="variant-cta-label">CTA label</Label>
                      <Input
                        id="variant-cta-label"
                        value={currentVariant.ctaLabel}
                        onChange={(event) =>
                          updateCurrentVariant(currentVariant.id, (variant) => ({
                            ...variant,
                            ctaLabel: event.target.value,
                          }))
                        }
                        disabled={!templatesQuery.data?.canEdit}
                      />
                    </div>
                  ) : null}

                  <Alert variant="default">
                    <Mail className="size-4" />
                    <AlertTitle>Supported placeholders</AlertTitle>
                    <AlertDescription>
                      Use <code>{'{{firstName}}'}</code>, <code>{'{{venue}}'}</code>, <code>{'{{date}}'}</code>,{' '}
                      <code>{'{{time}}'}</code>, and <code>{'{{party}}'}</code> inside your copy.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </div>
          )}
        </SettingsCard>

        <SettingsCard
          title="Live Preview"
          description="Preview the currently selected variant exactly as the renderer sees it."
          headerAction={
            <Tabs value={previewDevice} onValueChange={(value) => setPreviewDevice(value as 'desktop' | 'mobile')}>
              <TabsList>
                <TabsTrigger value="desktop">
                  <Monitor />
                  Desktop
                </TabsTrigger>
                <TabsTrigger value="mobile">
                  <Smartphone />
                  Mobile
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          {previewMutation.isPending && !previewMutation.data ? (
            <Skeleton className="h-[720px] w-full" />
          ) : previewMutation.data ? (
            <Tabs value={previewDevice} className="space-y-4">
              <TabsContent value="desktop" className="mt-0">
                <PreviewCanvas html={previewMutation.data.html} device="desktop" />
              </TabsContent>
              <TabsContent value="mobile" className="mt-0">
                <PreviewCanvas html={previewMutation.data.html} device="mobile" />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
              Preview data will appear here once a template is selected.
            </div>
          )}
        </SettingsCard>
      </div>
    </div>
  );
}
