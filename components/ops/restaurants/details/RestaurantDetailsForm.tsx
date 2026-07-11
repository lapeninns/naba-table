'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type FormEvent, type PropsWithChildren } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { cn } from '@/lib/utils';

import {
  ALL_TIMEZONES,
  buildTimezoneLabel,
  FIELD_TOOLTIPS,
  getGbpStatuses,
  mapInitialValues,
  sanitizePayload,
  validateRestaurantDetails,
  type FormErrors,
  type FormState,
  type GbpComparableField,
  type RestaurantDetailsFormValues,
} from '../restaurantDetailsFormModel';
import { FieldRequirement, GbpStatusBadge } from './shared';

import type { UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';
import type { ProfileFieldVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';

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
  const timezoneOptionsId = useId();

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

  const gbpStatuses = getGbpStatuses(state, gbpFieldVerifications);

  const handleChange = (field: keyof FormState, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleToggle = (
    field: keyof Pick<FormState, 'managerDailySummaryEnabled' | 'managerWhatsappEnabled'>,
    value: boolean,
  ) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const nextErrors = validateRestaurantDetails(state);
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
      <FormRoot onSubmit={handleSubmit} className={cn('space-y-4', className)}>
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
              <FieldRequirement label="Required" />
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
              aria-describedby={errors.name ? 'restaurant-name-error' : 'restaurant-name-help'}
              className={cn(errors.name && 'border-destructive focus-visible:ring-destructive/60')}
              autoFocus
            />
            <p id="restaurant-name-help" className="text-xs text-muted-foreground">
              {FIELD_TOOLTIPS.name}
            </p>
            {errors.name && (
              <p id="restaurant-name-error" className="text-xs text-destructive" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-business-description">Business description</Label>
              <FieldRequirement label="Optional" />
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
              {FIELD_TOOLTIPS.businessDescription}
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
              <FieldRequirement label="Required" />
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
                  aria-controls={timezoneOptionsId}
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
                    <div id={timezoneOptionsId} className="space-y-1">
                      {filteredTimezones.map((timezone) => (
                        <Button
                          key={timezone}
                          type="button"
                          variant="ghost"
                          className={cn(
                            'h-auto w-full justify-between rounded-md px-3 py-2 text-left text-sm font-normal hover:bg-muted',
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
                        </Button>
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
              {FIELD_TOOLTIPS.timezone}
            </p>
            {errors.timezone && (
              <p id="restaurant-timezone-error" className="text-xs text-destructive" role="alert">
                {errors.timezone}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-email">Contact Email</Label>
              <FieldRequirement label="Optional" />
            </div>
            <Input
              id="restaurant-email"
              type="email"
              value={state.contactEmail}
              onChange={(event) => handleChange('contactEmail', event.target.value)}
              aria-invalid={Boolean(errors.contactEmail)}
              aria-describedby={
                errors.contactEmail ? 'restaurant-email-error' : 'restaurant-email-help'
              }
              className={cn(
                errors.contactEmail && 'border-destructive focus-visible:ring-destructive/60',
              )}
            />
            <p id="restaurant-email-help" className="text-xs text-muted-foreground">
              {FIELD_TOOLTIPS.contactEmail}
            </p>
            {errors.contactEmail && (
              <p id="restaurant-email-error" className="text-xs text-destructive" role="alert">
                {errors.contactEmail}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-phone">Contact Phone</Label>
              <FieldRequirement label="Optional" />
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
              aria-describedby={
                errors.contactPhone ? 'restaurant-phone-error' : 'restaurant-phone-help'
              }
              className={cn(
                errors.contactPhone && 'border-destructive focus-visible:ring-destructive/60',
              )}
            />
            <p id="restaurant-phone-help" className="text-xs text-muted-foreground">
              {FIELD_TOOLTIPS.contactPhone}
            </p>
            {errors.contactPhone && (
              <p id="restaurant-phone-error" className="text-xs text-destructive" role="alert">
                {errors.contactPhone}
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-address">Address</Label>
              <FieldRequirement label="Optional" />
              <GbpStatusBadge
                status={gbpStatuses.address}
                verification={gbpFieldVerifications?.address}
              />
            </div>
            <Input
              id="restaurant-address"
              value={state.address}
              onChange={(event) => handleChange('address', event.target.value)}
              aria-describedby="restaurant-address-help"
            />
            <p id="restaurant-address-help" className="text-xs text-muted-foreground">
              {FIELD_TOOLTIPS.address}
            </p>
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
                Booking slot spacing (minutes) <span className="text-destructive">*</span>
              </Label>
              <FieldRequirement label="Required" />
              <HelpTooltip
                description={FIELD_TOOLTIPS.reservationInterval}
                ariaLabel="Booking slot spacing details"
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
              {FIELD_TOOLTIPS.reservationInterval}
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
                Default table time (minutes) <span className="text-destructive">*</span>
              </Label>
              <FieldRequirement label="Required" />
              <HelpTooltip
                description={FIELD_TOOLTIPS.reservationDuration}
                ariaLabel="Default table time details"
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
              {FIELD_TOOLTIPS.reservationDuration}
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
              <FieldRequirement label="Required" />
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
              {FIELD_TOOLTIPS.lastSeatingBuffer}
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
                Grace period (minutes) <span className="text-destructive">*</span>
              </Label>
              <FieldRequirement label="Required" />
              <HelpTooltip
                description={FIELD_TOOLTIPS.lifecycleGrace}
                ariaLabel="Grace period details"
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
              {FIELD_TOOLTIPS.lifecycleGrace}
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
              <Label htmlFor="restaurant-google-review">Guest review link</Label>
              <FieldRequirement label="Optional" />
              <GbpStatusBadge
                status={gbpStatuses.googleReviewUrl}
                verification={gbpFieldVerifications?.googleReviewUrl}
              />
              <HelpTooltip
                description={FIELD_TOOLTIPS.googleReviewUrl}
                ariaLabel="Why add a guest review link?"
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
              {FIELD_TOOLTIPS.googleReviewUrl}
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
              <Label htmlFor="restaurant-google-map">Map link</Label>
              <FieldRequirement label="Optional" />
              <GbpStatusBadge
                status={gbpStatuses.googleMapUrl}
                verification={gbpFieldVerifications?.googleMapUrl}
              />
              <HelpTooltip
                description={FIELD_TOOLTIPS.googleMapUrl}
                ariaLabel="Why add a map link?"
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
              {FIELD_TOOLTIPS.googleMapUrl}
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
              <FieldRequirement label="Optional" />
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
              aria-describedby="restaurant-policy-help"
            />
            <p id="restaurant-policy-help" className="text-xs text-muted-foreground">
              {FIELD_TOOLTIPS.bookingPolicy}
            </p>
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
                Manager alert number
              </Label>
              <FieldRequirement label="Required if on" />
              <HelpTooltip
                description={FIELD_TOOLTIPS.managerNotificationPhone}
                ariaLabel="What is the manager alert number?"
              />
            </div>
            <Input
              id="restaurant-manager-notification-phone"
              type="tel"
              inputMode="tel"
              placeholder="+447700900000"
              value={state.managerNotificationPhone}
              onChange={(event) => {
                handleChange('managerNotificationPhone', event.target.value);
                handleToggle('managerWhatsappEnabled', false);
              }}
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
              {FIELD_TOOLTIPS.managerNotificationPhone}
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
                    Daily manager SMS summary
                  </Label>
                  <FieldRequirement label="Optional" />
                  <HelpTooltip
                    description={FIELD_TOOLTIPS.managerDailySummaryEnabled}
                    ariaLabel="What does the daily manager SMS summary toggle do?"
                  />
                </div>
                <p
                  id="restaurant-manager-daily-summary-enabled-help"
                  className="text-xs text-muted-foreground"
                >
                  {FIELD_TOOLTIPS.managerDailySummaryEnabled}
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

          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="restaurant-manager-whatsapp-enabled">
                  Send daily summary via WhatsApp first
                </Label>
                <p
                  id="restaurant-manager-whatsapp-enabled-help"
                  className="text-xs text-muted-foreground"
                >
                  Nabatable sends on behalf of the restaurant to this manager number. If WhatsApp is
                  unavailable, we’ll send the summary by SMS instead.
                </p>
              </div>
              <Switch
                id="restaurant-manager-whatsapp-enabled"
                checked={state.managerWhatsappEnabled}
                disabled={
                  !state.managerNotificationPhone.trim() || !state.managerDailySummaryEnabled
                }
                onCheckedChange={(checked) => handleToggle('managerWhatsappEnabled', checked)}
                aria-describedby="restaurant-manager-whatsapp-enabled-help"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <Accordion type="single" collapsible className="rounded-lg border border-border/70">
              <AccordionItem value="advanced-settings" className="border-none">
                <AccordionTrigger className="px-4 text-left text-sm font-medium">
                  Booking page URL
                </AccordionTrigger>
                <AccordionContent className="space-y-4 px-4 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="restaurant-slug" className="inline-flex items-center gap-1">
                        Booking page URL <span className="text-destructive">*</span>
                      </Label>
                      <FieldRequirement label="Required" />
                      <HelpTooltip
                        description={FIELD_TOOLTIPS.slug}
                        ariaLabel="What is the booking page URL?"
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
                      {FIELD_TOOLTIPS.slug}
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
      </FormRoot>
    </TooltipProvider>
  );
}
