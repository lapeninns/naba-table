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
  googleMapUrl: string | null;
};

const defaultRestaurantId =
  runtime.readString('RESERVE_DEFAULT_RESTAURANT_ID', {
    alternatives: ['DEFAULT_RESTAURANT_ID'],
  }) ?? null;

const defaultRestaurantSlug =
  runtime.readString('RESERVE_DEFAULT_RESTAURANT_SLUG', {
    alternatives: ['DEFAULT_RESTAURANT_SLUG'],
  }) ?? null;

const defaultPolicy =
  runtime.readString('RESERVE_DEFAULT_VENUE_POLICY', {
    fallback:
      'You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.',
  }) ??
  'You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.';

export const DEFAULT_RESTAURANT_ID: string | null = defaultRestaurantId;
export const DEFAULT_RESTAURANT_SLUG: string | null = defaultRestaurantSlug;

export const DEFAULT_VENUE: VenueDetails = {
  id: defaultRestaurantId ?? '',
  slug: defaultRestaurantSlug ?? 'default',
  name: runtime.readString('RESERVE_DEFAULT_VENUE_NAME') ?? 'Set restaurant name',
  address: runtime.readString('RESERVE_DEFAULT_VENUE_ADDRESS') ?? 'Add address',
  phone: runtime.readString('RESERVE_DEFAULT_VENUE_PHONE') ?? '',
  email: runtime.readString('RESERVE_DEFAULT_VENUE_EMAIL') ?? '',
  policy: defaultPolicy,
  timezone: runtime.readString('RESERVE_DEFAULT_VENUE_TIMEZONE') ?? 'UTC',
  logoUrl: runtime.readString('RESERVE_DEFAULT_VENUE_LOGO_URL') ?? null,
  googleMapUrl: runtime.readString('RESERVE_DEFAULT_VENUE_GOOGLE_MAP_URL') ?? null,
};

export const resolveVenueDetails = (overrides?: Partial<VenueDetails>): VenueDetails => ({
  ...DEFAULT_VENUE,
  ...overrides,
  slug:
    overrides?.slug ??
    overrides?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ??
    DEFAULT_VENUE.slug,
});
