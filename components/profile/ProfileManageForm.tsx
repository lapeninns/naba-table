'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import React from 'react';
import Image from 'next/image';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Upload, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useProfile, useUpdateProfile, useUploadProfileAvatar, coerceProfileUpdatePayload } from '@/hooks/useProfile';
import { HttpError } from '@/lib/http/errors';
import { profilePhoneSchema } from '@/lib/profile/schema';
import type { ProfileResponse } from '@/lib/profile/schema';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/query/keys';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { useQueryClient } from '@tanstack/react-query';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

const formSchema = z.object({
  name: z
    .string()
    .transform((value) => value.trim())
    .superRefine((value, ctx) => {
      if (value.length === 0) {
        return;
      }
      if (value.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Name must be at least 2 characters',
        });
      }
      if (value.length > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Name must be 80 characters or fewer',
        });
      }
    }),
  phone: profilePhoneSchema,
  email: z.string().email(),
  image: z.string().optional(),
});

export type ProfileManageFormValues = z.infer<typeof formSchema>;

export type ProfileManageFormProps = {
  initialProfile: ProfileResponse;
};

type AvatarState = {
  file: File | null;
  previewUrl: string | null;
  removed: boolean;
};

type AvatarValidationError = {
  code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE';
  message: string;
};

type StatusTone = 'info' | 'success' | 'warning' | 'error';

type StatusState = {
  message: string;
  tone: StatusTone;
  live: 'polite' | 'assertive';
};

const FIELD_LABELS: Record<'name' | 'phone' | 'image', string> = {
  name: 'display name',
  phone: 'phone number',
  image: 'avatar',
};

const getLiveForTone = (tone: StatusTone): 'polite' | 'assertive' =>
  tone === 'warning' || tone === 'error' ? 'assertive' : 'polite';

const formatFieldList = (keys: Array<'name' | 'phone' | 'image'>): string => {
  const labels = keys.map((key) => FIELD_LABELS[key]);
  if (labels.length === 0) {
    return 'details';
  }
  if (labels.length === 1) {
    return labels[0]!;
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  const head = labels.slice(0, -1).join(', ');
  const tail = labels[labels.length - 1];
  return `${head}, and ${tail}`;
};

function validateAvatarFile(file: File): AvatarValidationError | null {
  if (file.size > MAX_AVATAR_SIZE) {
    return {
      code: 'FILE_TOO_LARGE',
      message: 'Images must be 2 MB or smaller',
    };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      code: 'UNSUPPORTED_FILE',
      message: 'Supported formats: JPEG, PNG, WEBP, SVG',
    };
  }

  return null;
}

