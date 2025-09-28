Below is a **practical, drop‑in migration patch** that hardens security, enforces data integrity (incl. no double‑bookings), improves performance, and reduces operational risk—**plus** short rationale and verification steps.

> **What you’ll get**
>
> - Corrected regex / policy DDL that currently won’t run (the script you shared has stray `</task>` fragments and broken `DO ... EXECUTE` quoting).
> - **Row‑level‑security** kept, but **anonymous reads are limited to a safe allow‑list**.
> - **No table double‑bookings** via a GiST **exclusion constraint** (requires `btree_gist`).
> - **Cross‑restaurant isolation** enforced (same‑restaurant checks for FK pairs).
> - **Email & phone** validation tightened (no trailing-dot domains; optional `citext`).
> - **Indexes** aligned to your hot queries.
> - **Audit/analytics** partitioning scaffolding + retention hook.

---

## 5) Booking idempotency + application alignment (Sept 2025)

**What changed**

- `bookings` now persists service-generated request metadata: `client_request_id` (UUID), unique `pending_ref`, optional `idempotency_key`, plus computed timestamps `start_at`, `end_at`, and stored `slot` range.
- Supabase typings, server handlers, and email templates were updated to consume these columns directly.
- API clients (Next.js flow and the Vite wizard) send an `Idempotency-Key` header per submission; the server deduplicates retries and returns the stored `client_request_id`.
- Analytics and audit logs include the new identifiers for traceability.

**Verification checklist**

1. Apply the updated `database/database.sql` (or run `database/migrations/index.sql`) to materialise the new columns/indexes.
2. Run `npm run typecheck && npm run lint` – verifies Supabase typings and downstream imports.
3. Exercise `POST /api/bookings` twice with the same `Idempotency-Key`; confirm the second call returns `duplicate: true` and the database has a single row.
4. Confirm confirmation emails still display the correct local time (they now prefer `start_at`/`end_at`).

---

---

## 0) One‑time fixes & extensions

**Why**

- Postgres **CHECK** constraints cannot reference other tables—use triggers/other constraints instead. ([PostgreSQL][1])
- **EXCLUDE** constraints on `tsrange` need GiST; to combine with `uuid` equality you need **btree_gist** operator classes. ([PostgreSQL][2])

```sql
BEGIN;

-- Fix broken CREATE POLICY wrappers by avoiding dynamic EXECUTE entirely.
-- We'll recreate policies explicitly in §2.

-- Required extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- for EXCLUDE with = on uuid/date/time
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Optional (see §4b): case-insensitive text for email
-- CREATE EXTENSION IF NOT EXISTS citext;

COMMIT;
```

---

## 1) Correct the broken regex / constraint text and typos

Your DDL has stray `</task>` fragments inside regexes and an incomplete policy regex. The below **removes any corrupted CHECK(s)** and re‑adds clean ones, idempotently.

```sql
BEGIN;

-- 1a) Repair email domain definition (no trailing dot; modest but robust)
-- Assumes the auto-named domain check is email_address_check
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_address_check'
      AND connamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'ALTER DOMAIN public.email_address DROP CONSTRAINT email_address_check';
  END IF;

  EXECUTE $DDL$
    ALTER DOMAIN public.email_address
    ADD CONSTRAINT email_address_check
    CHECK (
      /* case-insensitive; no trailing dot; TLD 2..63 */
      VALUE ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$'
    )
  $DDL$;
END$$;

-- 1b) Repair slug/reference CHECKS that contain stray text
-- Drop any CHECKs that contain the invalid literal and re-add clean ones.

-- restaurants.slug
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.restaurants'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%</task>%'
  LOOP
    EXECUTE format('ALTER TABLE public.restaurants DROP CONSTRAINT %I', c);
  END LOOP;
END$$;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_slug_check,
  ADD  CONSTRAINT restaurants_slug_check
  CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- loyalty_programs.slug
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.loyalty_programs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%</task>%'
  LOOP
    EXECUTE format('ALTER TABLE public.loyalty_programs DROP CONSTRAINT %I', c);
  END LOOP;
END$$;

ALTER TABLE public.loyalty_programs
  DROP CONSTRAINT IF EXISTS loyalty_programs_slug_check,
  ADD  CONSTRAINT loyalty_programs_slug_check
  CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- bookings.reference
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%</task>%'
  LOOP
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', c);
  END LOOP;
END$$;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_reference_format,
  ADD  CONSTRAINT bookings_reference_format
  CHECK (reference ~ '^[A-Z0-9]{10}$');

COMMIT;
```

