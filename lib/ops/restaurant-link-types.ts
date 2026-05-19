/**
 * Owner-editable restaurant link types. The database CHECK constraint also
 * allows `google_map` and `google_review`, but those are GBP-managed and not
 * offered in the owner discovery editor.
 */
export const RESTAURANT_EDITABLE_LINK_TYPES = [
  'website',
  'menu_or_services',
  'reservation',
  'order',
  'chat',
  'facebook',
  'instagram',
  'x',
  'youtube',
  'tiktok',
  'linkedin',
  'other',
] as const;

export type RestaurantEditableLinkType = (typeof RESTAURANT_EDITABLE_LINK_TYPES)[number];

export const RESTAURANT_LINK_TYPE_LABELS = {
  website: 'Website',
  menu_or_services: 'Menu / services',
  reservation: 'Reservation',
  order: 'Order',
  chat: 'Chat',
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'Twitter / X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  other: 'Other',
} as const satisfies Record<RestaurantEditableLinkType, string>;

export const RESTAURANT_LINK_TYPE_OPTIONS = RESTAURANT_EDITABLE_LINK_TYPES.map((value) => ({
  value,
  label: RESTAURANT_LINK_TYPE_LABELS[value],
}));
