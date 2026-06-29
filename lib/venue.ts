import type { RestaurantEmailTemplatesDocument } from '@/lib/restaurants/email-templates';

export type VenueDetails = {
  id: string;
  slug: string;
  name: string;
  managerName: string | null;
  address: string;
  phone: string;
  email: string;
  policy: string;
  timezone: string;
  logoUrl: string | null;
  googleMapUrl: string | null;
  googleReviewUrl: string | null;
  emailTemplates: RestaurantEmailTemplatesDocument | null;
};

export const DEFAULT_VENUE: VenueDetails = {
  id: '',
  slug: '',
  name: '',
  managerName: null,
  address: '',
  phone: "",
  email: "",
  policy:
    "You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.",
  timezone: "",
  logoUrl: null,
  googleMapUrl: null,
  googleReviewUrl: null,
  emailTemplates: null,
};
