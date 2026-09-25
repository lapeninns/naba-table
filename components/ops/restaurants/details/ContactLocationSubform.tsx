'use client';

import { useMemo } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import {
  ALL_TIMEZONES,
  buildTimezoneOptionLabel,
  getGbpStatuses,
  groupTimezonesByRegion,
} from '../restaurantDetailsFormModel';
import {
  ExternalUrlButton,
  fieldDescribedBy,
  GbpStatusBadge,
  getHttpUrl,
  PROFILE_CONTROL_CLASS,
  ProfileField,
  ProfileFieldGroup,
  type ProfileSubformProps,
} from './shared';

/** Timezone, address, public phone and email, and the post-visit review link. */
export function ContactLocationSubform({
  state,
  errors,
  onFieldChange,
  onFieldBlur,
  gbpFieldVerifications,
}: ProfileSubformProps) {
  // ~400 zones: build the option list once per saved value, not on every keystroke.
  const timezoneOptions = useMemo(
    () =>
      groupTimezonesByRegion(ALL_TIMEZONES, state.timezone).map((group) => (
        <SelectGroup key={group.region}>
          <SelectLabel>{group.region}</SelectLabel>
          {group.timezones.map((timezone) => (
            <SelectItem key={timezone} value={timezone} className="pl-7">
              {buildTimezoneOptionLabel(timezone)}
            </SelectItem>
          ))}
        </SelectGroup>
      )),
    [state.timezone],
  );
  const gbpStatuses = getGbpStatuses(state, gbpFieldVerifications);
  const mapUrl = getHttpUrl(state.googleMapUrl);
  const reviewUrl = getHttpUrl(state.googleReviewUrl);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col gap-6">
        <ProfileFieldGroup title="Location">
          <ProfileField
            id="restaurant-timezone"
            label="Timezone"
            requirement="Required"
            help="Opening hours, bookings and reminders all use this time."
            error={errors.timezone}
          >
            <Select
              value={state.timezone || undefined}
              onValueChange={(value) => {
                onFieldChange('timezone', value);
                onFieldBlur('timezone');
              }}
            >
              <SelectTrigger
                id="restaurant-timezone"
                aria-required="true"
                aria-invalid={Boolean(errors.timezone)}
                aria-describedby={fieldDescribedBy('restaurant-timezone', {
                  help: true,
                  error: Boolean(errors.timezone),
                })}
                className={cn('min-w-0 [&>span]:truncate', PROFILE_CONTROL_CLASS)}
              >
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-80">{timezoneOptions}</SelectContent>
            </Select>
          </ProfileField>

          <div className="grid gap-5 @xl:grid-cols-2">
            <ProfileField
              id="restaurant-address"
              label="Address"
              requirement="Optional"
              adornment={
                <GbpStatusBadge
                  field="address"
                  status={gbpStatuses.address}
                  verification={gbpFieldVerifications?.address}
                />
              }
            >
              <Input
                id="restaurant-address"
                value={state.address}
                autoComplete="street-address"
                onChange={(event) => onFieldChange('address', event.target.value)}
                onBlur={() => onFieldBlur('address')}
                className={PROFILE_CONTROL_CLASS}
              />
            </ProfileField>

            <ProfileField
              id="restaurant-google-map"
              label="Google Maps link"
              requirement="Optional"
              adornment={
                <GbpStatusBadge
                  field="googleMapUrl"
                  status={gbpStatuses.googleMapUrl}
                  verification={gbpFieldVerifications?.googleMapUrl}
                />
              }
              error={errors.googleMapUrl}
              footer={<ExternalUrlButton href={mapUrl} label="Open map link" />}
            >
              <Input
                id="restaurant-google-map"
                type="url"
                inputMode="url"
                placeholder="https://maps.google.com/…"
                value={state.googleMapUrl}
                onChange={(event) => onFieldChange('googleMapUrl', event.target.value)}
                onBlur={() => onFieldBlur('googleMapUrl')}
                aria-invalid={Boolean(errors.googleMapUrl)}
                aria-describedby={fieldDescribedBy('restaurant-google-map', {
                  error: Boolean(errors.googleMapUrl),
                })}
                className={cn('font-mono', PROFILE_CONTROL_CLASS)}
              />
            </ProfileField>
          </div>
        </ProfileFieldGroup>

        <Separator />

        <ProfileFieldGroup title="Public contact">
          <div className="grid gap-5 @xl:grid-cols-2">
            <ProfileField
              id="restaurant-phone"
              label="Public phone"
              requirement="Needed before guests can book"
              adornment={
                <GbpStatusBadge
                  field="contactPhone"
                  status={gbpStatuses.contactPhone}
                  verification={gbpFieldVerifications?.contactPhone}
                />
              }
              error={errors.contactPhone}
            >
              <Input
                id="restaurant-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+44 …"
                value={state.contactPhone}
                onChange={(event) => onFieldChange('contactPhone', event.target.value)}
                onBlur={() => onFieldBlur('contactPhone')}
                aria-invalid={Boolean(errors.contactPhone)}
                aria-describedby={fieldDescribedBy('restaurant-phone', {
                  error: Boolean(errors.contactPhone),
                })}
                className={PROFILE_CONTROL_CLASS}
              />
            </ProfileField>

            <ProfileField
              id="restaurant-email"
              label="Contact email"
              requirement="Optional"
              error={errors.contactEmail}
            >
              <Input
                id="restaurant-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={state.contactEmail}
                onChange={(event) => onFieldChange('contactEmail', event.target.value)}
                onBlur={() => onFieldBlur('contactEmail')}
                aria-invalid={Boolean(errors.contactEmail)}
                aria-describedby={fieldDescribedBy('restaurant-email', {
                  error: Boolean(errors.contactEmail),
                })}
                className={PROFILE_CONTROL_CLASS}
              />
            </ProfileField>
          </div>
        </ProfileFieldGroup>

        <Separator />

        <ProfileFieldGroup title="After the visit">
          <ProfileField
            id="restaurant-google-review"
            label="Guest review link"
            requirement="Optional"
            adornment={
              <GbpStatusBadge
                field="googleReviewUrl"
                status={gbpStatuses.googleReviewUrl}
                verification={gbpFieldVerifications?.googleReviewUrl}
              />
            }
            help="Used in review-request emails."
            error={errors.googleReviewUrl}
            footer={<ExternalUrlButton href={reviewUrl} label="Open review link" />}
          >
            <Input
              id="restaurant-google-review"
              type="url"
              inputMode="url"
              placeholder="https://g.page/r/…"
              value={state.googleReviewUrl}
              onChange={(event) => onFieldChange('googleReviewUrl', event.target.value)}
              onBlur={() => onFieldBlur('googleReviewUrl')}
              aria-invalid={Boolean(errors.googleReviewUrl)}
              aria-describedby={fieldDescribedBy('restaurant-google-review', {
                help: true,
                error: Boolean(errors.googleReviewUrl),
              })}
              className={cn('font-mono', PROFILE_CONTROL_CLASS)}
            />
          </ProfileField>
        </ProfileFieldGroup>
      </div>
    </TooltipProvider>
  );
}
