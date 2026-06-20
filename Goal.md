You are working in `/Users/amankumarshrestha/LapenInns Project/nabatableLP`.

Goal: redesign Nabatable UX/UI from the ground up with a clean, mobile-first, responsive design system, while preserving the existing product behavior, routes, backend contracts, permissions, and Supabase safety rules.

Before editing, read and follow:

1. `AGENTS.md`
2. `docs/sdlc/README.md`
3. `docs/sdlc/native-execution-loop.md`
4. `docs/sdlc/risk-tier-workflow.md`
5. `docs/sdlc/task-harness.md`
6. `docs/sdlc/verification.md`
7. `docs/sdlc/react-query-swr-ux.md`
8. `.agents/*.md`

Non-negotiables:

- Do not leak or print secrets.
- Supabase is remote-only. Do not perform data writes unless explicitly required, staged, and read back.
- UI must use the existing shadcn/ui primitive layer at `components/ui/*`.
- Do not introduce native HTML primitive systems, parallel component libraries, or one-off base components in app code.
- Keep ops and guest/public on one Radix Luma shadcn theme.
- UI changes require browser verification on real shipped routes, not only `/dev/**` or harness routes.
- Do not claim verification that was not performed.
- Medium/high-risk work must create a task folder under `tasks/<slug>-YYYYMMDD-HHMM>/`.

Product surfaces to redesign:

- Ops app: `src/app/app/**`
- Public/guest: `src/app/(public)/**` and `src/app/guest/**`
- Shared UI: `components/**` and `src/components/**`
- Respect routing/host split enforced by `src/proxy.ts`.

Design objective:

Create a mobile-first Nabatable interface that feels like a serious hospitality operating system: calm, fast, clear, premium, and practical for restaurant staff and guests. It should not feel like a generic SaaS dashboard, template landing page, or purple-gradient AI app.

Core design direction:

- Mobile first, then tablet, then desktop.
- Dense but readable layouts for ops workflows.
- Guest/public flows should feel simple, polished, and trustworthy.
- Prioritize scanning, decision-making, booking clarity, and operational speed.
- Use restrained visual hierarchy, strong spacing rhythm, clear touch targets, and accessible contrast.
- Avoid decorative clutter, generic card-heavy layouts, and marketing-style hero sections where a functional app view is needed.

Design system requirements:

Build or refactor toward a coherent system covering:

- Color tokens: background, surface, elevated surface, border, muted, primary, accent, success, warning, destructive, info.
- Typography scale: mobile-readable, no viewport-based font scaling, no negative letter spacing.
- Spacing scale: consistent vertical rhythm and touch-safe controls.
- Radius system: keep cards and controls restrained, generally 8px or less unless existing shadcn patterns require otherwise.
- Shadows/elevation: subtle and functional only.
- States: loading, empty, disabled, error, warning, success, stale data, optimistic update, offline/failed fetch.
- Components: buttons, icon buttons, inputs, selects, date/time controls, tabs, segmented controls, tables, lists, cards, dialogs, drawers, sheets, toasts, badges, forms, nav, mobile bottom actions, filters.
- Data UX: clear stale/reloading states using the repo’s React Query SWR guidance.
- Accessibility: keyboard support, focus states, labels, contrast, reduced motion.

Implementation approach:

1. Audit current UI structure, routes, shared components, shadcn usage, theme files, and design inconsistencies.
2. Create a task folder with findings, design principles, affected route list, and verification plan.
3. Define the core design system first: tokens, theme usage, layout primitives, component conventions.
4. Redesign in vertical slices, starting with the highest-value shipped routes.
5. Preserve existing behavior and API contracts.
6. Replace inconsistent UI with shadcn-based shared components.
7. Keep changes scoped and avoid unrelated backend or data model work.
8. Add or update focused tests where behavior risk exists.
9. Verify with real browser screenshots on mobile and desktop widths.

Mobile-first requirements:

- All primary workflows must work cleanly at 375px width.
- No horizontal overflow.
- Text must not overlap, truncate awkwardly, or escape controls.
- Touch targets should be comfortable for restaurant staff using phones.
- Important actions should remain reachable without crowding.
- Tables should become mobile-friendly lists, stacked rows, or responsive summaries where appropriate.
- Dialog-heavy desktop flows should use sheets/drawers or full-screen mobile patterns where needed.

Validation commands:

Run the relevant commands that exist in this repo:

```bash
pnpm run lint
pnpm run typecheck
pnpm node scripts/check-no-shadcn.mjs --primitives-only
pnpm exec vitest ...
pnpm exec playwright test ...
pnpm exec prettier --check ...
```
