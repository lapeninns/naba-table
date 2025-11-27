---
task: route-curl-diagnosis
timestamp_utc: 2025-11-27T10:40:20Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Investigate failing routes

## Requirements

- Functional: Identify which routes fail when called via `curl`, capture status codes and brief response context, and explain likely causes.
- Scope: Use local dev server (assume http://localhost:3000). Avoid destructive HTTP methods unless necessary.
- Non-functional: Keep investigation minimal risk; do not modify data; no code changes unless a clear bug is confirmed.

## Existing Patterns & Reuse

- Route inventories already exist in `route-map.json` / `route-map-ascii.txt` for reference.
- Many API and app routes are protected and may return 401/403 when unauthenticated—this is expected.
- Marketing/guest pages may be publicly reachable; errors there indicate real issues.

## External Resources

- None required; rely on local runtime behavior.

## Constraints & Risks

- Some API routes depend on DB data and Supabase credentials; missing data could yield 500s.
- Auth-required routes will fail under unauthenticated curl; must distinguish expected auth failures from true errors.

## Open Questions (owner, due)

- Which routes should be publicly accessible vs. auth-only? (Assumption: marketing/guest public, app/ops auth.)

## Recommended Direction (with rationale)

- Start dev server, then probe a representative mix of marketing, guest, and API routes using `curl -i`.
- Record status, key headers, and short body snippet; categorize failures (auth required, missing params, 404, server error).
- Summarize in a table mapping route → status → likely reason; propose fixes only where behavior appears unintended.
