# Capacity service windows and the bounded fallback

## Background (July 2026 incident)

Between 2026-07-11 and 2026-07-19 PostHog Logs recorded 120 `service not
found, using fallback service` warnings (106 on July 16 alone) for dinner
slots at 22:00–22:45 BST and a lunch slot at 15:00 BST.

Root cause: guest-facing slots are generated from the database
(`restaurant_operating_hours` + `restaurant_service_periods`, half-open on the
closing time), but the capacity engine's `VenuePolicy` service windows were
hardcoded (lunch 12:00–15:00, dinner 16:00–22:00, exclusive end) and never read
the restaurant's configured periods. Any configured slot at/after the hardcoded
end (22:00+ dinner, 15:00 lunch) threw `ServiceNotFoundError` inside
`computeBookingWindow`, and `computeBookingWindowWithFallback` silently
"repaired" it by guessing a service (falling back to the _first_ service in
policy order when the booking named none) and force-enabling `allowOverrun` —
an unbounded window expansion. Every ops timeline render, quote, and dialog
recomputed the same out-of-window booking, which is why single slots produced
dozens of identical warnings.

## The fix (2026-07-20)

1. **Source fix — DB-derived service windows.**
   `server/capacity/service-windows.ts` derives per-service windows from
   `restaurant_service_periods` (earliest start → latest end per lunch/dinner;
   periods crossing midnight map onto next-day ends). `getVenuePolicy` accepts
   a `serviceWindows` override and the capacity entry points (seatability
   precheck, quote, assignment, direct assignment, manual booking context, ops
   table timeline, alternative-slot preload) load and pass it alongside turn
   bands. A restaurant whose dinner periods run to 23:00 now resolves a 22:15
   dinner directly — no fallback, and the dining window clamps to the
   _configured_ 23:00 end.

2. **Bounded, gated fallback.** When a time still matches no window,
   `computeBookingWindowWithFallback` only falls back when **both** hold:
   - the booking explicitly names a configured service (serviceHint or
     `booking_type` of `lunch`/`dinner`) — the policy-order guess is removed;
   - the start lies within `maxExtensionMinutes` of that service's configured
     window (both sides).
     Otherwise it throws, and the public booking API maps
     `ServiceNotFoundError`/`ServiceOverrunError` to a controlled, customer-safe
     `422 OUTSIDE_SERVICE_HOURS` response (`server/bookings/api-error.ts`) —
     never a 500 and never an out-of-policy booking. Ops read paths (dialog
     assignment context) degrade to an approximate context window so existing
     out-of-window bookings remain viewable; ops mutations surface a controlled
     `422 OUTSIDE_SERVICE_HOURS` / `SERVICE_OVERRUN`.

3. **Warning dedupe.** The fallback warning logs once per
   restaurant/service/local-start per process (6h TTL) instead of once per
   recomputation.

## Runtime settings

| Env var                                           | Values             | Default   | Effect                                                                                                                                                         |
| ------------------------------------------------- | ------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CAPACITY_SERVICE_FALLBACK`                       | `bounded` \| `off` | `bounded` | `off` disables the fallback entirely: unmappable times always fail with the controlled response. `bounded` allows the explicit, margin-limited fallback above. |
| `CAPACITY_SERVICE_FALLBACK_MAX_EXTENSION_MINUTES` | `0`–`180`          | `60`      | Margin around the named service's configured window within which a fallback may still compute a window (with overrun allowed).                                 |

Both are read per call (`server/runtime-policy.ts:getCapacityServiceFallbackConfig`),
so a redeploy/env change takes effect without code changes. Production is NOT
expected to need `off` once restaurants' service periods cover their bookable
slots; `off` is the strict mode for verifying no out-of-policy windows remain.

## Regression tests

`tests/server/capacity/service-window-fallback-regression.test.ts` pins the
July 16 dinner (22:00/22:15/22:30/22:45) and July 18 lunch (15:00) patterns:
no fallback with DB-derived windows, bounded fallback under default policy,
hard failure beyond the margin or with fallback `off`, warning dedupe, and the
customer-safe 422 mapping.

## Operational notes

- The policy version hash (`hashPolicyVersion`) covers the derived service
  windows, so holds quoted before this deploy will requote once
  (`PolicyDriftError` → requote path) for restaurants with configured periods.
  Hold TTLs are short (minutes); the drift is transient at deploy time.
- The fallback warning now includes `restaurantId` when the caller has it.
- If a restaurant legitimately takes bookings outside its configured service
  periods, fix the `restaurant_service_periods` rows — that is the source of
  truth for both slot generation and, now, capacity windows.
