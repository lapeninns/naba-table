'use client';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { FIELD_TOOLTIPS, getGbpStatuses, sanitizePayload } from '../restaurantDetailsFormModel';
import {
  BRAND_FIELDS,
  FieldRequirement,
  GbpStatusBadge,
  SubformActions,
  type RestaurantDetailsSubformProps,
  useResetDraftRegistration,
  useRestaurantDetailsSubform,
} from './shared';

export function BrandIdentitySubform({
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
      fields: BRAND_FIELDS,
      analyticsSection: 'brand_identity',
      onDirtyChange,
      onDraftChange,
      restaurantId,
    });
  const gbpStatuses = getGbpStatuses(state, gbpFieldVerifications);
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
            <GbpStatusBadge
              field="name"
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
              field="businessDescription"
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
          actionPlacement={actionPlacement}
          isSubmitting={isSubmitting}
          isDirty={isDirty}
          onReset={resetDraft}
          submitLabel="Save brand & identity"
          status={status}
        />
      </FormRoot>
    </TooltipProvider>
  );
}
