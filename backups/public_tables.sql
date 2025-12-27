CREATE TABLE public.booking_table_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    table_id uuid NOT NULL,
    slot_id uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    idempotency_key text,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    allocation_id uuid,
    merge_group_id uuid,
    assignment_window tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)'::text)) STORED
);
CREATE TABLE public._migrations (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'applied'::character varying
);
CREATE TABLE public.allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shadow boolean DEFAULT false NOT NULL,
    restaurant_id uuid NOT NULL,
    "window" tstzrange NOT NULL,
    created_by uuid,
    is_maintenance boolean DEFAULT false NOT NULL,
    CONSTRAINT allocations_resource_type_check CHECK ((resource_type = ANY (ARRAY['table'::text, 'merge_group'::text])))
);
CREATE TABLE public.allocations_archive (
    id uuid NOT NULL,
    booking_id uuid,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    shadow boolean DEFAULT false NOT NULL,
    restaurant_id uuid NOT NULL,
    "window" tstzrange NOT NULL,
    created_by uuid,
    is_maintenance boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT allocations_archive_resource_type_check CHECK ((resource_type = ANY (ARRAY['table'::text, 'hold'::text, 'merge_group'::text])))
);
CREATE TABLE public.allowed_capacities (
    restaurant_id uuid NOT NULL,
    capacity smallint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT allowed_capacities_capacity_check CHECK ((capacity > 0))
);
CREATE TABLE public.analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type public.analytics_event_type NOT NULL,
    schema_version text NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    customer_id uuid,
    emitted_by text DEFAULT 'server'::text NOT NULL,
    payload jsonb NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    actor text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.booking_assignment_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    attempt_no integer NOT NULL,
    strategy text NOT NULL,
    result text NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE public.booking_assignment_idempotency (
    booking_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    table_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    assignment_window tstzrange NOT NULL,
    merge_group_allocation_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    table_set_hash text,
    payload_checksum text DEFAULT ''::text NOT NULL,
    expires_at timestamp with time zone
);
CREATE TABLE public.booking_confirmation_results (
    booking_id uuid NOT NULL,
    hold_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    table_ids uuid[] NOT NULL,
    assignment_window tstzrange NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    actor_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE TABLE public.booking_occasions (
    key text NOT NULL,
    label text NOT NULL,
    short_label text NOT NULL,
    description text,
    availability jsonb DEFAULT '[]'::jsonb NOT NULL,
    default_duration_minutes smallint DEFAULT 90 NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_builtin boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT booking_occasions_builtin_not_deleted CHECK ((NOT (is_builtin AND (deleted_at IS NOT NULL))))
);
CREATE TABLE public.booking_occasions_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    occasion_key text NOT NULL,
    action text NOT NULL,
    before_change jsonb,
    after_change jsonb,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.booking_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    slot_date date NOT NULL,
    slot_time time without time zone NOT NULL,
    service_period_id uuid,
    available_capacity integer DEFAULT 0 NOT NULL,
    reserved_count integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_slots_available_capacity_positive CHECK ((available_capacity >= 0)),
    CONSTRAINT booking_slots_capacity_valid CHECK (((reserved_count >= 0) AND (reserved_count <= available_capacity)))
);
CREATE TABLE public.booking_state_history (
    id bigint NOT NULL,
    booking_id uuid NOT NULL,
    from_status public.booking_status,
    to_status public.booking_status NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE TABLE public.booking_versions (
    version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    change_type public.booking_change_type NOT NULL,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    booking_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    party_size integer NOT NULL,
    seating_preference public.seating_preference_type DEFAULT 'any'::public.seating_preference_type NOT NULL,
    status public.booking_status DEFAULT 'confirmed'::public.booking_status NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    notes text,
    reference text NOT NULL,
    source text DEFAULT 'web'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_type text DEFAULT 'dinner'::text NOT NULL,
    idempotency_key text,
    client_request_id text DEFAULT (gen_random_uuid())::text NOT NULL,
    pending_ref text,
    details jsonb,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    confirmation_token character varying(64),
    confirmation_token_expires_at timestamp with time zone,
    confirmation_token_used_at timestamp with time zone,
    auth_user_id uuid,
    checked_in_at timestamp with time zone,
    checked_out_at timestamp with time zone,
    loyalty_points_awarded integer DEFAULT 0 NOT NULL,
    assigned_zone_id uuid,
    auto_assign_idempotency_key text,
    auto_assign_last_result jsonb,
    assignment_state_version integer DEFAULT 1 NOT NULL,
    assignment_strategy text,
    CONSTRAINT bookings_checked_out_after_checked_in CHECK (((checked_out_at IS NULL) OR (checked_in_at IS NULL) OR (checked_out_at >= checked_in_at))),
    CONSTRAINT bookings_lifecycle_timestamp_consistency CHECK ((((status = ANY (ARRAY['pending'::public.booking_status, 'pending_allocation'::public.booking_status, 'confirmed'::public.booking_status])) AND (checked_in_at IS NULL) AND (checked_out_at IS NULL)) OR ((status = 'checked_in'::public.booking_status) AND (checked_in_at IS NOT NULL) AND (checked_out_at IS NULL)) OR ((status = 'completed'::public.booking_status) AND (checked_in_at IS NOT NULL) AND (checked_out_at IS NOT NULL) AND (checked_out_at >= checked_in_at)) OR (status = 'cancelled'::public.booking_status) OR ((status = 'no_show'::public.booking_status) AND (checked_in_at IS NULL) AND (checked_out_at IS NULL)))),
    CONSTRAINT bookings_party_size_check CHECK ((party_size > 0)),
    CONSTRAINT chk_time_order CHECK ((start_at < end_at))
);
CREATE TABLE public.capacity_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    event_type text NOT NULL,
    dedupe_key text,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone,
    restaurant_id uuid,
    booking_id uuid,
    idempotency_key text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT capacity_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'dead'::text])))
);
CREATE TABLE public.customer_profiles (
    customer_id uuid NOT NULL,
    first_booking_at timestamp with time zone,
    last_booking_at timestamp with time zone,
    total_bookings integer DEFAULT 0 NOT NULL,
    total_covers integer DEFAULT 0 NOT NULL,
    total_cancellations integer DEFAULT 0 NOT NULL,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    last_marketing_opt_in_at timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_profiles_total_bookings_check CHECK ((total_bookings >= 0)),
    CONSTRAINT customer_profiles_total_cancellations_check CHECK ((total_cancellations >= 0)),
    CONSTRAINT customer_profiles_total_covers_check CHECK ((total_covers >= 0))
);
CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    email_normalized text GENERATED ALWAYS AS (lower(TRIM(BOTH FROM email))) STORED,
    phone_normalized text GENERATED ALWAYS AS (regexp_replace(phone, '[^0-9]+'::text, ''::text, 'g'::text)) STORED,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    auth_user_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_profile_id uuid,
    CONSTRAINT customers_email_check CHECK ((email = lower(email))),
    CONSTRAINT customers_phone_check CHECK (((length(phone) >= 7) AND (length(phone) <= 20)))
);
CREATE TABLE public.demand_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    service_window text NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_minute integer,
    end_minute integer,
    priority integer DEFAULT 1,
    CONSTRAINT demand_profiles_check CHECK (((end_minute > start_minute) AND (end_minute <= 1440))),
    CONSTRAINT demand_profiles_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT demand_profiles_multiplier_check CHECK (((multiplier >= 0.1) AND (multiplier <= 10.0))),
    CONSTRAINT demand_profiles_priority_check CHECK ((priority >= 1)),
    CONSTRAINT demand_profiles_service_window_check CHECK ((service_window = ANY (ARRAY['lunch'::text, 'drinks'::text, 'dinner'::text, 'christmas_party'::text, 'curry_and_carols'::text]))),
    CONSTRAINT demand_profiles_start_minute_check CHECK (((start_minute >= 0) AND (start_minute < 1440)))
);
CREATE TABLE public.feature_flag_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flag text NOT NULL,
    environment text NOT NULL,
    value boolean NOT NULL,
    notes jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid
);
CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE public.loyalty_point_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    booking_id uuid,
    points_change integer NOT NULL,
    event_type text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.loyalty_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    tier public.loyalty_tier DEFAULT 'bronze'::public.loyalty_tier NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.loyalty_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    accrual_rule jsonb DEFAULT '{"type": "per_guest", "base_points": 10, "points_per_guest": 5, "minimum_party_size": 1}'::jsonb NOT NULL,
    tier_definitions jsonb DEFAULT '[{"tier": "bronze", "min_points": 0}]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pilot_only boolean DEFAULT false NOT NULL
);
CREATE TABLE public.manual_assignment_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    state public.manual_assignment_session_state DEFAULT 'none'::public.manual_assignment_session_state NOT NULL,
    selection jsonb,
    selection_version integer DEFAULT 0 NOT NULL,
    context_version text,
    policy_version text,
    snapshot_hash text,
    hold_id uuid,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    table_version text,
    adjacency_version text,
    flags_version text,
    window_version text,
    holds_version text,
    assignments_version text
);
CREATE TABLE public.merge_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_a smallint NOT NULL,
    from_b smallint NOT NULL,
    to_capacity smallint NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    require_same_zone boolean DEFAULT true NOT NULL,
    require_adjacency boolean DEFAULT true NOT NULL,
    cross_category_merge boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT merge_rules_positive CHECK (((from_a > 0) AND (from_b > 0) AND (to_capacity > 0)))
);
CREATE TABLE public.observability_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    source text NOT NULL,
    event_type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    context jsonb,
    restaurant_id uuid,
    booking_id uuid,
    CONSTRAINT observability_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text])))
);
CREATE TABLE public.profile_update_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    payload_hash text NOT NULL,
    applied_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    name text,
    phone text,
    image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    has_access boolean DEFAULT true NOT NULL,
    CONSTRAINT profiles_email_check CHECK ((email = lower(email)))
);
CREATE TABLE public.restaurant_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    email text NOT NULL,
    email_normalized text GENERATED ALWAYS AS (lower(TRIM(BOTH FROM email))) STORED,
    role text NOT NULL,
    token_hash text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    invited_by uuid,
    accepted_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT restaurant_invites_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'host'::text, 'server'::text]))),
    CONSTRAINT restaurant_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text])))
);
CREATE TABLE public.restaurant_memberships (
    user_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_memberships_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'host'::text, 'server'::text])))
);
CREATE TABLE public.restaurant_operating_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    day_of_week smallint,
    effective_date date,
    opens_at time without time zone,
    closes_at time without time zone,
    is_closed boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_operating_hours_scope CHECK (((day_of_week IS NOT NULL) OR (effective_date IS NOT NULL))),
    CONSTRAINT restaurant_operating_hours_time_order CHECK ((is_closed OR ((opens_at IS NOT NULL) AND (closes_at IS NOT NULL) AND (opens_at < closes_at))))
);
CREATE TABLE public.restaurant_service_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    day_of_week smallint,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_option text DEFAULT 'drinks'::text NOT NULL,
    CONSTRAINT restaurant_service_periods_time_order CHECK ((start_time < end_time))
);
CREATE TABLE public.restaurants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    timezone text DEFAULT 'Europe/London'::text NOT NULL,
    capacity integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_email text,
    contact_phone text,
    address text,
    booking_policy text,
    reservation_interval_minutes integer DEFAULT 15 NOT NULL,
    reservation_default_duration_minutes integer DEFAULT 90 NOT NULL,
    reservation_last_seating_buffer_minutes integer DEFAULT 120 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    logo_url text,
    email_send_reminder_24h boolean DEFAULT true NOT NULL,
    email_send_reminder_short boolean DEFAULT true NOT NULL,
    email_send_review_request boolean DEFAULT true NOT NULL,
    google_map_url text,
    reservation_lifecycle_grace_minutes integer DEFAULT 15,
    google_review_url text,
    email_templates jsonb,
    CONSTRAINT restaurants_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT restaurants_reservation_default_duration_minutes_check CHECK (((reservation_default_duration_minutes >= 15) AND (reservation_default_duration_minutes <= 300))),
    CONSTRAINT restaurants_reservation_interval_minutes_check CHECK (((reservation_interval_minutes > 0) AND (reservation_interval_minutes <= 180))),
    CONSTRAINT restaurants_reservation_last_seating_buffer_minutes_check CHECK (((reservation_last_seating_buffer_minutes >= 15) AND (reservation_last_seating_buffer_minutes <= 300))),
    CONSTRAINT restaurants_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);
