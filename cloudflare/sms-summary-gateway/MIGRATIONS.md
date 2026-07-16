# Durable Object migrations

The current state contract is [`state-schema.json`](state-schema.json). Migration tags are append-only and must match `wrangler.jsonc`.

- `v1` creates `DailyBookingSummaryState` using SQLite-backed Durable Object storage.
- `v2` extends the backwards-compatible `state` value with manager WhatsApp dispatch context, an opaque callback correlation token, and an SMS fallback claim/result. Existing `v1` values are read with null defaults.

Add a new tag and compatibility fixture before changing persisted state. Never edit or reorder a deployed migration.
