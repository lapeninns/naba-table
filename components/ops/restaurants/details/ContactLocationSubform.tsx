'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { formatSaveScopeMessage } from '@/components/features/restaurant-settings/shared/compactSettingsClasses';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import {
  ALL_TIMEZONES,
  buildTimezoneLabel,
  FIELD_TOOLTIPS,
  getGbpStatuses,
  sanitizePayload,
} from '../restaurantDetailsFormModel';
import {
  CONTACT_FIELDS,
  ExternalUrlButton,
  FieldRequirement,
  GbpStatusBadge,
  getHttpUrl,
  SubformActions,
  type RestaurantDetailsSubformProps,
  useResetDraftRegistration,
  useRestaurantDetailsSubform,
} from './shared';

export function ContactLocationSubform({
  restaurantId,
  initialValues,
  formId,
  actionPlacement = 'inline',
  onDirtyChange,
  onDraftChange,
  onResetDraftChange,
  gbpFieldVerifications,
}: RestaurantDetailsSubformProps) {
  const { state, errors, status, isSubmitting, isDirty, handleChange, resetDraft, submitPartial } =
    useRestaurantDetailsSubform({
      initialValues,
      fields: CONTACT_FIELDS,
      analyticsSection: 'contact_location',
      onDirtyChange,
      onDraftChange,
      restaurantId,
    });
  useResetDraftRegistration(onResetDraftChange, resetDraft);
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
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">Location</p>
          <Text variant="caption">
            Keep the restaurant&apos;s address, timezone, and directions aligned for guests.
          </Text>
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
                        <Text variant="caption" className="px-3 py-2">
                          No matching timezones found.
                        </Text>
                      ) : null}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
            <Text variant="caption" id="restaurant-timezone-help">
              {FIELD_TOOLTIPS.timezone}
            </Text>
            {errors.timezone ? (
              <Text
                variant="caption"
                className="text-destructive"
                id="restaurant-timezone-error"
                role="alert"
              >
                {errors.timezone}
              </Text>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-address">Address</Label>
              <FieldRequirement label="Optional" />
              <GbpStatusBadge
                field="address"
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
            <Text variant="caption" id="restaurant-address-help">
              {FIELD_TOOLTIPS.address}
            </Text>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="restaurant-google-map">Map link</Label>
            <FieldRequirement label="Optional" />
            <GbpStatusBadge
              field="googleMapUrl"
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
          <Text variant="caption" id="restaurant-google-map-help">
            Directions link for guests (Google Maps).
          </Text>
          <ExternalUrlButton href={mapUrl} label="Open map link" />
          {errors.googleMapUrl ? (
            <Text
              variant="caption"
              className="text-destructive"
              id="restaurant-google-map-error"
              role="alert"
            >
              {errors.googleMapUrl}
            </Text>
          ) : null}
        </div>

        <Separator />

        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">Public contact</p>
          <Text variant="caption">
            Phone and email are the fallback details guests use when they need help.
          </Text>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="restaurant-phone">Contact Phone</Label>
              <FieldRequirement label="Optional" />
              <GbpStatusBadge
                field="contactPhone"
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
            <Text variant="caption" id="restaurant-phone-help">
              {FIELD_TOOLTIPS.contactPhone}
            </Text>
            {errors.contactPhone ? (
              <Text
                variant="caption"
                className="text-destructive"
                id="restaurant-phone-error"
                role="alert"
              >
                {errors.contactPhone}
              </Text>
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
            <Text variant="caption" id="restaurant-email-help">
              {FIELD_TOOLTIPS.contactEmail}
            </Text>
            {errors.contactEmail ? (
              <Text
                variant="caption"
                className="text-destructive"
                id="restaurant-email-error"
                role="alert"
              >
                {errors.contactEmail}
              </Text>
            ) : null}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">After visit</p>
          <Text variant="caption">
            Review links support follow-up emails without changing website or menu links.
          </Text>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="restaurant-google-review">Guest review link</Label>
            <FieldRequirement label="Optional" />
            <GbpStatusBadge
              field="googleReviewUrl"
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
          <Text variant="caption" id="restaurant-google-review-help">
            Post-visit review link; not the same as website/menu links in Discovery.
          </Text>
          <ExternalUrlButton href={reviewUrl} label="Open review link" />
          {errors.googleReviewUrl ? (
            <Text
              variant="caption"
              className="text-destructive"
              id="restaurant-google-review-error"
              role="alert"
            >
              {errors.googleReviewUrl}
            </Text>
          ) : null}
        </div>

        <SubformActions
          actionPlacement={actionPlacement}
          isSubmitting={isSubmitting}
          isDirty={isDirty}
          onReset={resetDraft}
          submitLabel="Save contact details"
          status={status}
          saveScopeMessage={formatSaveScopeMessage('profile-contact')}
        />
      </FormRoot>
    </TooltipProvider>
  );
}
