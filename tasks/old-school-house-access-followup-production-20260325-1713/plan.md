---
task: old-school-house-access-followup-production
timestamp_utc: 2026-03-25T17:13:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Old School House Access Follow-up

## Objective

We will ensure `oldschoolhouse@lapeninns.com` can access The Old School House in production, using the canonical auth + membership model already used by the product.

## Success Criteria

- [ ] `oldschoolhouse@lapeninns.com` resolves to an auth user in production.
- [ ] That user has a `manager` membership for restaurant `a120da71-ba6d-446f-a33a-2e78787abcb0`.
- [ ] The Old School House review URL remains the verified canonical Google Maps place page.

## Architecture & Components

- `scripts/grant-production-restaurant-access.ts`: production-safe auth user + membership bootstrapper.
- Task artifacts: capture whether the user existed already and the final membership state.

## Data Flow & API Contracts

Target tables / systems:

- `auth.users`
- `public.profiles`
- `public.restaurant_memberships`

Expected membership upsert:

```json
{
  "restaurant_id": "a120da71-ba6d-446f-a33a-2e78787abcb0",
  "role": "manager"
}
```

## UI/UX States

- Not applicable; production data change only.

## Edge Cases

- Auth user exists but is not discoverable via `listUsers`.
- Auth user missing and must be created.
- Existing membership present with a different role.

## Testing Strategy

- Dry-run access bootstrap summary.
- Applied summary with resolved user ID and final membership role.
- Readback query for the user’s membership rows.

## Rollout

- Single guarded production mutation.
- No feature flag.

## DB Change Plan (if applicable)

- No schema change.
- Direct row upserts only.
