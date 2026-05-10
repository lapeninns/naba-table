'use client';

import {
  Check,
  ChevronsUpDown,
  Clock3,
  Copy,
  ExternalLink,
  Info,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useOpsUpdateRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { cn } from '@/lib/utils';

import {
  ALL_TIMEZONES,
  buildProfileCompletionAnalytics,
  buildTimezoneLabel,
  FIELD_TOOLTIPS,
  filterErrors,
  getGbpStatuses,
  mapInitialValues,
  mapRestaurantProfileValues,
  pickDraftValues,
  pickState,
  sanitizePayload,
  validateRestaurantDetails,
  type DetailsField,
  type FormErrors,
  type FormState,
  type GbpComparableField,
  type GbpFieldStatus,
  type RestaurantDetailsDraftValues,
  type RestaurantDetailsFormValues,
} from './restaurantDetailsFormModel';

import type { UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';
import type { ProfileFieldVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';
import type { RestaurantProfile } from '@/services/ops/restaurants';
import type { PropsWithChildren } from 'react';

export { COMMON_TIMEZONES } from './restaurantDetailsFormModel';
export type { RestaurantDetailsDraftValues, RestaurantDetailsFormValues };

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

type SubformStatus = {
  tone: 'success' | 'error';
  message: string;
} | null;
type ProfileAnalyticsSection =
  | 'brand_identity'
  | 'contact_location'
  | 'manager_notifications'
  | 'advanced_identity'
  | 'booking_rules';

function gbpStatusPresentation(status: Exclude<GbpFieldStatus, 'unavailable'>) {
  if (status === 'verified') {
    return {
      label: 'Matches GBP',
      icon: Check,
      className: 'border-primary/30 bg-primary/10 text-primary',
    };
  }

  return {
    label: 'Drifted from GBP',
    icon: ShieldAlert,
    className: 'border-primary/30 bg-primary/10 text-primary',
  };
}

function GbpStatusBadge(props: {
  verification?: ProfileFieldVerification;
  status: GbpFieldStatus;
}) {
  if (props.status === 'unavailable' || !props.verification) {
    return null;
  }

  const presentation = gbpStatusPresentation(props.status);
  const Icon = presentation.icon;
  const hasTooltip = Boolean(
    props.verification.tooltipTitle ||
    props.verification.tooltipLines.length > 0 ||
    props.verification.tooltipFooter,
  );

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn(
          'h-5 gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide',
          presentation.className,
        )}
      >
        <Icon className="size-3 shrink-0" aria-hidden />
        <span>{presentation.label}</span>
      </Badge>
      {hasTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label="Show Google Business Profile field details"
            >
              <Info className="size-3.5" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-sm space-y-2 px-3 py-2">
            {props.verification.tooltipTitle ? (
              <p className="text-xs font-semibold">{props.verification.tooltipTitle}</p>
            ) : null}
            {props.verification.tooltipLines.length > 0 ? (
              <div className="space-y-1">
                {props.verification.tooltipLines.map((line) => (
                  <p key={line} className="text-xs leading-snug">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
            {props.verification.tooltipFooter ? (
              <p className="border-t border-background/20 pt-2 text-xs leading-snug text-background/80">
                {props.verification.tooltipFooter}
              </p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}

function FieldRequirement({ label }: { label: 'Required' | 'Optional' | 'Required if on' }) {
  return (
    <span
      aria-hidden="true"
      className="rounded-sm border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground"
    >
      {label}
    </span>
  );
}

function getHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function ExternalUrlButton({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return null;
  }

  return (
    <Button type="button" variant="ghost" size="sm" asChild>
      <a href={href} target="_blank" rel="noreferrer">
        <ExternalLink data-icon="inline-start" aria-hidden />
        {label}
      </a>
    </Button>
  );
}

type RestaurantDetailsSubformProps = {
  restaurantId: string | null;
  initialValues: RestaurantDetailsFormValues;
  formId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onDraftChange?: (draft: RestaurantDetailsDraftValues, dirty: boolean) => void;
  gbpFieldVerifications?: Partial<Record<GbpComparableField, ProfileFieldVerification>>;
};

function emitProfileAnalytics(
  eventName:
    | 'restaurant_profile_validation_error'
    | 'restaurant_profile_section_saved'
    | 'restaurant_profile_section_save_failed',
  props: Record<string, unknown>,
) {
  track(eventName, props);
  void emit(eventName, props);
}

function useRestaurantDetailsSubform({
  initialValues,
  fields,
  analyticsSection,
  onDirtyChange,
  onDraftChange,
  restaurantId,
}: {
  initialValues: RestaurantDetailsFormValues;
  fields: readonly DetailsField[];
  analyticsSection: ProfileAnalyticsSection;
  onDirtyChange?: (dirty: boolean) => void;
  onDraftChange?: (draft: RestaurantDetailsDraftValues, dirty: boolean) => void;
  restaurantId: string | null;
}) {
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);
  const [state, setState] = useState<FormState>(() => mapInitialValues(initialValues));
  const [savedState, setSavedState] = useState<FormState>(() => mapInitialValues(initialValues));
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<SubformStatus>(null);
  const editStartedAtRef = useRef<number | null>(null);
  const initialFormState = useMemo(() => mapInitialValues(initialValues), [initialValues]);
  const serializedInitialValues = useMemo(
    () => JSON.stringify(pickState(savedState, fields)),
    [fields, savedState],
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
    setSavedState(initialFormState);
    setState(initialFormState);
    setErrors({});
  }, [initialFormState, isDirty]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    if (isDirty && editStartedAtRef.current === null) {
      editStartedAtRef.current = Date.now();
    }
    if (!isDirty) {
      editStartedAtRef.current = null;
    }
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onDraftChange?.(isDirty ? pickDraftValues(state, fields) : {}, isDirty);
  }, [fields, isDirty, onDraftChange, state]);

  const handleChange = (field: keyof FormState, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
    setStatus(null);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleToggle = (
    field: keyof Pick<FormState, 'managerDailySummaryEnabled'>,
    value: boolean,
  ) => {
    setState((prev) => ({ ...prev, [field]: value }));
    setStatus(null);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const submitPartial = async (
    event: React.FormEvent,
    payloadBuilder: (nextState: FormState) => Partial<RestaurantProfile>,
    errorLogLabel: string,
    _successMessage: string,
  ) => {
    event.preventDefault();
    const nextErrors = filterErrors(validateRestaurantDetails(state), fields);
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      setStatus({ tone: 'error', message: 'Fix the highlighted fields before saving.' });
      emitProfileAnalytics('restaurant_profile_validation_error', {
        restaurant_id: restaurantId,
        section: analyticsSection,
        field_count: Object.keys(nextErrors).length,
        fields: Object.keys(nextErrors),
      });
      return;
    }

    try {
      const updatedProfile = await updateMutation.mutateAsync(payloadBuilder(state));
      const updatedValues = mapRestaurantProfileValues(updatedProfile);
      const nextSavedState = mapInitialValues(updatedValues);
      const elapsedMs =
        editStartedAtRef.current === null
          ? null
          : Math.max(0, Date.now() - editStartedAtRef.current);
      const changedFields = fields.filter((field) => savedState[field] !== state[field]);
      setSavedState(nextSavedState);
      setState(nextSavedState);
      setErrors({});
      setStatus({
        tone: 'success',
        message: 'Saved just now.',
      });
      emitProfileAnalytics('restaurant_profile_section_saved', {
        restaurant_id: restaurantId,
        section: analyticsSection,
        changed_field_count: changedFields.length,
        changed_fields: changedFields,
        elapsed_ms: elapsedMs,
        saved_at: updatedProfile.updatedAt ?? null,
        ...buildProfileCompletionAnalytics(updatedValues),
      });
    } catch (error) {
      console.error(`[${errorLogLabel}] submit failed`, error);
      setStatus({ tone: 'error', message: 'Unable to save this section. Try again.' });
      emitProfileAnalytics('restaurant_profile_section_save_failed', {
        restaurant_id: restaurantId,
        section: analyticsSection,
        field_count: fields.length,
        code: error instanceof Error ? error.name : 'unknown',
      });
    }
  };

  return {
    state,
    errors,
    status,
    isSubmitting: updateMutation.isPending,
    handleChange,
    handleToggle,
    submitPartial,
  };
}

function SubformActions({
  isSubmitting,
  submitLabel,
  status,
}: {
  isSubmitting: boolean;
  submitLabel: string;
  status: SubformStatus;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted-foreground">Saves this section only.</p>
        {status ? (
          <p
            role={status.tone === 'error' ? 'alert' : 'status'}
            className={status.tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}
          >
            {status.message}
          </p>
        ) : null}
      </div>
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
  formId,
  onDirtyChange,
  onDraftChange,
  gbpFieldVerifications,
}: RestaurantDetailsSubformProps) {
  const { state, errors, status, isSubmitting, handleChange, submitPartial } =
    useRestaurantDetailsSubform({
      initialValues,
      fields: BRAND_FIELDS,
      analyticsSection: 'brand_identity',
      onDirtyChange,
      onDraftChange,
      restaurantId,
    });
  const gbpStatuses = getGbpStatuses(state, gbpFieldVerifications);

  return (
    <TooltipProvider delayDuration={100}>
      <FormRoot
        id={formId}
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
            'Brand and identity saved.',
          )
        }
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="restaurant-name">
              Restaurant Name <span className="text-destructive">*</span>
            </Label>
            <FieldRequirement label="Required" />
            <GbpStatusBadge status={gbpStatuses.name} verification={gbpFieldVerifications?.name} />
          </div>
          <Input
            id="restaurant-name"
            value={state.name}
            onChange={(event) => handleChange('name', event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'restaurant-name-error' : 'restaurant-name-help'}
            className={cn(errors.name && 'border-destructive focus-visible:ring-destructive/60')}
          />
          <p id="restaurant-name-help" className="text-xs text-muted-foreground">
            {FIELD_TOOLTIPS.name}
          </p>
          {errors.name ? (
            <p id="restaurant-name-error" className="text-xs text-destructive" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
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
              errors.businessDescription && 'border-destructive focus-visible:ring-destructive/60',
            )}
          />
          <p id="restaurant-business-description-help" className="text-xs text-muted-foreground">
            {FIELD_TOOLTIPS.businessDescription}
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

        <SubformActions
          isSubmitting={isSubmitting}
          submitLabel="Save brand & identity"
          status={status}
        />
      </FormRoot>
    </TooltipProvider>
  );
}

export function ContactLocationSubform({
  restaurantId,
  initialValues,
  formId,
  onDirtyChange,
  onDraftChange,
  gbpFieldVerifications,
}: RestaurantDetailsSubformProps) {
  const { state, errors, status, isSubmitting, handleChange, submitPartial } =
    useRestaurantDetailsSubform({
      initialValues,
      fields: CONTACT_FIELDS,
      analyticsSection: 'contact_location',
      onDirtyChange,
      onDraftChange,
      restaurantId,
    });
  const [timezonePickerOpen, setTimezonePickerOpen] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const timezoneOptionsId = useId();
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
  const mapUrl = getHttpUrl(state.googleMapUrl);
  const reviewUrl = getHttpUrl(state.googleReviewUrl);

  return (
    <TooltipProvider delayDuration={100}>
      <FormRoot
        id={formId}
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
            'Contact and location saved.',
          )
        }
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <p className="text-sm font-medium text-foreground">Public contact</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Email and phone are the fallback details guests see when they need help.
            </p>
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <p className="text-sm font-medium text-foreground">Location confidence</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Address, timezone, and map link should agree before the profile is treated as ready.
            </p>
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <p className="text-sm font-medium text-foreground">After-visit path</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Review links support follow-up emails without changing booking rules.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
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
                <div className="flex flex-col gap-3">
                  <Input
                    value={timezoneSearch}
                    onChange={(event) => setTimezoneSearch(event.target.value)}
                    placeholder="Search city, region, or UTC offset"
                  />
                  <ScrollArea className="h-64 pr-3">
                    <div id={timezoneOptionsId} className="flex flex-col gap-1">
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
            {errors.timezone ? (
              <p id="restaurant-timezone-error" className="text-xs text-destructive" role="alert">
                {errors.timezone}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
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
            {errors.contactPhone ? (
              <p id="restaurant-phone-error" className="text-xs text-destructive" role="alert">
                {errors.contactPhone}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
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
            <ExternalUrlButton href={mapUrl} label="Open map link" />
            {errors.googleMapUrl ? (
              <p id="restaurant-google-map-error" className="text-xs text-destructive" role="alert">
                {errors.googleMapUrl}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
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
            <ExternalUrlButton href={reviewUrl} label="Open review link" />
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

        <SubformActions
          isSubmitting={isSubmitting}
          submitLabel="Save contact details"
          status={status}
        />
      </FormRoot>
    </TooltipProvider>
  );
}

export function ManagerNotificationsSubform({
  restaurantId,
  initialValues,
  formId,
  onDirtyChange,
  onDraftChange,
}: RestaurantDetailsSubformProps) {
  const { state, errors, status, isSubmitting, handleChange, handleToggle, submitPartial } =
    useRestaurantDetailsSubform({
      initialValues,
      fields: NOTIFICATION_FIELDS,
      analyticsSection: 'manager_notifications',
      onDirtyChange,
      onDraftChange,
      restaurantId,
    });
  const summaryState = state.managerDailySummaryEnabled ? 'On' : 'Off';

  return (
    <TooltipProvider delayDuration={100}>
      <FormRoot
        id={formId}
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
            'Manager alerts saved.',
          )
        }
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              Staff-only setting
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Guests never see this number. It only controls manager booking-summary delivery.
            </p>
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock3 className="size-4 text-primary" aria-hidden />
              10:00 local summary
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Current state: <span className="text-foreground">{summaryState}</span>. A valid E.164
              phone number is required when it is on.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
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
              {FIELD_TOOLTIPS.managerNotificationPhone}
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
        </div>

        <SubformActions
          isSubmitting={isSubmitting}
          submitLabel="Save notifications"
          status={status}
        />
      </FormRoot>
    </TooltipProvider>
  );
}

export function AdvancedIdentitySubform({
  restaurantId,
  initialValues,
  formId,
  onDirtyChange,
  onDraftChange,
}: RestaurantDetailsSubformProps) {
  const { state, errors, status, isSubmitting, handleChange, submitPartial } =
    useRestaurantDetailsSubform({
      initialValues,
      fields: ADVANCED_FIELDS,
      analyticsSection: 'advanced_identity',
      onDirtyChange,
      onDraftChange,
      restaurantId,
    });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const bookingSlug = state.slug.trim();
  const bookingPath = bookingSlug ? `/restaurants/${bookingSlug}/book` : null;
  const handleCopyBookingPath = async () => {
    if (!bookingPath || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyStatus('Copy is unavailable in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(bookingPath);
      setCopyStatus('Booking path copied.');
    } catch {
      setCopyStatus('Unable to copy booking path.');
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <FormRoot
        id={formId}
        className="flex flex-col gap-4"
        onSubmit={(event) =>
          submitPartial(
            event,
            (nextState) => ({ slug: sanitizePayload(nextState).slug }),
            'AdvancedIdentitySubform',
            'Booking link saved.',
          )
        }
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-slug" className="inline-flex items-center gap-1">
              Booking page URL <span className="text-destructive">*</span>
            </Label>
            <FieldRequirement label="Required" />
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
            {FIELD_TOOLTIPS.slug}
          </p>
          {errors.slug ? (
            <p id="restaurant-slug-error" className="text-xs text-destructive" role="alert">
              {errors.slug}
            </p>
          ) : null}
        </div>

        <div className="rounded-md border border-border/70 bg-muted/20 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Public booking path</p>
              <p className="mt-1 break-all font-mono text-xs tabular-nums text-muted-foreground">
                {bookingPath ?? 'Add a slug to generate the public booking path.'}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Change this only when the public guest link should change across menus, QR codes,
                and saved browser bookmarks.
              </p>
              {copyStatus ? (
                <p role="status" className="mt-2 text-xs text-muted-foreground">
                  {copyStatus}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyBookingPath}
              disabled={!bookingPath}
            >
              <Copy data-icon="inline-start" aria-hidden />
              Copy path
            </Button>
          </div>
        </div>

        <SubformActions
          isSubmitting={isSubmitting}
          submitLabel="Save booking link"
          status={status}
        />
      </FormRoot>
    </TooltipProvider>
  );
}

export function BookingRulesSubform({
  restaurantId,
  initialValues,
  formId,
  onDirtyChange,
  onDraftChange,
}: RestaurantDetailsSubformProps) {
  const { state, errors, status, isSubmitting, handleChange, submitPartial } =
    useRestaurantDetailsSubform({
      initialValues,
      fields: BOOKING_RULE_FIELDS,
      analyticsSection: 'booking_rules',
      onDirtyChange,
      onDraftChange,
      restaurantId,
    });

  return (
    <TooltipProvider delayDuration={100}>
      <FormRoot
        id={formId}
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
            'Booking rules saved.',
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
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
            {errors.reservationIntervalMinutes ? (
              <p id="restaurant-interval-error" className="text-xs text-destructive" role="alert">
                {errors.reservationIntervalMinutes}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
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

        <SubformActions
          isSubmitting={isSubmitting}
          submitLabel="Save booking rules"
          status={status}
        />
      </FormRoot>
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
    field: keyof Pick<FormState, 'managerDailySummaryEnabled'>,
    value: boolean,
  ) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
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
