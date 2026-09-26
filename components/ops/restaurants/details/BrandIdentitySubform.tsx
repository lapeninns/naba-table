'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';

import { getGbpStatuses } from '../restaurantDetailsFormModel';
import {
  fieldDescribedBy,
  GbpStatusBadge,
  PROFILE_CONTROL_CLASS,
  ProfileField,
  type ProfileSubformProps,
} from './shared';

import type { ReactNode } from 'react';

/** Limit enforced by `validateRestaurantDetails` and the restaurant update API. */
const BUSINESS_DESCRIPTION_MAX_LENGTH = 4096;

const COUNT_FORMAT = new Intl.NumberFormat('en-GB');

/**
 * Restaurant name and public description. The logo sits beside it and saves on its own.
 * `afterName` renders directly under the name, where the Profile page puts the booking page link.
 */
export function BrandIdentitySubform({
  state,
  errors,
  onFieldChange,
  onFieldBlur,
  gbpFieldVerifications,
  afterName,
}: ProfileSubformProps & { afterName?: ReactNode }) {
  const gbpStatuses = getGbpStatuses(state, gbpFieldVerifications);
  const descriptionLength = state.businessDescription.length;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col gap-5">
        <ProfileField
          id="restaurant-name"
          label="Restaurant name"
          requirement="Required"
          adornment={
            <GbpStatusBadge
              field="name"
              status={gbpStatuses.name}
              verification={gbpFieldVerifications?.name}
            />
          }
          error={errors.name}
        >
          <Input
            id="restaurant-name"
            value={state.name}
            autoComplete="organization"
            onChange={(event) => onFieldChange('name', event.target.value)}
            onBlur={() => onFieldBlur('name')}
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={fieldDescribedBy('restaurant-name', { error: Boolean(errors.name) })}
            className={PROFILE_CONTROL_CLASS}
          />
        </ProfileField>

        {afterName}

        <ProfileField
          id="restaurant-business-description"
          label="Business description"
          requirement="Optional"
          adornment={
            <GbpStatusBadge
              field="businessDescription"
              status={gbpStatuses.businessDescription}
              verification={gbpFieldVerifications?.businessDescription}
            />
          }
          help={
            <span className="tabular-nums">
              {COUNT_FORMAT.format(descriptionLength)} /{' '}
              {COUNT_FORMAT.format(BUSINESS_DESCRIPTION_MAX_LENGTH)} characters · Keep it short and
              current.
            </span>
          }
          error={errors.businessDescription}
        >
          <Textarea
            id="restaurant-business-description"
            value={state.businessDescription}
            rows={4}
            onChange={(event) => onFieldChange('businessDescription', event.target.value)}
            onBlur={() => onFieldBlur('businessDescription')}
            aria-invalid={Boolean(errors.businessDescription)}
            aria-describedby={fieldDescribedBy('restaurant-business-description', {
              help: true,
              error: Boolean(errors.businessDescription),
            })}
            className="min-h-28 resize-y"
          />
        </ProfileField>
      </div>
    </TooltipProvider>
  );
}
