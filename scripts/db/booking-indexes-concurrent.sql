-- Build booking indexes with minimal locking. Run manually via psql when production
-- needs zero-downtime index creation. Safe to run multiple times.

CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_restaurant_date_start_idx
  ON public.bookings (restaurant_id, booking_date, start_time)
  INCLUDE (end_time, status, party_size, seating_preference, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_restaurant_contact_idx
  ON public.bookings (restaurant_id, customer_email, customer_phone)
  INCLUDE (status, id, created_at);