---

## 2) Security hardening (RLS stays; anonymous reads restricted)

**Why**
RLS is enforced **in addition to** GRANTs; enabling RLS without a matching policy **denies** row access even if `SELECT` is granted. We’ll keep RLS but **revoke broad anon grants** and re‑grant only safe public tables. ([PostgreSQL][3])

```sql
BEGIN;

-- 2a) Revoke broad anon privileges
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE USAGE, SELECT              ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Prevent future auto-grants to anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM anon;

-- 2b) Public (anonymous) reads allowed ONLY for metadata tables
GRANT SELECT ON public.restaurants,
                 public.restaurant_areas,
                 public.restaurant_tables,
                 public.availability_rules
TO anon;

-- 2c) Re-create explicit, readable policies (no brittle dynamic EXECUTE)

-- Public read policies (anon + authenticated)
DROP POLICY IF EXISTS "Public read restaurants"        ON public.restaurants;
CREATE POLICY "Public read restaurants"
  ON public.restaurants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read restaurant_areas"   ON public.restaurant_areas;
CREATE POLICY "Public read restaurant_areas"
  ON public.restaurant_areas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read restaurant_tables"  ON public.restaurant_tables;
CREATE POLICY "Public read restaurant_tables"
  ON public.restaurant_tables FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read availability_rules" ON public.availability_rules;
CREATE POLICY "Public read availability_rules"
  ON public.availability_rules FOR SELECT USING (true);

-- Tenant-scoped reads (authenticated only)
DROP POLICY IF EXISTS "Tenant read bookings"          ON public.bookings;
CREATE POLICY "Tenant read bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (public.tenant_permitted(restaurant_id));

DROP POLICY IF EXISTS "Tenant read customers"         ON public.customers;
CREATE POLICY "Tenant read customers"
  ON public.customers FOR SELECT TO authenticated
  USING (public.tenant_permitted(restaurant_id));

DROP POLICY IF EXISTS "Tenant read customer_profiles" ON public.customer_profiles;
CREATE POLICY "Tenant read customer_profiles"
  ON public.customer_profiles FOR SELECT TO authenticated
  USING (
    public.tenant_permitted(
      (SELECT restaurant_id FROM public.customers c WHERE c.id = customer_profiles.customer_id)
    )
  );

DROP POLICY IF EXISTS "Tenant read loyalty_programs"   ON public.loyalty_programs;
CREATE POLICY "Tenant read loyalty_programs"
  ON public.loyalty_programs FOR SELECT TO authenticated
  USING (public.tenant_permitted(restaurant_id));

DROP POLICY IF EXISTS "Tenant read loyalty_points"     ON public.loyalty_points;
CREATE POLICY "Tenant read loyalty_points"
  ON public.loyalty_points FOR SELECT TO authenticated
  USING (
    public.tenant_permitted(
      (SELECT restaurant_id FROM public.loyalty_programs lp WHERE lp.id = loyalty_points.program_id)
    )
  );

DROP POLICY IF EXISTS "Tenant read loyalty_point_events" ON public.loyalty_point_events;
CREATE POLICY "Tenant read loyalty_point_events"
  ON public.loyalty_point_events FOR SELECT TO authenticated
  USING (
    public.tenant_permitted(
      (SELECT restaurant_id FROM public.loyalty_programs lp WHERE lp.id = loyalty_point_events.program_id)
    )
  );

DROP POLICY IF EXISTS "Tenant read analytics_events" ON public.analytics_events;
CREATE POLICY "Tenant read analytics_events"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (public.tenant_permitted(restaurant_id));

DROP POLICY IF EXISTS "Tenant read audit_logs"        ON public.audit_logs;
CREATE POLICY "Tenant read audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    CASE
      WHEN coalesce(metadata, '{}'::jsonb) ? 'restaurant_id' THEN
        CASE
          WHEN (coalesce(metadata, '{}'::jsonb) ->> 'restaurant_id')
               ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN public.tenant_permitted((metadata ->> 'restaurant_id')::uuid)
          WHEN coalesce(metadata, '{}'::jsonb) ->> 'restaurant_id' = '' THEN true
          ELSE false
        END
      ELSE true
    END
  );

COMMIT;
```

> **Optional**: If you can, move `public.tenant_permitted()` into a dedicated `sec` schema and **only grant EXECUTE** to `authenticated` + `service_role` (not `anon`). JWT‑based checks are fine, but consider a future-proof join to a membership table instead of hard‑coding claim shapes.

