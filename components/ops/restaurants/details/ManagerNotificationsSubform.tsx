'use client';

import { Clock3, ShieldCheck } from 'lucide-react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { formatSaveScopeMessage } from '@/components/features/restaurant-settings/shared/compactSettingsClasses';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { FIELD_TOOLTIPS, sanitizePayload } from '../restaurantDetailsFormModel';
import {
  FieldRequirement,
  NOTIFICATION_FIELDS,
  SubformActions,
  type RestaurantDetailsSubformProps,
  useResetDraftRegistration,
  useRestaurantDetailsSubform,
} from './shared';

export function ManagerNotificationsSubform({
  restaurantId,
  initialValues,
  formId,
  actionPlacement = 'inline',
  onDirtyChange,
  onDraftChange,
  onResetDraftChange,
}: RestaurantDetailsSubformProps) {
  const {
    state,
    errors,
    status,
    isSubmitting,
    isDirty,
    handleChange,
    handleToggle,
    resetDraft,
    submitPartial,
  } = useRestaurantDetailsSubform({
    initialValues,
    fields: NOTIFICATION_FIELDS,
    analyticsSection: 'manager_notifications',
    onDirtyChange,
    onDraftChange,
    restaurantId,
  });
  useResetDraftRegistration(onResetDraftChange, resetDraft);
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
                managerName: payload.managerName,
                managerNotificationPhone: payload.managerNotificationPhone,
                managerDailySummaryEnabled: payload.managerDailySummaryEnabled,
                managerWhatsappEnabled: payload.managerWhatsappEnabled,
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

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="restaurant-manager-name" className="inline-flex items-center gap-1">
              Manager name
            </Label>
            <FieldRequirement label="Optional" />
            <HelpTooltip
              description={FIELD_TOOLTIPS.managerName}
              ariaLabel="What is the manager name used for?"
            />
          </div>
          <Input
            id="restaurant-manager-name"
            type="text"
            placeholder="e.g. Sam"
            maxLength={80}
            value={state.managerName}
            onChange={(event) => handleChange('managerName', event.target.value)}
            aria-invalid={Boolean(errors.managerName)}
            aria-describedby={
              errors.managerName ? 'restaurant-manager-name-error' : 'restaurant-manager-name-help'
            }
            className={cn(
              errors.managerName && 'border-destructive focus-visible:ring-destructive/60',
            )}
          />
          <p id="restaurant-manager-name-help" className="text-xs text-muted-foreground">
            Guests see this as the sender of review-request emails — for example, “Sam from The Old
            Crown”. Leave blank to send as the venue name.
          </p>
          {errors.managerName ? (
            <p id="restaurant-manager-name-error" className="text-xs text-destructive" role="alert">
              {errors.managerName}
            </p>
          ) : null}
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

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 sm:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="restaurant-manager-whatsapp-enabled">
                  Send daily summary via WhatsApp first
                </Label>
                <p
                  id="restaurant-manager-whatsapp-enabled-help"
                  className="text-xs text-muted-foreground"
                >
                  Nabatable sends on behalf of the restaurant to the manager number above. If
                  WhatsApp is unavailable, we’ll send the summary by SMS instead.
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
        </div>

        <SubformActions
          actionPlacement={actionPlacement}
          isSubmitting={isSubmitting}
          isDirty={isDirty}
          onReset={resetDraft}
          submitLabel="Save notifications"
          status={status}
          saveScopeMessage={formatSaveScopeMessage('profile-notifications')}
        />
      </FormRoot>
    </TooltipProvider>
  );
}
