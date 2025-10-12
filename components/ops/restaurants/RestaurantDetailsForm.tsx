'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';

export type RestaurantDetailsFormValues = {
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  bookingPolicy: string | null;
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
  capacity: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  bookingPolicy: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
    capacity: values.capacity !== null && values.capacity !== undefined ? String(values.capacity) : '',
    contactEmail: values.contactEmail ?? '',
    contactPhone: values.contactPhone ?? '',
    address: values.address ?? '',
    bookingPolicy: values.bookingPolicy ?? '',
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
  const trimmedPolicy = trim(state.bookingPolicy);

  return {
    name: trimmedName,
    slug: trimmedSlug,
    timezone: trimmedTimezone,
    capacity: state.capacity ? Number(state.capacity) : null,
    contactEmail: trimmedEmail.length > 0 ? trimmedEmail : null,
    contactPhone: trimmedPhone.length > 0 ? trimmedPhone : null,
    address: trimmedAddress.length > 0 ? trimmedAddress : null,
    bookingPolicy: trimmedPolicy.length > 0 ? trimmedPolicy : null,
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

  if (state.capacity) {
    const numericCapacity = Number(state.capacity);
    if (Number.isNaN(numericCapacity)) {
      errors.capacity = 'Capacity must be a number';
    } else if (numericCapacity <= 0) {
      errors.capacity = 'Capacity must be positive';
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
          <Label htmlFor="restaurant-slug">
            Slug <span className="text-destructive">*</span>
          </Label>
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
          <Label htmlFor="restaurant-timezone">
            Timezone <span className="text-destructive">*</span>
          </Label>
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
          <Label htmlFor="restaurant-capacity">Capacity</Label>
          <Input
            id="restaurant-capacity"
            type="number"
            min="1"
            value={state.capacity}
            onChange={(event) => handleChange('capacity', event.target.value)}
            aria-invalid={Boolean(errors.capacity)}
            aria-describedby={errors.capacity ? 'restaurant-capacity-error' : undefined}
            className={cn(errors.capacity && 'border-destructive focus-visible:ring-destructive/60')}
          />
          {errors.capacity && (
            <p id="restaurant-capacity-error" className="text-xs text-destructive" role="alert">
              {errors.capacity}
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
          <Label htmlFor="restaurant-policy">Booking Policy</Label>
          <Textarea
            id="restaurant-policy"
            value={state.bookingPolicy}
            onChange={(event) => handleChange('bookingPolicy', event.target.value)}
            rows={3}
          />
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
  );
}