---

## 3) Data integrity & business rules

### 3a) Prevent double‑booking (with a single table)

**Why**
Use a **GiST EXCLUDE** to forbid overlapping time ranges for the **same table**; equality on `uuid` in GiST requires `btree_gist`. Also enforce `end_time > start_time`. ([PostgreSQL][2])

```sql
BEGIN;

-- Ensure coherent intervals
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_time_order,
  ADD  CONSTRAINT bookings_time_order
  CHECK (end_time > start_time);

-- Build a generated tsrange for clarity (optional, but helpful for queries)
ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS time_slot,
  ADD COLUMN time_slot tsrange GENERATED ALWAYS AS (
    tsrange(
      (booking_date::timestamp + start_time),
      (booking_date::timestamp + end_time),
      '[)'    -- start inclusive, end exclusive: back-to-back is OK
    )
  ) STORED;

-- Exclude overlapping bookings for the same table, only when table_id is set
-- and when status blocks the slot (confirmed or pending)
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS no_table_overlap,
  ADD  CONSTRAINT no_table_overlap
  EXCLUDE USING gist (
    table_id WITH =,
    time_slot WITH &&
  )
  WHERE (table_id IS NOT NULL AND status IN ('confirmed','pending'));

COMMIT;
```

> If you allow **“pending_allocation”** rows with `table_id IS NULL`, they won’t block; the constraint is scoped with `WHERE (table_id IS NOT NULL ...)`.

### 3b) Enforce same‑restaurant across relations

**Why**
You cannot write a `CHECK` that queries other tables; use **triggers** or restructure FKs. We’ll add **lightweight BEFORE triggers** that fail fast if a referenced row belongs to another restaurant. ([PostgreSQL][1])

```sql
BEGIN;

-- bookings: (customer_id, table_id) must belong to bookings.restaurant_id
CREATE OR REPLACE FUNCTION public.ensure_booking_same_restaurant()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cust_rest uuid;
  tbl_rest  uuid;
BEGIN
  SELECT restaurant_id INTO cust_rest FROM public.customers c WHERE c.id = NEW.customer_id;
  IF cust_rest IS NULL OR cust_rest <> NEW.restaurant_id THEN
    RAISE EXCEPTION 'customer % does not belong to restaurant %', NEW.customer_id, NEW.restaurant_id;
  END IF;

  IF NEW.table_id IS NOT NULL THEN
    SELECT restaurant_id INTO tbl_rest FROM public.restaurant_tables t WHERE t.id = NEW.table_id;
    IF tbl_rest IS NULL OR tbl_rest <> NEW.restaurant_id THEN
      RAISE EXCEPTION 'table % does not belong to restaurant %', NEW.table_id, NEW.restaurant_id;
    END IF;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_bookings_same_restaurant ON public.bookings;
CREATE TRIGGER trg_bookings_same_restaurant
BEFORE INSERT OR UPDATE OF restaurant_id, customer_id, table_id
ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.ensure_booking_same_restaurant();


-- restaurant_tables: area must be from the same restaurant
CREATE OR REPLACE FUNCTION public.ensure_table_area_same_restaurant()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  area_rest uuid;
BEGIN
  IF NEW.area_id IS NOT NULL THEN
    SELECT restaurant_id INTO area_rest FROM public.restaurant_areas a WHERE a.id = NEW.area_id;
    IF area_rest IS NULL OR area_rest <> NEW.restaurant_id THEN
      RAISE EXCEPTION 'area % does not belong to restaurant %', NEW.area_id, NEW.restaurant_id;
    END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_tables_area_check ON public.restaurant_tables;
CREATE TRIGGER trg_tables_area_check
BEFORE INSERT OR UPDATE OF restaurant_id, area_id
ON public.restaurant_tables
FOR EACH ROW EXECUTE FUNCTION public.ensure_table_area_same_restaurant();


-- reviews: booking must be from the same restaurant
CREATE OR REPLACE FUNCTION public.ensure_review_same_restaurant()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  b_rest uuid;
BEGIN
  IF NEW.booking_id IS NOT NULL THEN
    SELECT restaurant_id INTO b_rest FROM public.bookings b WHERE b.id = NEW.booking_id;
    IF b_rest IS NULL OR b_rest <> NEW.restaurant_id THEN
      RAISE EXCEPTION 'booking % does not belong to restaurant %', NEW.booking_id, NEW.restaurant_id;
    END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_reviews_same_restaurant ON public.reviews;
CREATE TRIGGER trg_reviews_same_restaurant
BEFORE INSERT OR UPDATE OF restaurant_id, booking_id
ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.ensure_review_same_restaurant();


-- loyalty_points: customer & program must target the same restaurant
CREATE OR REPLACE FUNCTION public.ensure_loyalty_same_restaurant()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  p_rest uuid;
  c_rest uuid;
BEGIN
  SELECT restaurant_id INTO p_rest FROM public.loyalty_programs p WHERE p.id = NEW.program_id;
  SELECT restaurant_id INTO c_rest FROM public.customers        c WHERE c.id = NEW.customer_id;
  IF p_rest IS NULL OR c_rest IS NULL OR p_rest <> c_rest THEN
    RAISE EXCEPTION 'program % and customer % belong to different restaurants', NEW.program_id, NEW.customer_id;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_loyalty_points_same_restaurant ON public.loyalty_points;
CREATE TRIGGER trg_loyalty_points_same_restaurant
BEFORE INSERT OR UPDATE OF program_id, customer_id
ON public.loyalty_points
FOR EACH ROW EXECUTE FUNCTION public.ensure_loyalty_same_restaurant();

COMMIT;
```

