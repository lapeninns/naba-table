-- Migration: Add Capacity Check RPC Function
-- Description: Creates PostgreSQL RPC function for race-safe booking creation with capacity enforcement
-- Story: Capacity & Availability Engine - Story 1
-- Date: 2025-10-16

-- =====================================================
-- 1. Create capacity check result type
-- =====================================================
-- Note: Using JSONB return type for flexibility with error/success responses

-- =====================================================
-- 2. Main RPC Function: create_booking_with_capacity_check
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."create_booking_with_capacity_check"(
    p_restaurant_id uuid,
    p_customer_id uuid,
    p_booking_date date,
    p_start_time time,
    p_end_time time,
    p_party_size integer,
    p_booking_type text,  -- Will be cast to booking_type enum
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_seating_preference text,  -- Will be cast to seating_preference_type enum
    p_notes text DEFAULT NULL,
    p_marketing_opt_in boolean DEFAULT false,
    p_idempotency_key text DEFAULT NULL,
    p_source text DEFAULT 'api',
    p_auth_user_id uuid DEFAULT NULL,
    p_client_request_id text DEFAULT NULL,
    p_details jsonb DEFAULT '{}'::jsonb,
    p_loyalty_points_awarded integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_service_period_id uuid;
    v_service_period_name text;
    v_max_covers integer;
    v_max_parties integer;
    v_booked_covers integer;
    v_booked_parties integer;
    v_booking_id uuid;
    v_booking_record jsonb;
    v_reference text;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_timezone text;
BEGIN
    -- Set transaction isolation level to SERIALIZABLE for maximum safety
    -- This prevents phantom reads and ensures consistency
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    
    -- =====================================================
    -- STEP 1: Idempotency Check
    -- =====================================================
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_booking_id 
        FROM bookings 
        WHERE restaurant_id = p_restaurant_id 
            AND idempotency_key = p_idempotency_key
        LIMIT 1;
        
        IF FOUND THEN
            -- Return existing booking (duplicate request)
            SELECT to_jsonb(b.*) INTO v_booking_record
            FROM bookings b 
            WHERE id = v_booking_id;
            
            RETURN jsonb_build_object(
                'success', true,
                'duplicate', true,
                'booking', v_booking_record,
                'message', 'Booking already exists (idempotency)'
            );
        END IF;
    END IF;
    
    -- =====================================================
    -- STEP 2: Find Applicable Service Period
    -- =====================================================
    SELECT sp.id, sp.name INTO v_service_period_id, v_service_period_name
    FROM restaurant_service_periods sp
    WHERE sp.restaurant_id = p_restaurant_id
        AND (sp.day_of_week IS NULL OR sp.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
        AND p_start_time >= sp.start_time
        AND p_start_time < sp.end_time
    ORDER BY 
        sp.day_of_week DESC NULLS LAST,
        sp.start_time ASC
    LIMIT 1;
    
    -- =====================================================
    -- STEP 3: Get Capacity Rules with Row-Level Lock
    -- =====================================================
    -- This FOR UPDATE lock prevents concurrent transactions from modifying
    -- the same capacity rule, ensuring consistent capacity checks
    SELECT 
        COALESCE(cr.max_covers, 999999) as max_covers,
        COALESCE(cr.max_parties, 999999) as max_parties
    INTO v_max_covers, v_max_parties
    FROM restaurant_capacity_rules cr
    WHERE cr.restaurant_id = p_restaurant_id
        AND (cr.service_period_id IS NULL OR cr.service_period_id = v_service_period_id)
        AND (cr.day_of_week IS NULL OR cr.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
        AND (cr.effective_date IS NULL OR cr.effective_date <= p_booking_date)
    ORDER BY 
        cr.effective_date DESC NULLS LAST,
        cr.day_of_week DESC NULLS LAST,
        cr.service_period_id DESC NULLS LAST
    LIMIT 1
    FOR UPDATE NOWAIT;  -- Fail fast if row is locked by another transaction
    
    -- If no capacity rule found, use high defaults (unlimited capacity)
    v_max_covers := COALESCE(v_max_covers, 999999);
    v_max_parties := COALESCE(v_max_parties, 999999);
    
    -- =====================================================
    -- STEP 4: Count Existing Bookings in Same Period
    -- =====================================================
    -- Count bookings that overlap with this service period
    -- Exclude cancelled and no-show bookings
    SELECT 
        COALESCE(SUM(b.party_size), 0) as total_covers,
        COUNT(*) as total_parties
    INTO v_booked_covers, v_booked_parties
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
        AND b.booking_date = p_booking_date
        AND b.status NOT IN ('cancelled', 'no_show')
        AND (
            -- If service period exists, filter by period time range
            v_service_period_id IS NULL
            OR b.start_time >= (
                SELECT start_time FROM restaurant_service_periods WHERE id = v_service_period_id
            )
            AND b.start_time < (
                SELECT end_time FROM restaurant_service_periods WHERE id = v_service_period_id
            )
        );
    
    -- =====================================================
    -- STEP 5: Capacity Validation
    -- =====================================================
    -- Check if adding this booking would exceed capacity limits
    
    -- Check max covers (total guests)
    IF v_booked_covers + p_party_size > v_max_covers THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('Maximum capacity of %s covers exceeded. Currently booked: %s, Requested: %s',
                v_max_covers, v_booked_covers, p_party_size),
            'details', jsonb_build_object(
                'maxCovers', v_max_covers,
                'bookedCovers', v_booked_covers,
                'requestedCovers', p_party_size,
                'availableCovers', v_max_covers - v_booked_covers,
                'servicePeriod', v_service_period_name
            )
        );
    END IF;
    
    -- Check max parties (total bookings)
    IF v_booked_parties + 1 > v_max_parties THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('Maximum of %s bookings exceeded for this period. Currently booked: %s',
                v_max_parties, v_booked_parties),
            'details', jsonb_build_object(
                'maxParties', v_max_parties,
                'bookedParties', v_booked_parties,
                'availableParties', v_max_parties - v_booked_parties,
                'servicePeriod', v_service_period_name
            )
        );
    END IF;
    
    -- =====================================================
    -- STEP 6: Generate Booking Reference
    -- =====================================================
    -- Generate unique 10-character reference
    v_reference := public.generate_booking_reference();
    
    -- =====================================================
    -- STEP 7: Calculate Timestamp Fields
    -- =====================================================
    -- Get restaurant timezone
    SELECT timezone INTO v_timezone
    FROM restaurants
    WHERE id = p_restaurant_id;
    
    -- Build timestamps (start_at, end_at) with timezone
    v_start_at := make_timestamptz(
        EXTRACT(YEAR FROM p_booking_date)::int,
        EXTRACT(MONTH FROM p_booking_date)::int,
        EXTRACT(DAY FROM p_booking_date)::int,
        EXTRACT(HOUR FROM p_start_time)::int,
        EXTRACT(MINUTE FROM p_start_time)::int,
        EXTRACT(SECOND FROM p_start_time),
        v_timezone
    );
    
    v_end_at := make_timestamptz(
        EXTRACT(YEAR FROM p_booking_date)::int,
        EXTRACT(MONTH FROM p_booking_date)::int,
        EXTRACT(DAY FROM p_booking_date)::int,
        EXTRACT(HOUR FROM p_end_time)::int,
        EXTRACT(MINUTE FROM p_end_time)::int,
        EXTRACT(SECOND FROM p_end_time),
        v_timezone
    );
    
    -- =====================================================
    -- STEP 8: Create Booking Record
    -- =====================================================
    INSERT INTO bookings (
        restaurant_id,
        customer_id,
        booking_date,
        start_time,
        end_time,
        start_at,
        end_at,
        party_size,
        booking_type,
        seating_preference,
        status,
        reference,
        customer_name,
        customer_email,
        customer_phone,
        notes,
        marketing_opt_in,
        loyalty_points_awarded,
        source,
        auth_user_id,
        idempotency_key,
        details
    ) VALUES (
        p_restaurant_id,
        p_customer_id,
        p_booking_date,
        p_start_time,
        p_end_time,
        v_start_at,
        v_end_at,
        p_party_size,
        p_booking_type::booking_type,
        p_seating_preference::seating_preference_type,
        'confirmed'::booking_status,
        v_reference,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_notes,
        p_marketing_opt_in,
        p_loyalty_points_awarded,
        p_source,
        p_auth_user_id,
        p_idempotency_key,
        jsonb_build_object(
            'channel', 'api.capacity_safe',
            'client_request_id', p_client_request_id,
            'capacity_check', jsonb_build_object(
                'service_period_id', v_service_period_id,
                'max_covers', v_max_covers,
                'booked_covers_before', v_booked_covers,
                'booked_covers_after', v_booked_covers + p_party_size
            )
        ) || COALESCE(p_details, '{}'::jsonb)
    )
    RETURNING id, to_jsonb(bookings.*) INTO v_booking_id, v_booking_record;
    
    -- =====================================================
    -- STEP 9: Return Success Response
    -- =====================================================
    RETURN jsonb_build_object(
        'success', true,
        'duplicate', false,
        'booking', v_booking_record,
        'capacity', jsonb_build_object(
            'servicePeriod', v_service_period_name,
            'maxCovers', v_max_covers,
            'bookedCovers', v_booked_covers + p_party_size,
            'availableCovers', v_max_covers - (v_booked_covers + p_party_size),
            'utilizationPercent', ROUND(((v_booked_covers + p_party_size)::numeric / v_max_covers) * 100, 1)
        ),
        'message', 'Booking created successfully'
    );
    
EXCEPTION
    -- Handle specific PostgreSQL errors
    WHEN serialization_failure THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Concurrent booking conflict detected. Please retry.',
            'retryable', true
        );
    
    WHEN deadlock_detected THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Database deadlock detected. Please retry.',
            'retryable', true
        );
    
    WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Capacity rule is currently locked by another transaction. Please retry.',
            'retryable', true
        );
    
    WHEN OTHERS THEN
        -- Log unexpected errors and return generic message
        RAISE WARNING 'Unexpected error in create_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INTERNAL_ERROR',
            'message', 'An unexpected error occurred while creating the booking',
            'retryable', false,
            'sqlstate', SQLSTATE,
            'sqlerrm', SQLERRM
        );
