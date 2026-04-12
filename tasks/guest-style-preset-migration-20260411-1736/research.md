---
task: guest-style-preset-migration
timestamp_utc: 2026-04-11T17:36:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Style Preset Migration

## Requirements

- Functional:
  - Apply the visual/system style from shadcn preset `b1aKNEah8` to the guest-facing surface.
  - Preserve the existing guest routes and canonical business logic while migrating presentation/layout styling.
  - Keep the migration aligned with the active `src/app/**` and `src/components/**` codepaths.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain current accessibility baseline during the visual migration.
  - Avoid rewriting or destabilizing auth, booking, or guest account logic.
  - Prevent shadcn CLI output from targeting stale root-level paths instead of the active `src/` paths.

## Existing Patterns & Reuse

- The repo already has `components.json` and installed shadcn components.
- Current guest surfaces span:
  - `src/app/(public)/**`
  - `src/app/guest/**`
  - `src/components/layouts/**`
  - `src/components/landing/**`
  - `src/components/shared/**`
- `pnpm dlx shadcn@latest info --json` reports the project as initialized, but its resolved output paths still point to root-level `/components` and `/app/globals.css` instead of `src/components` and `src/app/globals.css`.
- Shared primitives under `src/components/ui/**` are used across guest and non-guest surfaces, so a root-level preset reinstall would leak visual changes outside the requested scope.

## External Resources

- shadcn CLI project info (`pnpm dlx shadcn@latest info --json`) — confirms current base/style and reveals path-resolution mismatch that must be handled safely.

## Constraints & Risks

- Running `init --preset` directly may overwrite config/CSS and may emit files into stale root-level paths because of the current shadcn path resolution.
- Reinstall mode could rewrite existing component source used across the app, not just guest pages.
- The exact requested command with `--monorepo` expects a `packages/ui/components.json` layout that this repo does not have.
- Guest and marketing shells reuse a small set of shared layout components, so style changes must stay inside guest-facing wrappers and route shells.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Do not run the preset command blindly against the current repo state.
- Use the requested preset as a visual source of truth, but port it into the canonical guest codepaths instead of reinstalling shared primitives:
  - align `components.json` to the active `src/app/globals.css` path,
  - inspect the preset in an isolated scratch workspace,
  - adapt the guest-facing wrappers, landing sections, and public/guest layouts only,
  - leave ops-facing and other shared application primitives untouched.
