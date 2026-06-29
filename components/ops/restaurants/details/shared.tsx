'use client';

import { Check, ExternalLink, Info, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { GbpDriftFieldBadge } from '@/components/features/restaurant-settings/gbp-drift/GbpDriftFieldBadge';
import { useOptionalGbpDrift } from '@/components/features/restaurant-settings/gbp-drift/useGbpDrift';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOpsUpdateRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { getProfileFieldKey } from '@/lib/dual-sync/field-key-meta';
import { cn } from '@/lib/utils';

import {
  buildProfileCompletionAnalytics,
  filterErrors,
  mapInitialValues,
  mapRestaurantProfileValues,
  pickDraftValues,
  pickState,
  validateRestaurantDetails,
  type DetailsField,
  type FormErrors,
  type FormState,
  type GbpComparableField,
  type GbpFieldStatus,
  type RestaurantDetailsDraftValues,
  type RestaurantDetailsFormValues,
} from '../restaurantDetailsFormModel';

import type { ProfileFieldVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';
import type { RestaurantProfile } from '@/services/ops/restaurants';

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

export function GbpStatusBadge(props: {
  field?: GbpComparableField;
  verification?: ProfileFieldVerification;
  status: GbpFieldStatus;
}) {
  const fieldKey = props.field ? getProfileFieldKey(props.field) : null;
  const gbpDrift = useOptionalGbpDrift();
  if (fieldKey && gbpDrift?.fieldViewByKey.has(fieldKey)) {
    return <GbpDriftFieldBadge fieldKey={fieldKey} />;
  }

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

export function FieldRequirement({ label }: { label: 'Required' | 'Optional' | 'Required if on' }) {
  return (
    <span
      aria-hidden="true"
      className="whitespace-nowrap rounded-sm border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground"
    >
      {label}
    </span>
  );
}

export function getHttpUrl(value: string | null | undefined): string | null {
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

export function ExternalUrlButton({ href, label }: { href: string | null; label: string }) {
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

export type RestaurantDetailsSubformProps = {
  restaurantId: string | null;
  initialValues: RestaurantDetailsFormValues;
  formId?: string;
  actionPlacement?: 'inline' | 'stickyBar';
  onDirtyChange?: (dirty: boolean) => void;
  onDraftChange?: (draft: RestaurantDetailsDraftValues, dirty: boolean) => void;
  onResetDraftChange?: (resetDraft: (() => void) | null) => void;
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

export function useRestaurantDetailsSubform({
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

  const resetDraft = useCallback(() => {
    setState(savedState);
    setErrors({});
    setStatus(null);
  }, [savedState]);

  const submitPartial = async (
    event: FormEvent,
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
    isDirty,
    handleChange,
    handleToggle,
    resetDraft,
    submitPartial,
  };
}

export function SubformActions({
  actionPlacement = 'inline',
  isSubmitting,
  isDirty,
  onReset,
  submitLabel,
  status,
  saveScopeMessage,
}: {
  actionPlacement?: 'inline' | 'stickyBar';
  isSubmitting: boolean;
  isDirty: boolean;
  onReset: () => void;
  submitLabel: string;
  status: SubformStatus;
  saveScopeMessage?: string;
}) {
  const submitInStickyBar = actionPlacement === 'stickyBar';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted-foreground">
          {isDirty ? 'Unsaved changes in this section.' : 'No changes to save.'}
        </p>
        <p className="text-xs text-muted-foreground">
          {submitInStickyBar
            ? 'Use the sticky profile bar to save this section.'
            : (saveScopeMessage ?? 'Saves this section only.')}
        </p>
        {status ? (
          <p
            role={status.tone === 'error' ? 'alert' : 'status'}
            className={status.tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}
          >
            {status.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          disabled={isSubmitting || !isDirty}
        >
          Cancel changes
        </Button>
        {submitInStickyBar ? null : (
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function useResetDraftRegistration(
  onResetDraftChange: RestaurantDetailsSubformProps['onResetDraftChange'],
  resetDraft: () => void,
) {
  useEffect(() => {
    onResetDraftChange?.(resetDraft);
    return () => onResetDraftChange?.(null);
  }, [onResetDraftChange, resetDraft]);
}

export const BRAND_FIELDS = [
  'name',
  'businessDescription',
] as const satisfies readonly DetailsField[];
export const CONTACT_FIELDS = [
  'timezone',
  'contactEmail',
  'contactPhone',
  'address',
  'googleMapUrl',
  'googleReviewUrl',
] as const satisfies readonly DetailsField[];
export const NOTIFICATION_FIELDS = [
  'managerName',
  'managerNotificationPhone',
  'managerDailySummaryEnabled',
] as const satisfies readonly DetailsField[];
export const ADVANCED_FIELDS = ['slug'] as const satisfies readonly DetailsField[];
export const BOOKING_RULE_FIELDS = [
  'bookingPolicy',
  'reservationIntervalMinutes',
  'reservationDefaultDurationMinutes',
  'reservationLastSeatingBufferMinutes',
  'reservationLifecycleGraceMinutes',
] as const satisfies readonly DetailsField[];
