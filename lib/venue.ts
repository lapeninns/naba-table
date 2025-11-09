export type VenueDetails = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  policy: string;
  timezone: string;
  logoUrl: string | null;
};

export const DEFAULT_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_DEFAULT_RESTAURANT_ID ?? "b70decfe-8ad3-487e-bdbb-43aa7bd016ca";

export const DEFAULT_VENUE: VenueDetails = {
  id: DEFAULT_RESTAURANT_ID,
  name: "White Horse Pub (Waterbeach)",
  address: "12 Green Side, Waterbeach, Cambridge, CB25 9HP",
  phone: "01223 375578",
  email: "whitehorse@lapeninns.com",
  policy:
    "You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.",
  timezone: "Europe/London",
  logoUrl: null,
};
