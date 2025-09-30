import { runtime } from '@shared/config/runtime';

export type VenueDetails = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  policy: string;
  timezone: string;
};

const defaultRestaurantId =
  runtime.readString('RESERVE_DEFAULT_RESTAURANT_ID', {
    alternatives: ['DEFAULT_RESTAURANT_ID'],
    fallback: '39cb1346-20fb-4fa2-b163-0230e1caf749',
  }) ?? '39cb1346-20fb-4fa2-b163-0230e1caf749';

const defaultPolicy =
  runtime.readString('RESERVE_DEFAULT_VENUE_POLICY', {
    fallback:
      'You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.',
  }) ??
  'You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.';

export const DEFAULT_RESTAURANT_ID = defaultRestaurantId;

export const DEFAULT_VENUE: VenueDetails = {
  id: defaultRestaurantId,
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
};

export const resolveVenueDetails = (overrides?: Partial<VenueDetails>): VenueDetails => ({
  ...DEFAULT_VENUE,
  ...overrides,
});
