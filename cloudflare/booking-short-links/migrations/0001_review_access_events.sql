CREATE TABLE IF NOT EXISTS booking_short_link_access_events (
  event_id TEXT PRIMARY KEY,
  token TEXT NOT NULL REFERENCES booking_short_links(token) ON DELETE CASCADE,
  accessed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_short_link_access_events_token
  ON booking_short_link_access_events (token, accessed_at DESC);
