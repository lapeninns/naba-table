# SajiloReserveX - Database Schema Documentation

**Version:** 1.0  
**Date:** 2025-01-15  
**Database:** PostgreSQL (Supabase)

---

## Table of Contents

1. [Entity Relationship Diagram](#entity-relationship-diagram)
2. [Core Tables](#core-tables)
3. [Enums & Types](#enums--types)
4. [Indexes & Performance](#indexes--performance)
5. [Triggers & Functions](#triggers--functions)
6. [Row-Level Security](#row-level-security)
7. [Data Integrity](#data-integrity)
8. [Migration History](#migration-history)

---

## Entity Relationship Diagram

### Complete ERD

```mermaid
erDiagram
    restaurants ||--o{ bookings : has
    restaurants ||--o{ customers : has
    restaurants ||--o{ restaurant_memberships : has
    restaurants ||--o{ restaurant_operating_hours : defines
    restaurants ||--o{ restaurant_service_periods : defines
    restaurants ||--o{ loyalty_programs : has
    restaurants ||--o{ loyalty_points : tracks

    customers ||--o{ bookings : makes
    customers ||--o{ customer_profiles : has
    customers ||--o{ loyalty_points : earns

    bookings ||--o{ booking_versions : audited_by
    bookings ||--o{ booking_confirmation_tokens : has
    bookings ||--o{ loyalty_point_events : generates

    profiles ||--o{ restaurant_memberships : member_of

    loyalty_programs ||--o{ loyalty_point_events : defines

    restaurants {
        uuid id PK
        text name
        text slug UK
        text timezone
        text address
        text contact_email
        text contact_phone
        text booking_policy
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    bookings {
        uuid id PK
        uuid restaurant_id FK
        uuid customer_id FK
        date booking_date
        time start_time
        time end_time
        timestamptz start_at
        timestamptz end_at
        int party_size
        booking_status status
        booking_type booking_type
        seating_preference_type seating_preference
        text customer_name
        text customer_email
        text customer_phone
        text notes
        text reference UK
        text source
        text idempotency_key UK
        text client_request_id UK
        jsonb details
        boolean marketing_opt_in
        int loyalty_points_awarded
        timestamptz created_at
        timestamptz updated_at
    }

    customers {
        uuid id PK
        uuid restaurant_id FK
        text full_name
        text email
        text phone
        text email_normalized
        text phone_normalized
        boolean marketing_opt_in
        uuid auth_user_id FK
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    customer_profiles {
        uuid customer_id PK_FK
        timestamptz first_booking_at
        timestamptz last_booking_at
        int total_bookings
        int total_covers
        int total_cancellations
        boolean marketing_opt_in
        timestamptz last_marketing_opt_in_at
        jsonb preferences
        text notes
        timestamptz updated_at
    }

    profiles {
        uuid id PK
        text email
        text name
        text phone
        text image
        timestamptz created_at
        timestamptz updated_at
    }

    restaurant_memberships {
        uuid user_id PK_FK
        uuid restaurant_id PK_FK
        text role
        timestamptz created_at
    }

    booking_versions {
        uuid version_id PK
        uuid booking_id FK
        uuid restaurant_id FK
        booking_change_type change_type
        text changed_by
        timestamptz changed_at
        jsonb old_data
        jsonb new_data
        timestamptz created_at
    }

    booking_confirmation_tokens {
        uuid id PK
        uuid booking_id FK
        text token UK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }

    loyalty_programs {
        uuid id PK
        uuid restaurant_id FK
        text name
        boolean is_active
        jsonb accrual_rule
        jsonb tier_definitions
        boolean pilot_only
        timestamptz created_at
        timestamptz updated_at
    }

    loyalty_points {
        uuid id PK
        uuid restaurant_id FK
        uuid customer_id FK
        int total_points
        loyalty_tier tier
        timestamptz created_at
        timestamptz updated_at
    }

    loyalty_point_events {
        uuid id PK
        uuid restaurant_id FK
        uuid customer_id FK
        uuid booking_id FK
        int points_change
        text event_type
        int schema_version
        jsonb metadata
        timestamptz created_at
    }

    restaurant_operating_hours {
        uuid id PK
        uuid restaurant_id FK
        smallint day_of_week
        date effective_date
        time opens_at
        time closes_at
        boolean is_closed
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    restaurant_service_periods {
        uuid id PK
        uuid restaurant_id FK
        text name
        smallint day_of_week
        time start_time
        time end_time
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## Core Tables

### Table: restaurants

**Purpose:** Store restaurant/venue information

| Column         | Type        | Constraints                       | Description             |
| -------------- | ----------- | --------------------------------- | ----------------------- |
| id             | uuid        | PK, DEFAULT uuid_generate_v4()    | Unique identifier       |
| name           | text        | NOT NULL                          | Restaurant name         |
| slug           | text        | UNIQUE, NOT NULL                  | URL-friendly identifier |
| timezone       | text        | DEFAULT 'Europe/London', NOT NULL | IANA timezone           |
| address        | text        |                                   | Physical address        |
| contact_email  | text        |                                   | Contact email           |
| contact_phone  | text        |                                   | Contact phone           |
| booking_policy | text        |                                   | Policy text for guests  |
| is_active      | boolean     | DEFAULT true, NOT NULL            | Active status           |
| created_at     | timestamptz | DEFAULT now(), NOT NULL           | Creation timestamp      |
| updated_at     | timestamptz | DEFAULT now(), NOT NULL           | Last update timestamp   |

**Indexes:**

- `idx_restaurants_active` ON (is_active)
- `idx_restaurants_slug` ON (slug)

**Sample Data:**

```sql
INSERT INTO restaurants (name, slug, timezone, address, is_active) VALUES
('Bella Vista', 'bella-vista', 'Europe/London', '123 Main St, London', true),
('Le Bistro', 'le-bistro', 'Europe/Paris', '45 Rue de la Paix, Paris', true);
```

---

### Table: bookings

**Purpose:** Store all reservation records

| Column                 | Type                    | Constraints                               | Description            |
| ---------------------- | ----------------------- | ----------------------------------------- | ---------------------- |
| id                     | uuid                    | PK, DEFAULT uuid_generate_v4()            | Unique identifier      |
| restaurant_id          | uuid                    | FK → restaurants(id), NOT NULL            | Restaurant reference   |
| customer_id            | uuid                    | FK → customers(id), NOT NULL              | Customer reference     |
| booking_date           | date                    | NOT NULL                                  | Date of booking        |
| start_time             | time                    | NOT NULL                                  | Start time (local)     |
| end_time               | time                    | NOT NULL                                  | End time (local)       |
| start_at               | timestamptz             |                                           | Computed instant (UTC) |
| end_at                 | timestamptz             |                                           | Computed instant (UTC) |
| party_size             | int                     | NOT NULL, CHECK (party_size > 0)          | Number of guests       |
| status                 | booking_status          | DEFAULT 'confirmed', NOT NULL             | Booking status         |
| booking_type           | booking_type            | DEFAULT 'dinner', NOT NULL                | Meal type              |
| seating_preference     | seating_preference_type | DEFAULT 'any', NOT NULL                   | Seating preference     |
| customer_name          | text                    | NOT NULL                                  | Guest name             |
| customer_email         | text                    | NOT NULL                                  | Guest email            |
| customer_phone         | text                    | NOT NULL                                  | Guest phone            |
| notes                  | text                    |                                           | Special requests       |
| reference              | text                    | UNIQUE, NOT NULL                          | 10-char reference code |
| source                 | text                    | DEFAULT 'web', NOT NULL                   | Booking source         |
| idempotency_key        | text                    | UNIQUE (per restaurant)                   | Idempotency key        |
| client_request_id      | text                    | DEFAULT gen_random_uuid()::text, NOT NULL | Request tracking ID    |
| details                | jsonb                   |                                           | Additional metadata    |
| marketing_opt_in       | boolean                 | DEFAULT false, NOT NULL                   | Marketing consent      |
| loyalty_points_awarded | int                     | DEFAULT 0                                 | Points awarded         |
| created_at             | timestamptz             | DEFAULT now(), NOT NULL                   | Creation timestamp     |
| updated_at             | timestamptz             | DEFAULT now(), NOT NULL                   | Last update timestamp  |

**Constraints:**

- `chk_time_order` CHECK (start_at < end_at)
- `bookings_idem_unique_per_restaurant` UNIQUE (restaurant_id, idempotency_key) WHERE idempotency_key IS NOT NULL
- `bookings_client_request_unique` UNIQUE (restaurant_id, client_request_id)

**Indexes:**

- `idx_bookings_restaurant_date` ON (restaurant_id, booking_date)
- `idx_bookings_customer_email` ON (customer_email)
- `idx_bookings_status` ON (status)
- `idx_bookings_start_at` ON (start_at)
- `idx_bookings_reference` ON (reference)

**Triggers:**

- `set_booking_instants` BEFORE INSERT OR UPDATE: Compute start_at/end_at from date+time+timezone
- `set_booking_reference` BEFORE INSERT: Generate unique reference if empty
- `update_bookings_updated_at` BEFORE UPDATE: Update updated_at timestamp

**Sample Data:**

```sql
INSERT INTO bookings (
    restaurant_id, customer_id, booking_date, start_time, end_time,
    party_size, status, customer_name, customer_email, customer_phone, reference
) VALUES (
    '...', '...', '2025-01-25', '19:00', '21:00',
    4, 'confirmed', 'John Smith', 'john@example.com', '+44 7700 900123', 'ABC123XYZ9'
);
```

---

### Table: customers

**Purpose:** Store customer records per restaurant

| Column           | Type        | Constraints                            | Description                    |
| ---------------- | ----------- | -------------------------------------- | ------------------------------ |
| id               | uuid        | PK, DEFAULT uuid_generate_v4()         | Unique identifier              |
| restaurant_id    | uuid        | FK → restaurants(id), NOT NULL         | Restaurant reference           |
| full_name        | text        | NOT NULL                               | Full name                      |
| email            | text        | NOT NULL, CHECK (email = lower(email)) | Email (lowercase)              |
| phone            | text        | NOT NULL, CHECK (length ≥ 7 AND ≤ 20)  | Phone number                   |
| email_normalized | text        | GENERATED, STORED                      | Normalized email               |
| phone_normalized | text        | GENERATED, STORED                      | Normalized phone (digits only) |
| marketing_opt_in | boolean     | DEFAULT false, NOT NULL                | Marketing consent              |
| auth_user_id     | uuid        | FK → profiles(id)                      | Linked auth user               |
| notes            | text        |                                        | Staff notes                    |
| created_at       | timestamptz | DEFAULT now(), NOT NULL                | Creation timestamp             |
| updated_at       | timestamptz | DEFAULT now(), NOT NULL                | Last update timestamp          |

**Indexes:**

- `idx_customers_restaurant_email` ON (restaurant_id, email_normalized)
- `idx_customers_restaurant_phone` ON (restaurant_id, phone_normalized)
- `idx_customers_auth_user` ON (auth_user_id)

**Sample Data:**

```sql
INSERT INTO customers (restaurant_id, full_name, email, phone, marketing_opt_in) VALUES
('...', 'John Smith', 'john@example.com', '+44 7700 900123', true);
```

---

### Table: customer_profiles

**Purpose:** Aggregated customer metrics per restaurant

| Column                   | Type        | Constraints                      | Description             |
| ------------------------ | ----------- | -------------------------------- | ----------------------- |
| customer_id              | uuid        | PK, FK → customers(id)           | Customer reference      |
| first_booking_at         | timestamptz |                                  | First booking timestamp |
| last_booking_at          | timestamptz |                                  | Most recent booking     |
| total_bookings           | int         | DEFAULT 0, NOT NULL, CHECK (≥ 0) | Total bookings count    |
| total_covers             | int         | DEFAULT 0, NOT NULL, CHECK (≥ 0) | Total guests served     |
| total_cancellations      | int         | DEFAULT 0, NOT NULL, CHECK (≥ 0) | Cancellation count      |
| marketing_opt_in         | boolean     | DEFAULT false, NOT NULL          | Current consent status  |
| last_marketing_opt_in_at | timestamptz |                                  | Last consent change     |
| preferences              | jsonb       | DEFAULT '{}', NOT NULL           | Customer preferences    |
| notes                    | text        |                                  | Aggregated notes        |
| updated_at               | timestamptz | DEFAULT now(), NOT NULL          | Last update timestamp   |

**Indexes:**

- `idx_customer_profiles_total_bookings` ON (total_bookings DESC)
- `idx_customer_profiles_last_booking` ON (last_booking_at DESC)

---

### Table: profiles

**Purpose:** User account profiles (linked to auth.users)

| Column     | Type        | Constraints                  | Description           |
| ---------- | ----------- | ---------------------------- | --------------------- |
| id         | uuid        | PK (from auth.users.id)      | User ID               |
| email      | text        | CHECK (email = lower(email)) | Email (lowercase)     |
| name       | text        |                              | Display name          |
| phone      | text        |                              | Phone number          |
| image      | text        |                              | Avatar URL            |
| created_at | timestamptz | DEFAULT now(), NOT NULL      | Creation timestamp    |
| updated_at | timestamptz | DEFAULT now(), NOT NULL      | Last update timestamp |

**Indexes:**

- `idx_profiles_email` ON (email)

---

### Table: restaurant_memberships

**Purpose:** Team access control (RBAC)

| Column        | Type        | Constraints                                                     | Description          |
| ------------- | ----------- | --------------------------------------------------------------- | -------------------- |
| user_id       | uuid        | PK, FK → profiles(id)                                           | User reference       |
| restaurant_id | uuid        | PK, FK → restaurants(id)                                        | Restaurant reference |
| role          | text        | NOT NULL, CHECK (role IN ('owner', 'admin', 'staff', 'viewer')) | Access role          |
| created_at    | timestamptz | DEFAULT now(), NOT NULL                                         | Membership start     |

**Composite Primary Key:** (user_id, restaurant_id)

**Indexes:**

- `idx_memberships_user` ON (user_id)
- `idx_memberships_restaurant` ON (restaurant_id)

**Role Hierarchy:**

- **owner:** Full control (all operations)
- **admin:** High access (bookings, settings, team invites)
- **staff:** Standard access (bookings, customers)
- **viewer:** Read-only access

---

### Table: booking_versions

**Purpose:** Audit trail for all booking changes

| Column        | Type                | Constraints                         | Description             |
| ------------- | ------------------- | ----------------------------------- | ----------------------- |
| version_id    | uuid                | PK, DEFAULT uuid_generate_v4()      | Version ID              |
| booking_id    | uuid                | FK → bookings(id) ON DELETE CASCADE | Booking reference       |
| restaurant_id | uuid                | FK → restaurants(id), NOT NULL      | Restaurant reference    |
| change_type   | booking_change_type | NOT NULL                            | Type of change          |
| changed_by    | text                |                                     | Actor email/identifier  |
| changed_at    | timestamptz         | DEFAULT now(), NOT NULL             | Change timestamp        |
| old_data      | jsonb               |                                     | Previous state snapshot |
| new_data      | jsonb               |                                     | New state snapshot      |
| created_at    | timestamptz         | DEFAULT now(), NOT NULL             | Record creation         |

**Indexes:**

- `idx_booking_versions_booking_id` ON (booking_id)
- `idx_booking_versions_changed_at` ON (changed_at DESC)

---

### Table: booking_confirmation_tokens

**Purpose:** One-time confirmation tokens for guest access

| Column     | Type        | Constraints                           | Description                      |
| ---------- | ----------- | ------------------------------------- | -------------------------------- |
| id         | uuid        | PK, DEFAULT uuid_generate_v4()        | Token ID                         |
| booking_id | uuid        | FK → bookings(id) ON DELETE CASCADE   | Booking reference                |
| token      | text        | UNIQUE, NOT NULL, CHECK (length = 64) | 64-char token                    |
| expires_at | timestamptz | NOT NULL                              | Expiry timestamp                 |
| used_at    | timestamptz |                                       | Usage timestamp (NULL if unused) |
| created_at | timestamptz | DEFAULT now(), NOT NULL               | Creation timestamp               |

**Indexes:**

- `idx_confirmation_tokens_token` ON (token)
- `idx_confirmation_tokens_expires_at` ON (expires_at)
- `idx_confirmation_tokens_booking_id` ON (booking_id)

**Usage:**

- Generated on booking creation
- 1-hour expiry by default
- Single-use (used_at marked after first access)

---

### Table: loyalty_programs

**Purpose:** Loyalty program configuration per restaurant

| Column           | Type        | Constraints                    | Description           |
| ---------------- | ----------- | ------------------------------ | --------------------- |
| id               | uuid        | PK, DEFAULT uuid_generate_v4() | Program ID            |
| restaurant_id    | uuid        | FK → restaurants(id), NOT NULL | Restaurant reference  |
| name             | text        | NOT NULL                       | Program name          |
| is_active        | boolean     | DEFAULT true, NOT NULL         | Active status         |
| accrual_rule     | jsonb       | NOT NULL                       | Point accrual formula |
| tier_definitions | jsonb       | NOT NULL                       | Tier thresholds       |
| pilot_only       | boolean     | DEFAULT false, NOT NULL        | Pilot program flag    |
| created_at       | timestamptz | DEFAULT now(), NOT NULL        | Creation timestamp    |
| updated_at       | timestamptz | DEFAULT now(), NOT NULL        | Last update timestamp |

**Accrual Rule Structure:**

```json
{
  "type": "per_guest",
  "base_points": 10,
  "points_per_guest": 5,
  "minimum_party_size": 1
}
```

**Tier Definitions Structure:**

```json
[
  { "tier": "bronze", "min_points": 0 },
  { "tier": "silver", "min_points": 100 },
  { "tier": "gold", "min_points": 250 },
  { "tier": "platinum", "min_points": 500 }
]
```

---

### Table: loyalty_points

**Purpose:** Customer loyalty point balances

| Column        | Type         | Constraints                    | Description           |
| ------------- | ------------ | ------------------------------ | --------------------- |
| id            | uuid         | PK, DEFAULT uuid_generate_v4() | Record ID             |
| restaurant_id | uuid         | FK → restaurants(id), NOT NULL | Restaurant reference  |
| customer_id   | uuid         | FK → customers(id), NOT NULL   | Customer reference    |
| total_points  | int          | DEFAULT 0, NOT NULL            | Point balance         |
| tier          | loyalty_tier | DEFAULT 'bronze', NOT NULL     | Current tier          |
| created_at    | timestamptz  | DEFAULT now(), NOT NULL        | Creation timestamp    |
| updated_at    | timestamptz  | DEFAULT now(), NOT NULL        | Last update timestamp |

**Composite Unique:** (restaurant_id, customer_id)

---

### Table: loyalty_point_events

**Purpose:** Loyalty point transaction log

| Column         | Type        | Constraints                    | Description                       |
| -------------- | ----------- | ------------------------------ | --------------------------------- |
| id             | uuid        | PK, DEFAULT uuid_generate_v4() | Event ID                          |
| restaurant_id  | uuid        | FK → restaurants(id), NOT NULL | Restaurant reference              |
| customer_id    | uuid        | FK → customers(id), NOT NULL   | Customer reference                |
| booking_id     | uuid        | FK → bookings(id)              | Booking reference (if applicable) |
| points_change  | int         | NOT NULL                       | Point delta (+/-)                 |
| event_type     | text        | NOT NULL                       | Event type                        |
| schema_version | int         | DEFAULT 1, NOT NULL            | Schema version                    |
| metadata       | jsonb       |                                | Additional data                   |
| created_at     | timestamptz | DEFAULT now(), NOT NULL        | Event timestamp                   |

**Indexes:**

- `idx_loyalty_events_customer` ON (customer_id, created_at DESC)
- `idx_loyalty_events_booking` ON (booking_id)

---

### Table: restaurant_operating_hours

**Purpose:** Restaurant weekly hours and date overrides

| Column         | Type        | Constraints                    | Description                       |
| -------------- | ----------- | ------------------------------ | --------------------------------- |
| id             | uuid        | PK, DEFAULT uuid_generate_v4() | Record ID                         |
| restaurant_id  | uuid        | FK → restaurants(id), NOT NULL | Restaurant reference              |
| day_of_week    | smallint    | CHECK (0-6), NULLABLE          | 0=Sun, 6=Sat (NULL for overrides) |
| effective_date | date        | NULLABLE                       | Specific date override            |
| opens_at       | time        | NULLABLE                       | Opening time                      |
| closes_at      | time        | NULLABLE                       | Closing time                      |
| is_closed      | boolean     | DEFAULT false, NOT NULL        | Closed flag                       |
| notes          | text        |                                | Notes (e.g., "Holiday")           |
| created_at     | timestamptz | DEFAULT now(), NOT NULL        | Creation timestamp                |
| updated_at     | timestamptz | DEFAULT now(), NOT NULL        | Last update timestamp             |

**Constraints:**

- `restaurant_operating_hours_scope` CHECK (day_of_week IS NOT NULL OR effective_date IS NOT NULL)
- `restaurant_operating_hours_time_order` CHECK (is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at))

**Usage:**

- Weekly hours: day_of_week set, effective_date NULL
- Date overrides: effective_date set, day_of_week NULL or set

---

### Table: restaurant_service_periods

**Purpose:** Service period definitions (lunch, dinner, drinks)

| Column        | Type        | Constraints                    | Description                    |
| ------------- | ----------- | ------------------------------ | ------------------------------ |
| id            | uuid        | PK, DEFAULT uuid_generate_v4() | Period ID                      |
| restaurant_id | uuid        | FK → restaurants(id), NOT NULL | Restaurant reference           |
| name          | text        | NOT NULL                       | Period name (e.g., "Lunch")    |
| day_of_week   | smallint    | CHECK (0-6), NULLABLE          | Specific day (NULL = all days) |
| start_time    | time        | NOT NULL                       | Period start time              |
| end_time      | time        | NOT NULL                       | Period end time                |
| created_at    | timestamptz | DEFAULT now(), NOT NULL        | Creation timestamp             |
| updated_at    | timestamptz | DEFAULT now(), NOT NULL        | Last update timestamp          |

**Constraints:**

- `restaurant_service_periods_time_order` CHECK (start_time < end_time)

---

## Enums & Types

### Enum: booking_status

**Values:**

- `confirmed` - Booking confirmed
- `pending` - Awaiting confirmation
- `pending_allocation` - Awaiting table allocation
- `cancelled` - Cancelled by guest or restaurant
- `completed` - Service completed
- `no_show` - Guest did not arrive

**SQL Definition:**

```sql
CREATE TYPE booking_status AS ENUM (
    'confirmed',
    'pending',
    'cancelled',
    'completed',
    'no_show',
    'pending_allocation'
);
```

---

### Enum: booking_type

**Values:**

- `breakfast` - Morning meal
- `lunch` - Midday meal
- `dinner` - Evening meal
- `drinks` - Drinks only

**SQL Definition:**

```sql
CREATE TYPE booking_type AS ENUM (
    'breakfast',
    'lunch',
    'dinner',
    'drinks'
);
```

---

### Enum: seating_preference_type

**Values:**

- `any` - No preference
- `indoor` - Indoor seating
- `outdoor` - Outdoor/patio seating
- `bar` - Bar seating
- `window` - Window table
- `quiet` - Quiet area
- `booth` - Booth seating

**SQL Definition:**

```sql
CREATE TYPE seating_preference_type AS ENUM (
    'any',
    'indoor',
    'outdoor',
    'bar',
    'window',
    'quiet',
    'booth'
);
```

---

### Enum: loyalty_tier

**Values:**

- `bronze` - Entry level (0+ points)
- `silver` - Mid level (100+ points)
- `gold` - High level (250+ points)
- `platinum` - Top level (500+ points)

**SQL Definition:**

```sql
CREATE TYPE loyalty_tier AS ENUM (
    'bronze',
    'silver',
    'gold',
    'platinum'
);
```

---

### Enum: booking_change_type

**Values:**

- `created` - Booking created
- `updated` - Booking modified
- `cancelled` - Booking cancelled
- `deleted` - Booking deleted

**SQL Definition:**

```sql
CREATE TYPE booking_change_type AS ENUM (
    'created',
    'updated',
    'cancelled',
    'deleted'
);
```

---

## Indexes & Performance

### Index Strategy

**Primary Indexes (Unique Constraints):**

- All `id` columns (PK, B-tree)
- `bookings.reference` (unique, B-tree)
- `restaurants.slug` (unique, B-tree)
- `booking_confirmation_tokens.token` (unique, B-tree)

**Performance Indexes:**

| Table                | Index                           | Columns                           | Purpose               |
| -------------------- | ------------------------------- | --------------------------------- | --------------------- |
| bookings             | idx_bookings_restaurant_date    | (restaurant_id, booking_date)     | Daily booking queries |
| bookings             | idx_bookings_customer_email     | (customer_email)                  | Guest lookup          |
| bookings             | idx_bookings_status             | (status)                          | Status filtering      |
| bookings             | idx_bookings_start_at           | (start_at)                        | Chronological queries |
| customers            | idx_customers_restaurant_email  | (restaurant_id, email_normalized) | Customer lookup       |
| customers            | idx_customers_restaurant_phone  | (restaurant_id, phone_normalized) | Phone lookup          |
| booking_versions     | idx_booking_versions_changed_at | (changed_at DESC)                 | Recent changes        |
| loyalty_point_events | idx_loyalty_events_customer     | (customer_id, created_at DESC)    | Customer history      |

**Composite Indexes:**

- `(restaurant_id, booking_date)` - Most queries filter by both
- `(restaurant_id, email_normalized)` - Customer identification
- `(customer_id, created_at DESC)` - Event history queries

---

## Triggers & Functions

### Function: generate_booking_reference()

**Purpose:** Generate unique 10-character booking reference

```sql
CREATE OR REPLACE FUNCTION generate_booking_reference() RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes 0/O/1/I for clarity
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

---

### Trigger: set_booking_reference

**Purpose:** Auto-generate reference if not provided

```sql
CREATE TRIGGER set_booking_reference
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_reference();

-- Trigger function:
CREATE OR REPLACE FUNCTION set_booking_reference() RETURNS trigger AS $$
DECLARE ref text;
BEGIN
  IF COALESCE(NEW.reference, '') = '' THEN
    LOOP
      ref := generate_booking_reference();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM bookings WHERE reference = ref);
    END LOOP;
    NEW.reference := ref;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### Trigger: set_booking_instants

**Purpose:** Compute UTC timestamps from date + time + timezone

```sql
CREATE TRIGGER set_booking_instants
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_instants();

-- Trigger function:
CREATE OR REPLACE FUNCTION set_booking_instants() RETURNS trigger AS $$
DECLARE
  tz text;
  sh int; sm int; ss double precision;
  eh int; em int; es double precision;
BEGIN
  SELECT timezone INTO tz FROM restaurants WHERE id = NEW.restaurant_id;

  sh := EXTRACT(HOUR FROM NEW.start_time)::int;
  sm := EXTRACT(MINUTE FROM NEW.start_time)::int;
  ss := EXTRACT(SECOND FROM NEW.start_time);
  eh := EXTRACT(HOUR FROM NEW.end_time)::int;
  em := EXTRACT(MINUTE FROM NEW.end_time)::int;
  es := EXTRACT(SECOND FROM NEW.end_time);

  NEW.start_at := make_timestamptz(
    EXTRACT(YEAR FROM NEW.booking_date)::int,
    EXTRACT(MONTH FROM NEW.booking_date)::int,
    EXTRACT(DAY FROM NEW.booking_date)::int,
    sh, sm, ss, tz
  );

  NEW.end_at := make_timestamptz(
    EXTRACT(YEAR FROM NEW.booking_date)::int,
    EXTRACT(MONTH FROM NEW.booking_date)::int,
    EXTRACT(DAY FROM NEW.booking_date)::int,
    eh, em, es, tz
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### Trigger: update_updated_at

**Purpose:** Auto-update updated_at timestamp on row modification

```sql
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to multiple tables:
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- etc.
```

---

### Function: user_restaurants()

**Purpose:** Get restaurant IDs accessible by current user

```sql
CREATE OR REPLACE FUNCTION user_restaurants()
RETURNS SETOF uuid AS $$
  SELECT restaurant_id
  FROM restaurant_memberships
  WHERE user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Usage:** Powers RLS policies for ops routes

---

## Row-Level Security

### RLS Policies

**bookings table:**

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookings
CREATE POLICY user_view_own_bookings ON bookings
  FOR SELECT
  TO authenticated
  USING (customer_email = auth.email());

-- Staff can view bookings for their restaurants
CREATE POLICY staff_view_restaurant_bookings ON bookings
  FOR SELECT
  TO authenticated
  USING (restaurant_id IN (SELECT user_restaurants()));

-- Staff can insert bookings for their restaurants
CREATE POLICY staff_insert_restaurant_bookings ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (restaurant_id IN (SELECT user_restaurants()));

-- Staff can update bookings for their restaurants
CREATE POLICY staff_update_restaurant_bookings ON bookings
  FOR UPDATE
  TO authenticated
  USING (restaurant_id IN (SELECT user_restaurants()));
```

**customers table:**

```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Staff can view customers for their restaurants
CREATE POLICY staff_view_restaurant_customers ON customers
  FOR SELECT
  TO authenticated
  USING (restaurant_id IN (SELECT user_restaurants()));

-- Service role has full access
CREATE POLICY service_role_all_access ON customers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**profiles table:**

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY user_view_own_profile ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY user_update_own_profile ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());
```

**restaurant_memberships table:**

```sql
ALTER TABLE restaurant_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view their own memberships
CREATE POLICY user_view_own_memberships ON restaurant_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owners can manage memberships
CREATE POLICY owner_manage_memberships ON restaurant_memberships
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id
      FROM restaurant_memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
```

---

## Data Integrity

### Referential Integrity

**Foreign Key Cascades:**

| Parent Table | Child Table                 | Column        | On Delete |
| ------------ | --------------------------- | ------------- | --------- |
| restaurants  | bookings                    | restaurant_id | RESTRICT  |
| customers    | bookings                    | customer_id   | RESTRICT  |
| bookings     | booking_versions            | booking_id    | CASCADE   |
| bookings     | booking_confirmation_tokens | booking_id    | CASCADE   |
| restaurants  | customers                   | restaurant_id | RESTRICT  |
| restaurants  | restaurant_memberships      | restaurant_id | RESTRICT  |
| profiles     | restaurant_memberships      | user_id       | CASCADE   |

**Rational:**

- **RESTRICT:** Prevents deletion of referenced entities (bookings depend on restaurants/customers)
- **CASCADE:** Auto-deletes child records (tokens/versions removed with booking)

---

### Data Validation

**Check Constraints:**

| Table                       | Constraint           | Rule                              |
| --------------------------- | -------------------- | --------------------------------- |
| bookings                    | party_size_check     | party_size > 0                    |
| bookings                    | chk_time_order       | start_at < end_at                 |
| customers                   | email_check          | email = lower(email)              |
| customers                   | phone_check          | length(phone) BETWEEN 7 AND 20    |
| customer_profiles           | total_bookings_check | total_bookings >= 0               |
| booking_confirmation_tokens | token_length         | char_length(token) = 64           |
| restaurant_operating_hours  | time_order           | opens_at < closes_at OR is_closed |

---

### Unique Constraints

**Single-Column Unique:**

- `bookings.reference`
- `restaurants.slug`
- `booking_confirmation_tokens.token`

**Composite Unique:**

- `(restaurant_id, idempotency_key)` ON bookings WHERE idempotency_key IS NOT NULL
- `(restaurant_id, client_request_id)` ON bookings
- `(restaurant_id, customer_id)` ON loyalty_points
- `(user_id, restaurant_id)` ON restaurant_memberships

---

## Migration History

### Migration Files

| File                                                          | Date       | Description            |
| ------------------------------------------------------------- | ---------- | ---------------------- |
| 20251006170446_remote_schema.sql                              | 2025-10-06 | Initial schema setup   |
| 20250204103000_auth_team_invites.sql                          | 2025-02-04 | Team invitation system |
| 20250115071800_add_booking_confirmation_token.sql             | 2025-01-15 | Confirmation tokens    |
| 20251010165023_add_booking_option_and_reservation_columns.sql | 2025-10-10 | Booking options        |
| 20251011091500_add_has_access_to_profiles.sql                 | 2025-10-11 | Profile access control |
| 20250204114500_fix_membership_policy.sql                      | 2025-02-04 | RLS policy fix         |

**Migration Command:**

```bash
supabase db push
```

---

## Database Statistics

### Table Sizes (Estimated)

| Table                       | Rows (1 year, 10 restaurants) | Storage |
| --------------------------- | ----------------------------- | ------- |
| restaurants                 | 10                            | < 1 MB  |
| bookings                    | ~100,000                      | ~50 MB  |
| customers                   | ~30,000                       | ~10 MB  |
| customer_profiles           | ~30,000                       | ~5 MB   |
| booking_versions            | ~300,000                      | ~150 MB |
| booking_confirmation_tokens | ~100,000                      | ~10 MB  |
| loyalty_point_events        | ~80,000                       | ~30 MB  |
| profiles                    | ~500                          | < 1 MB  |
| restaurant_memberships      | ~50                           | < 1 MB  |

**Total Estimated:** ~256 MB for 1 year of operations

---

## Query Performance

### Typical Query Times (Indexed)

| Query Type        | Example                                                                       | Time (ms) |
| ----------------- | ----------------------------------------------------------------------------- | --------- |
| Booking by ID     | SELECT \* FROM bookings WHERE id = ?                                          | < 1       |
| Bookings by date  | SELECT \* FROM bookings WHERE restaurant_id = ? AND booking_date = ?          | 2-5       |
| Customer lookup   | SELECT \* FROM customers WHERE restaurant_id = ? AND email_normalized = ?     | < 1       |
| Audit trail       | SELECT \* FROM booking_versions WHERE booking_id = ? ORDER BY changed_at DESC | 2-3       |
| Dashboard summary | Complex aggregation query                                                     | 50-100    |

---

## Backup & Recovery

### Backup Strategy

**Supabase Managed Backups:**

- **Daily automated backups:** 7-day retention
- **Point-in-time recovery:** Available for Pro plans
- **Manual backups:** Via Supabase dashboard or CLI

**Export Options:**

```bash
# Export schema
pg_dump --schema-only -h db.xxx.supabase.co -U postgres > schema.sql

# Export data
pg_dump -h db.xxx.supabase.co -U postgres > backup.sql

# Restore
psql -h db.xxx.supabase.co -U postgres < backup.sql
```

---

## Monitoring & Maintenance

### Health Checks

```sql
-- Check for missing indexes on foreign keys
SELECT
    c.conrelid::regclass AS table_name,
    a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY(i.indkey)
  );

-- Check for bloated tables
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for slow queries
SELECT
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## Conclusion

The SajiloReserveX database schema is designed for:

- ✅ **Data Integrity:** Comprehensive constraints and foreign keys
- ✅ **Performance:** Strategic indexes on all query paths
- ✅ **Security:** Row-Level Security policies
- ✅ **Auditability:** Complete change tracking
- ✅ **Scalability:** Efficient indexing and partitioning-ready

**Key Features:**

- Type-safe enums for status fields
- Generated columns for normalized search
- Automatic timestamp management
- Unique reference generation
- Cascade delete where appropriate

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Maintained By:** Database Team  
**Review Cycle:** Quarterly
