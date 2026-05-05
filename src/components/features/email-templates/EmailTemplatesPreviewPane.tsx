'use client';

import { Mail, Monitor, Search, Smartphone } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Iframe } from '@/components/ui/iframe';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { EmailTemplatesPreviewDevice } from '@/hooks/ops/useOpsEmailTemplatesPageState';
import type { RestaurantEmailTemplatePreview } from '@/services/ops/restaurants';

type EmailTemplatesPreviewPaneProps = {
  previewDevice: EmailTemplatesPreviewDevice;
  onPreviewDeviceChange: (device: EmailTemplatesPreviewDevice) => void;
  preview: RestaurantEmailTemplatePreview | null;
  isLoading: boolean;
  errorMessage: string | null;
};

function DetailBlock({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1 rounded-2xl border border-border bg-muted/40 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className={cn('break-words text-sm text-foreground', mono && 'font-mono text-xs')}>
        {value}
      </div>
    </div>
  );
}

export function EmailTemplatesPreviewPane({
  previewDevice,
  onPreviewDeviceChange,
  preview,
  isLoading,
  errorMessage,
}: EmailTemplatesPreviewPaneProps) {
  const isMobile = previewDevice === 'mobile';

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-border bg-background shadow-sm">
      <header className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Mail className="size-4 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground">Live Preview</div>
            <div className="text-xs text-muted-foreground">
              Rendered using the current draft variant.
            </div>
          </div>
        </div>

        <div className="inline-flex items-center rounded-lg bg-muted p-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={cn(
              'rounded-md text-muted-foreground hover:text-foreground',
              previewDevice === 'desktop' && 'bg-background text-primary shadow-sm',
            )}
            onClick={() => onPreviewDeviceChange('desktop')}
            aria-label="Desktop preview"
          >
            <Monitor className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={cn(
              'rounded-md text-muted-foreground hover:text-foreground',
              previewDevice === 'mobile' && 'bg-background text-primary shadow-sm',
            )}
            onClick={() => onPreviewDeviceChange('mobile')}
            aria-label="Mobile preview"
          >
            <Smartphone className="size-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-[36rem] overflow-y-auto bg-muted/30 p-[var(--pg-gutter)]">
        <div className="flex flex-col gap-6">
          {errorMessage ? (
            <Alert variant="destructive" className="w-full">
              <AlertTitle>Preview unavailable</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : isLoading && !preview ? (
            <>
              <Skeleton className="h-28 w-full rounded-[1.5rem]" />
              <Skeleton className="h-40 w-full rounded-[1.5rem]" />
              <Skeleton className="h-[40rem] w-full rounded-[1.5rem]" />
            </>
          ) : preview ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border border-border bg-background p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Delivery summary</div>
                      <p className="text-xs text-muted-foreground">
                        Exactly what the inbox and recipient will see.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      {preview.selectedVariantName}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <DetailBlock label="Subject" value={preview.subject} />
                    <DetailBlock label="Preheader" value={preview.preheader} />
                    {preview.cue ? <DetailBlock label="Photo cue" value={preview.cue} /> : null}
                    {preview.ask ? <DetailBlock label="Review ask" value={preview.ask} /> : null}
                    <DetailBlock label="CTA destination" value={preview.ctaUrl} mono />
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-border bg-background p-4 shadow-sm">
                  <div className="text-sm font-semibold text-foreground">Plain text fallback</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Used by clients that block HTML or for deliverability spot checks.
                  </p>
                  <pre className="mt-4 max-h-48 overflow-auto rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-6 whitespace-pre-wrap text-muted-foreground">
                    {preview.text}
                  </pre>
                </div>
              </div>

              <div className="flex items-start justify-center">
                <div
                  className={cn(
                    'transition-all duration-500 ease-in-out',
                    isMobile
                      ? 'w-[320px] max-w-full min-h-[600px]'
                      : 'w-full max-w-[600px] min-h-[500px]',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-full w-full flex-col overflow-hidden bg-background shadow-xl ring-1 ring-border',
                      isMobile
                        ? 'rounded-[2.5rem] border-[8px] border-foreground'
                        : 'rounded-[1rem]',
                    )}
                  >
                    {!isMobile ? (
                      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-muted px-4">
                        <div className="hidden gap-2 sm:flex">
                          <span className="size-3 rounded-full bg-destructive" />
                          <span className="size-3 rounded-full bg-primary" />
                          <span className="size-3 rounded-full bg-muted-foreground" />
                        </div>
                        <div className="mx-auto flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm sm:w-auto">
                          <Search className="size-3 text-muted-foreground" />
                          mail.google.com
                        </div>
                      </div>
                    ) : null}

                    <Iframe
                      title={`${previewDevice} email preview`}
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={preview.html}
                      className={cn(
                        'w-full flex-1 bg-background',
                        isMobile ? 'min-h-[640px]' : 'min-h-[720px]',
                      )}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <OpsEmptyState
              title="Preview not ready"
              description="Start editing a template to render the preview here."
              className="min-h-[30rem] w-full rounded-[1.5rem] bg-background/80 px-6 shadow-sm"
            />
          )}
        </div>
      </div>
    </section>
  );
}
