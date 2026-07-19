const RESTAURANT_BASE_COLUMNS = [
  'id',
  'name',
  'slug',
  'timezone',
  'capacity',
  'contact_email',
  'contact_phone',
  'address',
  'google_map_url',
  'google_review_url',
  'manager_daily_summary_enabled',
  'manager_name',
  'manager_notification_phone',
  'manager_whatsapp_enabled',
  'manager_whatsapp_opt_in_at',
  'manager_whatsapp_consent_phone',
  'manager_whatsapp_consent_version',
  'manager_whatsapp_consent_actor_id',
  'booking_policy',
  'is_active',
  'email_templates',
  'email_send_reminder_24h',
  'email_send_reminder_short',
  'email_send_review_request',
  'reservation_interval_minutes',
  'reservation_default_duration_minutes',
  'reservation_lifecycle_grace_minutes',
  'reservation_last_seating_buffer_minutes',
  'created_at',
  'updated_at',
] as const;

export function restaurantSelectColumns(includeLogo = true): string {
  const base = RESTAURANT_BASE_COLUMNS.join(', ');
  return includeLogo ? `${base}, logo_url` : base;
}
