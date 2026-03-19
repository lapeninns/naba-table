---
task: fix-build-signin-env
timestamp_utc: 2026-03-19T00:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Not applicable for this task because no UI files or interactive UI flows were changed.

## Test Outcomes

- [x] Production build
- [x] Targeted sign-in error-path verification
- [x] Supabase staging project inventory verified with CLI
- [x] Supabase staging auth endpoint reachability verified

Build command:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run build
```

Result:

- Exit code `0`.
- No `next-sitemap` postbuild env loading error after removing the redundant `postbuild` hook.
- `src/app/sitemap.ts` and `src/app/robots.ts` remain the canonical metadata routes emitted by Next.js.
- Sign-in route now clamps invalid/missing upstream statuses to `500` and returns a stable generic message for non-auth failures.
- `npx supabase@latest projects list -o json` confirmed the account projects include staging ref `ndxmivcrehsacuerwxtm` and production ref `vrdiqfudmwydclqpydee`; the previously configured ref `loxrwkeuxesctnrdpksy` is not present.
- `.env.local` auth-facing staging values were updated to `ndxmivcrehsacuerwxtm` and backed up to `.env.local.bak-20260319-0024`.
- DNS lookup for `ndxmivcrehsacuerwxtm.supabase.co` succeeded and `curl -I https://ndxmivcrehsacuerwxtm.supabase.co/auth/v1/health` reached Supabase successfully.

## Artifacts

- Build log: `artifacts/build.txt`

## Known Issues

- [ ] Local Supabase DNS resolution is still environment-dependent; this task hardens the app response path but does not fix name resolution for the configured Supabase host.
- [ ] `SUPABASE_DB_URL` still points at the old pre-staging host because the CLI did not provide a verified database password to rewrite that value safely.

## Sign-off

- [x] Engineering
