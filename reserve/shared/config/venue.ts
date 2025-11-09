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
    fallback: 'b70decfe-8ad3-487e-bdbb-43aa7bd016ca',
  }) ?? 'b70decfe-8ad3-487e-bdbb-43aa7bd016ca';

const defaultRestaurantSlug =
  runtime.readString('RESERVE_DEFAULT_RESTAURANT_SLUG', {
    alternatives: ['DEFAULT_RESTAURANT_SLUG'],
    fallback: 'white-horse-pub-waterbeach',
  }) ?? 'white-horse-pub-waterbeach';

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
      fallback: 'White Horse Pub (Waterbeach)',
    }) ?? 'White Horse Pub (Waterbeach)',
  address:
    runtime.readString('RESERVE_DEFAULT_VENUE_ADDRESS', {
      fallback: '12 Green Side, Waterbeach, Cambridge, CB25 9HP',
    }) ?? '12 Green Side, Waterbeach, Cambridge, CB25 9HP',
  phone:
    runtime.readString('RESERVE_DEFAULT_VENUE_PHONE', {
      fallback: '01223 375578',
    }) ?? '01223 375578',
  email:
    runtime.readString('RESERVE_DEFAULT_VENUE_EMAIL', {
      fallback: 'whitehorse@lapeninns.com',
    }) ?? 'whitehorse@lapeninns.com',
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
