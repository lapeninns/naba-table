---
task: login-magic-link-expiry
timestamp_utc: 2025-11-27T00:32:57Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No console errors on `/app/login`
- [ ] Magic link send request succeeds and matches contract

### DOM & Accessibility

- [ ] Semantic form fields and labels
- [ ] Focus order and visible focus states
- [ ] Keyboard-only flow works

### Performance (mobile; 4× CPU; 4G)

- FCP: <value> s | LCP: <value> s | CLS: <value> | TBT: <value> ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (~375px) [ ] Tablet (~768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy path login with magic link
- [ ] Error handling for invalid email
- [ ] Accessibility (axe): 0 critical/serious

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/`

## Known Issues

- [ ] <issue> (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA
