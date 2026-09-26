'use client';

import { Info } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import {
  fieldDescribedBy,
  PROFILE_CONTROL_CLASS,
  ProfileField,
  type ProfileSubformProps,
} from './shared';

type ManagerNotificationsSubformProps = ProfileSubformProps & {
  /** Editing the alert number switched "Try WhatsApp first" off in this draft. */
  whatsappTurnedOff?: boolean;
};

/** Why "Try WhatsApp first" can't be turned on yet, or null when it can. */
function getWhatsappUnavailableReason(state: {
  managerDailySummaryEnabled: boolean;
  managerNotificationPhone: string;
}): string | null {
  if (!state.managerDailySummaryEnabled) {
    return 'Turn on the daily summary first.';
  }
  if (!state.managerNotificationPhone.trim()) {
    return 'Add a manager alert number first.';
  }
  return null;
}

/** Staff-only alert settings: who is named in review emails and where the daily summary goes. */
export function ManagerNotificationsSubform({
  state,
  errors,
  onFieldChange,
  onFieldBlur,
  whatsappTurnedOff = false,
}: ManagerNotificationsSubformProps) {
  const whatsappUnavailableReason = getWhatsappUnavailableReason(state);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 @xl:grid-cols-2">
        <ProfileField
          id="restaurant-manager-name"
          label="Manager name"
          requirement="Optional"
          help="Shown as the sender of review-request emails, e.g. “Sam from The Old Crown”."
          error={errors.managerName}
        >
          <Input
            id="restaurant-manager-name"
            type="text"
            placeholder="e.g. Sam"
            maxLength={80}
            autoComplete="off"
            value={state.managerName}
            onChange={(event) => onFieldChange('managerName', event.target.value)}
            onBlur={() => onFieldBlur('managerName')}
            aria-invalid={Boolean(errors.managerName)}
            aria-describedby={fieldDescribedBy('restaurant-manager-name', {
              help: true,
              error: Boolean(errors.managerName),
            })}
            className={PROFILE_CONTROL_CLASS}
          />
        </ProfileField>

        <ProfileField
          id="restaurant-manager-notification-phone"
          label="Manager alert number"
          requirement="Needed for the daily summary"
          help="International format, e.g. +447700900000."
          error={errors.managerNotificationPhone}
        >
          <Input
            id="restaurant-manager-notification-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="+447700900000"
            value={state.managerNotificationPhone}
            onChange={(event) => onFieldChange('managerNotificationPhone', event.target.value)}
            onBlur={() => onFieldBlur('managerNotificationPhone')}
            aria-required={state.managerDailySummaryEnabled ? 'true' : undefined}
            aria-invalid={Boolean(errors.managerNotificationPhone)}
            aria-describedby={fieldDescribedBy('restaurant-manager-notification-phone', {
              help: true,
              error: Boolean(errors.managerNotificationPhone),
            })}
            className={cn('font-mono', PROFILE_CONTROL_CLASS)}
          />
        </ProfileField>
      </div>

      {whatsappTurnedOff ? (
        <p
          role="status"
          className="flex items-start gap-1.5 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs leading-5 text-foreground"
        >
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            You changed the number, so <strong>WhatsApp was turned off</strong>. Turn it back on
            once the new number can receive WhatsApp.
          </span>
        </p>
      ) : null}

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-3 flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">Daily booking summary</span>
          <span className="text-xs leading-5 text-muted-foreground">Sent at 10:00 local time.</span>
        </legend>
        <div className="divide-y divide-border/70 rounded-lg border border-border/70">
          <div className="flex items-start justify-between gap-4 p-4">
            <Label htmlFor="restaurant-manager-daily-summary-enabled" className="leading-5">
              Send the daily summary by SMS
            </Label>
            <Switch
              id="restaurant-manager-daily-summary-enabled"
              checked={state.managerDailySummaryEnabled}
              onCheckedChange={(checked) => {
                onFieldChange('managerDailySummaryEnabled', checked);
                onFieldBlur('managerDailySummaryEnabled');
                onFieldBlur('managerNotificationPhone');
              }}
            />
          </div>
          <div className="flex items-start justify-between gap-4 p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="restaurant-manager-whatsapp-enabled" className="leading-5">
                Try WhatsApp first
              </Label>
              <Text variant="caption" id="restaurant-manager-whatsapp-enabled-help">
                {whatsappUnavailableReason ?? 'If WhatsApp can’t deliver, the summary goes by SMS.'}
              </Text>
            </div>
            <Switch
              id="restaurant-manager-whatsapp-enabled"
              checked={state.managerWhatsappEnabled}
              disabled={Boolean(whatsappUnavailableReason)}
              onCheckedChange={(checked) => {
                onFieldChange('managerWhatsappEnabled', checked);
                onFieldBlur('managerWhatsappEnabled');
              }}
              aria-describedby="restaurant-manager-whatsapp-enabled-help"
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
