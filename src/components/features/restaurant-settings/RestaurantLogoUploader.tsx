'use client';

import { Loader2, Upload, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOpsRestaurantLogoUpload } from '@/hooks/ops/useOpsRestaurantLogoUpload';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { cn } from '@/lib/utils';

import {
  extractLogoInitials,
  LOGO_ALLOWED_MIME_TYPES,
  type LogoAnalyticsEvent,
  validateLogoFile,
} from './restaurantLogoModel';

import type { HttpError } from '@/lib/http/errors';
import type { RestaurantProfile } from '@/services/ops/restaurants';
import type { UseMutationResult } from '@tanstack/react-query';

type RestaurantLogoUploaderProps = {
  restaurantId: string | null;
  restaurantName: string;
  logoUrl: string | null;
  updateMutation: UseMutationResult<
    RestaurantProfile,
    HttpError | Error,
    Partial<RestaurantProfile>
  >;
  isLoading?: boolean;
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
  updateMutation,
  isLoading = false,
  onPreviewChange,
}: RestaurantLogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMutation = useOpsRestaurantLogoUpload(restaurantId);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  const busy = uploadMutation.isPending || updateMutation.isPending;
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
      const uploaded = await uploadMutation.mutateAsync(file);
      await updateMutation.mutateAsync({ logoUrl: uploaded.url });
      onPreviewChange?.(uploaded.url);
      emitLogoAnalytics('restaurant_profile_logo_saved', {
        restaurant_id: restaurantId,
        action: 'upload',
        elapsed_ms: Math.max(0, Date.now() - uploadStartedAt),
      });
    } catch (error) {
      console.error('[restaurant-logo] upload failed', error);
      const message = error instanceof Error ? error.message : 'Failed to upload logo';
      setErrorMessage(message);
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
      await updateMutation.mutateAsync({ logoUrl: null });
      emitLogoAnalytics('restaurant_profile_logo_saved', {
        restaurant_id: restaurantId,
        action: 'remove',
        elapsed_ms: Math.max(0, Date.now() - removeStartedAt),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove logo';
      setErrorMessage(message);
      onPreviewChange?.(undefined);
      emitLogoAnalytics('restaurant_profile_logo_save_failed', {
        restaurant_id: restaurantId,
        action: 'remove',
        code: error instanceof Error ? error.name : 'unknown',
      });
    }
  };

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-md border border-border bg-background">
            {displayUrl ? (
              <Image
                src={displayUrl}
                alt={`${restaurantName} logo`}
                fill
                sizes="80px"
                className="object-cover"
                priority={false}
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-xl font-semibold text-muted-foreground">
                <span aria-hidden="true">{initials}</span>
              </div>
            )}
            {(busy || isLoading) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div>
            <Label className="text-sm font-medium text-foreground">Email branding</Label>
            <p className="text-sm text-muted-foreground">
              Guests will see this logo inside booking emails and other notifications.
            </p>
            <p className="text-xs text-muted-foreground">
              Recommended: 320×320px PNG, JPG, WEBP or SVG under 2 MB.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={controlsDisabled}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {logoUrl ? 'Replace logo' : 'Upload logo'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={controlsDisabled || !logoUrl}
              onClick={handleRemoveLogo}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove
            </Button>
          </div>
          <Input
            ref={fileInputRef}
            type="file"
            accept={LOGO_ALLOWED_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Upload restaurant logo"
            disabled={controlsDisabled}
          />
          <p
            role="status"
            aria-live={errorMessage ? 'assertive' : 'polite'}
            className={cn('text-xs text-muted-foreground', errorMessage && 'text-destructive')}
          >
            {errorMessage ??
              (restaurantId
                ? 'Images are cropped to square automatically.'
                : 'Select a restaurant to upload a logo.')}
          </p>
        </div>
      </div>
    </div>
  );
}
