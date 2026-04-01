---
task: restaurant-email-template-management
timestamp_utc: 2026-04-01T19:36:44Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Restaurant email template management

## Objective

We will add restaurant-level management for booking email template variants so owners and admins can customize guest-facing copy safely without changing the underlying email shell or send behavior.

## Success Criteria

- [ ] Restaurant settings exposes an `Email Templates` view with grouped template cards and an editor.
- [ ] Restaurants can manage up to 5 variants per supported template with active toggles, reset, preview, and test-send.
- [ ] Runtime sends use restaurant overrides when available and fall back safely to system defaults.
- [ ] APIs, services, and dev harnesses support the full CRUD + preview workflow.

## Architecture & Components

- Shared booking email template catalog and schema:
  - system defaults
  - editable field rules
  - grouping metadata
  - preview helpers
- Runtime override resolution inside booking email rendering.
- Nested ops API routes for email template CRUD, preview, and test-send.
- Restaurant settings UI section and service/hooks integration.

## Testing Strategy

- Unit coverage for catalog, validation, and deterministic rotation.
- Integration coverage for nested ops routes and runtime fallback behavior.
- UI coverage for grouped gallery and editor flows where practical.
- Manual UI verification through Chrome DevTools on the dev harness.

## Rollout

- No explicit feature flag in this implementation unless required during testing.
- Changes remain tenant-scoped to restaurant owners/admins through existing membership guards.
