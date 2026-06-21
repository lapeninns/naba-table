export type AmenityAttributeDefinition = {
  key: string;
  label: string;
};

export type AmenityAttributeGroup = {
  title: string;
  description: string;
  keys: readonly AmenityAttributeDefinition[];
};

/**
 * GBP Places attribute keys grouped for the ops discovery editor. These keys are
 * a Google Business Profile contract, not tenant-configurable restaurant data.
 */
export const AMENITY_ATTRIBUTE_GROUPS = [
  {
    title: 'Accessibility',
    description: 'Access details guests often check before visiting.',
    keys: [
      { key: 'has_wheelchair_accessible_entrance', label: 'Wheelchair-accessible entrance' },
      { key: 'has_wheelchair_accessible_restroom', label: 'Wheelchair-accessible toilet' },
      { key: 'has_wheelchair_accessible_parking', label: 'Wheelchair-accessible car park' },
    ],
  },
  {
    title: 'Amenities & crowd',
    description: 'Facilities and welcome signals for guests.',
    keys: [
      { key: 'has_restroom', label: 'Has toilet' },
      { key: 'has_wifi', label: 'Free Wi-Fi' },
      { key: 'good_for_kids', label: 'Good for kids' },
      { key: 'lgbtq_friendly', label: 'LGBTQ+ friendly' },
    ],
  },
  {
    title: 'Dining options',
    description: 'How guests can eat or spend time at the venue.',
    keys: [
      { key: 'seating', label: 'Has seating' },
      { key: 'outdoor_seating', label: 'Has outdoor seating' },
      { key: 'table_service', label: 'Has table service' },
      { key: 'dine_in', label: 'Serves dine-in' },
    ],
  },
  {
    title: 'Highlights',
    description: 'Reasons guests may choose this venue.',
    keys: [
      { key: 'live_performances', label: 'Live performances' },
      { key: 'watching_sport', label: 'Good for watching sport' },
      { key: 'live_music', label: 'Live music' },
      { key: 'karaoke', label: 'Karaoke' },
      { key: 'bar_games', label: 'Has bar games' },
      { key: 'rooftop_seating', label: 'Rooftop seating' },
    ],
  },
  {
    title: 'Offerings',
    description: 'Food and drink options guests can expect.',
    keys: [
      { key: 'serves_spirits', label: 'Serves spirits' },
      { key: 'serves_beer', label: 'Serves beer' },
      { key: 'serves_food', label: 'Serves food' },
      { key: 'serves_alcohol', label: 'Serves alcohol' },
      { key: 'serves_food_at_bar', label: 'Serves food at bar' },
      { key: 'serves_wine', label: 'Serves wine' },
      { key: 'serves_cocktails', label: 'Serves cocktails' },
      { key: 'happy_hour_drinks', label: 'Happy-hour drinks' },
      { key: 'happy_hour_food', label: 'Happy-hour food' },
    ],
  },
  {
    title: 'Parking',
    description: 'Parking options around the venue.',
    keys: [
      { key: 'free_parking_lot', label: 'Free parking lot' },
      { key: 'free_street_parking', label: 'Free street parking' },
      { key: 'paid_parking_lot', label: 'Paid parking lot' },
    ],
  },
  {
    title: 'Payments',
    description: 'Payment methods accepted on site.',
    keys: [
      { key: 'accepts_debit_cards', label: 'Accepts debit cards' },
      { key: 'nfc_mobile_payments', label: 'NFC mobile payments' },
      { key: 'accepts_credit_cards', label: 'Accepts credit cards' },
      { key: 'cash_only', label: 'Cash-only' },
      { key: 'accepts_visa', label: 'Visa' },
      { key: 'accepts_amex', label: 'American Express' },
      { key: 'accepts_mastercard', label: 'Mastercard' },
    ],
  },
  {
    title: 'Service options & planning',
    description: 'Booking and fulfilment details for guests.',
    keys: [
      { key: 'dogs_allowed', label: 'Dogs allowed' },
      { key: 'reservations_required', label: 'Reservations required' },
      { key: 'reservations', label: 'Accepts reservations' },
      { key: 'delivery', label: 'Delivery' },
      { key: 'takeout', label: 'Offers takeaway' },
      { key: 'drive_through', label: 'Drive-through' },
      { key: 'no_contact_delivery', label: 'No-contact delivery' },
    ],
  },
] as const satisfies readonly AmenityAttributeGroup[];

export const AMENITY_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set(
  AMENITY_ATTRIBUTE_GROUPS.flatMap((group) => group.keys.map((item) => item.key)),
);
