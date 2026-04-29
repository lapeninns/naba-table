'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { GoogleBusinessProfileComparisonBadge } from '@/components/features/restaurant-settings/GoogleBusinessProfileComparisonBadge';
import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useOpsUpdateRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { cn } from '@/lib/utils';

import type { UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';
import type { ProfileFieldVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';
import type { RestaurantProfile } from '@/services/ops/restaurants';
import type { PropsWithChildren } from 'react';

export type RestaurantDetailsFormValues = {
  name: string;
  slug: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  businessDescription: string | null;
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
  onDirtyChange?: (dirty: boolean) => void;
  submitLabel?: string;
  className?: string;
  gbpFieldVerifications?: Partial<Record<GbpComparableField, ProfileFieldVerification>>;
}>;

type FormState = {
  name: string;
  slug: string;
  timezone: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  businessDescription: string;
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
type GbpComparableField =
  | 'name'
  | 'businessDescription'
  | 'contactPhone'
  | 'address'
  | 'googleMapUrl'
  | 'googleReviewUrl';
type GbpFieldStatus = 'verified' | 'drifted' | 'unavailable';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const FIELD_TOOLTIPS = {
  slug: 'Lowercase text used in booking links. Only letters, numbers, and hyphens are allowed.',
  timezone:
    'Keeps opening hours, reservations, and reminders aligned to the restaurant’s local time.',
  businessDescription:
    'Public copy guests may see when they find or book this restaurant. Keep it clear and current.',
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

const ALL_TIMEZONES =
  typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [...COMMON_TIMEZONES];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeComparableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparablePhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/[^\d+]/g, '');
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparableUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${normalizedPath}${parsed.search}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

function compareFieldValue(
  field: GbpComparableField,
  currentValue: string,
  gbpValue: string | null | undefined,
): boolean {
  switch (field) {
    case 'contactPhone': {
      const currentPhone = normalizeComparablePhone(currentValue);
      const providerPhone = normalizeComparablePhone(gbpValue);
      return Boolean(currentPhone) && currentPhone === providerPhone;
    }
    case 'googleMapUrl':
    case 'googleReviewUrl': {
      const currentUrl = normalizeComparableUrl(currentValue);
      const providerUrl = normalizeComparableUrl(gbpValue);
      return Boolean(currentUrl) && currentUrl === providerUrl;
    }
    case 'name':
    case 'businessDescription':
    case 'address': {
      const currentText = normalizeComparableText(currentValue);
      const providerText = normalizeComparableText(gbpValue);
      return Boolean(currentText) && currentText === providerText;
    }
    default:
      return false;
  }
}

function GbpStatusBadge(props: {
  verification?: ProfileFieldVerification;
  status: GbpFieldStatus;
}) {
  if (props.status === 'unavailable' || !props.verification) {
    return null;
  }

  return (
    <GoogleBusinessProfileComparisonBadge
      status={props.status}
      tooltipTitle={props.verification.tooltipTitle}
      tooltipLines={props.verification.tooltipLines}
      tooltipFooter={props.verification.tooltipFooter}
      ariaLabel="Show Google Business Profile field details"
    />
  );
}

function mapInitialValues(values: RestaurantDetailsFormValues): FormState {
  return {
    name: values.name ?? '',
    slug: values.slug ?? '',
    timezone: values.timezone ?? COMMON_TIMEZONES[0],
    contactEmail: values.contactEmail ?? '',
    contactPhone: values.contactPhone ?? '',
    address: values.address ?? '',
    businessDescription: values.businessDescription ?? '',
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

function formatTimezoneOffset(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

function buildTimezoneLabel(timezone: string): string {
  const city = timezone.split('/').at(-1)?.replace(/_/g, ' ') ?? timezone;
  return `${city} (${formatTimezoneOffset(timezone)})`;
}

function sanitizePayload(state: FormState): UpdateRestaurantInput {
  const trim = (value: string) => value.trim();
  const trimmedName = trim(state.name);
  const trimmedSlug = trim(state.slug);
  const trimmedTimezone = trim(state.timezone);
  const trimmedEmail = trim(state.contactEmail);
  const trimmedPhone = trim(state.contactPhone);
  const trimmedAddress = trim(state.address);
  const trimmedBusinessDescription = trim(state.businessDescription);
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
    businessDescription: trimmedBusinessDescription.length > 0 ? trimmedBusinessDescription : null,
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
    errors.slug = 'Booking link slug is required';
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug = 'Booking link slug must contain only lowercase letters, numbers, and hyphens';
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

  if (state.businessDescription.length > 4096) {
    errors.businessDescription = 'Business description must be 4096 characters or fewer';
  }

  return errors;
}

type RestaurantDetailsSubformProps = {
  restaurantId: string | null;
  initialValues: RestaurantDetailsFormValues;
  onDirtyChange?: (dirty: boolean) => void;
  gbpFieldVerifications?: Partial<Record<GbpComparableField, ProfileFieldVerification>>;
};

type DetailsField = keyof FormState;

function pickState(state: FormState, fields: readonly DetailsField[]): Partial<FormState> {
  return fields.reduce<Partial<FormState>>((result, field) => {
    result[field] = state[field] as never;
    return result;
  }, {});
}

function filterErrors(errors: FormErrors, fields: readonly DetailsField[]): FormErrors {
  return fields.reduce<FormErrors>((result, field) => {
    if (errors[field]) {
      result[field] = errors[field];
    }
    return result;
  }, {});
}

function getGbpStatuses(
  state: FormState,
  gbpFieldVerifications?: Partial<Record<GbpComparableField, ProfileFieldVerification>>,
) {
  return {
    name: compareFieldValue('name', state.name, gbpFieldVerifications?.name?.providerValue)
      ? ('verified' as const)
      : gbpFieldVerifications?.name?.providerValue || state.name
        ? ('drifted' as const)
        : ('unavailable' as const),
    businessDescription: compareFieldValue(
      'businessDescription',
      state.businessDescription,
      gbpFieldVerifications?.businessDescription?.providerValue,
    )
      ? ('verified' as const)
      : gbpFieldVerifications?.businessDescription?.providerValue || state.businessDescription
        ? ('drifted' as const)
        : ('unavailable' as const),
    contactPhone: compareFieldValue(
      'contactPhone',
      state.contactPhone,
      gbpFieldVerifications?.contactPhone?.providerValue,
    )
      ? ('verified' as const)
      : gbpFieldVerifications?.contactPhone?.providerValue || state.contactPhone
        ? ('drifted' as const)
        : ('unavailable' as const),
    address: compareFieldValue(
      'address',
      state.address,
      gbpFieldVerifications?.address?.providerValue,
    )
      ? ('verified' as const)
      : gbpFieldVerifications?.address?.providerValue || state.address
        ? ('drifted' as const)
        : ('unavailable' as const),
    googleMapUrl: compareFieldValue(
      'googleMapUrl',
      state.googleMapUrl,
      gbpFieldVerifications?.googleMapUrl?.providerValue,
    )
      ? ('verified' as const)
      : gbpFieldVerifications?.googleMapUrl?.providerValue || state.googleMapUrl
        ? ('drifted' as const)
        : ('unavailable' as const),
    googleReviewUrl: compareFieldValue(
      'googleReviewUrl',
      state.googleReviewUrl,
      gbpFieldVerifications?.googleReviewUrl?.providerValue,
    )
      ? ('verified' as const)
      : gbpFieldVerifications?.googleReviewUrl?.providerValue || state.googleReviewUrl
        ? ('drifted' as const)
        : ('unavailable' as const),
  };
}

function useRestaurantDetailsSubform({
  initialValues,
  fields,
  onDirtyChange,
  restaurantId,
}: {
  initialValues: RestaurantDetailsFormValues;
  fields: readonly DetailsField[];
  onDirtyChange?: (dirty: boolean) => void;
  restaurantId: string | null;
}) {
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);
  const [state, setState] = useState<FormState>(() => mapInitialValues(initialValues));
  const [errors, setErrors] = useState<FormErrors>({});
  const initialFormState = useMemo(() => mapInitialValues(initialValues), [initialValues]);
  const serializedInitialValues = useMemo(
    () => JSON.stringify(pickState(initialFormState, fields)),
    [fields, initialFormState],
  );
  const serializedCurrentState = useMemo(
    () => JSON.stringify(pickState(state, fields)),
    [fields, state],
  );
  const isDirty = serializedCurrentState !== serializedInitialValues;

  useEffect(() => {
    if (isDirty) {
      return;
    }
    setState(initialFormState);
    setErrors({});
  }, [initialFormState, isDirty]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleChange = (field: keyof FormState, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleToggle = (
    field: keyof Pick<FormState, 'managerDailySummaryEnabled'>,
    value: boolean,
  ) => {
    setState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const submitPartial = async (
    event: React.FormEvent,
    payloadBuilder: (nextState: FormState) => Partial<RestaurantProfile>,
    errorLogLabel: string,
  ) => {
    event.preventDefault();
    const nextErrors = filterErrors(validate(state), fields);
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    try {
      await updateMutation.mutateAsync(payloadBuilder(state));
      setErrors({});
    } catch (error) {
      console.error(`[${errorLogLabel}] submit failed`, error);
    }
  };

  return {
    state,
    errors,
    isSubmitting: updateMutation.isPending,
    handleChange,
    handleToggle,
    submitPartial,
  };
}

function SubformActions({
  isSubmitting,
  submitLabel,
}: {
  isSubmitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : submitLabel}
      </Button>
    </div>
  );
}

const BRAND_FIELDS = ['name', 'businessDescription'] as const satisfies readonly DetailsField[];
const CONTACT_FIELDS = [
  'timezone',
  'contactEmail',
  'contactPhone',
  'address',
  'googleMapUrl',
  'googleReviewUrl',
] as const satisfies readonly DetailsField[];
const NOTIFICATION_FIELDS = [
  'managerNotificationPhone',
  'managerDailySummaryEnabled',
] as const satisfies readonly DetailsField[];
const ADVANCED_FIELDS = ['slug'] as const satisfies readonly DetailsField[];
const BOOKING_RULE_FIELDS = [
  'bookingPolicy',
  'reservationIntervalMinutes',
  'reservationDefaultDurationMinutes',
  'reservationLastSeatingBufferMinutes',
  'reservationLifecycleGraceMinutes',
] as const satisfies readonly DetailsField[];

export function BrandIdentitySubform({
  restaurantId,
  initialValues,
  onDirtyChange,
  gbpFieldVerifications,
}: RestaurantDetailsSubformProps) {
  const { state, errors, isSubmitting, handleChange, submitPartial } = useRestaurantDetailsSubform({
    initialValues,
    fields: BRAND_FIELDS,
    onDirtyChange,
    restaurantId,
  });
  const gbpStatuses = getGbpStatuses(state, gbpFieldVerifications);

  return (
    <TooltipProvider delayDuration={100}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) =>
          submitPartial(
            event,
            (nextState) => {
              const payload = sanitizePayload(nextState);
              return {
                name: payload.name,
                businessDescription: payload.businessDescription,
              };
            },
            'BrandIdentitySubform',
          )
        }
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="restaurant-name">
              Restaurant Name <span className="text-destructive">*</span>
            </Label>
            <GbpStatusBadge status={gbpStatuses.name} verification={gbpFieldVerifications?.name} />
          </div>
          <Input
            id="restaurant-name"
            value={state.name}
            onChange={(event) => handleChange('name', event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'restaurant-name-error' : undefined}
            className={cn(errors.name && 'border-destructive focus-visible:ring-destructive/60')}
          />
          {errors.name ? (
            <p id="restaurant-name-error" className="text-xs text-destructive" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="restaurant-business-description">Business description</Label>
            <GbpStatusBadge
              status={gbpStatuses.businessDescription}
              verification={gbpFieldVerifications?.businessDescription}
            />
            <HelpTooltip
              description={FIELD_TOOLTIPS.businessDescription}
              ariaLabel="Business description details"
            />
          </div>
          <Textarea
            id="restaurant-business-description"
            value={state.businessDescription}
            rows={6}
            onChange={(event) => handleChange('businessDescription', event.target.value)}
            aria-invalid={Boolean(errors.businessDescription)}
            aria-describedby={
              errors.businessDescription
                ? 'restaurant-business-description-error'
                : 'restaurant-business-description-help'
            }
            className={cn(
              errors.businessDescription && 'border-destructive focus-visible:ring-destructive/60',
            )}
          />
          <p id="restaurant-business-description-help" className="text-xs text-muted-foreground">
            Write this for guests. It should describe the restaurant clearly and naturally.
          </p>
          {errors.businessDescription ? (
            <p
              id="restaurant-business-description-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {errors.businessDescription}
            </p>
          ) : null}
        </div>

        <SubformActions isSubmitting={isSubmitting} submitLabel="Save brand & identity" />
      </form>
    </TooltipProvider>
  );
}

export function ContactLocationSubform({
  restaurantId,
  initialValues,
  onDirtyChange,
  gbpFieldVerifications,
}: RestaurantDetailsSubformProps) {
  const { state, errors, isSubmitting, handleChange, submitPartial } = useRestaurantDetailsSubform({
    initialValues,
    fields: CONTACT_FIELDS,
    onDirtyChange,
    restaurantId,
  });
  const [timezonePickerOpen, setTimezonePickerOpen] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const filteredTimezones = useMemo(() => {
    const query = timezoneSearch.trim().toLowerCase();
    if (!query) {
      return ALL_TIMEZONES;
    }

    return ALL_TIMEZONES.filter((timezone) => {
      const normalized = timezone.toLowerCase();
      const label = buildTimezoneLabel(timezone).toLowerCase();
      return normalized.includes(query) || label.includes(query);
    });
  }, [timezoneSearch]);
  const gbpStatuses = getGbpStatuses(state, gbpFieldVerifications);

  return (
    <TooltipProvider delayDuration={100}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) =>
          submitPartial(
            event,
            (nextState) => {
              const payload = sanitizePayload(nextState);
              return {
                timezone: payload.timezone,
                contactEmail: payload.contactEmail,
                contactPhone: payload.contactPhone,
                address: payload.address,
                googleMapUrl: payload.googleMapUrl,
                googleReviewUrl: payload.googleReviewUrl,
              };
            },
            'ContactLocationSubform',
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="restaurant-timezone" className="inline-flex items-center gap-1">
                Timezone <span className="text-destructive">*</span>
              </Label>
              <HelpTooltip
                description={FIELD_TOOLTIPS.timezone}
                ariaLabel="Why does timezone matter?"
              />
            </div>
            <Popover open={timezonePickerOpen} onOpenChange={setTimezonePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="restaurant-timezone"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={timezonePickerOpen}
                  aria-invalid={Boolean(errors.timezone)}
                  aria-describedby={
                    errors.timezone ? 'restaurant-timezone-error' : 'restaurant-timezone-help'
                  }
                  className={cn(
                    'h-10 w-full justify-between text-left font-normal',
                    !state.timezone && 'text-muted-foreground',
                    errors.timezone && 'border-destructive focus-visible:ring-destructive/60',
                  )}
                >
                  <span className="truncate">
                    {state.timezone ? buildTimezoneLabel(state.timezone) : 'Select timezone'}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-3" align="start">
                <div className="flex flex-col gap-3">
                  <Input
                    value={timezoneSearch}
                    onChange={(event) => setTimezoneSearch(event.target.value)}
                    placeholder="Search city, region, or UTC offset"
                  />
                  <ScrollArea className="h-64 pr-3">
                    <div className="flex flex-col gap-1">
                      {filteredTimezones.map((timezone) => (
                        <button
                          key={timezone}
                          type="button"
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted',
                            state.timezone === timezone && 'bg-muted text-foreground',
                          )}
                          onClick={() => {
                            handleChange('timezone', timezone);
                            setTimezonePickerOpen(false);
                            setTimezoneSearch('');
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {buildTimezoneLabel(timezone)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {timezone}
                            </span>
                          </span>
                          {state.timezone === timezone ? (
                            <Check className="ml-3 size-4 shrink-0 text-primary" />
                          ) : null}
                        </button>
                      ))}
                      {filteredTimezones.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                          No matching timezones found.
                        </p>
                      ) : null}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
            <p id="restaurant-timezone-help" className="text-xs text-muted-foreground">
              Search by city, region, or UTC offset.
            </p>
            {errors.timezone ? (
              <p id="restaurant-timezone-error" className="text-xs text-destructive" role="alert">
                {errors.timezone}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
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
            {errors.contactEmail ? (
              <p id="restaurant-email-error" className="text-xs text-destructive" role="alert">
                {errors.contactEmail}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-phone">Contact Phone</Label>
              <GbpStatusBadge
                status={gbpStatuses.contactPhone}
                verification={gbpFieldVerifications?.contactPhone}
              />
            </div>
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
            {errors.contactPhone ? (
              <p id="restaurant-phone-error" className="text-xs text-destructive" role="alert">
                {errors.contactPhone}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-address">Address</Label>
              <GbpStatusBadge
                status={gbpStatuses.address}
                verification={gbpFieldVerifications?.address}
              />
            </div>
            <Input
              id="restaurant-address"
              value={state.address}
              onChange={(event) => handleChange('address', event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-google-map">Google Maps URL</Label>
              <GbpStatusBadge
                status={gbpStatuses.googleMapUrl}
                verification={gbpFieldVerifications?.googleMapUrl}
              />
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
              Optional directions link guests can open from booking messages and public profiles.
            </p>
            {errors.googleMapUrl ? (
              <p id="restaurant-google-map-error" className="text-xs text-destructive" role="alert">
                {errors.googleMapUrl}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-google-review">Google Review URL</Label>
              <GbpStatusBadge
                status={gbpStatuses.googleReviewUrl}
                verification={gbpFieldVerifications?.googleReviewUrl}
              />
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
              Optional review link sent after a visit.
            </p>
            {errors.googleReviewUrl ? (
              <p
                id="restaurant-google-review-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.googleReviewUrl}
              </p>
            ) : null}
          </div>
        </div>

        <SubformActions isSubmitting={isSubmitting} submitLabel="Save contact details" />
      </form>
    </TooltipProvider>
  );
}

export function ManagerNotificationsSubform({
  restaurantId,
  initialValues,
  onDirtyChange,
}: RestaurantDetailsSubformProps) {
  const { state, errors, isSubmitting, handleChange, handleToggle, submitPartial } =
    useRestaurantDetailsSubform({
      initialValues,
      fields: NOTIFICATION_FIELDS,
      onDirtyChange,
      restaurantId,
    });

  return (
    <TooltipProvider delayDuration={100}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) =>
          submitPartial(
            event,
            (nextState) => {
              const payload = sanitizePayload(nextState);
              return {
                managerNotificationPhone: payload.managerNotificationPhone,
                managerDailySummaryEnabled: payload.managerDailySummaryEnabled,
              };
            },
            'ManagerNotificationsSubform',
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
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
              Enter the phone number that should receive the daily booking summary. Use E.164
              format, such as +447700900000.
            </p>
            {errors.managerNotificationPhone ? (
              <p
                id="restaurant-manager-notification-phone-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.managerNotificationPhone}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
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
                  Send the booking summary at 10:00 in the restaurant’s local time.
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
        </div>

        <SubformActions isSubmitting={isSubmitting} submitLabel="Save notifications" />
      </form>
    </TooltipProvider>
  );
}

export function AdvancedIdentitySubform({
  restaurantId,
  initialValues,
  onDirtyChange,
}: RestaurantDetailsSubformProps) {
  const { state, errors, isSubmitting, handleChange, submitPartial } = useRestaurantDetailsSubform({
    initialValues,
    fields: ADVANCED_FIELDS,
    onDirtyChange,
    restaurantId,
  });

  return (
    <TooltipProvider delayDuration={100}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) =>
          submitPartial(
            event,
            (nextState) => ({ slug: sanitizePayload(nextState).slug }),
            'AdvancedIdentitySubform',
          )
        }
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-slug" className="inline-flex items-center gap-1">
              Booking link slug <span className="text-destructive">*</span>
            </Label>
            <HelpTooltip
              description={FIELD_TOOLTIPS.slug}
              ariaLabel="What is a booking link slug?"
            />
          </div>
          <Input
            id="restaurant-slug"
            value={state.slug}
            onChange={(event) => handleChange('slug', event.target.value)}
            aria-invalid={Boolean(errors.slug)}
            aria-describedby={errors.slug ? 'restaurant-slug-error' : 'restaurant-slug-help'}
            className={cn(errors.slug && 'border-destructive focus-visible:ring-destructive/60')}
          />
          <p id="restaurant-slug-help" className="text-xs text-muted-foreground">
            This appears in shared booking links. Change it only when the public URL should change.
          </p>
          {errors.slug ? (
            <p id="restaurant-slug-error" className="text-xs text-destructive" role="alert">
              {errors.slug}
            </p>
          ) : null}
        </div>

        <SubformActions isSubmitting={isSubmitting} submitLabel="Save booking link" />
      </form>
    </TooltipProvider>
  );
}

export function BookingRulesSubform({
  restaurantId,
  initialValues,
  onDirtyChange,
}: RestaurantDetailsSubformProps) {
  const { state, errors, isSubmitting, handleChange, submitPartial } = useRestaurantDetailsSubform({
    initialValues,
    fields: BOOKING_RULE_FIELDS,
    onDirtyChange,
    restaurantId,
  });

  return (
    <TooltipProvider delayDuration={100}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) =>
          submitPartial(
            event,
            (nextState) => {
              const payload = sanitizePayload(nextState);
              return {
                bookingPolicy: payload.bookingPolicy,
                reservationIntervalMinutes: payload.reservationIntervalMinutes,
                reservationDefaultDurationMinutes: payload.reservationDefaultDurationMinutes,
                reservationLastSeatingBufferMinutes: payload.reservationLastSeatingBufferMinutes,
                reservationLifecycleGraceMinutes: payload.reservationLifecycleGraceMinutes,
              };
            },
            'BookingRulesSubform',
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
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
            {errors.reservationIntervalMinutes ? (
              <p id="restaurant-interval-error" className="text-xs text-destructive" role="alert">
                {errors.reservationIntervalMinutes}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
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
            {errors.reservationDefaultDurationMinutes ? (
              <p id="restaurant-duration-error" className="text-xs text-destructive" role="alert">
                {errors.reservationDefaultDurationMinutes}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
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
              Controls the latest start time relative to closing; choose 15 to 300 minutes.
            </p>
            {errors.reservationLastSeatingBufferMinutes ? (
              <p
                id="restaurant-last-seating-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.reservationLastSeatingBufferMinutes}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
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
            {errors.reservationLifecycleGraceMinutes ? (
              <p
                id="restaurant-lifecycle-grace-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.reservationLifecycleGraceMinutes}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
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

        <SubformActions isSubmitting={isSubmitting} submitLabel="Save booking rules" />
      </form>
    </TooltipProvider>
  );
}

export function RestaurantDetailsForm({
  initialValues,
  onSubmit,
  isSubmitting = false,
  onCancel,
  onDirtyChange,
  submitLabel = 'Save Changes',
  className,
  children,
  gbpFieldVerifications,
}: RestaurantDetailsFormProps) {
  const [state, setState] = useState<FormState>(() => mapInitialValues(initialValues));
  const [errors, setErrors] = useState<FormErrors>({});
  const [timezonePickerOpen, setTimezonePickerOpen] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');

  const initialFormState = useMemo(() => mapInitialValues(initialValues), [initialValues]);
  const serializedInitialValues = useMemo(
    () => JSON.stringify(initialFormState),
    [initialFormState],
  );
  const serializedCurrentState = useMemo(() => JSON.stringify(state), [state]);
  const isDirty = serializedCurrentState !== serializedInitialValues;

  useEffect(() => {
    if (serializedCurrentState !== serializedInitialValues && isDirty) {
      return;
    }
    setState(initialFormState);
    setErrors({});
  }, [initialFormState, isDirty, serializedCurrentState, serializedInitialValues]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const filteredTimezones = useMemo(() => {
    const query = timezoneSearch.trim().toLowerCase();
    if (!query) {
      return ALL_TIMEZONES;
    }

    return ALL_TIMEZONES.filter((timezone) => {
      const normalized = timezone.toLowerCase();
      const label = buildTimezoneLabel(timezone).toLowerCase();
      return normalized.includes(query) || label.includes(query);
    });
  }, [timezoneSearch]);

  const gbpStatuses = useMemo(
    () => ({
      name: compareFieldValue('name', state.name, gbpFieldVerifications?.name?.providerValue)
        ? ('verified' as const)
        : gbpFieldVerifications?.name?.providerValue || state.name
          ? ('drifted' as const)
          : ('unavailable' as const),
      businessDescription: compareFieldValue(
        'businessDescription',
        state.businessDescription,
        gbpFieldVerifications?.businessDescription?.providerValue,
      )
        ? ('verified' as const)
        : gbpFieldVerifications?.businessDescription?.providerValue || state.businessDescription
          ? ('drifted' as const)
          : ('unavailable' as const),
      contactPhone: compareFieldValue(
        'contactPhone',
        state.contactPhone,
        gbpFieldVerifications?.contactPhone?.providerValue,
      )
        ? ('verified' as const)
        : gbpFieldVerifications?.contactPhone?.providerValue || state.contactPhone
          ? ('drifted' as const)
          : ('unavailable' as const),
      address: compareFieldValue(
        'address',
        state.address,
        gbpFieldVerifications?.address?.providerValue,
      )
        ? ('verified' as const)
        : gbpFieldVerifications?.address?.providerValue || state.address
          ? ('drifted' as const)
          : ('unavailable' as const),
      googleMapUrl: compareFieldValue(
        'googleMapUrl',
        state.googleMapUrl,
        gbpFieldVerifications?.googleMapUrl?.providerValue,
      )
        ? ('verified' as const)
        : gbpFieldVerifications?.googleMapUrl?.providerValue || state.googleMapUrl
          ? ('drifted' as const)
          : ('unavailable' as const),
      googleReviewUrl: compareFieldValue(
        'googleReviewUrl',
        state.googleReviewUrl,
        gbpFieldVerifications?.googleReviewUrl?.providerValue,
      )
        ? ('verified' as const)
        : gbpFieldVerifications?.googleReviewUrl?.providerValue || state.googleReviewUrl
          ? ('drifted' as const)
          : ('unavailable' as const),
    }),
    [
      gbpFieldVerifications?.address?.providerValue,
      gbpFieldVerifications?.businessDescription?.providerValue,
      gbpFieldVerifications?.contactPhone?.providerValue,
      gbpFieldVerifications?.googleMapUrl?.providerValue,
      gbpFieldVerifications?.googleReviewUrl?.providerValue,
      gbpFieldVerifications?.name?.providerValue,
      state.address,
      state.businessDescription,
      state.contactPhone,
      state.googleMapUrl,
      state.googleReviewUrl,
      state.name,
    ],
  );

  const handleChange = (field: keyof FormState, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleToggle = (
    field: keyof Pick<FormState, 'managerDailySummaryEnabled'>,
    value: boolean,
  ) => {
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
      setErrors({});
    } catch (error) {
      // Error presentation is delegated to the mutation hook / caller.
      console.error('[RestaurantDetailsForm] submit failed', error);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            id="profile-identity"
            className="scroll-mt-28 sm:col-span-2 rounded-lg border border-border/70 bg-muted/20 p-4"
          >
            <p className="text-sm font-medium text-foreground">Restaurant identity</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep the guest-facing details, timezone, and contact information aligned with what
              staff actually manage day to day.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-name">
                Restaurant Name <span className="text-destructive">*</span>
              </Label>
              <GbpStatusBadge
                status={gbpStatuses.name}
                verification={gbpFieldVerifications?.name}
              />
            </div>
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
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-business-description">Business description</Label>
              <GbpStatusBadge
                status={gbpStatuses.businessDescription}
                verification={gbpFieldVerifications?.businessDescription}
              />
              <HelpTooltip
                description={FIELD_TOOLTIPS.businessDescription}
                ariaLabel="Business description details"
              />
            </div>
            <Textarea
              id="restaurant-business-description"
              value={state.businessDescription}
              rows={6}
              onChange={(event) => handleChange('businessDescription', event.target.value)}
              aria-invalid={Boolean(errors.businessDescription)}
              aria-describedby={
                errors.businessDescription
                  ? 'restaurant-business-description-error'
                  : 'restaurant-business-description-help'
              }
              className={cn(
                errors.businessDescription &&
                  'border-destructive focus-visible:ring-destructive/60',
              )}
            />
            <p id="restaurant-business-description-help" className="text-xs text-muted-foreground">
              Write this for guests. It should describe the restaurant clearly and naturally.
            </p>
            {errors.businessDescription && (
              <p
                id="restaurant-business-description-error"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.businessDescription}
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
            <Popover open={timezonePickerOpen} onOpenChange={setTimezonePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="restaurant-timezone"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={timezonePickerOpen}
                  aria-invalid={Boolean(errors.timezone)}
                  aria-describedby={
                    errors.timezone ? 'restaurant-timezone-error' : 'restaurant-timezone-help'
                  }
                  className={cn(
                    'h-10 w-full justify-between text-left font-normal',
                    !state.timezone && 'text-muted-foreground',
                    errors.timezone && 'border-destructive focus-visible:ring-destructive/60',
                  )}
                >
                  <span className="truncate">
                    {state.timezone ? buildTimezoneLabel(state.timezone) : 'Select timezone'}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-3" align="start">
                <div className="space-y-3">
                  <Input
                    value={timezoneSearch}
                    onChange={(event) => setTimezoneSearch(event.target.value)}
                    placeholder="Search city, region, or UTC offset"
                  />
                  <ScrollArea className="h-64 pr-3">
                    <div className="space-y-1">
                      {filteredTimezones.map((timezone) => (
                        <button
                          key={timezone}
                          type="button"
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted',
                            state.timezone === timezone && 'bg-muted text-foreground',
                          )}
                          onClick={() => {
                            handleChange('timezone', timezone);
                            setTimezonePickerOpen(false);
                            setTimezoneSearch('');
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {buildTimezoneLabel(timezone)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {timezone}
                            </span>
                          </span>
                          {state.timezone === timezone ? (
                            <Check className="ml-3 size-4 shrink-0 text-primary" />
                          ) : null}
                        </button>
                      ))}
                      {filteredTimezones.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                          No matching timezones found.
                        </p>
                      ) : null}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
            <p id="restaurant-timezone-help" className="text-xs text-muted-foreground">
              Search by city, region, or UTC offset to keep schedules and reminders accurate.
            </p>
            {errors.timezone && (
              <p id="restaurant-timezone-error" className="text-xs text-destructive" role="alert">
                {errors.timezone}
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
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-phone">Contact Phone</Label>
              <GbpStatusBadge
                status={gbpStatuses.contactPhone}
                verification={gbpFieldVerifications?.contactPhone}
              />
            </div>
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
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-address">Address</Label>
              <GbpStatusBadge
                status={gbpStatuses.address}
                verification={gbpFieldVerifications?.address}
              />
            </div>
            <Input
              id="restaurant-address"
              value={state.address}
              onChange={(event) => handleChange('address', event.target.value)}
            />
          </div>

          <div
            id="profile-booking"
            className="scroll-mt-28 sm:col-span-2 rounded-lg border border-border/70 bg-muted/20 p-4"
          >
            <p className="text-sm font-medium text-foreground">Guest booking experience</p>
            <p className="mt-1 text-sm text-muted-foreground">
              These rules shape what guests see during booking and in follow-up communications.
            </p>
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

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-google-review">Google Review URL</Label>
              <GbpStatusBadge
                status={gbpStatuses.googleReviewUrl}
                verification={gbpFieldVerifications?.googleReviewUrl}
              />
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
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-google-map">Google Maps URL</Label>
              <GbpStatusBadge
                status={gbpStatuses.googleMapUrl}
                verification={gbpFieldVerifications?.googleMapUrl}
              />
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

          <div
            id="profile-notifications"
            className="scroll-mt-28 sm:col-span-2 rounded-lg border border-border/70 bg-muted/20 p-4"
          >
            <p className="text-sm font-medium text-foreground">Staff notifications</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Daily manager summaries can be configured here. Guest reminder and review emails are
              always on for every restaurant, so staff do not need to manage them individually.
            </p>
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

          <div className="sm:col-span-2">
            <Accordion type="single" collapsible className="rounded-lg border border-border/70">
              <AccordionItem value="advanced-settings" className="border-none">
                <AccordionTrigger className="px-4 text-left text-sm font-medium">
                  Booking link
                </AccordionTrigger>
                <AccordionContent className="space-y-4 px-4 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="restaurant-slug" className="inline-flex items-center gap-1">
                        Booking link slug <span className="text-destructive">*</span>
                      </Label>
                      <HelpTooltip
                        description={FIELD_TOOLTIPS.slug}
                        ariaLabel="What is a booking link slug?"
                      />
                    </div>
                    <Input
                      id="restaurant-slug"
                      value={state.slug}
                      onChange={(event) => handleChange('slug', event.target.value)}
                      aria-invalid={Boolean(errors.slug)}
                      aria-describedby={
                        errors.slug ? 'restaurant-slug-error' : 'restaurant-slug-help'
                      }
                      className={cn(
                        errors.slug && 'border-destructive focus-visible:ring-destructive/60',
                      )}
                    />
                    <p id="restaurant-slug-help" className="text-xs text-muted-foreground">
                      This appears in shared booking links. Change it only when the public URL
                      should change.
                    </p>
                    {errors.slug && (
                      <p
                        id="restaurant-slug-error"
                        className="text-xs text-destructive"
                        role="alert"
                      >
                        {errors.slug}
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
