'use client';

import { Mail, Monitor, Search, Smartphone } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

function DetailBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1 rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      <div className={cn('text-sm text-zinc-900 break-words', mono && 'font-mono text-xs')}>{value}</div>
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
    <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Mail className="size-4 text-zinc-400" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-zinc-800">Live Preview</div>
            <div className="text-xs text-zinc-500">Rendered using the current draft variant.</div>
          </div>
        </div>

        <div className="inline-flex items-center rounded-lg bg-zinc-200/60 p-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={cn(
              'rounded-md text-zinc-500 hover:text-zinc-900',
              previewDevice === 'desktop' && 'bg-white text-indigo-700 shadow-sm',
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
              'rounded-md text-zinc-500 hover:text-zinc-900',
              previewDevice === 'mobile' && 'bg-white text-indigo-700 shadow-sm',
            )}
            onClick={() => onPreviewDeviceChange('mobile')}
            aria-label="Mobile preview"
          >
            <Smartphone className="size-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-[36rem] overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgba(39,39,42,0.04)_1px,transparent_0)] bg-[length:18px_18px] p-6">
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
                <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">Delivery summary</div>
                      <p className="text-xs text-zinc-500">Exactly what the inbox and recipient will see.</p>
                    </div>
                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                      {preview.selectedVariantName}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <DetailBlock label="Subject" value={preview.subject} />
                    <DetailBlock label="Preheader" value={preview.preheader} />
                    <DetailBlock label="CTA destination" value={preview.ctaUrl} mono />
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-zinc-900">Plain text fallback</div>
                  <p className="mt-1 text-xs text-zinc-500">Used by clients that block HTML or for deliverability spot checks.</p>
                  <pre className="mt-4 max-h-48 overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-xs leading-6 text-zinc-700 whitespace-pre-wrap">
                    {preview.text}
                  </pre>
                </div>
              </div>

              <div className="flex items-start justify-center">
                <div
                  className={cn(
                    'transition-all duration-500 ease-in-out',
                    isMobile ? 'w-[320px] max-w-full min-h-[600px]' : 'w-full max-w-[600px] min-h-[500px]',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-full w-full flex-col overflow-hidden bg-white shadow-xl ring-1 ring-zinc-950/5',
                      isMobile ? 'rounded-[2.5rem] border-[8px] border-zinc-950' : 'rounded-[1rem]',
                    )}
                  >
                    {!isMobile ? (
                      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-zinc-100 px-4">
                        <div className="hidden gap-2 sm:flex">
                          <span className="size-3 rounded-full bg-red-400" />
                          <span className="size-3 rounded-full bg-amber-400" />
                          <span className="size-3 rounded-full bg-emerald-400" />
                        </div>
                        <div className="mx-auto flex w-full items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-500 shadow-sm sm:w-auto">
                          <Search className="size-3 text-zinc-400" />
                          mail.google.com
                        </div>
                      </div>
                    ) : null}

                    <iframe
                      title={`${previewDevice} email preview`}
                      srcDoc={preview.html}
                      className={cn('w-full flex-1 bg-white', isMobile ? 'min-h-[640px]' : 'min-h-[720px]')}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[30rem] w-full items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-300 bg-white/80 px-6 text-center text-sm text-zinc-500 shadow-sm">
              Start editing a template to render the preview here.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
