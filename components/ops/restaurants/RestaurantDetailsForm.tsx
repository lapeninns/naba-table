'use client';

import { useEffect, useMemo, useState } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';
import type { PropsWithChildren } from 'react';

export type RestaurantDetailsFormValues = {
  name: string;
  slug: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  googleMapUrl: string | null;
  bookingPolicy: string | null;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  emailSendReminder24h?: boolean;
  emailSendReminderShort?: boolean;
  emailSendReviewRequest?: boolean;
};

export type RestaurantDetailsFormProps = PropsWithChildren<{
  initialValues: RestaurantDetailsFormValues;
  onSubmit: (values: UpdateRestaurantInput) => Promise<void> | void;
  isSubmitting?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  className?: string;
}>;

type FormState = {
  name: string;
  slug: string;
  timezone: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  googleMapUrl: string;
  bookingPolicy: string;
  reservationIntervalMinutes: string;
  reservationDefaultDurationMinutes: string;
  reservationLastSeatingBufferMinutes: string;
  emailSendReminder24h: boolean;
  emailSendReminderShort: boolean;
  emailSendReviewRequest: boolean;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const FIELD_TOOLTIPS = {
  slug: 'Lowercase identifier used in booking links and exports. Only letters, numbers, and hyphens are allowed.',
  timezone: 'Determines how operating hours, reservations, and reminders are interpreted across the product.',
  reservationInterval:
    'Spacing between available reservation slots. Shorter intervals create more options but increase booking traffic.',
  reservationDuration:
    'Default dining time that pre-fills new reservations. Staff can override per booking if needed.',
  lastSeatingBuffer:
    'Minutes before closing when you stop seating guests so everyone can finish before the kitchen closes.',
  bookingPolicy:
    'Optional message shown to guests during booking and in confirmations (e.g., deposits, grace periods).',
  googleMapUrl: 'Link for customers to leave a Google review. This is sent in post-visit emails.',
} as const;

export const COMMON_TIMEZONES = [
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Europe/Paris',
  'Europe/Berlin',
] as const;

function mapInitialValues(values: RestaurantDetailsFormValues): FormState {
  return {
    name: values.name ?? '',
    slug: values.slug ?? '',
    timezone: values.timezone ?? COMMON_TIMEZONES[0],
    contactEmail: values.contactEmail ?? '',
    contactPhone: values.contactPhone ?? '',
    address: values.address ?? '',
    bookingPolicy: values.bookingPolicy ?? '',
    reservationIntervalMinutes:
      values.reservationIntervalMinutes !== undefined && values.reservationIntervalMinutes !== null
        ? String(values.reservationIntervalMinutes)
        : '',
    reservationDefaultDurationMinutes:
      values.reservationDefaultDurationMinutes !== undefined && values.reservationDefaultDurationMinutes !== null
        ? String(values.reservationDefaultDurationMinutes)
        : '',
    reservationLastSeatingBufferMinutes:
      values.reservationLastSeatingBufferMinutes !== undefined && values.reservationLastSeatingBufferMinutes !== null
        ? String(values.reservationLastSeatingBufferMinutes)
        : '',
    emailSendReminder24h: values.emailSendReminder24h ?? true,
    emailSendReminderShort: values.emailSendReminderShort ?? true,
    emailSendReviewRequest: values.emailSendReviewRequest ?? true,
    googleMapUrl: values.googleMapUrl ?? '',
  };
}

function sanitizePayload(state: FormState): UpdateRestaurantInput {
  const trim = (value: string) => value.trim();
  const trimmedName = trim(state.name);
  const trimmedSlug = trim(state.slug);
  const trimmedTimezone = trim(state.timezone);
  const trimmedEmail = trim(state.contactEmail);
  const trimmedPhone = trim(state.contactPhone);
  const trimmedAddress = trim(state.address);
  const trimmedMapUrl = trim(state.googleMapUrl);
  const trimmedPolicy = trim(state.bookingPolicy);
  const intervalMinutes = Number.parseInt(state.reservationIntervalMinutes, 10);
  const defaultDurationMinutes = Number.parseInt(state.reservationDefaultDurationMinutes, 10);
  const lastSeatingBufferMinutes = Number.parseInt(state.reservationLastSeatingBufferMinutes, 10);

  return {
    name: trimmedName,
    slug: trimmedSlug,
    timezone: trimmedTimezone,
    contactEmail: trimmedEmail.length > 0 ? trimmedEmail : null,
    contactPhone: trimmedPhone.length > 0 ? trimmedPhone : null,
    address: trimmedAddress.length > 0 ? trimmedAddress : null,
    googleMapUrl: trimmedMapUrl.length > 0 ? trimmedMapUrl : null,
    bookingPolicy: trimmedPolicy.length > 0 ? trimmedPolicy : null,
    reservationIntervalMinutes: intervalMinutes,
    reservationDefaultDurationMinutes: defaultDurationMinutes,
    reservationLastSeatingBufferMinutes: lastSeatingBufferMinutes,
    emailSendReminder24h: state.emailSendReminder24h,
    emailSendReminderShort: state.emailSendReminderShort,
    emailSendReviewRequest: state.emailSendReviewRequest,
  };
}

function validate(state: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!state.name.trim()) {
    errors.name = 'Restaurant name is required';
  }

  const slug = state.slug.trim();
  if (!slug) {
    errors.slug = 'Slug is required';
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
  }

  if (!state.timezone.trim()) {
    errors.timezone = 'Timezone is required';
  }

  const intervalRaw = state.reservationIntervalMinutes.trim();
  if (!intervalRaw) {
    errors.reservationIntervalMinutes = 'Reservation interval is required';
  } else {
    const intervalValue = Number(intervalRaw);
    if (!Number.isInteger(intervalValue)) {
      errors.reservationIntervalMinutes = 'Must be a whole number';
    } else if (intervalValue < 1 || intervalValue > 180) {
      errors.reservationIntervalMinutes = 'Must be between 1 and 180 minutes';
    }
  }

  const durationRaw = state.reservationDefaultDurationMinutes.trim();
  let durationValue: number | null = null;
  if (!durationRaw) {
    errors.reservationDefaultDurationMinutes = 'Reservation duration is required';
  } else {
    durationValue = Number(durationRaw);
    if (!Number.isInteger(durationValue)) {
      errors.reservationDefaultDurationMinutes = 'Must be a whole number';
    } else if (durationValue < 15 || durationValue > 300) {
      errors.reservationDefaultDurationMinutes = 'Must be between 15 and 300 minutes';
    }
  }

  const bufferRaw = state.reservationLastSeatingBufferMinutes.trim();
  if (!bufferRaw) {
    errors.reservationLastSeatingBufferMinutes = 'Last seating buffer is required';
  } else {
    const bufferValue = Number(bufferRaw);
    if (!Number.isInteger(bufferValue)) {
      errors.reservationLastSeatingBufferMinutes = 'Must be a whole number';
    } else if (bufferValue < 15 || bufferValue > 300) {
      errors.reservationLastSeatingBufferMinutes = 'Must be between 15 and 300 minutes';
    }
  }

  const email = state.contactEmail.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contactEmail = 'Invalid email format';
  }

  const phone = state.contactPhone.trim();
  if (phone && phone.length < 5) {
    errors.contactPhone = 'Phone number must be at least 5 characters';
  }

  const mapUrl = state.googleMapUrl.trim();
  if (mapUrl) {
    try {
      new URL(mapUrl);
    } catch (error) {
      errors.googleMapUrl = 'Enter a valid URL (e.g., https://maps.google.com/...)';
    }
  }

  return errors;
}


