---
task: implicit-auth-guard-and-status-focus
timestamp_utc: 2025-12-05T09:44:00Z
owner: github:@ai-assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix implicit auth guard reset & GuestStatus focusability

## Requirements

- Functional: allow repeated implicit magic-link logins within same SPA session; keep status alert focusable so focusStatus() moves SR/keyboard users.
- Non-functional: maintain a11y (focus management), avoid double-processing hashes, keep redirects stable.

## Existing Patterns & Reuse

- `components/auth/ImplicitAuthHandler` centralizes implicit hash handling with module-level guards and a ref.
- `GuestStatus` lives in `src/components/guest/ui/GuestPrimitives.tsx` and was previously focusable when rendered inline as `<p tabIndex={-1}>`.

## External Resources

- MCP discovery unavailable in this environment; performed manual code inspection of `ImplicitAuthHandler` and `GuestStatus` implementations instead (see notes above).

## Constraints & Risks

- Handler is mounted in persistent layouts (`components/LayoutClient`, `src/components/layouts/AuthLayout`), so module-level state persists across navigations.
- Must avoid reintroducing duplicate hash processing across multiple handler instances.
- A11y regression risk if focus target remains non-focusable.

## Open Questions (owner, due)

- None identified; behavior and fixes are straightforward.

## Recommended Direction (with rationale)

- Reset `redirectInFlight` (and clear handled signature) after navigation/attempt so subsequent implicit logins are processed; ensure cleanup even if layout persists.
- Make `GuestStatus` focusable (e.g., `tabIndex={-1}` on the wrapper) to keep `focusStatus()` functional for screen reader/keyboard users.
