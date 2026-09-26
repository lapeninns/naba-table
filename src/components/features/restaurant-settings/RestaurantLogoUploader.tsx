'use client';

import { CircleAlert, Loader2, Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/typography';
import {
  useOpsRemoveRestaurantLogo,
  useOpsRestaurantLogoUpload,
} from '@/hooks/ops/useOpsRestaurantLogoUpload';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { cn } from '@/lib/utils';

import { ConfirmDialog } from './ConfirmDialog';
import {
  extractLogoInitials,
  LOGO_ALLOWED_MIME_TYPES,
  type LogoAnalyticsEvent,
  validateLogoFile,
} from './restaurantLogoModel';
import { getSafeSettingsErrorMessage } from './shared/settingsErrorCopy';

type RestaurantLogoUploaderProps = {
  restaurantId: string | null;
  restaurantName: string;
  logoUrl: string | null;
  isLoading?: boolean;
  /**
   * The logo the page should preview: a local object URL while uploading, `null` while removing,
   * and `undefined` to fall back to the saved logo (after success or failure).
   */
  onPreviewChange?: (previewUrl: string | null | undefined) => void;
};

function emitLogoAnalytics(eventName: LogoAnalyticsEvent, props: Record<string, unknown>) {
  track(eventName, props);
  void emit(eventName, props);
}

export function RestaurantLogoUploader({
  restaurantId,
  restaurantName,
  logoUrl,
  isLoading = false,
  onPreviewChange,
}: RestaurantLogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Both hooks write the canonical restaurant into the details cache and own the success toast.
  const uploadMutation = useOpsRestaurantLogoUpload(restaurantId);
  const removeMutation = useOpsRemoveRestaurantLogo(restaurantId);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const displayUrl = localPreview ?? logoUrl ?? null;

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  const initials = useMemo(
    () => extractLogoInitials(restaurantName || 'Restaurant'),
    [restaurantName],
  );
  const busy = uploadMutation.isPending || removeMutation.isPending;
  const controlsDisabled = busy || !restaurantId || isLoading;

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const validation = validateLogoFile(file);
    if (validation) {
      emitLogoAnalytics('restaurant_profile_logo_validation_error', {
        restaurant_id: restaurantId,
        code: validation.code,
        size: file.size,
        type: file.type,
      });
      setErrorMessage(validation.message);
      resetFileInput();
      return;
    }

    setErrorMessage(null);
    const uploadStartedAt = Date.now();
    const nextPreview = URL.createObjectURL(file);
    setLocalPreview(nextPreview);
    onPreviewChange?.(nextPreview);

    try {
      await uploadMutation.mutateAsync(file);
      // The saved profile now carries the new logo; stop overriding it with the local preview.
      onPreviewChange?.(undefined);
      emitLogoAnalytics('restaurant_profile_logo_saved', {
        restaurant_id: restaurantId,
        action: 'upload',
        elapsed_ms: Math.max(0, Date.now() - uploadStartedAt),
      });
    } catch (error) {
      setErrorMessage(getSafeSettingsErrorMessage(error, 'The logo could not be uploaded.'));
      onPreviewChange?.(undefined);
      emitLogoAnalytics('restaurant_profile_logo_save_failed', {
        restaurant_id: restaurantId,
        action: 'upload',
        code: error instanceof Error ? error.name : 'unknown',
      });
    } finally {
      setLocalPreview(null);
      resetFileInput();
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoUrl || !restaurantId) {
      return;
    }
    setErrorMessage(null);
    onPreviewChange?.(null);
    const removeStartedAt = Date.now();
    try {
      await removeMutation.mutateAsync();
      onPreviewChange?.(undefined);
      emitLogoAnalytics('restaurant_profile_logo_saved', {
        restaurant_id: restaurantId,
        action: 'remove',
        elapsed_ms: Math.max(0, Date.now() - removeStartedAt),
      });
    } catch (error) {
      setErrorMessage(getSafeSettingsErrorMessage(error, 'The logo could not be removed.'));
      onPreviewChange?.(undefined);
      emitLogoAnalytics('restaurant_profile_logo_save_failed', {
        restaurant_id: restaurantId,
        action: 'remove',
        code: error instanceof Error ? error.name : 'unknown',
      });
    }
  };

  const statusMessage =
    errorMessage ??
    (busy
      ? 'Saving logo…'
      : restaurantId
        ? 'Saves as soon as you upload it.'
        : 'Select a restaurant to upload a logo.');

  return (
    <div
      id="restaurant-logo-uploader"
      tabIndex={-1}
      role="group"
      aria-labelledby="restaurant-logo-title"
      className="flex flex-col gap-4 rounded-lg border border-border/70 p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 @md:flex-row @md:items-start"
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt={`${restaurantName} logo`}
            fill
            sizes="64px"
            className="object-cover"
            priority={false}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
            <span aria-hidden="true">{initials}</span>
          </div>
        )}
        {busy || isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2
              className="size-5 animate-spin text-foreground motion-reduce:animate-none"
              aria-hidden
            />
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p id="restaurant-logo-title" className="text-sm font-medium text-foreground">
          Logo
        </p>
        <Text variant="caption">Square, 320×320px, PNG, JPG or WEBP, under 2 MB.</Text>
        <Text
          variant="caption"
          role="status"
          aria-live={errorMessage ? 'assertive' : 'polite'}
          className={cn('flex items-start gap-1.5', errorMessage && 'text-destructive')}
        >
          {errorMessage ? <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : null}
          <span>{statusMessage}</span>
        </Text>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            id="restaurant-logo-upload"
            type="button"
            variant="outline"
            disabled={controlsDisabled}
            aria-busy={uploadMutation.isPending || undefined}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : (
              <Upload data-icon="inline-start" aria-hidden />
            )}
            {logoUrl ? 'Replace logo' : 'Upload logo'}
          </Button>
          {logoUrl ? (
            <Button
              type="button"
              variant="ghost"
              disabled={controlsDisabled}
              onClick={() => setConfirmRemoveOpen(true)}
            >
              <Trash2 data-icon="inline-start" aria-hidden />
              Remove logo
            </Button>
          ) : null}
          <Input
            ref={fileInputRef}
            type="file"
            accept={LOGO_ALLOWED_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Upload restaurant logo"
            disabled={controlsDisabled}
          />
        </div>
      </div>
      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title="Remove logo?"
        description="Your logo is removed straight away and guests see your initials instead."
        confirmLabel="Remove logo"
        tone="destructive"
        onConfirm={() => {
          setConfirmRemoveOpen(false);
          void handleRemoveLogo();
        }}
      />
    </div>
  );
}
