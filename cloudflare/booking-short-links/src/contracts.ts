export const SERVICE_NAME = 'booking-short-links';

export const DEFAULT_ALLOWED_DESTINATION_HOSTS = [
  'nabatable.com',
  'www.nabatable.com',
  'app.nabatable.com',
] as const;

export const DEFAULT_ALLOWED_REVIEW_DESTINATION_HOSTS = [
  'g.page',
  'maps.app.goo.gl',
  'google.com',
  'google.co.uk',
  'google.co.in',
  'google.ca',
  'google.com.au',
  'google.ie',
  'google.fr',
  'google.de',
  'google.es',
  'google.it',
  'google.nl',
] as const;

export const SHORT_LINK_PURPOSES = ['booking_manage', 'review'] as const;

export type ShortLinkPurpose = (typeof SHORT_LINK_PURPOSES)[number];

export type ShortLinkCreateSource =
  | 'guest_confirmation_sms'
  | 'guest_update_sms'
  | 'guest_review_whatsapp'
  | 'guest_review_email';

export type ShortLinkRecord = {
  token: string;
  destinationUrl: string;
  destinationHost: string;
  purpose: ShortLinkPurpose;
  bookingId: string | null;
  restaurantId: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  createdBy: ShortLinkCreateSource;
};

export type CreateShortLinkRequest = {
  purpose: ShortLinkPurpose;
  destinationUrl: string;
  bookingId: string;
  restaurantId: string | null;
  expiresAt: string;
  createdBy: ShortLinkCreateSource;
};

export type CreateShortLinkResponse = {
  token: string;
  shortUrl: string;
  expiresAt: string;
};
