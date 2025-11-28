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

const defaultPolicy =
  runtime.readString('RESERVE_DEFAULT_VENUE_POLICY', {
    fallback:
      'You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.',
  }) ??
  'You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.';

export const DEFAULT_VENUE: VenueDetails = {
  id: '',
  slug: '',
  name: '',
  address: '',
  phone: runtime.readString('RESERVE_DEFAULT_VENUE_PHONE') ?? '',
  email: runtime.readString('RESERVE_DEFAULT_VENUE_EMAIL') ?? '',
  policy: defaultPolicy,
  timezone: '',
  logoUrl: runtime.readString('RESERVE_DEFAULT_VENUE_LOGO_URL') ?? null,
  googleMapUrl: runtime.readString('RESERVE_DEFAULT_VENUE_GOOGLE_MAP_URL') ?? null,
};

export const resolveVenueDetails = (overrides?: Partial<VenueDetails>): VenueDetails => ({
  ...DEFAULT_VENUE,
  ...overrides,
  slug: overrides?.slug ?? '',
});
