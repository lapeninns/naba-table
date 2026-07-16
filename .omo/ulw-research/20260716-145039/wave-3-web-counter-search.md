# Wave 3: semantic counter-search

## Verdict

No stronger alternative was found. A server-owned party-aware projection remains the safest design under the user’s finish-by-close intent.

Corrections:

- Keep the core schedule party-agnostic.
- Put party in the public URL and query key.
- Prevent stale previous-party slots during refetch.
- Apply the operating-close rule, not service-period-end duration enforcement.
- Fail overnight guest availability closed until service-day normalization is implemented end to end.

## Counter-model results

- Global cutoff: rejected because party durations differ.
- Latest-arrival-only: rejected because unified create and current UI promise hard finish.
- Client filtering: rejected because authoritative restaurant turn bands are server-side.
- Whole-day `/api/availability`: rejected as a larger redesign for this fix.
- Service-period finish boundary: rejected for compatibility.

## EXPAND

None. All counter-model and rollout leads were resolved.
