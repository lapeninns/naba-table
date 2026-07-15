# Durable Object migrations

The current state contract is [`state-schema.json`](state-schema.json). Migration tags are append-only and must match `wrangler.jsonc`.

- `v1` creates `EmailQueueState` using SQLite-backed Durable Object storage.
- `v2` creates `RateLimitState` and `CapacityVersionState` using SQLite-backed storage.

Never edit or reorder a shipped tag. Add a new tag and update the schema compatibility test whenever a class or persisted value changes.
