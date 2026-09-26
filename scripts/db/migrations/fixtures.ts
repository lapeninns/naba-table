import path from 'node:path';

/**
 * Deterministic synthetic fixture identifiers shared by tests/db/fixtures/synthetic-fixtures.sql,
 * the SQL regression files and the sql-regression runner.
 *
 * The UUIDs are RFC 4122 version-4 shaped but fixed, so a regression file can name the row it
 * exercises instead of selecting an arbitrary existing record. Every fixture row is tenant
 * scoped to one of the two synthetic restaurants and is only ever created inside a
 * transaction that is rolled back.
 */

export const SYNTHETIC_FIXTURES_RELATIVE_PATH = path.join(
  'tests',
  'db',
  'fixtures',
  'synthetic-fixtures.sql',
);

export const SQL_REGRESSION_FILES: readonly string[] = [
  'tests/db/terminal-booking-table-release.sql',
  'tests/db/manual-table-unassignment.sql',
  'tests/db/atomic-table-hold-enforcement.sql',
  'tests/db/review-scheduling-recovery.sql',
  'tests/db/gbp-oauth-terminal-state.sql',
  'tests/db/booking-create-idempotency.sql',
  'tests/db/booking-cancel-guard-and-undo-no-show.sql',
  'tests/db/atomic-booking-table-move.sql',
  'tests/db/save-restaurant-availability.sql',
  'tests/db/atomic-table-inventory-update.sql',
  'tests/db/menu-mutation-integrity.sql',
  'tests/db/email-queue-finalize-and-retry-claims.sql',
  'tests/db/capacity-outbox-claim.sql',
  'tests/db/booking-email-intent-ensure.sql',
  'tests/db/booking-modification-table-swap.sql',
  'tests/db/business-context-atomic-save.sql',
  'tests/db/atomic-restaurant-profile-update.sql',
  'tests/db/onboarding-replace-layout.sql',
  'supabase/tests/mobile_sms_attempt_finalization.sql',
  'supabase/tests/whatsapp_review_notification_ledger.sql',
];

export const FIXTURE_IDS = {
  restaurantA: '00000000-0000-4000-8000-00000000a001',
  restaurantB: '00000000-0000-4000-8000-00000000a002',
  customerA: '00000000-0000-4000-8000-00000000c001',
  zoneA: '00000000-0000-4000-8000-00000000d001',
  tableA: '00000000-0000-4000-8000-00000000e001',
  completedBookingA: '00000000-0000-4000-8000-00000000b001',
  confirmedBookingA: '00000000-0000-4000-8000-00000000b002',
} as const;

export type FixtureId = (typeof FIXTURE_IDS)[keyof typeof FIXTURE_IDS];

/** Marker every regression file must carry so it is never run without the fixture set. */
export const REQUIRES_FIXTURES_MARKER =
  '-- requires-fixtures: tests/db/fixtures/synthetic-fixtures.sql';

/** SQLSTATE reserved for regression assertion failures; never caught by a test's own handlers. */
export const ASSERTION_SQLSTATE = 'NB001';

/** Tables whose row counts must be identical before and after every regression file. */
export const TRACKED_TABLES: readonly string[] = [
  'restaurants',
  'customers',
  'zones',
  'allowed_capacities',
  'table_inventory',
  'bookings',
  'booking_table_assignments',
  'allocations',
  'allocations_archive',
  'booking_assignment_idempotency',
  'booking_slots',
  'table_holds',
  'table_hold_members',
  'table_hold_windows',
  'mobile_notifications',
  'mobile_notification_attempts',
  'review_requests',
  'review_request_events',
  'review_scheduling_jobs',
  'restaurant_external_profile_oauth_states',
  'booking_table_moves',
  'restaurant_business_context_revisions',
];
