---
task: fix-cls
timestamp_utc: 2026-01-21T13:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Reduce Cumulative Layout Shift (CLS)

## Objective

We will reduce visible layout jumps during initial load/hydration so pages feel stable and Lighthouse CLS stays within budget.

## Success Criteria

- [ ] Lighthouse CLS <= 0.10 on representative routes (desktop + mobile).
- [ ] DevTools Performance trace shows no large Layout Shift clusters caused by missing image dimensions or late injected banners.
- [ ] No new console errors introduced.

## Architecture & Components

- No major architectural change expected; focus on rendering stability.

## Data Flow & API Contracts

- N/A (unless CLS is caused by client-only data injection; document per offender).

## UI/UX States

- Loading/empty states must reserve space to prevent late content pushing existing layout.

## Edge Cases

- Slow network/CPU: late images/fonts/components should not shift content.
- Responsive layouts: reserve height consistently across breakpoints.

## Testing Strategy

- Manual: Chrome DevTools MCP Lighthouse + Performance trace.
- Automated: `pnpm build` + `pnpm test` smoke, if available.

## Rollout

- No feature flag planned; changes are expected to be safe and localized.

## DB Change Plan (if applicable)

- N/A.
