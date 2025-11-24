---
task: guest-cta-link-audit
timestamp_utc: 2025-11-24T01:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Guest CTA & Broken Link Audit

## Requirements

- Functional: inventory all guest-facing CTAs and links; identify any broken links (4xx/5xx or misrouted) across guest-facing experience.
- Non-functional: keep audit reproducible; avoid mutating data; respect accessibility (link text meaningful).

## Existing Patterns & Reuse

- `guest-facing-routes.md` documents canonical guest routes.
- `route-map*.md/json` and `route-scanner.js` may assist in crawling routes.
- Playwright setup exists for E2E under `tests/` which could be leveraged for link checks.

## External Resources

- N/A at this stage; will rely on in-repo routes and local app rendering.

## Constraints & Risks

- Guest pages may require mocked data or seed to render; ensure no destructive actions.
- Some CTAs may be dynamically generated from restaurant data; need representative dataset.

## Open Questions (owner, due)

- Do we have a staging base URL to crawl instead of local? (owner: amankumarshrestha, due: 2025-11-24)

## Recommended Direction (with rationale)

- Run local Next app in read-only mode and crawl guest-facing routes for links using a script or Playwright; compare against canonical list.
- Use `route-scanner.js` or a simple headless crawl to collect links and check HTTP status.
- Manually verify CTA link text/targets on key pages if automation misses semantic intent.
