'use client';

import { Loader2, Upload, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useOpsRestaurantLogoUpload } from '@/hooks';
import { cn } from '@/lib/utils';

import type { HttpError } from '@/lib/http/errors';
import type { RestaurantProfile } from '@/services/ops/restaurants';
import type { UseMutationResult } from '@tanstack/react-query';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

type RestaurantLogoUploaderProps = {
  restaurantId: string | null;
  restaurantName: string;
  logoUrl: string | null;
  updateMutation: UseMutationResult<RestaurantProfile, HttpError | Error, Partial<RestaurantProfile>>;
  isLoading?: boolean;
};

type ValidationError = {
  code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE';
  message: string;
};

function validateFile(file: File): ValidationError | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      code: 'FILE_TOO_LARGE',
      message: 'Images must be 2 MB or smaller.',
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      code: 'UNSUPPORTED_FILE',
      message: 'Supported formats: JPEG, PNG, WEBP, SVG.',
    };
  }

  return null;
}

function extractInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('')
    .padEnd(2, '•');
}

export function RestaurantLogoUploader({
  restaurantId,
  restaurantName,
  logoUrl,
  updateMutation,
  isLoading = false,
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

  const initials = useMemo(() => extractInitials(restaurantName || 'Restaurant'), [restaurantName]);
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

    const validation = validateFile(file);
    if (validation) {
      setErrorMessage(validation.message);
      resetFileInput();
      return;
    }

    setErrorMessage(null);
    const nextPreview = URL.createObjectURL(file);
    setLocalPreview(nextPreview);

    try {
      const uploaded = await uploadMutation.mutateAsync(file);
      await updateMutation.mutateAsync({ logoUrl: uploaded.url });
      toast.success('Logo updated');
    } catch (error) {
      console.error('[restaurant-logo] upload failed', error);
      const message = error instanceof Error ? error.message : 'Failed to upload logo';
      setErrorMessage(message);
      toast.error(message);
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
    try {
      await updateMutation.mutateAsync({ logoUrl: null });
      toast.success('Logo removed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove logo';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-md border border-border bg-background">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={`${restaurantName} logo`}
                className="h-full w-full object-cover"
                aria-hidden={false}
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
            <p className="text-xs text-muted-foreground">Recommended: 320×320px PNG, JPG, WEBP or SVG under 2 MB.</p>
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
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
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
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
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
            {errorMessage ?? (restaurantId ? 'Images are cropped to square automatically.' : 'Select a restaurant to upload a logo.')}
          </p>
        </div>
      </div>
    </div>
  );
}