export function RestaurantDetailsForm({
  initialValues,
  onSubmit,
  isSubmitting = false,
  onCancel,
  submitLabel = 'Save Changes',
  className,
  children,
}: RestaurantDetailsFormProps) {
  const [state, setState] = useState<FormState>(() => mapInitialValues(initialValues));
  const [errors, setErrors] = useState<FormErrors>({});

  const serializedInitialValues = useMemo(() => JSON.stringify(initialValues), [initialValues]);

  useEffect(() => {
    setState(mapInitialValues(initialValues));
    setErrors({});
  }, [serializedInitialValues, initialValues]);

  const handleChange = (field: keyof FormState, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleToggle = (field: 'emailSendReminder24h' | 'emailSendReminderShort' | 'emailSendReviewRequest', value: boolean) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validate(state);
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    try {
      await onSubmit(sanitizePayload(state));
    } catch (error) {
      // Error presentation is delegated to the mutation hook / caller.
      console.error('[RestaurantDetailsForm] submit failed', error);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="restaurant-name">
            Restaurant Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="restaurant-name"
            value={state.name}
            onChange={(event) => handleChange('name', event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'restaurant-name-error' : undefined}
            className={cn(errors.name && 'border-destructive focus-visible:ring-destructive/60')}
            autoFocus
          />
          {errors.name && (
            <p id="restaurant-name-error" className="text-xs text-destructive" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-slug" className="inline-flex items-center gap-1">
              Slug <span className="text-destructive">*</span>
            </Label>
            <HelpTooltip description={FIELD_TOOLTIPS.slug} ariaLabel="What is a restaurant slug?" />
          </div>
          <Input
            id="restaurant-slug"
            value={state.slug}
            onChange={(event) => handleChange('slug', event.target.value)}
            aria-invalid={Boolean(errors.slug)}
            aria-describedby={errors.slug ? 'restaurant-slug-error' : undefined}
            className={cn(errors.slug && 'border-destructive focus-visible:ring-destructive/60')}
          />
          {errors.slug && (
            <p id="restaurant-slug-error" className="text-xs text-destructive" role="alert">
              {errors.slug}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-timezone" className="inline-flex items-center gap-1">
              Timezone <span className="text-destructive">*</span>
            </Label>
            <HelpTooltip description={FIELD_TOOLTIPS.timezone} ariaLabel="Why does timezone matter?" />
          </div>
          <select
            id="restaurant-timezone"
            value={state.timezone}
            onChange={(event) => handleChange('timezone', event.target.value)}
            className={cn(
              'h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              errors.timezone && 'border-destructive focus-visible:ring-destructive/60',
            )}
            aria-invalid={Boolean(errors.timezone)}
            aria-describedby={errors.timezone ? 'restaurant-timezone-error' : undefined}
          >
            {COMMON_TIMEZONES.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
          {errors.timezone && (
            <p id="restaurant-timezone-error" className="text-xs text-destructive" role="alert">
              {errors.timezone}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-interval" className="inline-flex items-center gap-1">
              Reservation Interval (minutes) <span className="text-destructive">*</span>
            </Label>
            <HelpTooltip
              description={FIELD_TOOLTIPS.reservationInterval}
              ariaLabel="Reservation interval details"
            />
          </div>
          <Input
            id="restaurant-interval"
            type="number"
            inputMode="numeric"
            min={1}
            max={180}
            step={1}
            value={state.reservationIntervalMinutes}
            onChange={(event) => handleChange('reservationIntervalMinutes', event.target.value)}
            aria-invalid={Boolean(errors.reservationIntervalMinutes)}
            aria-describedby={
              errors.reservationIntervalMinutes
                ? 'restaurant-interval-error'
                : 'restaurant-interval-help'
            }
            className={cn(
              errors.reservationIntervalMinutes && 'border-destructive focus-visible:ring-destructive/60',
            )}
          />
          <p id="restaurant-interval-help" className="text-xs text-muted-foreground">
            Controls slot spacing; must be between 1 and 180 minutes.
          </p>
          {errors.reservationIntervalMinutes && (
            <p id="restaurant-interval-error" className="text-xs text-destructive" role="alert">
              {errors.reservationIntervalMinutes}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-duration" className="inline-flex items-center gap-1">
              Default Reservation Duration (minutes) <span className="text-destructive">*</span>
            </Label>
            <HelpTooltip
              description={FIELD_TOOLTIPS.reservationDuration}
              ariaLabel="Reservation duration details"
            />
          </div>
          <Input
            id="restaurant-duration"
            type="number"
            inputMode="numeric"
            min={15}
            max={300}
            step={1}
            value={state.reservationDefaultDurationMinutes}
            onChange={(event) => handleChange('reservationDefaultDurationMinutes', event.target.value)}
            aria-invalid={Boolean(errors.reservationDefaultDurationMinutes)}
            aria-describedby={
              errors.reservationDefaultDurationMinutes
                ? 'restaurant-duration-error'
                : 'restaurant-duration-help'
            }
            className={cn(
              errors.reservationDefaultDurationMinutes &&
                'border-destructive focus-visible:ring-destructive/60',
            )}
          />
          <p id="restaurant-duration-help" className="text-xs text-muted-foreground">
            Default booking length; must be between 15 and 300 minutes.
          </p>
          {errors.reservationDefaultDurationMinutes && (
            <p id="restaurant-duration-error" className="text-xs text-destructive" role="alert">
              {errors.reservationDefaultDurationMinutes}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-last-seating" className="inline-flex items-center gap-1">
              Last Seating Buffer (minutes) <span className="text-destructive">*</span>
            </Label>
            <HelpTooltip
              description={FIELD_TOOLTIPS.lastSeatingBuffer}
              ariaLabel="Last seating buffer details"
            />
          </div>
          <Input
            id="restaurant-last-seating"
            type="number"
            inputMode="numeric"
            min={15}
            max={300}
            step={1}
            value={state.reservationLastSeatingBufferMinutes}
            onChange={(event) => handleChange('reservationLastSeatingBufferMinutes', event.target.value)}
            aria-invalid={Boolean(errors.reservationLastSeatingBufferMinutes)}
            aria-describedby={
              errors.reservationLastSeatingBufferMinutes
                ? 'restaurant-last-seating-error'
                : 'restaurant-last-seating-help'
            }
            className={cn(
              errors.reservationLastSeatingBufferMinutes &&
                'border-destructive focus-visible:ring-destructive/60',
            )}
          />
          <p id="restaurant-last-seating-help" className="text-xs text-muted-foreground">
            Controls the latest start time relative to closing; choose a value between 15 and 300 minutes.
          </p>
          {errors.reservationLastSeatingBufferMinutes && (
            <p id="restaurant-last-seating-error" className="text-xs text-destructive" role="alert">
              {errors.reservationLastSeatingBufferMinutes}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restaurant-email">Contact Email</Label>
          <Input
            id="restaurant-email"
            type="email"
            value={state.contactEmail}
            onChange={(event) => handleChange('contactEmail', event.target.value)}
            aria-invalid={Boolean(errors.contactEmail)}
            aria-describedby={errors.contactEmail ? 'restaurant-email-error' : undefined}
            className={cn(errors.contactEmail && 'border-destructive focus-visible:ring-destructive/60')}
          />
          {errors.contactEmail && (
            <p id="restaurant-email-error" className="text-xs text-destructive" role="alert">
              {errors.contactEmail}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restaurant-phone">Contact Phone</Label>
          <Input
            id="restaurant-phone"
            type="tel"
            value={state.contactPhone}
            onChange={(event) => handleChange('contactPhone', event.target.value)}
            aria-invalid={Boolean(errors.contactPhone)}
            aria-describedby={errors.contactPhone ? 'restaurant-phone-error' : undefined}
            className={cn(errors.contactPhone && 'border-destructive focus-visible:ring-destructive/60')}
          />
          {errors.contactPhone && (
            <p id="restaurant-phone-error" className="text-xs text-destructive" role="alert">
              {errors.contactPhone}
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="restaurant-address">Address</Label>
          <Input
            id="restaurant-address"
            value={state.address}
            onChange={(event) => handleChange('address', event.target.value)}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-google-map">Google Maps Review Link</Label>
            <HelpTooltip
              description={FIELD_TOOLTIPS.googleMapUrl}
              ariaLabel="Why add a Google Maps review link?"
            />
          </div>
          <Input
            id="restaurant-google-map"
            type="url"
            inputMode="url"
            placeholder="https://g.page/r/YourRestaurant/review"
            value={state.googleMapUrl}
            onChange={(event) => handleChange('googleMapUrl', event.target.value)}
            aria-invalid={Boolean(errors.googleMapUrl)}
            aria-describedby={
              errors.googleMapUrl ? 'restaurant-google-map-error' : 'restaurant-google-map-help'
            }
            className={cn(errors.googleMapUrl && 'border-destructive focus-visible:ring-destructive/60')}
          />
          <p id="restaurant-google-map-help" className="text-xs text-muted-foreground">
            Optional link sent to customers to ask for a review.
          </p>
          {errors.googleMapUrl && (
            <p id="restaurant-google-map-error" className="text-xs text-destructive" role="alert">
              {errors.googleMapUrl}
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-policy">Booking Policy</Label>
            <HelpTooltip description={FIELD_TOOLTIPS.bookingPolicy} ariaLabel="Booking policy guidance" />
          </div>
          <Textarea
            id="restaurant-policy"
            value={state.bookingPolicy}
            onChange={(event) => handleChange('bookingPolicy', event.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-border/80 p-3 sm:col-span-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">Guest Emails</Label>
            <HelpTooltip
              description="Control which automated guest emails are sent for this restaurant (reminders, reviews)."
              ariaLabel="Guest email settings help"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={state.emailSendReminder24h}
                onChange={(e) => handleToggle('emailSendReminder24h', e.target.checked)}
              />
              <span>
                Send 24h reminder
                <p className="text-xs text-muted-foreground">Pre-visit reminder roughly one day before arrival.</p>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={state.emailSendReminderShort}
                onChange={(e) => handleToggle('emailSendReminderShort', e.target.checked)}
              />
              <span>
                Send same-day reminder
                <p className="text-xs text-muted-foreground">Short heads-up closer to arrival time.</p>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-foreground sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={state.emailSendReviewRequest}
                onChange={(e) => handleToggle('emailSendReviewRequest', e.target.checked)}
              />
              <span>
                Send post-visit review request
                <p className="text-xs text-muted-foreground">Quick feedback ask after the visit is completed.</p>
              </span>
            </label>
          </div>
        </div>
      </div>

      {children}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
      </form>
    </TooltipProvider>
  );
}