CREATE TABLE public.scheduled_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    type text NOT NULL,
    booking_id uuid NOT NULL,
    restaurant_id uuid,
    scheduled_for timestamp with time zone NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    processing_started_at timestamp with time zone,
    sent_at timestamp with time zone,
    last_error text,
    dedupe_key text,
    CONSTRAINT scheduled_emails_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'cancelled'::text, 'skipped'::text]))),
    CONSTRAINT scheduled_emails_type_check CHECK ((type = ANY (ARRAY['reminder_24h'::text, 'reminder_short'::text, 'review_request'::text])))
);
CREATE TABLE public.service_policy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lunch_start time without time zone DEFAULT '12:00:00'::time without time zone NOT NULL,
    lunch_end time without time zone DEFAULT '15:00:00'::time without time zone NOT NULL,
    dinner_start time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    dinner_end time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    clean_buffer_minutes smallint DEFAULT 5 NOT NULL,
    allow_after_hours boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.strategic_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    scarcity_weight numeric(8,2) DEFAULT 22 NOT NULL,
    demand_multiplier_override numeric(8,3),
    future_conflict_penalty numeric(10,2)
);
CREATE TABLE public.table_adjacencies (
    table_a uuid NOT NULL,
    table_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_adjacencies_not_equal CHECK ((table_a <> table_b))
);
CREATE TABLE public.table_hold_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hold_id uuid NOT NULL,
    table_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE public.table_hold_windows (
    hold_id uuid NOT NULL,
    table_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    hold_window tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)'::text)) STORED
);
CREATE TABLE public.table_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid,
    zone_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb,
    session_id uuid,
    status public.table_hold_status DEFAULT 'active'::public.table_hold_status NOT NULL,
    last_touched_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT table_holds_window_check CHECK ((start_at < end_at)),
    CONSTRAINT th_times_consistent CHECK ((expires_at >= end_at))
);
CREATE TABLE public.table_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_number text NOT NULL,
    capacity integer NOT NULL,
    section text,
    status public.table_status DEFAULT 'available'::public.table_status NOT NULL,
    "position" jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    zone_id uuid NOT NULL,
    category public.table_category NOT NULL,
    seating_type public.table_seating_type DEFAULT 'standard'::public.table_seating_type NOT NULL,
    mobility public.table_mobility DEFAULT 'movable'::public.table_mobility NOT NULL,
    active boolean DEFAULT true NOT NULL,
    min_party_size integer DEFAULT 1 NOT NULL,
    max_party_size integer,
    CONSTRAINT table_inventory_min_party_positive CHECK ((min_party_size > 0)),
    CONSTRAINT table_inventory_valid_party_range CHECK (((max_party_size IS NULL) OR (max_party_size >= min_party_size)))
);
CREATE TABLE public.table_merge_graph (
    restaurant_id uuid NOT NULL,
    table_a uuid NOT NULL,
    table_b uuid NOT NULL,
    merge_score integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    status text DEFAULT 'pending'::text NOT NULL
);
CREATE TABLE public.table_scarcity_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_type text NOT NULL,
    scarcity_score numeric(5,4) NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_scarcity_metrics_scarcity_score_check CHECK (((scarcity_score >= (0)::numeric) AND (scarcity_score <= (1)::numeric)))
);
CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    name text,
    phone text,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_email_suppressed boolean DEFAULT false NOT NULL,
    CONSTRAINT user_profiles_phone_e164_check CHECK (((phone IS NULL) OR (phone ~ '^\\+[1-9]\\d{1,14}$'::text)))
);
CREATE TABLE public.waiting_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_date date NOT NULL,
    desired_time time without time zone NOT NULL,
    party_size integer NOT NULL,
    seating_preference public.seating_preference_type DEFAULT 'any'::public.seating_preference_type NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT waiting_list_party_size_check CHECK ((party_size > 0))
);
CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT zones_name_not_blank CHECK ((char_length(TRIM(BOTH FROM name)) > 0))
);
