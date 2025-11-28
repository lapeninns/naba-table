export type VenueDetails = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  policy: string;
  timezone: string;
  logoUrl: string | null;
  googleMapUrl: string | null;
};

export const DEFAULT_VENUE: VenueDetails = {
  id: '',
  name: '',
  address: '',
  phone: "",
  email: "",
  policy:
    "You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.",
  timezone: "",
  logoUrl: null,
  googleMapUrl: null,
};
