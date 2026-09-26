'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildPublicBookingUrl } from '@/lib/site-url';
import { cn } from '@/lib/utils';

import {
  fieldDescribedBy,
  PROFILE_CONTROL_CLASS,
  ProfileField,
  type ProfileSubformProps,
} from './shared';

const AFFIX_CLASS =
  'flex shrink-0 items-center whitespace-nowrap bg-muted/60 px-2 font-mono text-xs text-muted-foreground sm:px-3';

/** The booking page link: the slug in `/restaurants/<slug>/book`. */
export function AdvancedIdentitySubform({
  state,
  savedState,
  errors,
  onFieldChange,
  onFieldBlur,
}: ProfileSubformProps) {
  const draftSlug = state.slug.trim();
  const savedSlug = savedState.slug.trim();
  const changed = draftSlug !== savedSlug;
  const draftUrl = buildPublicBookingUrl(draftSlug);
  const savedUrl = buildPublicBookingUrl(savedSlug);
  const canCopy = !changed && !errors.slug && Boolean(savedUrl);

  const handleCopy = async () => {
    if (!savedUrl || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      toast.error('Copy isn’t available in this browser. Select the link to copy it.');
      return;
    }
    try {
      await navigator.clipboard.writeText(savedUrl);
      toast.success('Booking page link copied.');
    } catch {
      toast.error('Couldn’t copy the link. Select it to copy it instead.');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <ProfileField
        id="restaurant-slug"
        label="Link name"
        requirement="Required"
        help="Lowercase letters, numbers and hyphens."
        error={errors.slug}
      >
        <div
          className={cn(
            'flex min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background transition-[color,box-shadow]',
            'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
            errors.slug && 'border-destructive',
          )}
        >
          <span aria-hidden="true" className={cn(AFFIX_CLASS, 'border-r border-border')}>
            /restaurants/
          </span>
          <Input
            id="restaurant-slug"
            value={state.slug}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => onFieldChange('slug', event.target.value)}
            onBlur={() => onFieldBlur('slug')}
            aria-required="true"
            aria-invalid={Boolean(errors.slug)}
            aria-describedby={fieldDescribedBy('restaurant-slug', {
              help: true,
              error: Boolean(errors.slug),
            })}
            className={cn(
              'min-w-0 rounded-none border-0 font-mono shadow-none focus-visible:border-transparent focus-visible:ring-0',
              PROFILE_CONTROL_CLASS,
            )}
          />
          <span aria-hidden="true" className={cn(AFFIX_CLASS, 'border-l border-border')}>
            /book
          </span>
        </div>
      </ProfileField>

      <div
        className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="booking-link-preview"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {changed
              ? 'New link after you save. Guests keep using the old one until then.'
              : 'Guests book at'}
          </p>
          <p className="break-all font-mono text-xs text-foreground">
            {(changed ? draftUrl : savedUrl) ??
              'No booking page link yet. Guests can’t book online.'}
          </p>
          {changed && savedUrl ? (
            <p className="break-all text-xs text-muted-foreground">
              Current: <span className="font-mono">{savedUrl}</span>
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 self-start [@media(pointer:coarse)]:min-h-11 sm:self-center"
          onClick={handleCopy}
          disabled={!canCopy}
          aria-describedby={changed ? 'restaurant-slug-copy-reason' : undefined}
        >
          <Copy data-icon="inline-start" aria-hidden />
          Copy link
        </Button>
        {changed ? (
          <span id="restaurant-slug-copy-reason" className="sr-only">
            Save the new link before copying it.
          </span>
        ) : null}
      </div>
    </div>
  );
}
