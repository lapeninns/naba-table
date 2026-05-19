'use client';

import { Copy } from 'lucide-react';
import { useState } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { formatSaveScopeMessage } from '@/components/features/restaurant-settings/shared/compactSettingsClasses';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TooltipProvider } from '@/components/ui/tooltip';
import { buildPublicBookingUrl } from '@/lib/site-url';
import { cn } from '@/lib/utils';

import { FIELD_TOOLTIPS, sanitizePayload } from '../restaurantDetailsFormModel';
import {
  ADVANCED_FIELDS,
  FieldRequirement,
  SubformActions,
  type RestaurantDetailsSubformProps,
  useResetDraftRegistration,
  useRestaurantDetailsSubform,
} from './shared';

export function AdvancedIdentitySubform({
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
      fields: ADVANCED_FIELDS,
      analyticsSection: 'advanced_identity',
      onDirtyChange,
      onDraftChange,
      restaurantId,
    });
  useResetDraftRegistration(onResetDraftChange, resetDraft);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const bookingSlug = state.slug.trim();
  const bookingPath = bookingSlug ? `/restaurants/${bookingSlug}/book` : null;
  const bookingUrl = bookingSlug ? buildPublicBookingUrl(bookingSlug) : null;
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
  const handleCopyBookingUrl = async () => {
    if (!bookingUrl || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyStatus('Copy is unavailable in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopyStatus('Full booking URL copied.');
    } catch {
      setCopyStatus('Unable to copy full booking URL.');
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
              <p className="text-sm font-medium text-foreground">Public booking preview</p>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-xs font-medium text-foreground">Relative path</p>
                  <p className="mt-1 break-all font-mono text-xs tabular-nums text-muted-foreground">
                    {bookingPath ?? 'Add a slug to generate the public booking path.'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Full URL</p>
                  <p className="mt-1 break-all font-mono text-xs tabular-nums text-muted-foreground">
                    {bookingUrl ?? 'Add a slug to generate the full public booking URL.'}
                  </p>
                </div>
              </div>
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
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <Button type="button" size="sm" onClick={handleCopyBookingUrl} disabled={!bookingUrl}>
                <Copy data-icon="inline-start" aria-hidden />
                Copy full URL
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyBookingPath}
                disabled={!bookingPath}
              >
                Copy path
              </Button>
            </div>
          </div>
        </div>

        <SubformActions
          actionPlacement={actionPlacement}
          isSubmitting={isSubmitting}
          isDirty={isDirty}
          onReset={resetDraft}
          submitLabel="Save booking link"
          status={status}
          saveScopeMessage={formatSaveScopeMessage('profile-advanced')}
        />
      </FormRoot>
    </TooltipProvider>
  );
}
