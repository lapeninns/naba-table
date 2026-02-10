---
task: landing-copy-cleanup
timestamp_utc: 2026-02-10T06:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Target: `http://localhost:3000/`
- Checked:
  - Hero: "Integrated with your stack" section removed
  - Profit stack: SMS -> email confirmations; deposit/pre-auth removed
  - Proof: 8 reviews shown; only restaurant names shown (no reviewer identities)
  - Guarantees & Objections: copy renders with real quotes/apostrophes (no `&apos;` / `&quot;` visible)
- Console:
  - No errors observed
  - Warning observed: PostHog "already initialized" (dev-only)

## Test Outcomes

- `pnpm -s exec eslint --max-warnings=0 <touched files>`: PASS
- `pnpm -s typecheck`: PASS

## Artifacts

- Screenshot: `artifacts/landing-full.png`
