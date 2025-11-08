const RESTAURANT_BASE_COLUMNS = [
  'id',
  'name',
  'slug',
  'timezone',
  'capacity',
  'contact_email',
  'contact_phone',
  'address',
  'booking_policy',
  'reservation_interval_minutes',
  'reservation_default_duration_minutes',
  'reservation_last_seating_buffer_minutes',
  'created_at',
  'updated_at',
] as const;

export function restaurantSelectColumns(includeLogo = true): string {
  const base = RESTAURANT_BASE_COLUMNS.join(', ');
  return includeLogo ? `${base}, logo_url` : base;
}