export function ProfileManageForm({ initialProfile }: ProfileManageFormProps) {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadProfileAvatar();

  const currentProfile = profile ?? initialProfile;

  // Warm the query cache with the server-provided profile so the GET request de-dupes.
  useEffect(() => {
    queryClient.setQueryData(queryKeys.profile.self(), initialProfile);
  }, [initialProfile, queryClient]);

  const form = useForm<ProfileManageFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: currentProfile.name ?? '',
      phone: currentProfile.phone ?? '',
      email: currentProfile.email,
      image: currentProfile.image ?? '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const [avatarState, setAvatarState] = useState<AvatarState>({
    file: null,
    previewUrl: null,
    removed: false,
  });
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  // Sync form when profile changes (e.g. after successful mutation elsewhere).
  useEffect(() => {
    form.reset({
      name: currentProfile.name ?? '',
      phone: currentProfile.phone ?? '',
      email: currentProfile.email,
      image: currentProfile.image ?? '',
    });
    setAvatarState({ file: null, previewUrl: null, removed: false });
    setAvatarError(null);
    setStatus(null);
  }, [currentProfile.email, currentProfile.image, currentProfile.name, form]);

  // Focus first error when validation fails.
  useEffect(() => {
    const entries = Object.entries(form.formState.errors);
    if (entries.length > 0) {
      const firstKey = entries[0]?.[0];
      if (firstKey) {
        form.setFocus(firstKey as keyof ProfileManageFormValues, { shouldSelect: true });
      }
    }
  }, [form, form.formState.errors]);

  // Clean up preview blob URLs.
  useEffect(() => {
    return () => {
      if (avatarState.previewUrl) {
        URL.revokeObjectURL(avatarState.previewUrl);
      }
    };
  }, [avatarState.previewUrl]);

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const validation = validateAvatarFile(file);
    if (validation) {
      const payload = {
        code: validation.code,
        size: file.size,
        type: file.type,
      };
      track('profile_upload_error', payload);
      emit('profile_upload_error', payload);
      setAvatarError(validation.message);
      setAvatarState((prev) => {
        if (prev.previewUrl) {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return { file: null, previewUrl: null, removed: false };
      });
      return;
    }

    setAvatarError(null);
    setAvatarState((prev) => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        removed: false,
      };
    });
  };

  const handleRemoveAvatar = () => {
    setAvatarError(null);
    setAvatarState((prev) => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return { file: null, previewUrl: null, removed: true };
    });
    form.setValue('image', '', { shouldDirty: true });
  };

  const watchedName = form.watch('name');
  const watchedPhone = form.watch('phone');
  const hasNameChanged = useMemo(() => {
    const trimmed = watchedName.trim();
    const baseline = currentProfile.name ?? '';
    return trimmed !== baseline.trim();
  }, [currentProfile.name, watchedName]);

  const hasPhoneChanged = useMemo(() => {
    const trimmed = watchedPhone.trim();
    const baseline = currentProfile.phone ?? '';
    return trimmed !== (baseline ?? '').trim();
  }, [currentProfile.phone, watchedPhone]);

  const hasAvatarChanged = avatarState.removed || Boolean(avatarState.file);
  const isSubmitting = updateProfile.isPending || uploadAvatar.isPending;
  const disableSubmit = isSubmitting || (!hasNameChanged && !hasPhoneChanged && !hasAvatarChanged);
  const hasUnsavedChanges = !disableSubmit;

  const focusStatus = () => {
    setTimeout(() => statusRef.current?.focus(), 0);
  };

  const announceStatus = (
    next: {
      message: string;
      tone: StatusTone;
      live?: 'polite' | 'assertive';
    } | null,
  ) => {
    if (!next) {
      setStatus(null);
      return;
    }
    const live = next.live ?? getLiveForTone(next.tone);
    setStatus({ message: next.message, tone: next.tone, live });
    focusStatus();
  };

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      // Chrome requires returnValue to be set.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [hasUnsavedChanges]);

  const onSubmit = form.handleSubmit(async (values) => {
    announceStatus(null);

    const trimmedName = values.name.trim();
    const baselineName = currentProfile.name ?? '';
    const nameHasChanged = trimmedName !== baselineName.trim();

    const trimmedPhone = values.phone.trim();
    const baselinePhone = currentProfile.phone ?? '';
    const phoneHasChanged = trimmedPhone !== baselinePhone.trim();

    let desiredImage: string | null | undefined = undefined;

    if (avatarState.removed) {
      desiredImage = null;
    } else if (avatarState.file) {
      try {
        const uploadResult = await uploadAvatar.mutateAsync(avatarState.file);
        desiredImage = uploadResult.url;
      } catch (error) {
        console.error('[profile/manage] avatar upload failed', error);
        setAvatarError('We couldn’t upload your image. Please try again.');
        return;
      }
    }

    if (desiredImage === undefined) {
      const baselineImage = currentProfile.image ?? null;
      desiredImage = baselineImage;
    }

    const draft: Record<string, string | null> = {};
    if (nameHasChanged) {
      draft.name = trimmedName.length > 0 ? trimmedName : null;
    }

    if (phoneHasChanged) {
      draft.phone = trimmedPhone.length > 0 ? trimmedPhone : null;
    }

    if (hasAvatarChanged) {
      draft.image = desiredImage;
    }

    const changedKeys = Object.keys(draft).filter((key): key is 'name' | 'phone' | 'image' =>
      key === 'name' || key === 'phone' || key === 'image',
    );

    if (changedKeys.length === 0) {
      announceStatus({
        message: 'No changes detected — update a field before saving.',
        tone: 'info',
      });
      return;
    }

    try {
      const payload = coerceProfileUpdatePayload(draft);
      const result = await updateProfile.mutateAsync(payload);
      const updated = result.profile;
      form.reset({
        name: updated.name ?? '',
        phone: updated.phone ?? '',
        email: updated.email,
        image: updated.image ?? '',
      });
      setAvatarState((prev) => {
        if (prev.previewUrl) {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return { file: null, previewUrl: null, removed: false };
      });
      setAvatarError(null);
      if (result.idempotent) {
        const description =
          changedKeys.length > 0
            ? `We already saved your ${formatFieldList(changedKeys)} — everything is up to date.`
            : 'We already saved those details — everything is up to date.';
        announceStatus({
          message: description,
          tone: 'info',
        });
      } else {
        announceStatus({
          message: 'Profile updated successfully.',
          tone: 'success',
        });
      }
    } catch (error) {
      console.error('[profile/manage] update failed', error);
      if (error instanceof HttpError) {
        if (error.code === 'IDEMPOTENCY_KEY_CONFLICT') {
          announceStatus({
            message:
              'We already processed a recent update. Refresh the page to make sure you are editing the latest details.',
            tone: 'warning',
          });
          return;
        }

        announceStatus({
          message: error.message || 'We couldn’t update your profile. Please try again.',
          tone: 'error',
        });
        return;
      }

      announceStatus({
        message: 'We couldn’t update your profile. Please try again.',
        tone: 'error',
      });
    }
  });

  const avatarPreviewSrc = avatarState.previewUrl ?? currentProfile.image ?? null;

  const statusToneClass: Record<StatusTone, string> = {
    info: 'text-muted-foreground',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
  };

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-8" noValidate>
        <section className="rounded-2xl border border-base-300 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-wrap gap-6">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-base-200">
              {avatarPreviewSrc ? (
                <Image
                  src={avatarPreviewSrc}
                  alt="Profile avatar preview"
                  fill
                  className="object-cover"
                  sizes="96px"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-base-content/60">
                  {currentProfile.name?.slice(0, 1) ?? currentProfile.email.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <div>
                <p className="text-base font-medium text-base-content">Avatar</p>
                <p className="text-sm text-base-content/70">
                  Upload a clear photo. Supported formats: JPEG, PNG, WEBP, SVG. Max size 2 MB.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="relative inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-srx-border-strong bg-white px-4 py-2 text-sm font-medium text-srx-ink-strong shadow-sm transition hover:bg-srx-surface-positive-alt focus-within:outline-none focus-within:ring-2 focus-within:ring-srx-brand focus-within:ring-offset-2">
                  <Upload className="h-4 w-4" aria-hidden />
                  <span>Choose image</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="sr-only"
                    onChange={onAvatarChange}
                  />
                </label>
                {(currentProfile.image || avatarPreviewSrc) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={isSubmitting}
                  >
                    <X className="mr-2 h-4 w-4" aria-hidden /> Remove
                  </Button>
                )}
              </div>
              {avatarError ? (
                <p className="text-sm text-red-600" role="alert" aria-live="assertive">
                  {avatarError}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-2xl border border-base-300 bg-white/80 p-6 shadow-sm">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="profile-name">Display name</FormLabel>
                <FormControl>
                  <Input
                    id="profile-name"
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                    {...field}
                  />
                </FormControl>
                <FormMessage>{form.formState.errors.name?.message}</FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="profile-phone">Phone</FormLabel>
                <FormControl>
                  <Input
                    id="profile-phone"
                    placeholder="+1 415 555 0123"
                    autoComplete="tel"
                    inputMode="tel"
                    {...field}
                  />
                </FormControl>
                <FormMessage>{form.formState.errors.phone?.message}</FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="profile-email">Email</FormLabel>
                <FormControl>
                  <Input id="profile-email" readOnly disabled {...field} />
                </FormControl>
                <p className="text-sm text-base-content/70">Email is managed via Supabase Auth and cannot be changed.</p>
              </FormItem>
            )}
          />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            ref={statusRef}
            tabIndex={status ? -1 : undefined}
            className={cn(
              'min-h-[1.25rem] text-sm text-srx-ink-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-srx-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              status ? statusToneClass[status.tone] : 'text-srx-ink-soft',
            )}
            role="status"
            aria-live={status?.live ?? 'polite'}
            aria-atomic="true"
          >
            {status?.message ?? ''}
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="primary"
              onClick={() => {
                form.reset();
                setAvatarState((prev) => {
                  if (prev.previewUrl) {
                    URL.revokeObjectURL(prev.previewUrl);
                  }
                  return { file: null, previewUrl: null, removed: false };
                });
                setAvatarError(null);
                announceStatus(null);
              }}
              disabled={isSubmitting}
            >
              Reset
            </Button>
            <Button type="submit" disabled={disableSubmit} aria-disabled={disableSubmit}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving
                </span>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
