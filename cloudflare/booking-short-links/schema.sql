CREATE TABLE IF NOT EXISTS booking_short_links (
  token TEXT PRIMARY KEY,
  destination_url TEXT NOT NULL,
  destination_host TEXT NOT NULL,
  purpose TEXT NOT NULL,
  booking_id TEXT,
  restaurant_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_accessed_at TEXT,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_short_links_booking_lookup
  ON booking_short_links (booking_id, purpose, created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_short_links_expires_at
  ON booking_short_links (expires_at);
