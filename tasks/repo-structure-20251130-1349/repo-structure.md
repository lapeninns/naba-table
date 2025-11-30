# Repository Structure (depth 2)

Excludes: .DS_Store, .cache, .git, .husky, .idea, .next, .pnpm-store, .swc, .turbo, .vercel, artifacts, build, coverage, dist, logs, node_modules, playwright-report, storybook-static, test-results, tmp

```text
.
|-- .agent
|   `-- workflows
|-- .claude
|   `-- settings.local.json
|-- .env.example
|-- .env.local
|-- .env.local.example
|-- .factory
|   |-- config.json
|   `-- skills
|-- .gitattributes
|-- .github
|   `-- workflows
|-- .gitignore
|-- .pre-commit-config.yaml
|-- .prettierrc.json
|-- .qodo
|   |-- agents
|   `-- workflows
|-- .reserve-dist
|   |-- assets
|   `-- index.html
|-- .vscode
|   `-- mcp.json
|-- AGENTS.md
|-- CLEANUP_QUICKSTART.sh
|-- FILES_CREATED.txt
|-- FINAL_SESSION_SUMMARY.md
|-- GEMINI.md
|-- LICENSE
|-- MAGIC_LINK_FIX.md
|-- README.md
|-- README_SESSION.md
|-- SESSION_SUMMARY.md
|-- backups
|   |-- schema-cleanup-20251101-113955
|   `-- supabase-backup-20251017-132504
|-- booking_issue_files.json
|-- cleanup.py
|-- cleanup.sh
|-- components
|   |-- BetterIcon.tsx
|   |-- ButtonGradient.tsx
|   |-- ButtonLead.tsx
|   |-- ButtonPopover.tsx
|   |-- ButtonSignin.tsx
|   |-- ButtonSupport.tsx
|   |-- CTA.tsx
|   |-- FAQ.tsx
|   |-- FeaturesAccordion.tsx
|   |-- FeaturesGrid.tsx
|   |-- FeaturesListicle.tsx
|   |-- Footer.tsx
|   |-- Header.tsx
|   |-- Hero.tsx
|   |-- LayoutClient.tsx
|   |-- Modal.tsx
|   |-- Problem.tsx
|   |-- Testimonial1Small.tsx
|   |-- TestimonialRating.tsx
|   |-- Testimonials1.tsx
|   |-- Testimonials11.tsx
|   |-- Testimonials3.tsx
|   |-- TestimonialsAvatars.tsx
|   |-- TimeSlider.tsx
|   |-- WithWithout.tsx
|   |-- app-sidebar.tsx
|   |-- atoms
|   |-- auth
|   |-- customer
|   |-- dashboard
|   |-- features
|   |-- guest-account
|   |-- invite
|   |-- marketing
|   |-- mobile
|   |-- nav-main.tsx
|   |-- nav-projects.tsx
|   |-- nav-user.tsx
|   |-- ops
|   |-- owner
|   |-- owner-marketing
|   |-- profile
|   |-- providers
|   |-- reserve
|   |-- team-switcher.tsx
|   |-- ui
|   `-- wizard
|-- components.json
|-- config
|   |-- booking-state-machine.ts
|   |-- demand-profiles.json
|   |-- env.schema.ts
|   `-- observability
|-- config.example.yaml
|-- config.ts
|-- config.yaml
|-- context
|   |-- sticky-footer-consolidated.json
|   |-- table-assignment-code.json
|   `-- wizard-steps-consolidated.json
|-- docs
|   |-- BROKEN-LINKS-AND-ISSUES.md
|   |-- BUSINESS_LOGIC.md
|   |-- CRITICAL-ISSUES.md
|   |-- PRODUCTION-READINESS.md
|   |-- README.md
|   |-- auth-email-templates.md
|   |-- auth-fixes-summary.md
|   |-- authentication-routes.md
|   |-- cache-strategy.md
|   |-- current-routes.md
|   |-- deployment-summary.md
|   |-- design-notes.md
|   |-- dev-routing.md
|   |-- environments.md
|   |-- keyboard-shortcuts.md
|   |-- legacy-routes-cleanup.md
|   |-- mutation-pattern.md
|   |-- prod.env
|   |-- production-readiness-checklist.md
|   |-- refactoring-table-business-rules.md
|   |-- restaurant-facing-routes.md
|   |-- routes-guest-facing.md
|   |-- routing-conventions.md
|   |-- routing-overview.md
|   |-- security
|   `-- security.md
|-- eslint.config.mjs
|-- floor_plan_code.json
|-- guest-facing-routes.md
|-- guest_screenshots
|   `-- REPORT.md
|-- hooks
|   |-- index.ts
|   |-- ops
|   |-- owner
|   |-- use-mobile.ts
|   |-- use-toast.ts
|   |-- useBookingHistory.ts
|   |-- useBookings.ts
|   |-- useBookingsTableState.ts
|   |-- useCancelBooking.ts
|   |-- useOnlineStatus.ts
|   |-- useOpsBookings.ts
|   |-- useOpsCancelBooking.ts
|   |-- useOpsCustomers.ts
|   |-- useOpsUpdateBooking.ts
|   |-- useProfile.ts
|   |-- useSupabaseSession.ts
|   `-- useUpdateBooking.ts
|-- lib
|   |-- analytics
|   |-- analytics.ts
|   |-- api
|   |-- auth
|   |-- bookings
|   |-- enums.ts
|   |-- env-client.ts
|   |-- env.ts
|   |-- errors
|   |-- export
|   |-- http
|   |-- logger.ts
|   |-- owner
|   |-- prefetchers.ts
|   |-- profile
|   |-- query
|   |-- queue
|   |-- reservations
|   |-- restaurants
|   |-- security
|   |-- site-url.ts
|   |-- supabase
|   |-- url
|   |-- utils
|   |-- utils.ts
|   `-- venue.ts
|-- libs
|   |-- api.ts
|   |-- gpt.ts
|   |-- resend.ts
|   `-- seo.tsx
|-- manual-assignment-full-code.txt
|-- manual-assignment-map.json
|-- next
|-- next-env.d.ts
|-- next-sitemap.config.js
|-- next.config.js
|-- openapi.yaml
|-- package.json
|-- patches
|   |-- tr46@0.0.3.patch
|   `-- whatwg-url@5.0.0.patch
|-- playwright.component.config.ts
|-- playwright.config.ts
|-- pnpm-lock.yaml
|-- pnpm-workspace.yaml
|-- postcss.config.js
|-- public
|   |-- robots.txt
|   |-- sitemap-0.xml
|   `-- sitemap.xml
|-- reports
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-02-10.182Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-02-29.702Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-02-48.595Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-03-07.829Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-03-17.088Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-16-19.093Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-16-39.400Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-17-02.052Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-17-21.232Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-17-30.736Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-26-22.758Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-27-21.947Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-27-58.749Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-28-49.030Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-29-13.738Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-33-36.682Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-34-07.776Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-35-52.093Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-36-52.682Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-37-17.012Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-54-15.091Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-54-56.169Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-56-22.992Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-57-06.082Z.json
|   |-- auto-assign-ultra-fast-2025-11-05-2025-11-05T18-57-23.341Z.json
|   |-- auto-assign-ultra-fast-2025-11-06-2025-11-06T08-26-17.376Z.json
|   |-- auto-assign-ultra-fast-2025-11-06-2025-11-06T08-39-10.279Z.json
|   |-- auto-assign-ultra-fast-2025-11-06-2025-11-06T09-28-41.831Z.json
|   `-- auto-assign-ultra-fast-2025-11-07-2025-11-06T08-35-19.999Z.json
|-- reserve
|   |-- .storybook
|   |-- app
|   |-- entities
|   |-- features
|   |-- index.html
|   |-- main.tsx
|   |-- pages
|   |-- shared
|   |-- tests
|   |-- tsconfig.reserve.json
|   |-- vite-env.d.ts
|   |-- vite.config.ts
|   `-- vitest.config.ts
|-- restaurant.json
|-- route-map-ascii.txt
|-- route-map-mermaid.md
|-- route-map.json
|-- route-scanner.js
|-- run-dev.sh
|-- scripts
|   |-- analyze_unused_tables.py
|   |-- apply-tenant-rls-migrations.sh
|   |-- apply_factory_config.sh
|   |-- apply_factory_config_with_token.sh
|   |-- apply_supabase_order.sh
|   |-- capture-route-screenshots.ts
|   |-- check-allocation-results.ts
|   |-- check-booking-assignments.mjs
|   |-- check-booking-dates.ts
|   |-- check-restaurants.ts
|   |-- check_assignment_overlaps.sql
|   |-- check_vibeproxy_connection.sh
|   |-- db
|   |-- debug-selector.ts
|   |-- deploy-capacity-overlap-migration.sh
|   |-- deploy-tenant-rls-production.sh
|   |-- dump-seed-data.sh
|   |-- ensure-dev-port.ts
|   |-- feature-flags
|   |-- generate-env-local-example.ts
|   |-- jobs
|   |-- observability
|   |-- ops-assign-all-bookings.ts
|   |-- ops-auto-assign-ultra-fast-loop.ts
|   |-- ops-auto-assign-ultra-fast.ts
|   |-- ordered_apply.sh
|   |-- patch_factory_config_for_vibeproxy.sh
|   |-- preview-booking-email.ts
|   |-- queues
|   |-- quick-deploy-production.sh
|   |-- reproduce_issue.ts
|   |-- reset-bookings.ts
|   |-- restore_supabase_backup.sh
|   |-- revert_factory_config.sh
|   |-- rollback-tenant-rls.sh
|   |-- run-allocation-stress-test.sh
|   |-- run-booking-flow.ts
|   |-- run-slot-fill.ts
|   |-- send-booking-confirmation.ts
|   |-- smoke-test-tenant-rls.sh
|   |-- update-schema.sh
|   |-- utils
|   |-- validate-env.ts
|   |-- validate_overlap_constraints.sql
|   |-- verify-session-endpoint.mjs
|   |-- vibeproxy_health_check.sh
|   `-- vibeproxy_injection_test.sh
|-- security
|-- server
|   |-- __tests__
|   |-- alerts
|   |-- analytics.ts
|   |-- auth
|   |-- booking
|   |-- booking-reference.ts
|   |-- bookingHistory.ts
|   |-- bookings
|   |-- bookings.ts
|   |-- cache
|   |-- capacity
|   |-- customers.ts
|   |-- db-errors.ts
|   |-- emails
|   |-- feature-flags-overrides.ts
|   |-- feature-flags.ts
|   |-- http
|   |-- jobs
|   |-- loyalty.ts
|   |-- observability
|   |-- observability.ts
|   |-- occasions
|   |-- ops
|   |-- outbox.ts
|   |-- queue
|   |-- reservations
|   |-- restaurants
|   |-- security
|   |-- supabase.ts
|   |-- team
|   |-- test-api.ts
|   |-- waitlist
|   `-- webhooks
|-- ship-fast-code@0.1.0
|-- squash_migrations.sh
|-- src
|   |-- app
|   |-- components
|   |-- contexts
|   |-- data
|   |-- hooks
|   |-- lib
|   |-- middleware.test.ts
|   |-- middleware.ts
|   |-- services
|   |-- types
|   `-- utils
|-- styles
|   `-- tokens.css
|-- supabase
|   |-- .branches
|   |-- .temp
|   |-- migrations
|   |-- schema.sql
|   |-- schema_new.sql
|   |-- seed.sql
|   |-- seeds
|   |-- supabase
|   `-- utilities
|-- tailwind.config.js
|-- tasks
|   |-- analytics-types-fix-20251127-1750
|   |-- app-host-local-20251127-2340
|   |-- auth-email-fallback-20251128-0749
|   |-- auth-email-templates-20251128-0806
|   |-- booking-availability-edit-bug-20251127-2358
|   |-- booking-default-slug-fix-20251128-0907
|   |-- booking-edit-save-error-20251128-1419
|   |-- booking-email-reminders-20251128-2056
|   |-- booking-flow-venue-name-20251128-1512
|   |-- business-logic-analysis-20251130-0019
|   |-- capacity-simplification-20251130-1246
|   |-- guest-thank-you-redirect-20251128-0804
|   |-- host-routing-auth-20251127-1755
|   |-- magic-link-landing-20251128-1232
|   |-- middleware-regex-build-fix-20251127-2322
|   |-- party-size-numeric-20251130-1243
|   |-- remove-images-20251128-0801
|   |-- repo-structure-20251130-1349
|   |-- route-groups-20251127-1741
|   |-- secret-rotation-20251130-1154
|   `-- wizard-venue-hydration-20251128-1613
|-- test-email.mjs
|-- test-magic-link.mjs
|-- tests
|   |-- fixtures
|   |-- lib
|   |-- ops
|   |-- scripts
|   |-- server
|   `-- vitest.setup.ts
|-- tools
|   |-- OpenJDK17U-jdk_aarch64_mac_hotspot.tar.gz
|   |-- jdk-17.0.17+10
|   `-- temurin17.tar.gz
|-- tsconfig.eslint.json
|-- tsconfig.json
|-- tsconfig.strict.json
|-- tsconfig.strict.tsbuildinfo
|-- tsconfig.tsbuildinfo
|-- types
|   |-- bookingHistory.ts
|   |-- cally.d.ts
|   |-- config.ts
|   |-- images.d.ts
|   |-- index.ts
|   |-- next-auth.d.ts
|   `-- supabase.ts
`-- vitest.config.ts
```
