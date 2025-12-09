---
task: guest-pages-revamp
timestamp_utc: 2025-12-09T13:50:00Z
owner: github:@factory-droid
reviewers:
  - github:@maintainers
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Tool: Chrome DevTools MCP (pending update per-page)
- Console: ☐ No errors
- Network: ☐ Requests correct
- Accessibility: ☐ Headings/focus verified
- Performance (mobile 4×/4G): FCP ☐ | LCP ☐ | CLS ☐ | TBT ☐
- Device coverage: ☐ Mobile ☐ Tablet ☐ Desktop

Artifacts:

- ☐ `artifacts/lighthouse-report.json`
- ☐ `artifacts/network.har`

## Automated Tests

- ☐ `pnpm run lint`
- ☐ `pnpm run test`

## Notes / Known Issues

- Pending implementation.
