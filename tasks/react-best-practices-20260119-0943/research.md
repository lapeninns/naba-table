---
task: react-best-practices
timestamp_utc: 2026-01-19T09:43:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: React Best Practices

## Requirements

- Functional:
  - Analyze React/Next.js codebase and apply Vercel React Best Practices improvements.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve accessibility and server-first patterns; avoid UI regressions.

## Existing Patterns & Reuse

- App Router under `src/app` favors server components by default; client providers in `src/app/providers.tsx`.
- Reserve SPA uses React Router under `reserve/` with client-side entry (`reserve/main.tsx`).

## External Resources

- Vercel React Best Practices skill (rules in `skills/vercel-react-best-practices`).

## Constraints & Risks

- UI/visual changes require delegation; prefer logic-only improvements.
- Avoid bundle regressions; defer heavy imports and avoid barrel imports where needed.

## Open Questions (owner, due)

- Q: Are there any areas to exclude from broad changes? (Owner: github:@amanshresthaa)

## Recommended Direction (with rationale)

- Perform broad but focused pass targeting high-impact rules: async waterfall elimination, bundle size optimization, server-side caching, and rerender optimization where safe.
