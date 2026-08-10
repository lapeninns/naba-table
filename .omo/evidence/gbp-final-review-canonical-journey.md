# Canonical GBP connect/location/disconnect browser journey

Invocation: `QA_APP_PORT=5180 node scripts/qa/gbp-final-review-journey.mjs` (temporary deterministic mock-provider harness; script removed after execution).

Result (exit 0):

```json
{
  "url": "http://app.localhost:5180/settings/restaurant/google-business-profile",
  "linkedAfterLink": true,
  "canonicalLocationGet": true,
  "linkPut": {
    "method": "PUT",
    "pathname": "/api/ops/restaurants/11111111-1111-4111-8111-111111111111/google-business-profile",
    "body": {
      "accountName": "accounts/2",
      "accountId": "2",
      "locationName": "locations/2",
      "locationId": "2"
    }
  },
  "disconnectDelete": {
    "method": "DELETE",
    "pathname": "/api/ops/restaurants/11111111-1111-4111-8111-111111111111/google-business-profile",
    "body": { "password": "secret-password" }
  },
  "calls": 16
}
```
