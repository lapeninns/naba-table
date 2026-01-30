# DSAR (Data Subject Access Requests)

This repo provides a minimal intake endpoint for DSAR requests.

## Endpoint

`POST /api/privacy/dsar`

Body:

```json
{
  "type": "access",
  "email": "person@example.com",
  "message": "Optional details"
}
```

Notes:

- The server hashes the email before recording an observability event.
- This is an intake mechanism; fulfillment happens via internal process.

## Operations

Track requests via the `observability_events` stream (source `privacy`).