END;
$$;

ALTER FUNCTION "public"."create_booking_with_capacity_check"(
    uuid, uuid, date, time, time, integer, text, text, text, text, text, text, boolean, text, text, uuid, text, jsonb, integer
) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."create_booking_with_capacity_check" IS 
'Race-safe booking creation with capacity enforcement. Uses SERIALIZABLE isolation and row-level locking to prevent overbooking. Returns JSONB with success/error/booking/capacity data.';

-- =====================================================
-- 3. Grant execute permission
-- =====================================================
GRANT EXECUTE ON FUNCTION "public"."create_booking_with_capacity_check"(
    uuid, uuid, date, time, time, integer, text, text, text, text, text, text, boolean, text, text, uuid, text, jsonb, integer
) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_booking_with_capacity_check"(
    uuid, uuid, date, time, time, integer, text, text, text, text, text, text, boolean, text, text, uuid, text, jsonb, integer
) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."create_booking_with_capacity_check"(
    uuid, uuid, date, time, time, integer, text, text, text, text, text, text, boolean, text, text, uuid, text, jsonb, integer
) TO "anon";

-- =====================================================
-- Migration complete
-- =====================================================
-- This RPC function is the core of the capacity engine.
-- It ensures:
-- 1. Atomic capacity checks (no race conditions)
-- 2. SERIALIZABLE isolation (prevents phantom reads)
-- 3. Row-level locking on capacity rules (FOR UPDATE NOWAIT)
-- 4. Idempotency (duplicate requests return existing booking)
-- 5. Proper error handling (serialization failures, deadlocks)
-- 6. Detailed capacity metadata in response
-- 
-- Usage from TypeScript:
-- const result = await supabase.rpc('create_booking_with_capacity_check', {
--   p_restaurant_id: '...',
--   p_customer_id: '...',
--   p_booking_date: '2025-10-20',
--   p_start_time: '19:00',
--   p_end_time: '21:00',
--   p_party_size: 4,
--   p_booking_type: 'dinner',
--   // ... other params
-- });
-- 
-- if (result.data.success) {
--   const booking = result.data.booking;
--   const capacity = result.data.capacity;
-- } else {
--   const error = result.data.error; // 'CAPACITY_EXCEEDED' | 'BOOKING_CONFLICT'
-- }
