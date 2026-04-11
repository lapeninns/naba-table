'use client';

import { useEffect, useMemo, useState } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
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
  managerDailySummaryEnabled: boolean;
  managerNotificationPhone: string | null;
  googleMapUrl: string | null;
  googleReviewUrl: string | null;
  bookingPolicy: string | null;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  reservationLifecycleGraceMinutes: number;
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
  managerDailySummaryEnabled: boolean;
  managerNotificationPhone: string;
  googleMapUrl: string;
  googleReviewUrl: string;
  bookingPolicy: string;
  reservationIntervalMinutes: string;
  reservationDefaultDurationMinutes: string;
  reservationLastSeatingBufferMinutes: string;
  reservationLifecycleGraceMinutes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const FIELD_TOOLTIPS = {
  slug: 'Lowercase identifier used in booking links and exports. Only letters, numbers, and hyphens are allowed.',
  timezone:
    'Determines how operating hours, reservations, and reminders are interpreted across the product.',
  reservationInterval:
    'Spacing between available reservation slots. Shorter intervals create more options but increase booking traffic.',
  reservationDuration:
    'Default dining time that pre-fills new reservations. Staff can override per booking if needed.',
  lastSeatingBuffer:
    'Minutes before closing when you stop seating guests so everyone can finish before the kitchen closes.',
  lifecycleGrace:
    'Minutes after the reservation end time when staff can still check out or mark no-shows.',
  bookingPolicy:
    'Optional message shown to guests during booking and in confirmations (e.g., grace periods, large-party policies).',
  managerNotificationPhone:
    'Direct delivery number for the daily manager SMS summary. Use E.164 format such as +447700900000.',
  managerDailySummaryEnabled:
    'Turns the 10:00 local-time manager booking summary SMS on or off for this restaurant.',
  googleReviewUrl:
    'Link for customers to leave a Google review. This is sent in post-visit emails.',
  googleMapUrl: 'Link shared with guests for directions in Google Maps.',
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
    managerDailySummaryEnabled: values.managerDailySummaryEnabled ?? false,
    managerNotificationPhone: values.managerNotificationPhone ?? '',
    bookingPolicy: values.bookingPolicy ?? '',
    reservationIntervalMinutes:
      values.reservationIntervalMinutes !== undefined && values.reservationIntervalMinutes !== null
        ? String(values.reservationIntervalMinutes)
        : '',
    reservationDefaultDurationMinutes:
      values.reservationDefaultDurationMinutes !== undefined &&
      values.reservationDefaultDurationMinutes !== null
        ? String(values.reservationDefaultDurationMinutes)
        : '',
    reservationLastSeatingBufferMinutes:
      values.reservationLastSeatingBufferMinutes !== undefined &&
      values.reservationLastSeatingBufferMinutes !== null
        ? String(values.reservationLastSeatingBufferMinutes)
        : '',
    reservationLifecycleGraceMinutes:
      values.reservationLifecycleGraceMinutes !== undefined &&
      values.reservationLifecycleGraceMinutes !== null
        ? String(values.reservationLifecycleGraceMinutes)
        : '',
    googleMapUrl: values.googleMapUrl ?? '',
    googleReviewUrl: values.googleReviewUrl ?? '',
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
  const trimmedManagerNotificationPhone = trim(state.managerNotificationPhone);
  const trimmedMapUrl = trim(state.googleMapUrl);
  const trimmedReviewUrl = trim(state.googleReviewUrl);
  const trimmedPolicy = trim(state.bookingPolicy);
  const intervalMinutes = Number.parseInt(state.reservationIntervalMinutes, 10);
  const defaultDurationMinutes = Number.parseInt(state.reservationDefaultDurationMinutes, 10);
  const lastSeatingBufferMinutes = Number.parseInt(state.reservationLastSeatingBufferMinutes, 10);
  const lifecycleGraceMinutes = Number.parseInt(state.reservationLifecycleGraceMinutes, 10);

  return {
    name: trimmedName,
    slug: trimmedSlug,
    timezone: trimmedTimezone,
    contactEmail: trimmedEmail.length > 0 ? trimmedEmail : null,
    contactPhone: trimmedPhone.length > 0 ? trimmedPhone : null,
    address: trimmedAddress.length > 0 ? trimmedAddress : null,
    managerDailySummaryEnabled: state.managerDailySummaryEnabled,
    managerNotificationPhone:
      trimmedManagerNotificationPhone.length > 0 ? trimmedManagerNotificationPhone : null,
    googleMapUrl: trimmedMapUrl.length > 0 ? trimmedMapUrl : null,
    googleReviewUrl: trimmedReviewUrl.length > 0 ? trimmedReviewUrl : null,
    bookingPolicy: trimmedPolicy.length > 0 ? trimmedPolicy : null,
    reservationIntervalMinutes: intervalMinutes,
    reservationDefaultDurationMinutes: defaultDurationMinutes,
    reservationLastSeatingBufferMinutes: lastSeatingBufferMinutes,
    reservationLifecycleGraceMinutes: lifecycleGraceMinutes,
    // Email preferences are always enabled - no longer configurable
    emailSendReminder24h: true,
    emailSendReminderShort: true,
    emailSendReviewRequest: true,
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
    } else if (
      intervalValue < RESERVATION_INTERVAL_MIN ||
      intervalValue > RESERVATION_INTERVAL_MAX
    ) {
      errors.reservationIntervalMinutes = `Must be between ${RESERVATION_INTERVAL_MIN} and ${RESERVATION_INTERVAL_MAX} minutes`;
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

  const graceRaw = state.reservationLifecycleGraceMinutes.trim();
  if (!graceRaw) {
    errors.reservationLifecycleGraceMinutes = 'Lifecycle grace period is required';
  } else {
    const graceValue = Number(graceRaw);
    if (!Number.isInteger(graceValue)) {
      errors.reservationLifecycleGraceMinutes = 'Must be a whole number';
    } else if (graceValue < 0 || graceValue > 120) {
      errors.reservationLifecycleGraceMinutes = 'Must be between 0 and 120 minutes';
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

  const managerNotificationPhone = state.managerNotificationPhone.trim();
  if (state.managerDailySummaryEnabled && !managerNotificationPhone) {
    errors.managerNotificationPhone = 'Add a manager number before enabling daily SMS summaries';
  }
  if (managerNotificationPhone && !/^\+[1-9][0-9]{6,14}$/.test(managerNotificationPhone)) {
    errors.managerNotificationPhone = 'Use E.164 format such as +447700900000';
  }

  const reviewUrl = state.googleReviewUrl.trim();
  if (reviewUrl) {
    try {
      new URL(reviewUrl);
    } catch {
      errors.googleReviewUrl = 'Enter a valid URL (e.g., https://g.page/.../review)';
    }
  }

  const mapUrl = state.googleMapUrl.trim();
  if (mapUrl) {
    try {
      new URL(mapUrl);
    } catch {
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

  const handleToggle = (field: keyof Pick<FormState, 'managerDailySummaryEnabled'>, value: boolean) => {
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

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label
                htmlFor="restaurant-manager-notification-phone"
                className="inline-flex items-center gap-1"
              >
                Manager Notification Number
              </Label>
              <HelpTooltip
                description={FIELD_TOOLTIPS.managerNotificationPhone}
                ariaLabel="What is the manager notification number?"
              />
            </div>
            <Input
              id="restaurant-manager-notification-phone"
              type="tel"
              inputMode="tel"
              placeholder="+447700900000"
              value={state.managerNotificationPhone}
              onChange={(event) => handleChange('managerNotificationPhone', event.target.value)}
              aria-invalid={Boolean(errors.managerNotificationPhone)}
              aria-describedby={
                errors.managerNotificationPhone
                  ? 'restaurant-manager-notification-phone-error'
                  : 'restaurant-manager-notification-phone-help'
              }
              className={cn(
                errors.managerNotificationPhone &&
                  'border-destructive focus-visible:ring-destructive/60',
              )}
            />
            <p
              id="restaurant-manager-notification-phone-help"
              className="text-xs text-muted-foreground"
            >
              Used for the daily manager summary recipient. Keep it in E.164 format for production
              SMS delivery.
            </p>
            {errors.managerNotificationPhone && (
              <p
                id="restaurant-manager-notification-phone-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.managerNotificationPhone}
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label
                    htmlFor="restaurant-manager-daily-summary-enabled"
                    className="inline-flex items-center gap-1"
                  >
                    Daily Manager SMS Summary
                  </Label>
                  <HelpTooltip
                    description={FIELD_TOOLTIPS.managerDailySummaryEnabled}
                    ariaLabel="What does the daily manager SMS summary toggle do?"
                  />
                </div>
                <p
                  id="restaurant-manager-daily-summary-enabled-help"
                  className="text-xs text-muted-foreground"
                >
                  Sends the booking summary to the manager at 10:00 local restaurant time.
                </p>
              </div>
              <Switch
                id="restaurant-manager-daily-summary-enabled"
                checked={state.managerDailySummaryEnabled}
                onCheckedChange={(checked) => handleToggle('managerDailySummaryEnabled', checked)}
                aria-describedby="restaurant-manager-daily-summary-enabled-help"
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="restaurant-slug" className="inline-flex items-center gap-1">
                Slug <span className="text-destructive">*</span>
              </Label>
              <HelpTooltip
                description={FIELD_TOOLTIPS.slug}
                ariaLabel="What is a restaurant slug?"
              />
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
              <HelpTooltip
                description={FIELD_TOOLTIPS.timezone}
                ariaLabel="Why does timezone matter?"
              />
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
              min={RESERVATION_INTERVAL_MIN}
              max={RESERVATION_INTERVAL_MAX}
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
                errors.reservationIntervalMinutes &&
                  'border-destructive focus-visible:ring-destructive/60',
              )}
            />
            <p id="restaurant-interval-help" className="text-xs text-muted-foreground">
              Controls slot spacing; must be between {RESERVATION_INTERVAL_MIN} and{' '}
              {RESERVATION_INTERVAL_MAX} minutes.
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
              onChange={(event) =>
                handleChange('reservationDefaultDurationMinutes', event.target.value)
              }
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
              onChange={(event) =>
                handleChange('reservationLastSeatingBufferMinutes', event.target.value)
              }
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
              Controls the latest start time relative to closing; choose a value between 15 and 300
              minutes.
            </p>
            {errors.reservationLastSeatingBufferMinutes && (
              <p
                id="restaurant-last-seating-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.reservationLastSeatingBufferMinutes}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label
                htmlFor="restaurant-lifecycle-grace"
                className="inline-flex items-center gap-1"
              >
                Lifecycle Grace Period (minutes) <span className="text-destructive">*</span>
              </Label>
              <HelpTooltip
                description={FIELD_TOOLTIPS.lifecycleGrace}
                ariaLabel="Lifecycle grace period details"
              />
            </div>
            <Input
              id="restaurant-lifecycle-grace"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              step={1}
              value={state.reservationLifecycleGraceMinutes}
              onChange={(event) =>
                handleChange('reservationLifecycleGraceMinutes', event.target.value)
              }
              aria-invalid={Boolean(errors.reservationLifecycleGraceMinutes)}
              aria-describedby={
                errors.reservationLifecycleGraceMinutes
                  ? 'restaurant-lifecycle-grace-error'
                  : 'restaurant-lifecycle-grace-help'
              }
              className={cn(
                errors.reservationLifecycleGraceMinutes &&
                  'border-destructive focus-visible:ring-destructive/60',
              )}
            />
            <p id="restaurant-lifecycle-grace-help" className="text-xs text-muted-foreground">
              Extra time after a booking ends before it is hidden; usually 0-120 mins.
            </p>
            {errors.reservationLifecycleGraceMinutes && (
              <p
                id="restaurant-lifecycle-grace-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.reservationLifecycleGraceMinutes}
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
              className={cn(
                errors.contactEmail && 'border-destructive focus-visible:ring-destructive/60',
              )}
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
              className={cn(
                errors.contactPhone && 'border-destructive focus-visible:ring-destructive/60',
              )}
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
              <Label htmlFor="restaurant-google-review">Google Review URL</Label>
              <HelpTooltip
                description={FIELD_TOOLTIPS.googleReviewUrl}
                ariaLabel="Why add a Google review link?"
              />
            </div>
            <Input
              id="restaurant-google-review"
              type="url"
              inputMode="url"
              placeholder="https://g.page/r/YourRestaurant/review"
              value={state.googleReviewUrl}
              onChange={(event) => handleChange('googleReviewUrl', event.target.value)}
              aria-invalid={Boolean(errors.googleReviewUrl)}
              aria-describedby={
                errors.googleReviewUrl
                  ? 'restaurant-google-review-error'
                  : 'restaurant-google-review-help'
              }
              className={cn(
                errors.googleReviewUrl && 'border-destructive focus-visible:ring-destructive/60',
              )}
            />
            <p id="restaurant-google-review-help" className="text-xs text-muted-foreground">
              Optional link sent to customers to ask for a review.
            </p>
            {errors.googleReviewUrl && (
              <p
                id="restaurant-google-review-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.googleReviewUrl}
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="restaurant-google-map">Google Maps URL</Label>
              <HelpTooltip
                description={FIELD_TOOLTIPS.googleMapUrl}
                ariaLabel="Why add a Google Maps link?"
              />
            </div>
            <Input
              id="restaurant-google-map"
              type="url"
              inputMode="url"
              placeholder="https://maps.google.com/..."
              value={state.googleMapUrl}
              onChange={(event) => handleChange('googleMapUrl', event.target.value)}
              aria-invalid={Boolean(errors.googleMapUrl)}
              aria-describedby={
                errors.googleMapUrl ? 'restaurant-google-map-error' : 'restaurant-google-map-help'
              }
              className={cn(
                errors.googleMapUrl && 'border-destructive focus-visible:ring-destructive/60',
              )}
            />
            <p id="restaurant-google-map-help" className="text-xs text-muted-foreground">
              Optional link shared with guests for directions.
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
              <HelpTooltip
                description={FIELD_TOOLTIPS.bookingPolicy}
                ariaLabel="Booking policy guidance"
              />
            </div>
            <Textarea
              id="restaurant-policy"
              value={state.bookingPolicy}
              onChange={(event) => handleChange('bookingPolicy', event.target.value)}
              rows={3}
            />
          </div>

          {/* Guest email settings removed - all emails are always enabled */}
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
