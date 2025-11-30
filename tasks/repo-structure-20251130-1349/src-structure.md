# src Directory Structure (depth 3)

Excludes: .DS_Store, .cache, .git, .husky, .idea, .next, .pnpm-store, .swc, .turbo, .vercel, artifacts, build, coverage, dist, logs, node_modules, playwright-report, storybook-static, test-results, tmp

```text
src
|-- app
|   |-- (public)
|   |   |-- (marketing)
|   |   |-- auth
|   |   |-- bookings
|   |   `-- page.tsx
|   |-- api
|   |   |-- README.md
|   |   |-- app
|   |   |-- auth
|   |   |-- availability
|   |   |-- bookings
|   |   |-- config
|   |   |-- debug-env
|   |   |-- events
|   |   |-- inngest
|   |   |-- lead
|   |   |-- ops
|   |   |-- profile
|   |   |-- reservations
|   |   |-- restaurants
|   |   |-- staff
|   |   |-- team
|   |   |-- test
|   |   |-- test-email
|   |   |-- v1
|   |   `-- webhook
|   |-- app
|   |   |-- (app)
|   |   `-- auth
|   |-- dev
|   |-- error.tsx
|   |-- globals.css
|   |-- globals.css.backup-20251003-163824
|   |-- globals.css.minimal-backup
|   |-- guest
|   |   |-- bookings
|   |   |-- dashboard
|   |   |-- error.tsx
|   |   |-- layout.tsx
|   |   |-- page.tsx
|   |   |-- profile
|   |   `-- thank-you
|   |-- layout.tsx
|   |-- layout.tsx.new
|   |-- not-found.tsx
|   |-- providers.tsx
|   |-- robots.ts
|   `-- sitemap.ts
|-- components
|   |-- auth
|   |   `-- SignInForm.tsx
|   |-- common
|   |   `-- index.ts
|   |-- features
|   |   |-- booking
|   |   |-- booking-details-v2
|   |   |-- booking-state-machine
|   |   |-- bookings
|   |   |-- customers
|   |   |-- dashboard
|   |   |-- guest
|   |   |-- index.ts
|   |   |-- ops-shell
|   |   |-- restaurant-settings
|   |   |-- tables
|   |   `-- team
|   |-- landing
|   |-- layout
|   |   `-- header
|   |-- layouts
|   |   |-- AuthLayout.tsx
|   |   |-- GuestLayout.tsx
|   |   `-- MarketingLayout.tsx
|   |-- marketing
|   |-- shared
|   |   |-- FeatureCard.tsx
|   |   |-- PageHero.tsx
|   |   `-- PageSection.tsx
|   `-- ui
|       `-- copy-button.tsx
|-- contexts
|   |-- booking-offline-queue.tsx
|   |-- booking-state-machine.tsx
|   |-- index.ts
|   |-- ops-services.tsx
|   `-- ops-session.tsx
|-- data
|-- hooks
|   |-- app
|   |   `-- __tests__
|   |-- index.ts
|   |-- ops
|   |   |-- useAssignmentContext.ts
|   |   |-- useBookingRealtime.ts
|   |   |-- useManualAssignmentContext.ts
|   |   |-- useOccasions.ts
|   |   |-- useOpsBooking.ts
|   |   |-- useOpsBookingChanges.ts
|   |   |-- useOpsBookingHeatmap.ts
|   |   |-- useOpsBookingService.ts
|   |   |-- useOpsBookingStatusActions.ts
|   |   |-- useOpsBookingStatusSummary.ts
|   |   |-- useOpsBookingsList.ts
|   |   |-- useOpsBookingsTableState.ts
|   |   |-- useOpsOperatingHours.ts
|   |   |-- useOpsRejectionAnalytics.ts
|   |   |-- useOpsRestaurantDetails.ts
|   |   |-- useOpsRestaurantLogoUpload.ts
|   |   |-- useOpsRestaurants.ts
|   |   |-- useOpsServicePeriods.ts
|   |   |-- useOpsStrategicSettings.ts
|   |   |-- useOpsTableAssignments.ts
|   |   |-- useOpsTableTimeline.ts
|   |   |-- useOpsTeamInvitations.ts
|   |   |-- useOpsTodaySummary.ts
|   |   |-- useOpsTodayVIPs.ts
|   |   `-- utils
|   |-- use-copy-to-clipboard.ts
|   |-- use-countdown.ts
|   |-- use-debounced-value.ts
|   `-- useGlobalShortcuts.ts
|-- lib
|   |-- booking
|   |   `-- state-machine.ts
|   `-- utils
|-- middleware.test.ts
|-- middleware.ts
|-- services
|   |-- index.ts
|   `-- ops
|       |-- allowedCapacities.ts
|       |-- bookings.ts
|       |-- customers.ts
|       |-- index.ts
|       |-- occasions.ts
|       |-- restaurants.ts
|       |-- tables.ts
|       |-- team.ts
|       `-- zones.ts
|-- types
|   |-- index.ts
|   `-- ops.ts
`-- utils
    |-- debounceThrottle.ts
    |-- index.ts
    |-- ops
    |   `-- dashboard.ts
    `-- shortcuts.ts
```
