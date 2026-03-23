# PostHog Error Summary

Project: `Lapen Inns / Default project` (`120939`)
Window reviewed: `2026-01-01` through `2026-03-23`

## Highest-signal issues

1. `019c5695-0fbc-74f2-b197-8aebac51a024` — `Script error.`
   - Occurrences: `36`
   - Users: `7`
   - Last seen: `2026-03-18`
   - Primary path: public booking pages on `www.nabatable.com`
   - Notes:
     - Still recurring in March.
     - Cross-origin script errors are not actionable without source maps or reproduction with third-party scripts isolated.

2. `019cf7df-8438-7d13-bbdb-889af9c4dd90` — `'TypeError' captured as exception with message: 'undefined is not an object (evaluating 'a.length')'`
   - Occurrences: `1`
   - Users: `1`
   - Last seen: `2026-03-16`
   - Primary path: `/restaurants/the-corner-house-pub-cambridge/book`
   - Notes:
     - Newest first-party-looking crash.
     - Stack trace is not symbolicated because production source maps are unavailable.

3. `019c6892-49c1-7e11-a8ba-5eaca84c35cc` — `Failed to fetch`
   - Occurrences: `27`
   - Users: `3`
   - Last seen: `2026-02-17`
   - Primary path: `/auth` expired/malformed callback flows
   - Notes:
     - Matches the previously investigated PostHog noise/auth callback issue.
     - No observed recurrences after the hardening work landed on `2026-02-19`.

4. `019c68dc-4384-7740-b886-310846075c24` — `UnhandledRejection: Object Not Found Matching Id:2, MethodName:update, ParamCount:4`
   - Occurrences: `19`
   - Users: `3`
   - Last seen: `2026-02-18`
   - Notes:
     - Explicitly classified in repo history as non-actionable browser/SDK storage noise.
     - Current code already suppresses this signature before send.

5. `019c2465-c87d-7bd3-9dde-7388712ad2b7` — `Cannot read properties of undefined (reading 'toLowerCase')`
   - Occurrences: `2`
   - Users: `1`
   - Last seen: `2026-02-03`
   - Primary path: `/settings/tables`
   - Notes:
     - Likely nullish `restaurantName` in the ops restaurant switcher search path.

6. `019c244a-1947-7913-9be6-f537f7747646` — `Cannot read properties of undefined (reading 'find')`
   - Occurrences: `1`
   - Users: `1`
   - Last seen: `2026-02-03`
   - Primary path: `/dashboard` after entering from `/bookings`
   - Notes:
     - React Query optimistic cache update stack points at list-shape assumptions.

7. `019c248b-2bc7-72e1-8caf-428cbd208809` — `undefined is not an object (evaluating 's.items.map')`
   - Occurrences: `1`
   - Users: `1`
   - Last seen: `2026-02-03`
   - Primary path: `/dashboard`
   - Notes:
     - Strongly matches optimistic list patching in ops booking lifecycle hooks.

## Stale or low-priority issues

- `019c377c-a2a7-77d2-86e3-a9136aba82ef` — `ChunkLoadError` for `nextjs-toploader`
  - One occurrence.
  - Happened on `localhost:3000`, not production.
- `019c18ef-9372-71e0-9a34-8fa4a21bff05` — `HttpError 409`
  - One occurrence.
  - Likely expected optimistic-concurrency/user-conflict behavior on the ops dashboard.
- Multiple `Minified React error #418/#419` issues
  - Mostly one-off February events.
  - Require source maps to make them fixable with confidence.

## Cross-cutting finding

- Production source maps are not available to PostHog.
  - Multiple issue details show `404 Not Found` while fetching deployed `*.js.map` files.
  - This blocks precise symbolication for the React/minified/TypeError issues.
