'use client';

import {
  Check,
  CircleAlert,
  ExternalLink,
  Info,
  ShieldAlert,
} from 'lucide-react';


import { GbpDriftFieldBadge } from '@/components/features/restaurant-settings/gbp-drift/GbpDriftFieldBadge';
import { useOptionalGbpDrift } from '@/components/features/restaurant-settings/gbp-drift/useGbpDrift';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Text } from '@/components/ui/typography';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { getProfileFieldKey } from '@/lib/dual-sync/field-key-meta';
import { cn } from '@/lib/utils';

import type {
  DetailsField,
  FormErrors,
  FormState,
  GbpComparableField,
  GbpFieldStatus,
} from '../restaurantDetailsFormModel';
import type { ProfileFieldVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';
import type { ReactNode } from 'react';

export type ProfileAnalyticsSection =
  | 'public_details'
  | 'brand_identity'
  | 'contact_location'
  | 'manager_notifications'
  | 'advanced_identity'
  | 'booking_rules';

function gbpStatusPresentation(status: Exclude<GbpFieldStatus, 'unavailable'>) {
  if (status === 'verified') {
    return {
      label: 'Matches Google',
      icon: Check,
      variant: 'outline' as const,
    };
  }

  return {
    label: 'Differs from Google',
    icon: ShieldAlert,
    variant: 'status-pending' as const,
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
  const googleValue = props.verification.providerValue?.trim() || null;
  const hasTooltip = Boolean(
    googleValue ||
    props.verification.tooltipTitle ||
    props.verification.tooltipLines.length > 0 ||
    props.verification.tooltipFooter,
  );

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant={presentation.variant}
        className="h-5 gap-1 rounded-full px-2 text-xs font-medium"
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
              aria-label="Show the Google value"
            >
              <Info className="size-3.5" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-sm space-y-2 px-3 py-2">
            {googleValue ? (
              <p className="break-words text-xs leading-snug">Google has: {googleValue}</p>
            ) : null}
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

export type FieldRequirementLabel =
  | 'Required'
  | 'Optional'
  | 'Required if on'
  | 'Needed before guests can book'
  | 'Needed for the daily summary';

/** Plain-text requirement marker beside a label. Hidden from AT: inputs carry aria-required. */
export function FieldRequirement({ label }: { label: FieldRequirementLabel }) {
  return (
    <span
      aria-hidden="true"
      className="whitespace-nowrap text-xs font-normal text-muted-foreground"
    >
      {label}
    </span>
  );
}

/** Taller controls on touch screens so every profile input keeps a 44px hit area. */
export const PROFILE_CONTROL_CLASS = 'pointer-coarse:h-11';

export function fieldDescribedBy(id: string, options: { help?: boolean; error?: boolean }) {
  const ids = [options.error ? `${id}-error` : null, options.help ? `${id}-help` : null].filter(
    Boolean,
  );
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs leading-5 text-destructive">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

type ProfileFieldProps = {
  /** Id of the control; help and error ids derive from it (`<id>-help`, `<id>-error`). */
  id: string;
  label: ReactNode;
  requirement?: FieldRequirementLabel;
  /** Status markers after the label, such as the Google comparison badge. */
  adornment?: ReactNode;
  help?: ReactNode;
  error?: string;
  /** Rendered under the help text, e.g. an "Open map link" action. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * One layout for every profile field: label row, control, helper, then the inline
 * error with an icon so validation is never colour-only.
 */
export function ProfileField({
  id,
  label,
  requirement,
  adornment,
  help,
  error,
  footer,
  className,
  children,
}: ProfileFieldProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        <Label htmlFor={id}>{label}</Label>
        {requirement ? <FieldRequirement label={requirement} /> : null}
        {adornment}
      </div>
      {children}
      {help ? (
        <Text variant="caption" id={`${id}-help`} className="max-w-prose">
          {help}
        </Text>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
      {footer}
    </div>
  );
}

/** Titled group of fields inside a profile section. */
export function ProfileFieldGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-4', className)}>
      <legend className="mb-3 flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {description ? (
          <span className="text-xs leading-5 text-muted-foreground">{description}</span>
        ) : null}
      </legend>
      {children}
    </fieldset>
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
    <Button type="button" variant="link" size="sm" className="h-auto self-start px-0" asChild>
      <a href={href} target="_blank" rel="noreferrer">
        <ExternalLink data-icon="inline-start" aria-hidden />
        {label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </Button>
  );
}

/**
 * Props of the four Restaurant profile subforms. They render one page-wide draft owned by
 * the Profile page, which also validates and saves it; the subforms only report edits.
 */
export type ProfileSubformProps = {
  state: FormState;
  /** Last saved values, for "new link after you save"-style previews. */
  savedState: FormState;
  /** Errors to show now: touched fields, or every field after Save / "Show first issue". */
  errors: FormErrors;
  onFieldChange: <K extends DetailsField>(field: K, value: FormState[K]) => void;
  /** Marks a field as touched so its error can show. */
  onFieldBlur: (field: DetailsField) => void;
  gbpFieldVerifications?: Partial<Record<GbpComparableField, ProfileFieldVerification>>;
};

/** Per-section profile analytics, shared by the subform hook and the Profile page save. */
export function emitProfileAnalytics(
  eventName:
    | 'restaurant_profile_validation_error'
    | 'restaurant_profile_section_saved'
    | 'restaurant_profile_section_save_failed',
  props: Record<string, unknown>,
) {
  track(eventName, props);
  void emit(eventName, props);
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
  'managerWhatsappEnabled',
] as const satisfies readonly DetailsField[];
export const ADVANCED_FIELDS = ['slug'] as const satisfies readonly DetailsField[];