---

## 4) Data quality: email & phone

### 4a) Email: keep it simple and strict enough

- Domain fixed in §1 (rejects trailing dots).
- You’re already normalizing to lowercase and ensuring `email = lower(email)`; keep that.

**Alternative (optional): use `citext` + unique**—case‑insensitive by type, simplifies uniqueness. ([PostgreSQL][4])

```sql
-- OPTIONAL: switch customers.email to citext (if you want case-insensitive type)
-- ALTER TABLE public.customers ALTER COLUMN email TYPE citext;
-- Adjust dependent generated column if needed.
```

### 4b) Phone numbers: prefer **E.164** at write time

Database‑side regex can only do so much; consider normalizing to **E.164** (`+` and up to 15 digits). If you store a canonical `phone_e164`, enforce:

```sql
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD CONSTRAINT customers_phone_e164_format
    CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9]\d{1,14}$');
```

E.164 itself caps numbers at **15 digits**; the regex above is the standard basic screen. ([Wikipedia][5])

---

## 5) Performance & scalability

### 5a) Targeted composite indexes (align with your query patterns)

```sql
BEGIN;

-- Availability / search-by-day
CREATE INDEX IF NOT EXISTS bookings_rest_date_start_idx
  ON public.bookings (restaurant_id, booking_date, start_time)
  INCLUDE (end_time, status, party_size, seating_preference, id);

-- Back-office list: status over day
CREATE INDEX IF NOT EXISTS bookings_rest_status_date_idx
  ON public.bookings (restaurant_id, status, booking_date DESC);

-- Waitlist operations
CREATE INDEX IF NOT EXISTS waiting_list_rest_status_date_idx
  ON public.waiting_list (restaurant_id, status, booking_date);

-- Customer lookups by phone (you already have email)
CREATE INDEX IF NOT EXISTS customers_rest_phone_idx
  ON public.customers (restaurant_id, phone_normalized);

-- Analytics/events by booking (joins)
CREATE INDEX IF NOT EXISTS analytics_events_booking_idx
  ON public.analytics_events (booking_id);

-- Loyalty events by program+customer
CREATE INDEX IF NOT EXISTS loyalty_point_events_prog_cust_idx
  ON public.loyalty_point_events (program_id, customer_id, occurred_at DESC);

COMMIT;
```

> **Note on UUID PKs**: they’re fine here. If you ever see write‑amplification, consider **v7‑style ordered UUIDs** or a short surrogate bigserial in hot join tables; not urgent.

---

## 6) Operational safety: audit & analytics growth

- Convert **audit_logs** (and optionally **analytics_events**, **stripe_events**) to **monthly partitions**; attach a simple retention job (drop partitions older than N months).
- Below is **forward‑only** scaffolding—migrates _new_ writes; you can backfill later.

```sql
BEGIN;

-- New partitioned parent (keep columns identical)
CREATE TABLE IF NOT EXISTS public.audit_logs_v2 (
  LIKE public.audit_logs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Current month partition
CREATE TABLE IF NOT EXISTS public.audit_logs_y2025m09
  PARTITION OF public.audit_logs_v2
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- Route new inserts: replace writer to target v2 (application or trigger)
-- (If you need a routing trigger from audit_logs -> v2, add it; or swap tables)
-- Example: make a view for stable name
DROP VIEW IF EXISTS public.audit_logs_view;
CREATE VIEW public.audit_logs_view AS SELECT * FROM public.audit_logs_v2;

COMMIT;
```

