# Continuity Ledger

Last updated: 2026-01-26T13:57:17Z

## Goal (incl. success criteria)

- Produce a complete inventory of ops and guest features across UI, APIs, jobs, and feature flags
- Success: Markdown and CSV inventory with audience, category, surface, entry point, and source path
- Success: All routes and APIs covered with no obvious omissions

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases; task folder required
- Documentation-only output; no runtime changes
- Categories are domain-based (Bookings, Customers, Tables/Floor Plan, Settings/Team, Restaurants/Search, Auth/Profile, Analytics, Messaging/Notifications, Infra/Safety)

## Key decisions

- Use route docs + nav configs as primary feature names; map to route/API file paths
- Include background jobs and feature flags as feature surfaces

## State

- Inventory generated and recorded in task folder

## Done

- Created task folder and SDLC artifacts for feature inventory
- Ran codebase scans for UI routes and API routes
- Consolidated ops/guest features into Markdown + CSV
- Documented doc-vs-code discrepancies in inventory notes

## Now

- Ready for review or follow-up adjustments

## Next

- Incorporate any requested category adjustments or additions

## Open questions (UNCONFIRMED if needed)

- None

## Working set (files/ids/commands)

- tasks/feature-inventory-20260126-1346/features-inventory.md
- tasks/feature-inventory-20260126-1346/artifacts/features-inventory.csv
- tasks/feature-inventory-20260126-1346/todo.md
- tasks/feature-inventory-20260126-1346/verification.md
