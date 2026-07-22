'use client';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { formatSaveScopeMessage } from '@/components/features/restaurant-settings/shared/compactSettingsClasses';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Text } from '@/components/ui/typography';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { cn } from '@/lib/utils';

import { FIELD_TOOLTIPS, sanitizePayload } from '../restaurantDetailsFormModel';
import {
  BOOKING_RULE_FIELDS,
  FieldRequirement,
  SubformActions,
  type RestaurantDetailsSubformProps,
  useResetDraftRegistration,
  useRestaurantDetailsSubform,
} from './shared';

export function BookingRulesSubform({
  restaurantId,
  initialValues,
  formId,
  actionPlacement = 'inline',
  onDirtyChange,
  onDraftChange,
  onResetDraftChange,
}: RestaurantDetailsSubformProps) {
  const { state, errors, status, isSubmitting, isDirty, handleChange, resetDraft, submitPartial } =
    useRestaurantDetailsSubform({
      initialValues,
      fields: BOOKING_RULE_FIELDS,
      analyticsSection: 'booking_rules',
      onDirtyChange,
      onDraftChange,
      restaurantId,
    });
  useResetDraftRegistration(onResetDraftChange, resetDraft);

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
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold text-foreground">Guest booking grid</p>
            <Text variant="caption">
              Controls slot spacing and the default table time guests receive.
            </Text>
          </div>
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
            <Text id="restaurant-interval-help" variant="caption">
              {FIELD_TOOLTIPS.reservationInterval}
            </Text>
            {errors.reservationIntervalMinutes ? (
              <Text id="restaurant-interval-error" variant="caption" className="text-destructive" role="alert">
                {errors.reservationIntervalMinutes}
              </Text>
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
            <Text id="restaurant-duration-help" variant="caption">
              {FIELD_TOOLTIPS.reservationDuration}
            </Text>
            {errors.reservationDefaultDurationMinutes ? (
              <Text id="restaurant-duration-error" variant="caption" className="text-destructive" role="alert">
                {errors.reservationDefaultDurationMinutes}
              </Text>
            ) : null}
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold text-foreground">Service cutoffs</p>
            <Text variant="caption">
              Keeps late seating and booking lifecycle timing separate from the visible slot grid.
            </Text>
          </div>
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
            <Text id="restaurant-last-seating-help" variant="caption">
              {FIELD_TOOLTIPS.lastSeatingBuffer}
            </Text>
            {errors.reservationLastSeatingBufferMinutes ? (
              <Text
                id="restaurant-last-seating-error"
                variant="caption"
                className="text-destructive"
                role="alert"
              >
                {errors.reservationLastSeatingBufferMinutes}
              </Text>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label
                htmlFor="restaurant-lifecycle-grace"
                className="inline-flex items-center gap-1"
              >
                Late grace period (minutes) <span className="text-destructive">*</span>
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
            <Text id="restaurant-lifecycle-grace-help" variant="caption">
              {FIELD_TOOLTIPS.lifecycleGrace}
            </Text>
            {errors.reservationLifecycleGraceMinutes ? (
              <Text
                id="restaurant-lifecycle-grace-error"
                variant="caption"
                className="text-destructive"
                role="alert"
              >
                {errors.reservationLifecycleGraceMinutes}
              </Text>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Separator />
          <div>
            <p className="text-sm font-semibold text-foreground">Guest-facing policy</p>
            <Text variant="caption">
              Shown where booking terms or reservation guidance are needed.
            </Text>
          </div>
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
          <Text id="restaurant-policy-help" variant="caption">
            {FIELD_TOOLTIPS.bookingPolicy}
          </Text>
        </div>

        <SubformActions
          actionPlacement={actionPlacement}
          isSubmitting={isSubmitting}
          isDirty={isDirty}
          onReset={resetDraft}
          submitLabel="Save booking rules"
          status={status}
          saveScopeMessage={formatSaveScopeMessage('availability-rules')}
        />
      </FormRoot>
    </TooltipProvider>
  );
}
