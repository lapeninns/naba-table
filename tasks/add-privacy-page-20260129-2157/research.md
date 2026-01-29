---
task: add-privacy-page
timestamp_utc: 2026-01-29T21:57:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Add Privacy Page

## Requirements

- Functional:
  - Resolve build failure caused by missing `/privacy` route.
  - Provide a public privacy policy page reachable from existing links.
- Non-functional (a11y, perf, security, privacy, i18n):
  - WCAG-compliant layout with semantic structure and readable typography.
  - No secrets or PII in page content.

## Existing Patterns & Reuse

- Marketing pages use `MarketingLayout` (`src/app/(public)/(marketing)/layout.tsx`).
- Layout utilities: `guest-page`, `guest-boundary` in `src/app/globals.css`.
- Existing links point to `/privacy` (auth layout, guest sign-in).

## External Resources

- None required (content pending).

## Constraints & Risks

- Need approved privacy policy text; avoid placeholder legal copy for production.
- UI changes require Chrome DevTools MCP QA artifacts.

## Open Questions (owner, due)

- Q: Provide official privacy policy content and effective date.
  A: UNCONFIRMED

## Recommended Direction (with rationale)

- Add `src/app/(public)/(marketing)/privacy/page.tsx` using existing marketing layout and typography utilities; wire metadata and contact email.
