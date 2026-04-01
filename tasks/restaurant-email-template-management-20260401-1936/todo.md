---
task: restaurant-email-template-management
timestamp_utc: 2026-04-01T19:36:44Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Define shared booking email template catalog, types, and validation
- [x] Update venue/restaurant typing for versioned template overrides

## Core

- [x] Add nested ops API routes for list, update, reset, preview, and test-send
- [x] Extend ops restaurant service layer and dev service support
- [x] Update runtime booking email rendering to use variant-aware overrides

## UI / UX

- [x] Add `email-templates` restaurant settings view and route
- [x] Build grouped gallery and split editor
- [x] Add desktop/mobile preview and variant controls

## Tests

- [x] Unit tests
- [x] Integration tests
- [x] Manual UI QA via Chrome DevTools

## Notes

- Assumptions:
  - Existing restaurant settings admin membership guards remain the write-access source of truth for this feature.
  - System HTML shell, booking facts, destinations, and delivery behavior stay locked in the renderer.
- Deviations:
  - Write access follows the existing ops admin membership model (`owner`/`manager`) rather than introducing a parallel role check just for email templates.
  - The dev harness mock preview uses simplified HTML, so placeholder interpolation is fully validated in the real preview route/tests rather than the local iframe mock.
