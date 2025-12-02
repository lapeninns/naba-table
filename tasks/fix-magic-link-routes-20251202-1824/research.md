---
task: fix-magic-link-routes
timestamp_utc: 2025-12-02T18:24:59Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix magic link auth + callback routes

## Requirements

- **Functional**: Magic-link sign-in/signup must complete successfully and set a Supabase session; callback must route users to the correct destination without 404/loop. Redirect parameters (`redirectedFrom`) should be honored when valid and sanitized. Staff should land in the app area; guests in guest dashboard.
- **Non-functional**: Preserve CSRF/rate-limit protections; no secret leakage; accessibility unchanged (forms already built). Avoid breaking password sign-in.

## Existing Patterns & Reuse

- Baseline good state at commit `43ee2e617c3c09595f115b7f628da771178108c2` — callback used `exchangeCodeForSession`, `sanitizeRedirect`, and `defaultRedirectForHost` for fallbacks.
- Current auth proxy (`src/app/api/auth/signin/route.ts`) handles CSRF + rate limits, builds `redirectedFrom`, and now emails admin-generated magic links via Resend.
- Redirect validation helpers live in `lib/auth/redirects.ts` (allowed prefixes, host allowlist, `defaultRedirectForHost`).

## External Resources

- Manual diff against commit `43ee2e617c3c09595f115b7f628da771178108c2` to spot regressions (used in place of MCP research; MCP not available in this environment).

## Constraints & Risks

- Magic links coming from `admin.generateLink` may arrive with either `code` or `token_hash`; must handle both without double failures.
- `sanitizeRedirect` only allows specific prefixes/hosts; missing `NEXT_PUBLIC_ROOT_DOMAIN` would cause redirects to be dropped—need safe fallback.
- Using service-role client in callback must not block auth if service env vars are missing; failures should degrade gracefully.
- Avoid leaking detailed Supabase errors in responses/logs (security posture).

## Open Questions (owner, due)

- Should staff/guest routing honor host-based fallback (`defaultRedirectForHost`) instead of membership lookup? (owner: dev, before implementation)
- Do we need to keep the customer-linking side effect in callback? (owner: dev, before implementation)

## Recommended Direction (with rationale)

- Restore the proven redirect resolution path from `43ee2e6` (use `sanitizeRedirect` else `defaultRedirectForHost`/config), while keeping new code paths for `token_hash` verification and optional customer linking.
- Treat service-client failures as non-fatal; guard routes so magic-link completion always returns a redirect.
- Add regression tests around callback behavior (code vs token_hash, redirect handling) to lock in expected routing.