> Add a monthly job to `CREATE TABLE ... PARTITION OF ... FOR VALUES FROM (...) TO (...)` and a retention job to `DROP TABLE` old partitions (policy-dependent).

---

## 7) Post‑migration verification (quick checks)

```sql
-- RLS: anon can read only public tables
SET ROLE anon;
SELECT count(*) FROM public.restaurants;          -- ok
SELECT count(*) FROM public.customers;            -- 0 rows (denied by RLS)
RESET ROLE;

-- Overlap test (should fail):
INSERT INTO public.bookings (restaurant_id, customer_id, table_id, booking_date, start_time, end_time,
  party_size, status, customer_name, customer_email, customer_phone)
SELECT r.id, c.id, t.id, CURRENT_DATE, '18:00', '19:00', 2, 'confirmed',
       'T', 't@example.com', '+15550000000'
FROM restaurants r
JOIN restaurant_tables t ON t.restaurant_id = r.id
JOIN customers c ON c.restaurant_id = r.id
LIMIT 1;

-- Try to insert overlapping booking on same table and time
-- (Should raise exclusion violation)
-- Repeat with 18:30..19:30 => expect error

-- Same-restaurant guard (should error if mismatched)
-- Try to set bookings.table_id from another restaurant => expect error.

-- Email rule (invalid: trailing dot)
SELECT 'test@domain.'::public.email_address;  -- should fail

-- Phone E.164 (if you added the column)
INSERT INTO public.customers (..., phone_e164) VALUES (..., '+0123');  -- should fail
```

---

## 8) Notes, trade‑offs & alternatives

- **Why not a CHECK to enforce cross-restaurant?** Postgres **does not** support checks that read other tables; use **triggers** or redesign FKs (denormalize `restaurant_id` everywhere and use composite FKs—but `ON DELETE SET NULL` becomes awkward). ([PostgreSQL][1])
- **Exclusion constraint details**
  - We mark intervals `[start, end)` to allow **back‑to‑back** bookings. Use `'[]'` if you want end‑points considered overlapping. ([Redgate Software][6])
  - `btree_gist` is necessary to combine `uuid` equality with a range GiST in the same EXCLUDE. ([PostgreSQL][7])

- **RLS & GRANTs** are complementary; with RLS enabled, **no policy = no rows**, regardless of GRANTs. ([PostgreSQL][3])
- **Email validation** in SQL should be **pragmatic**; true RFC compliance is huge. Consider app‑side libraries for deeper checks.
- **Phones**: DB regex validates format only; country/line validity needs a library or API (e.g., libphonenumber/Twilio Lookup). The E.164 regex is only a **baseline**. ([Twilio][8])

---

### That’s it—apply sections 0→7 in order.

If you want, I can also produce a **single consolidated SQL file** tailored to your environment (e.g., swap to `citext`, add a routing trigger to move `audit_logs` writes automatically, or adopt ordered UUIDs).

[1]: https://www.postgresql.org/docs/current/ddl-constraints.html?utm_source=chatgpt.com 'Documentation: 17: 5.5. Constraints'
[2]: https://www.postgresql.org/docs/current/rangetypes.html?utm_source=chatgpt.com 'Documentation: 17: 8.17. Range Types'
[3]: https://www.postgresql.org/docs/current/ddl-rowsecurity.html?utm_source=chatgpt.com 'Documentation: 17: 5.9. Row Security Policies'
[4]: https://www.postgresql.org/docs/current/citext.html?utm_source=chatgpt.com '17: F.9. citext — a case-insensitive character string type'
[5]: https://en.wikipedia.org/wiki/E.164?utm_source=chatgpt.com 'E.164'
[6]: https://www.red-gate.com/simple-talk/?p=104588&utm_source=chatgpt.com 'Overlapping Ranges in Subsets in PostgreSQL - Simple Talk'
[7]: https://www.postgresql.org/docs/current/btree-gist.html?utm_source=chatgpt.com 'F.8. btree_gist — GiST operator classes with B-tree behavior'
[8]: https://www.twilio.com/docs/glossary/what-e164?utm_source=chatgpt.com 'What is E.164?'
