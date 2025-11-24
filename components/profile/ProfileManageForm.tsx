'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useProfile, useUpdateProfile, useUploadProfileAvatar, coerceProfileUpdatePayload } from '@/hooks/useProfile';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { HttpError } from '@/lib/http/errors';
import { profilePhoneSchema } from '@/lib/profile/schema';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import type { ProfileResponse } from '@/lib/profile/schema';



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
      if (avatarState.previewUrl && avatarState.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarState.previewUrl);
      }
    };
  }, [avatarState.previewUrl]);

  const releasePreview = (url: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  };

  const uploadAvatarFile = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setAvatarState((prev) => {
      releasePreview(prev.previewUrl);
      return {
        file,
        previewUrl,
        removed: false,
      };
    });
    setAvatarError(null);

    try {
      const uploadResult = await uploadAvatar.mutateAsync(file);
      setAvatarState((prev) => {
        releasePreview(prev.previewUrl);
        return {
          file: null,
          previewUrl: uploadResult.url ?? null,
          removed: false,
        };
      });
      form.setValue('image', uploadResult.url ?? '', { shouldDirty: true });
      setAvatarError(null);
      announceStatus({
        message: 'Avatar uploaded — save changes to apply it everywhere.',
        tone: 'info',
      });
    } catch (error) {
      console.error('[profile/manage] avatar upload failed', error);
      const message = 'We couldn’t upload your image. Please try again.';
      setAvatarState((prev) => {
        releasePreview(prev.previewUrl);
        return { file: null, previewUrl: null, removed: false };
      });
      setAvatarError(message);
      announceStatus({
        message,
        tone: 'error',
        live: 'assertive',
      });
    }
  };

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
        releasePreview(prev.previewUrl);
        return { file: null, previewUrl: null, removed: false };
      });
      return;
    }

    void uploadAvatarFile(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarError(null);
    setAvatarState((prev) => {
      releasePreview(prev.previewUrl);
      return { file: null, previewUrl: null, removed: true };
    });
    form.setValue('image', '', { shouldDirty: true });
  };

  const watchedName = form.watch('name');
  const watchedPhone = form.watch('phone');
  const watchedImage = form.watch('image');
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

  const hasImageChanged = useMemo(() => {
    const trimmed = watchedImage?.trim() ?? '';
    const baseline = currentProfile.image ?? '';
    return trimmed !== (baseline ?? '').trim();
  }, [currentProfile.image, watchedImage]);

  const hasAvatarChanged = avatarState.removed || Boolean(avatarState.file) || hasImageChanged;
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

    if (avatarState.file) {
      announceStatus({
        message: 'Please wait for your avatar upload to finish before saving.',
        tone: 'info',
      });
      return;
    }

    let desiredImage: string | null;
    if (avatarState.removed) {
      desiredImage = null;
    } else {
      const currentImageValue = form.getValues('image')?.trim();
      desiredImage = currentImageValue && currentImageValue.length > 0 ? currentImageValue : currentProfile.image ?? null;
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
        if (prev.previewUrl && prev.previewUrl.startsWith('blob:')) {
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
        <div className="grid gap-8 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details and how you can be reached.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ada Lovelace"
                          autoComplete="name"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This is the name that will be displayed to restaurants.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+1 415 555 0123"
                          autoComplete="tel"
                          inputMode="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Used for booking confirmations and updates.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input readOnly disabled {...field} className="bg-muted" />
                      </FormControl>
                      <FormDescription>
                        Managed via your account login and cannot be changed here.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex flex-col items-start justify-between gap-4 border-t bg-muted/50 px-6 py-4 sm:flex-row sm:items-center">
                <p
                  ref={statusRef}
                  tabIndex={status ? -1 : undefined}
                  className={cn(
                    'text-sm font-medium transition-colors',
                    status ? statusToneClass[status.tone] : 'text-muted-foreground'
                  )}
                  role="status"
                  aria-live={status?.live ?? 'polite'}
                >
                  {status?.message}
                </p>
                <div className="flex w-full gap-3 sm:w-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      form.reset();
                      setAvatarState((prev) => {
                        if (prev.previewUrl && prev.previewUrl.startsWith('blob:')) {
                          URL.revokeObjectURL(prev.previewUrl);
                        }
                        return { file: null, previewUrl: null, removed: false };
                      });
                      setAvatarError(null);
                      announceStatus(null);
                    }}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none"
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    disabled={disableSubmit}
                    className="flex-1 sm:flex-none"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>

          <div className="order-first md:order-last">
            <Card>
              <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
                <CardDescription>
                  Upload a picture to make your profile recognizable.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                <div className="relative h-40 w-40 overflow-hidden rounded-full border-4 border-muted bg-muted shadow-sm">
                  {avatarPreviewSrc ? (
                    <Image
                      src={avatarPreviewSrc}
                      alt="Profile avatar preview"
                      fill
                      className="object-cover"
                      sizes="160px"
                      priority
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-4xl font-semibold text-muted-foreground">
                      {currentProfile.name?.slice(0, 1).toUpperCase() ?? currentProfile.email.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex w-full flex-col gap-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={isSubmitting}
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      className="sr-only"
                      onChange={onAvatarChange}
                      disabled={isSubmitting}
                    />

                    {(currentProfile.image || avatarPreviewSrc) && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={handleRemoveAvatar}
                        disabled={isSubmitting}
                        title="Remove avatar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {avatarError && (
                    <p className="text-center text-sm font-medium text-destructive">
                      {avatarError}
                    </p>
                  )}

                  <p className="text-center text-xs text-muted-foreground">
                    JPEG, PNG, WEBP or SVG. Max 2MB.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
