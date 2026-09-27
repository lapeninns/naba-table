'use client';

import { CircleAlert, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { SettingsSegmentedControl } from '@/components/features/restaurant-settings/shared/SettingsSegmentedControl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Iframe } from '@/components/ui/iframe';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { CTA_DESTINATIONS, SAMPLE_BOOKING_DESCRIPTION } from './model/emailTemplateEditorModel';

import type { OpsEmailTemplatesEditor } from '@/hooks/ops/useOpsEmailTemplatesEditor';

type Device = 'desktop' | 'mobile';
type Format = 'email' | 'text';

const DEVICE_OPTIONS = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Phone' },
] as const satisfies readonly { value: Device; label: string }[];

const FORMAT_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Plain text' },
] as const satisfies readonly { value: Format; label: string }[];

const WIDTH: Record<Device, string> = { desktop: 'max-w-[640px]', mobile: 'max-w-[375px]' };

/**
 * The server-rendered email for the variant being edited, unsaved changes included. The frame
 * is fully sandboxed (no scripts, no same-origin access), so it scrolls inside a fixed height
 * instead of growing to its content.
 */
export function EmailTemplatePreview({ editor }: { editor: OpsEmailTemplatesEditor }) {
  const {
    templateKey,
    variants,
    variant,
    previewVariant,
    previewQuery,
    previewErrorMessage,
    restaurantName,
  } = editor;
  const [device, setDevice] = useState<Device>('desktop');
  const [format, setFormat] = useState<Format>('email');

  // A failed render keeps the last good preview of this email on screen, marked as out of date.
  const [lastRendered, setLastRendered] = useState(previewQuery.data);
  if (previewQuery.data && previewQuery.data !== lastRendered) setLastRendered(previewQuery.data);

  if (!templateKey || !previewVariant) return null;
  const preview =
    previewQuery.data ?? (lastRendered?.templateKey === templateKey ? lastRendered : undefined);
  const updating = previewQuery.isFetching || previewQuery.isPlaceholderData;
  const width = WIDTH[device];

  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <h2 className="mr-auto flex items-center gap-2 text-sm font-semibold">
          Preview
          {updating ? (
            <Loader2
              className="size-3.5 animate-spin text-muted-foreground"
              aria-label="Updating preview"
            />
          ) : null}
        </h2>
        <Select value={previewVariant.id} onValueChange={editor.setPreviewVariantId}>
          <SelectTrigger
            className="h-9 w-auto min-w-0 max-w-[220px]"
            aria-label="Variant to preview"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent collisionPadding={16} className="max-w-[calc(100vw-2rem)]">
            {variants.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name || 'Untitled variant'}
                {item.isActive ? '' : ' (paused)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SettingsSegmentedControl
          value={device}
          onValueChange={setDevice}
          options={DEVICE_OPTIONS}
          ariaLabel="Preview width"
        />
        <SettingsSegmentedControl
          value={format}
          onValueChange={setFormat}
          options={FORMAT_OPTIONS}
          ariaLabel="Preview format"
        />
      </div>

      <div className="grid content-start gap-3 overflow-y-auto bg-muted/60 p-3">
        {previewQuery.isError ? (
          <Alert
            variant="destructive"
            className={cn('mx-auto bg-background [&>svg]:size-4', width)}
          >
            <CircleAlert aria-hidden />
            <AlertDescription className="flex flex-col items-start gap-2">
              <p>
                {preview
                  ? 'The preview is out of date: the latest changes could not be rendered.'
                  : 'The preview could not be rendered.'}{' '}
                {previewErrorMessage}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                // The destructive Alert tints its text; the retry stays a neutral outline button.
                className="text-foreground"
                disabled={previewQuery.isFetching}
                aria-busy={previewQuery.isFetching || undefined}
                onClick={editor.retryPreview}
              >
                Retry preview
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {preview ? (
          <>
            <div
              aria-label="Inbox row"
              className={cn(
                'mx-auto grid w-full grid-cols-[32px_minmax(0,1fr)_auto] gap-x-2.5 gap-y-0.5 rounded-lg border bg-background px-3 py-2.5',
                width,
              )}
            >
              <span
                aria-hidden
                className="row-span-3 grid size-8 place-items-center rounded-full bg-muted text-sm font-semibold"
              >
                {restaurantName.trim().charAt(0).toUpperCase() || 'N'}
              </span>
              <span className="truncate font-semibold">{restaurantName}</span>
              <span className="text-xs text-muted-foreground">Now</span>
              <span className="col-span-2 truncate font-semibold">
                {preview.subject || '(no subject)'}
              </span>
              <span className="col-span-2 truncate text-sm text-muted-foreground">
                {preview.preheader}
              </span>
            </div>
            <div
              className={cn(
                'mx-auto w-full overflow-hidden rounded-lg border bg-background transition-opacity',
                width,
                updating && 'opacity-80',
              )}
            >
              {format === 'email' ? (
                <Iframe
                  title="Email preview"
                  srcDoc={preview.html}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  className="block h-[720px] w-full border-0"
                />
              ) : (
                <pre className="m-0 whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed">
                  {preview.text}
                </pre>
              )}
            </div>
          </>
        ) : previewQuery.isError ? null : (
          <div className={cn('mx-auto grid w-full gap-3', width)} aria-busy="true">
            <Skeleton className="h-16" />
            <Skeleton className="h-[480px]" />
            <span className="sr-only" role="status">
              Rendering the preview…
            </span>
          </div>
        )}

        <dl
          className={cn(
            'mx-auto grid w-full gap-1.5 rounded-lg border bg-background px-3 py-2.5 text-xs',
            width,
          )}
        >
          <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-2">
            <dt className="text-muted-foreground">Showing</dt>
            <dd>
              {previewVariant.id === variant?.id
                ? 'The variant you are editing, including unsaved changes'
                : `${previewVariant.name || 'Untitled variant'}, including unsaved changes`}
            </dd>
          </div>
          <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-2">
            <dt className="text-muted-foreground">Sample booking</dt>
            <dd>{SAMPLE_BOOKING_DESCRIPTION}</dd>
          </div>
          <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-2">
            <dt className="text-muted-foreground">Button goes to</dt>
            <dd>{CTA_DESTINATIONS[templateKey]}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
