-- Migration: Booking Lifecycle State Machine Foundations
-- Description: Extends booking_status enum, adds booking_state_history table, and enforces timestamp invariants.
-- Date: 2025-10-16

-- =====================================================
-- 1. Extend booking_status enum with checked_in state
-- =====================================================
ALTER TYPE "public"."booking_status"
ADD VALUE IF NOT EXISTS 'checked_in';

COMMENT ON TYPE "public"."booking_status" IS 'Lifecycle status of a booking (pending, confirmed, checked_in, completed, cancelled, no_show, etc).';

-- =====================================================
-- 2. Create booking_state_history table for audit trail
-- =====================================================
CREATE TABLE IF NOT EXISTS "public"."booking_state_history" (
    "id" BIGSERIAL PRIMARY KEY,
    "booking_id" UUID NOT NULL REFERENCES "public"."bookings"("id") ON DELETE CASCADE,
    "from_status" "public"."booking_status",
    "to_status" "public"."booking_status" NOT NULL,
    "changed_by" UUID REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE "public"."booking_state_history" OWNER TO "postgres";

COMMENT ON TABLE "public"."booking_state_history" IS 'Audit history of booking lifecycle transitions.';
COMMENT ON COLUMN "public"."booking_state_history"."booking_id" IS 'Booking whose status transitioned.';
COMMENT ON COLUMN "public"."booking_state_history"."from_status" IS 'Previous lifecycle status.';
COMMENT ON COLUMN "public"."booking_state_history"."to_status" IS 'New lifecycle status.';
COMMENT ON COLUMN "public"."booking_state_history"."changed_by" IS 'User who triggered the change (null for system operations).';
COMMENT ON COLUMN "public"."booking_state_history"."changed_at" IS 'UTC timestamp when the transition was recorded.';
COMMENT ON COLUMN "public"."booking_state_history"."reason" IS 'Optional human-readable reason for the transition.';
COMMENT ON COLUMN "public"."booking_state_history"."metadata" IS 'Additional structured data describing the transition.';

-- Indexes for fast lookup by booking and recent history queries
CREATE INDEX IF NOT EXISTS "idx_booking_state_history_booking"
    ON "public"."booking_state_history" ("booking_id", "changed_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_booking_state_history_changed_at"
    ON "public"."booking_state_history" ("changed_at");

COMMENT ON INDEX "public"."idx_booking_state_history_booking" IS 'Lookup transitions for a booking ordered by recency.';
COMMENT ON INDEX "public"."idx_booking_state_history_changed_at" IS 'Support chronological reporting of booking transitions.';

-- =====================================================
-- 3. Enforce checked_out_at occurs after checked_in_at
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_checked_out_after_checked_in'
            AND conrelid = 'public.bookings'::regclass
    ) THEN
        ALTER TABLE "public"."bookings"
            ADD CONSTRAINT "bookings_checked_out_after_checked_in"
            CHECK (
                "checked_out_at" IS NULL
                OR "checked_in_at" IS NULL
                OR "checked_out_at" >= "checked_in_at"
            );
    END IF;
END
$$;

COMMENT ON CONSTRAINT "bookings_checked_out_after_checked_in" ON "public"."bookings"
    IS 'Ensures recorded check-out timestamps are chronologically after check-in.';

-- =====================================================
-- 4. Helper function for atomic booking transitions
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."apply_booking_state_transition"(
    p_booking_id uuid,
    p_status "public"."booking_status",
    p_checked_in_at timestamptz,
    p_checked_out_at timestamptz,
    p_updated_at timestamptz,
    p_history_from "public"."booking_status",
    p_history_to "public"."booking_status",
    p_history_changed_by uuid,
    p_history_changed_at timestamptz,
    p_history_reason text,
    p_history_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    status "public"."booking_status",
    checked_in_at timestamptz,
    checked_out_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated public.bookings%ROWTYPE;
BEGIN
    UPDATE public.bookings
    SET
        status = p_status,
        checked_in_at = p_checked_in_at,
        checked_out_at = p_checked_out_at,
        updated_at = p_updated_at
    WHERE id = p_booking_id
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id;
    END IF;

    INSERT INTO public.booking_state_history (
        booking_id,
        from_status,
        to_status,
        changed_by,
        changed_at,
        reason,
        metadata
    )
    VALUES (
        p_booking_id,
        p_history_from,
        p_history_to,
        p_history_changed_by,
        p_history_changed_at,
        p_history_reason,
        COALESCE(p_history_metadata, '{}'::jsonb)
    );

    RETURN QUERY
    SELECT
        v_updated.status,
        v_updated.checked_in_at,
        v_updated.checked_out_at,
        v_updated.updated_at;
END;
$$;

ALTER FUNCTION "public"."apply_booking_state_transition"(
    uuid,
    "public"."booking_status",
    timestamptz,
    timestamptz,
    timestamptz,
    "public"."booking_status",
    "public"."booking_status",
    uuid,
    timestamptz,
    text,
    jsonb
) OWNER TO "postgres";

-- =====================================================
-- 5. Rollback guidance
-- =====================================================
-- To rollback:
--   1. Delete from booking_state_history, then DROP TABLE booking_state_history;
--   2. DROP CONSTRAINT bookings_checked_out_after_checked_in from bookings;
--   3. Removing enum values requires recreating booking_status type; follow Postgres enum rollback procedure if necessary.
