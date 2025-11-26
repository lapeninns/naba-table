---
task: repo-perf-improvements
timestamp_utc: 2025-11-26T14:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Repo-Wide Performance Improvements

## Requirements

- Functional: Deliver the 15 listed performance initiatives (optimistic UI, prefetching, staleTime tuning, keyboard shortcuts, skeletons/Suspense, code splitting, debouncing/throttling, memoization, network optimizations, image/assets, form performance, animation hygiene, bundle reduction, error recovery, accessibility+perf). Produce implementation plan and execution checklist before coding.
- Non-functional: Maintain accessibility baseline (WCAG, ARIA, keyboard support), no secrets in source, respect Supabase remote-only rule, keep existing UX consistent, avoid regressions in booking flows.

## Existing Patterns & Reuse

- Next.js 16 / React 19 app with React Query v5.90, React Hook Form v7.63, Tailwind 4.1, Radix components, lucide-react icons, next-plausible, nextjs-toploader.
- React Query already used (e.g., profile hooks with 5m staleTime). Query keys likely centralized (need audit). React Hook Form present—aligns with form performance guidance.
- Code splitting via Next’s route-level splitting; Vite used for `reserve` package (storybook). Bundle analysis script `reserve:build --mode analyze` exists; `analyze` Vite script available.
- Shadcn is disallowed by guard (`guard:no-shadcn`), so reuse existing Radix/Tailwind components for skeletons and UI tweaks.
- Tests via Vitest; Playwright e2e stubs removed. Chrome DevTools MCP required for UI QA per policy.

## External Resources

- TanStack React Query docs for optimistic updates, prefetching, staleTime and cancellation.
- Next.js dynamic import docs for code splitting; bundle analyzer plugin.
- React Hook Form performance notes; MDN aria-busy; React error boundaries.

## Constraints & Risks

- Must follow SDLC; no coding before plan approval. Task folder required for PR.
- Potential regressions in booking workflows if optimistic updates are incorrect; need precise query keys and rollback logic.
- Keyboard shortcuts may conflict with browser defaults (Ctrl+N); scope carefully.
- Suspense with React Query is experimental; use selectively.
- Supabase operations must stay remote; performance work should avoid DB migrations unless necessary.

## Open Questions (owner, due)

- Do we have a centralized queryKeys helper? (owner: dev, due: during planning)
- Are there existing skeleton components or design tokens to reuse? (owner: design/dev, due: during implementation)
- Any analytics/heatmaps to prioritize prefetch targets? (owner: PM, due: before implementation of prefetch)

## Recommended Direction (with rationale)

- Start with low-risk, high-impact items: staleTime tuning and optimistic updates across critical mutations. Add instrumentation (React Query Devtools in dev) to validate cache effects.
- Layer smart prefetching and skeletons to boost perceived performance on navigation and list loads without heavy code changes.
- Introduce keyboard shortcuts with clear scoping and preventDefault handling; document in UI tooltips/help.
- Plan code splitting and debouncing as follow-ups once hotspots identified via bundle analysis and profiling.
- Keep accessibility integrated: aria-busy on loading regions, focus management after async actions, respect prefers-reduced-motion for animations.
