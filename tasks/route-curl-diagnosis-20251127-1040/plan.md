---
task: route-curl-diagnosis
timestamp_utc: 2025-11-27T10:40:20Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Investigate failing routes

## Objective

Determine which routes are failing, capture responses via curl, and explain causes (auth requirements, missing params, errors).

## Success Criteria

- [ ] For each sampled route category (marketing, guest, app pages, key APIs), have a recorded status code and short rationale.
- [ ] At least one clear example for each failure type (auth required vs. server error vs. 404).
- [ ] Provide actionable notes on likely fixes or next steps.

## Approach

- Start local dev server on port 3000.
- Probe representative routes (GET only unless safe), including:
  - Public/marketing: `/`, `/thank-you`
  - Guest flows: `/guest`, `/restaurants/test-slug` (if exists), `/guest/bookings`
  - App pages (likely auth): `/app`, `/dashboard`
  - APIs: `/api/availability`, `/api/bookings`, `/api/ops/bookings`, `/api/ops/restaurants`
- Use `curl -i` with minimal headers; note redirects, auth challenges, or server errors.
- Capture outputs into task artifacts.

## Risks / Mitigations

- Auth-protected routes returning 401/403 expected; call out as such.
- Some APIs may require POST bodies; avoid unless necessary to prevent unintended writes.

## Rollout

- No code changes planned unless a simple bug is identified; focus on diagnosis.
