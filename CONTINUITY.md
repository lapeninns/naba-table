# Continuity Ledger

Last updated: 2025-12-26T15:36:58Z

## Goal (incl. success criteria)

- Add separate restaurant profile fields for Google Review URL (post-email review CTA) and Google Map URL (directions), wired end-to-end (schema, API, UI) with existing DB columns.

## Constraints/Assumptions

- Follow AGENTS SDLC phases with task artifacts.
- UI change requires Chrome DevTools MCP QA and artifacts in verification.
- Supabase remote-only; no local migrations.
- Use existing patterns and keep scope narrow.

## Key decisions

- Expose googleReviewUrl separately in profile UI and API while keeping googleMapUrl for directions.

## State

- Phase 3 implementation starting for googleReviewUrl field wiring.

## Done

- Identified current code paths for google map URL and review URL in prior exploration.
- Created task folder `tasks/google-review-map-fields-20251226-1516/` with SDLC stubs.
- Implemented googleReviewUrl wiring across schema, services, server handlers, and profile UI.
- Fixed ESLint warnings by removing unused catch bindings in ops restaurant routes.

## Now

- Re-run lint/tests as needed and prep for manual QA.

## Next

- Run manual UI QA via Chrome DevTools MCP; capture artifacts.
- Update `verification.md` with QA results and artifacts.

## Open questions (UNCONFIRMED if needed)

- Owner/reviewer handles for task frontmatter.

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `tasks/google-review-map-fields-20251226-1516/research.md`
- `tasks/google-review-map-fields-20251226-1516/plan.md`
- `tasks/google-review-map-fields-20251226-1516/todo.md`
- `tasks/google-review-map-fields-20251226-1516/verification.md`
