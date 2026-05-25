import { AlertCircle, ChevronLeft, Eye, Info, RotateCcw, Save, Sparkles } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import type { RestaurantEmailTemplate } from '@/services/ops/restaurants';

export function EmailTemplatesEditorHeader({
  baseTemplate,
  canEdit,
  isCurrentDirty,
  isSaving,
  onBackToList,
  onDiscardCurrent,
  onOpenPreview,
  onSave,
  restaurantName,
}: {
  readonly baseTemplate: RestaurantEmailTemplate | null;
  readonly canEdit: boolean;
  readonly isCurrentDirty: boolean;
  readonly isSaving: boolean;
  readonly onBackToList: () => void;
  readonly onDiscardCurrent: () => void;
  readonly onOpenPreview: () => void;
  readonly onSave: () => void;
  readonly restaurantName: string;
}) {
  return (
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
            <ChevronLeft data-icon="icon" />
          </Button>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">
              {baseTemplate?.title ?? 'Select a template'}
            </div>
            <div className="truncate text-sm text-muted-foreground">
              {baseTemplate?.description ?? `Choose a template to edit copy for ${restaurantName}.`}
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
            <Eye data-icon="icon" />
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
          <Button type="button" onClick={onSave} disabled={!canEdit || !isCurrentDirty || isSaving}>
            {isSaving ? (
              <RotateCcw data-icon="inline-start" className="animate-spin" />
            ) : (
              <Save data-icon="inline-start" />
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
  );
}

export function EmailTemplatesViewOnlyAlert({
  canEdit,
  restaurantName,
}: {
  readonly canEdit: boolean;
  readonly restaurantName: string;
}) {
  if (canEdit) {
    return null;
  }

  return (
    <Alert variant="info" className="border-primary/20 bg-primary/10">
      <Info className="size-4" />
      <AlertTitle>View only</AlertTitle>
      <AlertDescription>
        You can review {restaurantName}&apos;s template setup here, but only owners and managers can
        change copy or send tests.
      </AlertDescription>
    </Alert>
  );
}

export function EmailTemplatesRotationAlert({
  activeVariantCount,
  hasTemplate,
}: {
  readonly activeVariantCount: number;
  readonly hasTemplate: boolean;
}) {
  if (!hasTemplate) {
    return null;
  }

  return (
    <Alert className="border-primary/20 bg-primary/10 text-foreground">
      <Sparkles className="size-4 text-primary" />
      <AlertTitle>A/B testing is live</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          {activeVariantCount} active {activeVariantCount === 1 ? 'variant is' : 'variants are'}{' '}
          rotating for future sends.
        </p>
        <p className="text-xs text-muted-foreground">
          Keep variants focused and distinct so you can compare engagement without changing delivery
          rules or booking data.
        </p>
      </AlertDescription>
    </Alert>
  );
}
