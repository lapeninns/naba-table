# Hold confirmation and Google Business settings regression evidence

The confirmation RPC consumes an unbound hold while retaining the ordered inventory row locks used by admission. Its assignment, receipt, booking transition and outbox changes remain in one transaction. A failure restores the original hold, members and projection. Terminal bookings cannot confirm a hold. Tenant, ownership, expiry and policy checks remain in place.

`tests/db/atomic-table-hold-enforcement.sql` exercises unbound confirmation, terminal rejection and an injected receipt failure after assignment. The staging SQL runner verifies rollback against tracked tables. Existing conflict and direct-writer checks remain enabled.

Google Business drift queries and the dual-sync workspace require a linked connection with both an account ID and a location ID. Component cases cover authorized, unlinked and incomplete linked connections; the staging browser test covers the real unlinked settings route without provider writes.

The pending local edit to `20260809120000_gbp_write_safety_foundation.sql` is retired because the migration has already been applied and is immutable. Production inspection found no unhashed OAuth rows or conflicting consumed/invalidated terminal states. No OAuth data repair is required. Its intended behavior is instead covered by `tests/db/gbp-oauth-terminal-state.sql`: consuming an attempt, creating another, preserving the consumed terminal state, denying replay and denying cross-tenant consumption. The original schema driver adds the same consumed-state preservation assertion.

The requested release skips CI repair. Execute local verification, staging database regression and deployed browser proof before production migration and promotion. Record exact source revision and migration ledger readbacks in release evidence.
