---
task: fix-localhost-app-redirect
timestamp_utc: 2026-02-02T19:58:18Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix localhost /app redirect

## Requirements

- Functional: `http://localhost:3000/app` should not redirect to `app.nabatable.com` in local dev.
- Non-functional (a11y, perf, security, privacy, i18n): No UI changes; keep cookie scope safe for localhost; no secrets in logs.

## Existing Patterns & Reuse

- `src/proxy.ts` middleware routes `/app/*` to app subdomain in multi-host mode.
- Single-host mode is controlled by `NEXT_PUBLIC_LOCAL_APP_HOSTS`.
- Root domain is sourced from `NEXT_PUBLIC_ROOT_DOMAIN`.

## External Resources

- None.

## Constraints & Risks

- `.env.local` is git-ignored and may contain secrets; do not expose values.
- Keep local routing consistent with docs.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Set `NEXT_PUBLIC_ROOT_DOMAIN=localhost` and add `NEXT_PUBLIC_LOCAL_APP_HOSTS` for localhost to keep `/app` on the same host in local dev.
