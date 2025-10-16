-- Migration: Create Table Inventory
-- Description: Adds table_inventory table for managing physical restaurant tables
-- Story: Capacity & Availability Engine - Story 1
-- Date: 2025-10-16

-- =====================================================
-- 1. Create table_status enum
-- =====================================================
CREATE TYPE "public"."table_status" AS ENUM (
    'available',
    'reserved',
    'occupied',
    'out_of_service'
);

ALTER TYPE "public"."table_status" OWNER TO "postgres";

COMMENT ON TYPE "public"."table_status" IS 'Status of a restaurant table: available, reserved (booked), occupied (guests seated), out_of_service (maintenance)';

-- =====================================================
-- 2. Create table_inventory table
-- =====================================================
CREATE TABLE IF NOT EXISTS "public"."table_inventory" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "table_number" "text" NOT NULL,
    "capacity" integer NOT NULL,
    "min_party_size" integer DEFAULT 1 NOT NULL,
    "max_party_size" integer,
    "section" "text",
    "seating_type" "public"."seating_type" NOT NULL DEFAULT 'indoor'::"public"."seating_type",
    "status" "public"."table_status" NOT NULL DEFAULT 'available'::"public"."table_status",
    "position" jsonb,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    -- Constraints
    CONSTRAINT "table_inventory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "table_inventory_restaurant_id_table_number_key" UNIQUE ("restaurant_id", "table_number"),
    CONSTRAINT "table_inventory_valid_capacity" CHECK (("capacity" > 0 AND "min_party_size" > 0)),
    CONSTRAINT "table_inventory_valid_party_range" CHECK (("max_party_size" IS NULL OR "max_party_size" >= "min_party_size")),
    
    -- Foreign keys
    CONSTRAINT "table_inventory_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."table_inventory" OWNER TO "postgres";

COMMENT ON TABLE "public"."table_inventory" IS 'Physical restaurant tables with capacity and seating type. Used for table assignment and floor plan visualization.';

COMMENT ON COLUMN "public"."table_inventory"."table_number" IS 'Display name for the table (e.g., "T1", "Main-5", "Patio-2")';
COMMENT ON COLUMN "public"."table_inventory"."capacity" IS 'Number of seats at the table';
COMMENT ON COLUMN "public"."table_inventory"."min_party_size" IS 'Minimum party size for this table (e.g., 2-top only for parties of 2+)';
COMMENT ON COLUMN "public"."table_inventory"."max_party_size" IS 'Maximum party size for this table (optional, defaults to capacity)';
COMMENT ON COLUMN "public"."table_inventory"."section" IS 'Section name (e.g., "Main Floor", "Patio", "Bar Area", "Private Room")';
COMMENT ON COLUMN "public"."table_inventory"."seating_type" IS 'Type of seating (indoor/outdoor/bar/patio/private_room)';
COMMENT ON COLUMN "public"."table_inventory"."status" IS 'Current status: available, reserved, occupied, out_of_service';
COMMENT ON COLUMN "public"."table_inventory"."position" IS 'Floor plan position as JSON: {x: number, y: number, rotation?: number} for drag-and-drop UI';

-- =====================================================
-- 3. Create indexes
-- =====================================================
CREATE INDEX "idx_table_inventory_lookup" ON "public"."table_inventory" USING "btree" ("restaurant_id", "status", "capacity");

CREATE INDEX "idx_table_inventory_section" ON "public"."table_inventory" USING "btree" ("restaurant_id", "section");

COMMENT ON INDEX "public"."idx_table_inventory_lookup" IS 'Fast lookup for available tables by restaurant and capacity';
COMMENT ON INDEX "public"."idx_table_inventory_section" IS 'Fast filtering by section for floor plan views';

-- =====================================================
-- 4. Create updated_at trigger
-- =====================================================
CREATE TRIGGER "table_inventory_updated_at" 
    BEFORE UPDATE ON "public"."table_inventory" 
    FOR EACH ROW 
    EXECUTE FUNCTION "public"."update_updated_at"();

-- =====================================================
-- 5. Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE "public"."table_inventory" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. Create RLS Policies
-- =====================================================

-- Policy 1: Service role has full access
CREATE POLICY "Service role can manage table inventory" 
    ON "public"."table_inventory" 
    TO "service_role" 
    USING (true) 
    WITH CHECK (true);

-- Policy 2: Authenticated staff can view and manage tables for their restaurants
CREATE POLICY "Staff can manage table inventory" 
    ON "public"."table_inventory" 
    USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) 
    WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));

-- Policy 3: Public can view tables for active restaurants (for floor plan display)
-- Note: This might be removed if floor plans are staff-only
CREATE POLICY "Public can view table inventory" 
    ON "public"."table_inventory" 
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM "public"."restaurants" "r"
            WHERE "r"."id" = "table_inventory"."restaurant_id" 
                AND "r"."is_active" = true
        )
    );

-- =====================================================
-- 7. Grant permissions
-- =====================================================
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."table_inventory" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."table_inventory" TO "authenticated";
GRANT SELECT ON TABLE "public"."table_inventory" TO "anon";

-- =====================================================
-- 8. Sample seed data (optional, for testing)
-- =====================================================
-- Uncomment to add sample tables for testing
-- INSERT INTO "public"."table_inventory" ("restaurant_id", "table_number", "capacity", "min_party_size", "max_party_size", "section", "seating_type", "status", "position")
-- SELECT 
--     r.id,
--     'T' || generate_series,
--     CASE generate_series % 4
--         WHEN 0 THEN 2
--         WHEN 1 THEN 4
--         WHEN 2 THEN 6
--         ELSE 8
--     END,
--     1,
--     NULL,
--     CASE generate_series % 3
--         WHEN 0 THEN 'Main Floor'
--         WHEN 1 THEN 'Patio'
--         ELSE 'Bar Area'
--     END,
--     CASE generate_series % 3
--         WHEN 0 THEN 'indoor'::seating_type
--         WHEN 1 THEN 'outdoor'::seating_type
--         ELSE 'bar'::seating_type
--     END,
--     'available'::table_status,
--     jsonb_build_object('x', (generate_series % 10) * 100, 'y', (generate_series / 10) * 100)
-- FROM restaurants r, generate_series(1, 20)
-- WHERE r.slug = 'test-restaurant';  -- Replace with your test restaurant slug

-- =====================================================
-- Migration complete
-- =====================================================
-- Next migration: 20251016091900_create_booking_slots.sql
