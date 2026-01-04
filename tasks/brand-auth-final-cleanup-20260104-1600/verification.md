---
task: brand-auth-final-cleanup
timestamp_utc: 2026-01-04T16:00:00Z
owner: github:@opencode
---

# Verification Report

## Manual QA

### Auth Links

- [ ] Homepage "Sign In" -> `/auth`
- [ ] Footer "Sign In" -> `/auth`
- [ ] Middleware redirect -> `/auth` (if triggered)

### Logo Consistency

- [ ] Navbar logo present and has Beta badge
- [ ] Footer logo present
- [ ] Correct `href` on logos (Home for public, Auth for auth pages)

## Test Outcomes

- [ ] Linting: `pnpm run lint`

## Artifacts

- [ ] Grep results for `/login` (post-cleanup)
