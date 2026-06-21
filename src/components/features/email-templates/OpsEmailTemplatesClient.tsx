'use client';

import Link from 'next/link';
import { useRef } from 'react';

import { EmailTemplatesEditorPane } from '@/components/features/email-templates/EmailTemplatesEditorPane';
import { EmailTemplatesPreviewPane } from '@/components/features/email-templates/EmailTemplatesPreviewPane';
import { EmailTemplatesSidebarPane } from '@/components/features/email-templates/EmailTemplatesSidebarPane';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsEmailTemplatesPageState } from '@/hooks/ops/useOpsEmailTemplatesPageState';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

export function OpsEmailTemplatesClient() {
  const state = useOpsEmailTemplatesPageState();
  const previewSectionRef = useRef<HTMLDivElement | null>(null);

  const scrollToPreview = () => {
    previewSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  if (state.memberships.length === 0) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <OpsEmptyState
            title="No restaurant access"
            description="You need access to at least one restaurant to manage guest-facing email templates."
            action={
              <Button asChild variant="secondary">
                <Link href={opsHref('/dashboard')} prefetch={false}>
                  Return to ops home
                </Link>
              </Button>
            }
          />
        </section>
      </OpsPageShell>
    );
  }

  if (!state.restaurantId) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <OpsEmptyState
            title="Choose a restaurant"
            description="Use the sidebar switcher to choose the restaurant whose email templates you want to edit."
          />
        </section>
      </OpsPageShell>
    );
  }

  const showSkeleton = state.templatesQuery.isLoading && !state.templatesQuery.data;
  const previewErrorMessage =
    state.previewMutation.error instanceof Error ? state.previewMutation.error.message : null;

  return (
    <OpsPageShell
      variant="immersive"
      as="section"
      className="relative flex bg-muted/40 text-foreground"
    >
      {showSkeleton ? (
        <div className="grid h-full w-full min-w-0 gap-0 lg:grid-cols-[20rem,minmax(0,1fr)]">
          <div className="hidden border-r border-border bg-background p-[var(--pg-gutter)] lg:block">
            <Skeleton className="h-7 w-44 rounded-xl" />
            <Skeleton className="mt-2 h-4 w-56 rounded-xl" />
            <Skeleton className="mt-4 h-11 w-full rounded-xl" />
            <div className="mt-6 space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          </div>
          <div className="overflow-y-auto p-[var(--pg-gutter)]">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-[1.5rem]" />
              <Skeleton className="h-[640px] w-full rounded-[1.5rem]" />
              <Skeleton className="h-[720px] w-full rounded-[1.5rem]" />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn(
              state.activePane === 'list' ? 'flex' : 'hidden',
              'h-full min-h-0 w-full lg:flex lg:w-80 lg:shrink-0 xl:w-[22rem]',
            )}
          >
            <EmailTemplatesSidebarPane
              filteredGroups={state.filteredGroups}
              searchQuery={state.searchQuery}
              onSearchQueryChange={state.setSearchQuery}
              selectedTemplateKey={state.selectedTemplateKey}
              dirtyTemplateKeys={state.dirtyTemplateKeys}
              restaurantName={state.restaurantName}
              onSelectTemplate={state.handleSelectTemplate}
            />
          </div>

          <div
            className={cn(
              state.activePane === 'editor' ? 'flex' : 'hidden',
              'min-w-0 flex-1 flex-col overflow-y-auto lg:flex',
            )}
          >
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-[var(--pg-gutter)] py-[var(--pg-section-y-tight)]">
              <EmailTemplatesEditorPane
                restaurantName={state.restaurantName}
                canEdit={Boolean(state.templatesQuery.data?.canEdit)}
                baseTemplate={state.baseTemplate}
                currentVariants={state.currentVariants}
                currentVariant={state.currentVariant}
                selectedVariantId={state.selectedVariantId}
                activeVariantCount={state.activeVariantCount}
                isCurrentDirty={state.isCurrentDirty}
                testEmail={state.testEmail}
                onTestEmailChange={state.setTestEmail}
                activePane={state.activePane}
                isSaving={state.updateMutation.isPending}
                isResetting={state.resetMutation.isPending}
                isSendingTest={state.testSendMutation.isPending}
                onBackToList={() => state.setActivePane('list')}
                onOpenPreview={scrollToPreview}
                onDiscardCurrent={state.handleDiscardCurrent}
                onSave={state.handleSave}
                onAddVariant={state.handleAddVariant}
                onMoveVariant={state.handleMoveVariant}
                onDeleteVariant={state.handleDeleteVariant}
                onSelectVariant={state.setSelectedVariantId}
                onResetTemplate={state.handleResetTemplate}
                onSendTest={state.handleSendTest}
                onUpdateVariant={state.updateCurrentVariant}
              />

              <div ref={previewSectionRef} id="preview-section">
                <EmailTemplatesPreviewPane
                  previewDevice={state.previewDevice}
                  onPreviewDeviceChange={state.setPreviewDevice}
                  preview={state.preview}
                  isLoading={state.previewMutation.isPending}
                  errorMessage={previewErrorMessage}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </OpsPageShell>
  );
}
