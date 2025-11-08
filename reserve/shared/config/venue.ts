import { runtime } from '@shared/config/runtime';

export type VenueDetails = {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  policy: string;
  timezone: string;
  logoUrl: string | null;
};

const defaultRestaurantId =
  runtime.readString('RESERVE_DEFAULT_RESTAURANT_ID', {
    alternatives: ['DEFAULT_RESTAURANT_ID'],
    fallback: '39cb1346-20fb-4fa2-b163-0230e1caf749',
  }) ?? '39cb1346-20fb-4fa2-b163-0230e1caf749';

const defaultRestaurantSlug =
  runtime.readString('RESERVE_DEFAULT_RESTAURANT_SLUG', {
    alternatives: ['DEFAULT_RESTAURANT_SLUG'],
    fallback: 'sajiloreservex-test-kitchen',
  }) ?? 'sajiloreservex-test-kitchen';

const defaultPolicy =
  runtime.readString('RESERVE_DEFAULT_VENUE_POLICY', {
    fallback:
      'You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.',
  }) ??
  'You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.';

export const DEFAULT_RESTAURANT_ID = defaultRestaurantId;
export const DEFAULT_RESTAURANT_SLUG = defaultRestaurantSlug;

export const DEFAULT_VENUE: VenueDetails = {
  id: defaultRestaurantId,
  slug: defaultRestaurantSlug,
  name:
    runtime.readString('RESERVE_DEFAULT_VENUE_NAME', {
      fallback: 'SajiloReserveX Test Kitchen',
    }) ?? 'SajiloReserveX Test Kitchen',
  address:
    runtime.readString('RESERVE_DEFAULT_VENUE_ADDRESS', {
      fallback: '12 Market Row, London SE1 0AA',
    }) ?? '12 Market Row, London SE1 0AA',
  phone:
    runtime.readString('RESERVE_DEFAULT_VENUE_PHONE', {
      fallback: '+44 20 1234 5678',
    }) ?? '+44 20 1234 5678',
  email:
    runtime.readString('RESERVE_DEFAULT_VENUE_EMAIL', {
      fallback: 'reservations@SajiloReserveX.co.uk',
    }) ?? 'reservations@SajiloReserveX.co.uk',
  policy: defaultPolicy,
  timezone:
    runtime.readString('RESERVE_DEFAULT_VENUE_TIMEZONE', {
      fallback: 'Europe/London',
    }) ?? 'Europe/London',
  logoUrl: runtime.readString('RESERVE_DEFAULT_VENUE_LOGO_URL') ?? null,
};

export const resolveVenueDetails = (overrides?: Partial<VenueDetails>): VenueDetails => ({
  ...DEFAULT_VENUE,
  ...overrides,
  slug:
    overrides?.slug ??
    overrides?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ??
    DEFAULT_VENUE.slug,
});
