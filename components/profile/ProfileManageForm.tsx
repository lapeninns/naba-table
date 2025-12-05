'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Mail, Phone, User, X, CheckCircle2, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { GuestCard, GuestSection, GuestStatus } from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useGuestProfile } from '@/guest/hooks';
import { useUpdateProfile, useUploadProfileAvatar, coerceProfileUpdatePayload } from '@/hooks/useProfile';
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
      if (value.length === 0) return;
      if (value.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Name must be at least 2 characters' });
      }
      if (value.length > 80) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Name must be 80 characters or fewer' });
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
  if (labels.length === 0) return 'details';
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  const head = labels.slice(0, -1).join(', ');
  const tail = labels[labels.length - 1];
  return `${head}, and ${tail}`;
};

function validateAvatarFile(file: File): { code: string; message: string } | null {
  if (file.size > MAX_AVATAR_SIZE) {
    return { code: 'FILE_TOO_LARGE', message: 'Images must be 2 MB or smaller' };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { code: 'UNSUPPORTED_FILE', message: 'Supported formats: JPEG, PNG, WEBP, SVG' };
  }
  return null;
}

export function ProfileManageForm({ initialProfile }: ProfileManageFormProps) {
  const queryClient = useQueryClient();
  const { data: profile } = useGuestProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadProfileAvatar();

  const currentProfile = profile ?? initialProfile;

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

  useEffect(() => {
    const entries = Object.entries(form.formState.errors);
    if (entries.length > 0) {
      const firstKey = entries[0]?.[0];
      if (firstKey) {
        form.setFocus(firstKey as keyof ProfileManageFormValues, { shouldSelect: true });
      }
    }
  }, [form, form.formState.errors]);

  useEffect(() => {
    return () => {
      if (avatarState.previewUrl && avatarState.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarState.previewUrl);
      }
    };
  }, [avatarState.previewUrl]);

  const releasePreview = (url: string | null) => {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const uploadAvatarFile = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setAvatarState((prev) => {
      releasePreview(prev.previewUrl);
      return { file, previewUrl, removed: false };
    });
    setAvatarError(null);

    try {
      const uploadResult = await uploadAvatar.mutateAsync(file);
      setAvatarState((prev) => {
        releasePreview(prev.previewUrl);
        return { file: null, previewUrl: uploadResult.url ?? null, removed: false };
      });
      form.setValue('image', uploadResult.url ?? '', { shouldDirty: true });
      setAvatarError(null);
      announceStatus({ message: 'Avatar uploaded — save changes to apply it everywhere.', tone: 'info' });
    } catch (error) {
      console.error('[profile/manage] avatar upload failed', error);
      const message = "We couldn't upload your image. Please try again.";
      setAvatarState((prev) => {
        releasePreview(prev.previewUrl);
        return { file: null, previewUrl: null, removed: false };
      });
      setAvatarError(message);
      announceStatus({ message, tone: 'error', live: 'assertive' });
    }
  };

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const validation = validateAvatarFile(file);
    if (validation) {
      track('profile_upload_error', { code: validation.code, size: file.size, type: file.type });
      emit('profile_upload_error', { code: validation.code, size: file.size, type: file.type });
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

  const hasNameChanged = useMemo(() => watchedName.trim() !== (currentProfile.name ?? '').trim(), [currentProfile.name, watchedName]);
  const hasPhoneChanged = useMemo(() => watchedPhone.trim() !== (currentProfile.phone ?? '').trim(), [currentProfile.phone, watchedPhone]);
  const hasImageChanged = useMemo(() => (watchedImage?.trim() ?? '') !== (currentProfile.image ?? '').trim(), [currentProfile.image, watchedImage]);
  const hasAvatarChanged = avatarState.removed || Boolean(avatarState.file) || hasImageChanged;

  const isSubmitting = updateProfile.isPending || uploadAvatar.isPending;
  const disableSubmit = isSubmitting || (!hasNameChanged && !hasPhoneChanged && !hasAvatarChanged);
  const hasUnsavedChanges = !disableSubmit;

  const focusStatus = () => {
    setTimeout(() => statusRef.current?.focus(), 0);
  };

  const announceStatus = (next: { message: string; tone: StatusTone; live?: 'polite' | 'assertive' } | null) => {
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
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const onSubmit = form.handleSubmit(async (values) => {
    announceStatus(null);

    if (avatarState.file) {
      announceStatus({ message: 'Please wait for your avatar upload to finish before saving.', tone: 'info' });
      return;
    }

    const trimmedName = values.name.trim();
    const nameHasChanged = trimmedName !== (currentProfile.name ?? '').trim();
    const trimmedPhone = values.phone.trim();
    const phoneHasChanged = trimmedPhone !== (currentProfile.phone ?? '').trim();

    let desiredImage: string | null;
    if (avatarState.removed) {
      desiredImage = null;
    } else {
      const currentImageValue = form.getValues('image')?.trim();
      desiredImage = currentImageValue && currentImageValue.length > 0 ? currentImageValue : currentProfile.image ?? null;
    }

    const draft: Record<string, string | null> = {};
    if (nameHasChanged) draft.name = trimmedName.length > 0 ? trimmedName : null;
    if (phoneHasChanged) draft.phone = trimmedPhone.length > 0 ? trimmedPhone : null;
    if (hasAvatarChanged) draft.image = desiredImage;

    const changedKeys = Object.keys(draft).filter((key): key is 'name' | 'phone' | 'image' =>
      key === 'name' || key === 'phone' || key === 'image'
    );

    if (changedKeys.length === 0) {
      announceStatus({ message: 'No changes detected — update a field before saving.', tone: 'info' });
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
        if (prev.previewUrl && prev.previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
        return { file: null, previewUrl: null, removed: false };
      });
      setAvatarError(null);
      if (result.idempotent) {
        const description = changedKeys.length > 0
          ? `We already saved your ${formatFieldList(changedKeys)} — everything is up to date.`
          : 'We already saved those details — everything is up to date.';
        announceStatus({ message: description, tone: 'info' });
      } else {
        announceStatus({ message: 'Profile updated successfully!', tone: 'success' });
      }
    } catch (error) {
      console.error('[profile/manage] update failed', error);
      if (error instanceof HttpError) {
        if (error.code === 'IDEMPOTENCY_KEY_CONFLICT') {
          announceStatus({
            message: 'We already processed a recent update. Refresh the page to make sure you are editing the latest details.',
            tone: 'warning',
          });
          return;
        }
        announceStatus({ message: error.message || "We couldn't update your profile. Please try again.", tone: 'error' });
        return;
      }
      announceStatus({ message: "We couldn't update your profile. Please try again.", tone: 'error' });
    }
  });

  const avatarPreviewSrc = avatarState.previewUrl ?? currentProfile.image ?? null;

  const statusStyles: Record<StatusTone, { bg: string; text: string; icon: React.ElementType }> = {
    info: { bg: 'bg-blue-50', text: 'text-blue-700', icon: AlertCircle },
    success: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
    warning: { bg: 'bg-amber-50', text: 'text-amber-700', icon: AlertCircle },
    error: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle },
  };

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-8" noValidate>

        {/* Avatar Section */}
        <GuestSection title={currentProfile.name || 'Your Profile'} description="Update your photo and personal details. A clear photo helps restaurants recognize you." padding="md" className="bg-white">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="relative group">
              <div className="relative h-32 w-32 overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-slate-100 to-slate-50 shadow-xl ring-1 ring-slate-100 transition-transform group-hover:scale-105">
                {avatarPreviewSrc ? (
                  <Image
                    src={avatarPreviewSrc}
                    alt="Profile avatar"
                    fill
                    className="object-cover"
                    sizes="128px"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-slate-300">
                    {currentProfile.name?.slice(0, 1).toUpperCase() ?? currentProfile.email.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Avatar Actions */}
              <div className="absolute -bottom-2 -right-2 flex gap-1.5">
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-slate-900 shadow-lg hover:bg-slate-800 transition-all"
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                  disabled={isSubmitting}
                  title="Upload new photo"
                >
                  <Camera className="h-4 w-4 text-white" />
                </Button>
                {(currentProfile.image || avatarPreviewSrc) && (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-10 w-10 rounded-full shadow-lg"
                    onClick={handleRemoveAvatar}
                    disabled={isSubmitting}
                    title="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="sr-only"
                onChange={onAvatarChange}
                disabled={isSubmitting}
              />
            </div>

            {/* Avatar Info */}
            <div className="flex-1 text-center sm:text-left">
              {avatarError && (
                <GuestStatus title={avatarError} tone="error" className="inline-flex" />
              )}
            </div>
          </div>
        </GuestSection>

        {/* Form Fields */}
        <GuestCard className="shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Personal Information</h3>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-medium">Display Name</FormLabel>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <FormControl>
                      <Input
                        placeholder="Ada Lovelace"
                        autoComplete="name"
                        className="h-12 pl-12 rounded-xl border-slate-200 bg-white text-base focus:border-slate-400 focus:ring-slate-400"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormDescription className="text-slate-500">
                    The name restaurants will see when you book.
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
                  <FormLabel className="text-slate-700 font-medium">Phone Number</FormLabel>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <FormControl>
                      <Input
                        placeholder="+1 415 555 0123"
                        autoComplete="tel"
                        inputMode="tel"
                        className="h-12 pl-12 rounded-xl border-slate-200 bg-white text-base focus:border-slate-400 focus:ring-slate-400"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormDescription className="text-slate-500">
                    Required for reservation updates and reminders.
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
                  <FormLabel className="text-slate-700 font-medium">Email Address</FormLabel>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <FormControl>
                      <Input
                        readOnly
                        disabled
                        {...field}
                        className="h-12 pl-12 rounded-xl border-slate-100 bg-slate-50 text-slate-500 text-base cursor-not-allowed"
                      />
                    </FormControl>
                  </div>
                  <FormDescription className="text-slate-500">
                    Managed via your login provider.
                  </FormDescription>
                </FormItem>
              )}
            />
          </CardContent>
        </GuestCard>

        {/* Action Bar */}
        <div className="sticky bottom-6 z-10">
          <GuestCard className="border-slate-100 shadow-xl bg-white/95 backdrop-blur-sm">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {status && (
                  <GuestStatus
                    ref={statusRef}
                    title={status.message}
                    tone={status.tone}
                    aria-live={status.live}
                    className="sm:max-w-xl"
                  />
                )}

                <div className="flex gap-3 sm:ml-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      form.reset();
                      setAvatarState((prev) => {
                        if (prev.previewUrl && prev.previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
                        return { file: null, previewUrl: null, removed: false };
                      });
                      setAvatarError(null);
                      announceStatus(null);
                    }}
                    disabled={isSubmitting || !hasUnsavedChanges}
                    className="text-slate-500 hover:text-slate-900"
                  >
                    Discard Changes
                  </Button>
                  <Button
                    type="submit"
                    disabled={disableSubmit}
                    className="rounded-full bg-slate-900 px-8 hover:bg-slate-800 shadow-lg"
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
              </div>
            </div>
          </GuestCard>
        </div>
      </form>
    </Form>
  );
}
