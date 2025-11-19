# Manual Table Assignment: Architectural Analysis & Redesign Proposal

## 1. Executive Summary

This document outlines a critical analysis of the current manual table assignment workflow and proposes a new, robust target architecture.

**The Problem:** The existing system, while functional, suffers from architectural flaws that create race conditions, a brittle versioning model, and a confusing user experience. Its three-step, context-version-dependent API is "chatty" and prone to failure under concurrent use by multiple staff members.

**The Solution:** We propose a new design centered on an **explicit state machine**, managed in a new `manual_assignment_sessions` database table. This approach simplifies the backend to a single, idempotent API endpoint, eliminates race conditions, and provides a solid foundation for a more intuitive and reliable user interface. This new model is also more aligned with industry best practices for managing transactional, multi-step user workflows.

## 2. Analysis of Current Implementation

The current system is a complex interaction between the frontend, a Next.js backend, and a Supabase/Postgres database.

### High-Level Flow

1.  **`validate`**: The client sends a proposed set of tables. The server validates business rules (capacity, conflicts, etc.).
2.  **`hold`**: If validation passes, the client sends a separate request to place a temporary hold on the tables. This is a "soft" reservation with a TTL.
3.  **`confirm`**: The client sends a final request to convert the hold into a permanent booking assignment.

### Backend API (`/api/staff/manual/...`)

- **Three Separate Endpoints:** `validate`, `hold`, `confirm`.
- **Concurrency Control:** A `contextVersion` string (a checksum of relevant booking and capacity state) is used to prevent stale updates. If the client's `contextVersion` does not match the server's, the request is rejected. This is the source of the frequent "Your view is out of date" errors.

### Core Logic (`server/capacity/` & Postgres RPCs)

- The core validation logic resides in `server/capacity/table-assignment/manual.ts`.
- Crucially, the most sensitive database operations (creating a hold, confirming an assignment) are delegated to Postgres RPC functions (`create_table_hold_v2`, `assign_tables_to_booking_from_hold_v3`) for atomicity.
- The `allocations` table, with its `tstzrange` column and `EXCLUDE` constraint, is the ultimate source of truth for preventing double-bookings at the database level.

### Frontend (`useManualAssignmentContext`, `BookingDetailsDialog.tsx`)

- A complex hook, `useManualAssignmentContext`, manages the state, including the `contextVersion`.
- It uses Supabase Realtime to listen for database changes and trigger context refetches.
- To reduce API traffic and user confusion, the "hold" request is debounced, meaning it only fires after the user stops making changes for a set period. This is a workaround for the chatty API.

## 3. Identified Problems & Failure Modes

1.  **Concurrency & Race Conditions:** The gap between `validate`, `hold`, and `confirm` is a classic race condition. Two staff members can validate the same tables, but only one can successfully create a hold. The loser's hold request silently fails or overwrites the winner's, leading to confusion.
2.  **Brittle Versioning:** The `contextVersion` is too broad. A change to an unrelated booking can invalidate a staff member's context, forcing them to restart. It's a sledgehammer approach to a surgical problem.
3.  **Implicit & Fragile Data Model:** The state of an assignment is _implicit_. A "hold" is just a row in `table_holds`. A "confirmed" assignment is a row in `booking_table_assignments`. There is no single object representing the _session_ of a user trying to assign tables. Hold cleanup relies on a periodic job, which is a potential point of failure.
4.  **Chatty API & Poor UX:** The three-step process is inefficient. The debounced hold is a confusing abstraction that feels sluggish and unresponsive to the user.

## 4. Proposed Target Architecture

The new design is based on a single, explicit state machine.

### New Data Model: `manual_assignment_sessions` Table

This new table will be the heart of the system.

| Column              | Type          | Description                                                 |
| ------------------- | ------------- | ----------------------------------------------------------- |
| `id`                | `uuid`        | Primary Key.                                                |
| `booking_id`        | `uuid`        | The booking being worked on.                                |
| `created_by`        | `uuid`        | The staff member who initiated the session.                 |
| `status`            | `enum`        | **`PROPOSED`, `HELD`, `CONFIRMED`, `CANCELLED`, `EXPIRED`** |
| `proposed_tables`   | `jsonb`       | Array of `table_inventory_id`s being considered.            |
| `hold_expires_at`   | `timestamptz` | When the hold becomes invalid.                              |
| `last_validated_at` | `timestamptz` | Timestamp of the last successful business rule validation.  |
| ... (timestamps)    |               |                                                             |

### New API Design: Single, Idempotent Endpoint

A single endpoint, `/api/staff/manual/session`, will manage the entire lifecycle.

- **`POST /api/staff/manual/session` (Body: `{ bookingId, tableIds }`)**
  - **Action:** Creates a new session or updates an existing one for that user/booking.
  - **Logic:**
    1.  Find an active session for `booking_id` + `user_id` or create one.
    2.  Set `status` to `PROPOSED` and update `proposed_tables`.
    3.  Run all business rule validations.
    4.  If validation passes, **atomically** create a hold (using an RPC that writes to `table_holds`) and update the session: set `status` to `HELD` and set `hold_expires_at`.
    5.  Return the complete session object.

- **`PUT /api/staff/manual/session/{sessionId}/confirm`**
  - **Action:** Confirms the assignment.
  - **Logic:**
    1.  Lock the session row.
    2.  Verify the session is still `HELD` and not expired.
    3.  Run final, critical validations.
    4.  **Atomically** call an RPC to convert the hold to a permanent assignment and update the session `status` to `CONFIRMED`.
    5.  Return the final session object.

### Unified Constraint Engine

The validation logic (`manual.ts`) will be refactored into a "Constraint Engine" module. This module will be pure, testable, and shared between the manual assignment flow and the auto-assignment algorithm to ensure consistency.

## 5. Migration & Rollout Plan

We will use a feature flag (`use-new-manual-assignment-flow`) to de-risk the migration.

1.  **Phase 1: Schema & API Foundation (Behind Flag)**
    - Create the `manual_assignment_sessions` table and associated RPCs.
    - Build the new `/api/staff/manual/session` endpoint. The old API endpoints remain active.
    - Write comprehensive tests for the new API and RPCs.

2.  **Phase 2: Frontend Implementation (Behind Flag)**
    - Create a new hook, `useManualAssignmentSession`, that interacts with the new endpoint.
    - Refactor `BookingDetailsDialog.tsx` to use the new hook when the feature flag is enabled. The UI should now feel instant and provide clear feedback (e.g., "Hold acquired," "Table X conflicts...").

3.  **Phase 3: Rollout & Monitoring**
    - Enable the feature flag for internal staff first.
    - Monitor performance and error logs.
    - Gradually roll out to all users.

4.  **Phase 4: Cleanup**
    - Once the new system is stable and fully adopted, remove the feature flag.
    - Remove the old API endpoints (`/api/staff/manual/{validate,hold,confirm}`).
    - Remove the old frontend code (`useManualAssignmentContext`).
