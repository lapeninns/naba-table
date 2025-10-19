-- Seed dataset for SajiloReserveX. Generated 2025-10-19.
-- WARNING: This script truncates existing data. Run only against non-production environments.

\echo 'Seeding SajiloReserveX sample data...'

BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL search_path = public;

TRUNCATE TABLE
    public.allocations,
    public.allowed_capacities,
    public.analytics_events,
    public.audit_logs,
    public.booking_slots,
    public.booking_state_history,
    public.booking_table_assignments,
    public.booking_versions,
    public.bookings,
    public.capacity_metrics_hourly,
    public.customer_profiles,
    public.customers,
    public.loyalty_point_events,
    public.loyalty_points,
    public.loyalty_programs,
    public.merge_group_members,
    public.merge_groups,
    public.merge_rules,
    public.profile_update_requests,
    public.restaurant_capacity_rules,
    public.restaurant_invites,
    public.restaurant_memberships,
    public.restaurant_operating_hours,
    public.restaurant_service_periods,
    public.restaurants,
    public.service_policy,
    public.stripe_events,
    public.table_adjacencies,
    public.table_inventory,
    public.zones,
    public.profiles
RESTART IDENTITY CASCADE;

-- Ensure employee accounts exist for profile FK relations.
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES
    ('6babb126-c166-41a0-b9f2-57ef473b179b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@sajiloreserve.test', '$2a$10$owner-placeholder-hash..............', '2025-10-10 09:00:00+00', '{"provider":"email"}'::jsonb, '{"display_name":"Fatima Owner"}'::jsonb, '2025-10-10 09:00:00+00', '2025-10-10 09:00:00+00'),
    ('6ec7390d-1542-4592-9e53-93d4eab22bca', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@sajiloreserve.test', '$2a$10$manager-placeholder-hash............', '2025-10-10 09:05:00+00', '{"provider":"email"}'::jsonb, '{"display_name":"Ravi Manager"}'::jsonb, '2025-10-10 09:05:00+00', '2025-10-18 08:00:00+00'),
    ('0a5a867f-1a0a-4612-b549-f8004cdfe052', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'host@sajiloreserve.test', '$2a$10$host-placeholder-hash................', '2025-10-11 10:00:00+00', '{"provider":"email"}'::jsonb, '{"display_name":"Jamie Host"}'::jsonb, '2025-10-11 10:00:00+00', '2025-10-18 08:00:00+00'),
    ('5586f5b0-a17d-4ea0-a46f-83b8e313923c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'server@sajiloreserve.test', '$2a$10$server-placeholder-hash..............', '2025-10-12 12:00:00+00', '{"provider":"email"}'::jsonb, '{"display_name":"Morgan Server"}'::jsonb, '2025-10-12 12:00:00+00', '2025-10-18 08:00:00+00')
ON CONFLICT (id) DO UPDATE
SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.profiles (id, email, name, phone, image, has_access, created_at, updated_at)
VALUES
    ('6babb126-c166-41a0-b9f2-57ef473b179b', 'owner@sajiloreserve.test', 'Fatima Owner', '+447700900111', 'https://example.com/avatars/owner.png', true, '2025-10-10 09:05:00+00', '2025-10-19 09:00:00+00'),
    ('6ec7390d-1542-4592-9e53-93d4eab22bca', 'manager@sajiloreserve.test', 'Ravi Manager', '+447700900222', 'https://example.com/avatars/manager.png', true, '2025-10-10 09:05:00+00', '2025-10-19 09:00:00+00'),
    ('0a5a867f-1a0a-4612-b549-f8004cdfe052', 'host@sajiloreserve.test', 'Jamie Host', '+447700900333', 'https://example.com/avatars/host.png', true, '2025-10-11 10:05:00+00', '2025-10-19 09:00:00+00'),
    ('5586f5b0-a17d-4ea0-a46f-83b8e313923c', 'server@sajiloreserve.test', 'Morgan Server', '+447700900444', 'https://example.com/avatars/server.png', true, '2025-10-12 12:05:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.restaurants (
    id,
    name,
    slug,
    timezone,
    capacity,
    contact_email,
    contact_phone,
    address,
    booking_policy,
    reservation_interval_minutes,
    reservation_default_duration_minutes,
    is_active,
    created_at,
    updated_at
) VALUES
    ('ca450968-8837-4fb3-8fe7-753addb33373', 'Sajilo Reserve Downtown', 'sajilo-reserve-downtown', 'Europe/London', 120, 'contactdowntown@sajilo.example', '+442079460123', '123 High Street, London, UK', 'Parties over 8 require prepayment and confirmation 48 hours prior.', 15, 120, true, '2025-09-15 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', 'Sajilo Reserve Riverside', 'sajilo-reserve-riverside', 'America/New_York', 90, 'hello@sajilo-riverside.example', '+12125550100', '500 Riverside Dr, New York, USA', 'Outdoor seating subject to weather; deposits required for groups of 6+. ', 30, 90, true, '2025-09-20 14:00:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.zones (id, restaurant_id, name, sort_order, created_at, updated_at)
VALUES
    ('e84b28c6-8ead-4c17-b4c2-972550d893d3', 'ca450968-8837-4fb3-8fe7-753addb33373', 'Main Dining', 1, '2025-10-01 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('ea87acec-44a6-46d1-bce6-7318c9e028ac', 'ca450968-8837-4fb3-8fe7-753addb33373', 'Garden Patio', 2, '2025-10-01 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('c3ca7877-b87e-4809-b24a-1af4ab3aea8b', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'River View', 1, '2025-10-02 12:00:00+00', '2025-10-19 09:00:00+00'),
    ('3daabeea-7e8f-4239-be4e-8445da67025c', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'Chef''s Table', 2, '2025-10-02 12:00:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.allowed_capacities (restaurant_id, capacity, created_at, updated_at)
VALUES
    ('ca450968-8837-4fb3-8fe7-753addb33373', 2, '2025-10-01 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('ca450968-8837-4fb3-8fe7-753addb33373', 4, '2025-10-01 09:05:00+00', '2025-10-19 09:00:00+00'),
    ('ca450968-8837-4fb3-8fe7-753addb33373', 6, '2025-10-01 09:10:00+00', '2025-10-19 09:00:00+00'),
    ('ca450968-8837-4fb3-8fe7-753addb33373', 8, '2025-10-01 09:15:00+00', '2025-10-19 09:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', 2, '2025-10-02 12:00:00+00', '2025-10-19 09:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', 4, '2025-10-02 12:05:00+00', '2025-10-19 09:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', 5, '2025-10-02 12:07:30+00', '2025-10-19 09:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', 6, '2025-10-02 12:10:00+00', '2025-10-19 09:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', 8, '2025-10-02 12:12:30+00', '2025-10-19 09:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', 10, '2025-10-02 12:15:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.service_policy (id, lunch_start, lunch_end, dinner_start, dinner_end, clean_buffer_minutes, allow_after_hours, created_at, updated_at)
VALUES
    ('33e88ebb-7483-45e7-aa05-aee107537c82', '11:30:00', '15:00:00', '17:30:00', '22:30:00', 5, false, '2025-10-01 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('4b376b93-cc50-46fb-aaf2-7f52bdb32820', '10:00:00', '14:00:00', '16:00:00', '23:30:00', 10, true, '2025-10-02 12:00:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.restaurant_service_periods (id, restaurant_id, name, day_of_week, start_time, end_time, booking_option, created_at, updated_at)
VALUES
    ('72cafd94-fb71-4b58-bc3e-abef2b745e2e', 'ca450968-8837-4fb3-8fe7-753addb33373', 'Weekday Lunch', 2, '12:00:00', '14:30:00', 'lunch', '2025-10-05 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('0504a631-bad3-4500-8c20-b6a14ad305be', 'ca450968-8837-4fb3-8fe7-753addb33373', 'Dinner Service', 5, '17:30:00', '22:00:00', 'dinner', '2025-10-05 09:05:00+00', '2025-10-19 09:00:00+00'),
    ('0b94b233-eed9-48a3-a916-84bc16cb0c88', 'ca450968-8837-4fb3-8fe7-753addb33373', 'Cocktail Hour', NULL, '16:00:00', '19:00:00', 'drinks', '2025-10-05 09:10:00+00', '2025-10-19 09:00:00+00'),
    ('26b4c774-67fa-40c5-8b38-4a46bc99dd42', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'Weekend Brunch', 6, '10:30:00', '14:30:00', 'lunch', '2025-10-06 12:00:00+00', '2025-10-19 09:00:00+00'),
    ('afd32852-7900-4e1b-9943-f3b3b2d5808e', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'Late Supper', 5, '19:00:00', '23:00:00', 'dinner', '2025-10-06 12:05:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.restaurant_operating_hours (restaurant_id, day_of_week, effective_date, opens_at, closes_at, is_closed, notes, created_at, updated_at)
VALUES
    ('ca450968-8837-4fb3-8fe7-753addb33373', 0, NULL, NULL, NULL, true, 'Closed on Mondays for maintenance', '2025-10-05 08:00:00+00', '2025-10-19 09:00:00+00'),
    ('ca450968-8837-4fb3-8fe7-753addb33373', 5, NULL, '10:00:00', '23:00:00', false, 'Extended hours on Fridays', '2025-10-05 08:05:00+00', '2025-10-19 09:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', NULL, '2025-12-24', '12:00:00', '21:00:00', false, 'Christmas Eve special menu', '2025-10-06 11:00:00+00', '2025-10-19 09:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', 2, NULL, '11:00:00', '22:00:00', false, 'Standard Tuesday hours', '2025-10-06 11:05:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.restaurant_capacity_rules (
    id,
    restaurant_id,
    service_period_id,
    day_of_week,
    effective_date,
    max_covers,
    max_parties,
    notes,
    label,
    override_type,
    created_at,
    updated_at
) VALUES
    ('91cf693c-5350-46f9-ab8d-b57e08f23ace', 'ca450968-8837-4fb3-8fe7-753addb33373', '72cafd94-fb71-4b58-bc3e-abef2b745e2e', 5, NULL, 60, 25, 'Manual tweak for busy Friday lunch', 'Friday Lunch Cap', 'manual', '2025-10-10 08:00:00+00', '2025-10-19 09:00:00+00'),
    ('a13cf8aa-ae73-4240-b45e-4aea7b48fd61', 'ca450968-8837-4fb3-8fe7-753addb33373', NULL, NULL, '2025-12-24', 80, 30, 'Holiday override for Christmas Eve', 'Christmas Eve Dinner', 'holiday', '2025-10-10 08:05:00+00', '2025-10-19 09:00:00+00'),
    ('0a48ba2e-b612-42d1-a7cf-006a58897308', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'afd32852-7900-4e1b-9943-f3b3b2d5808e', NULL, NULL, 50, 18, 'Chef''s tasting menu night', 'Chef''s Tasting', 'event', '2025-10-11 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('bf58f375-d927-4517-a26e-a7feab4bb505', 'b19ad348-6a54-4821-863b-ac591e7790ae', NULL, NULL, '2025-11-01', 30, 10, 'Emergency staffing shortage, reduced capacity', 'Staffing Shortage', 'emergency', '2025-10-11 09:05:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.table_inventory (
    id,
    restaurant_id,
    table_number,
    capacity,
    min_party_size,
    max_party_size,
    section,
    status,
    position,
    notes,
    created_at,
    updated_at,
    zone_id,
    category,
    seating_type,
    mobility,
    active
) VALUES
    ('81196066-fee5-4d0c-a42a-197080a88e66', 'ca450968-8837-4fb3-8fe7-753addb33373', 'T1', 2, 1, 2, 'Main Floor', 'available', '{"x":5,"y":3}'::jsonb, 'Ideal for couples', '2025-10-01 09:00:00+00', '2025-10-19 09:00:00+00', 'e84b28c6-8ead-4c17-b4c2-972550d893d3', 'dining', 'standard', 'movable', true),
    ('a57e8d8b-0b94-4f4a-82ae-1d4782e0916d', 'ca450968-8837-4fb3-8fe7-753addb33373', 'P3', 4, 2, 4, 'Patio', 'reserved', '{"x":12,"y":8}'::jsonb, 'Shaded umbrella seating', '2025-10-01 09:05:00+00', '2025-10-19 09:00:00+00', 'ea87acec-44a6-46d1-bce6-7318c9e028ac', 'patio', 'standard', 'movable', true),
    ('07ede2c8-e0a9-4d57-a306-695d8ccb526b', 'ca450968-8837-4fb3-8fe7-753addb33373', 'B1', 4, 1, 4, 'Bar', 'occupied', '{"x":2,"y":1}'::jsonb, 'High-top near bar', '2025-10-01 09:10:00+00', '2025-10-19 09:00:00+00', 'e84b28c6-8ead-4c17-b4c2-972550d893d3', 'bar', 'high_top', 'movable', true),
    ('9ac1b9e5-ebff-4a61-8dc3-5b8356482ada', 'ca450968-8837-4fb3-8fe7-753addb33373', 'L2', 6, 2, 6, 'Lounge', 'available', '{"x":15,"y":6}'::jsonb, 'Low sofa seating', '2025-10-01 09:15:00+00', '2025-10-19 09:00:00+00', 'e84b28c6-8ead-4c17-b4c2-972550d893d3', 'lounge', 'sofa', 'movable', true),
    ('75ff0ee8-2970-4666-b4b3-e8875957fcf3', 'ca450968-8837-4fb3-8fe7-753addb33373', 'PR1', 8, 4, 10, 'Private Room', 'out_of_service', '{"x":18,"y":2}'::jsonb, 'Under renovation until November', '2025-10-01 09:20:00+00', '2025-10-19 09:00:00+00', 'e84b28c6-8ead-4c17-b4c2-972550d893d3', 'private', 'booth', 'fixed', false),
    ('bf1ee309-86a7-4d33-b157-ab398d3801ca', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'R1', 2, 2, 2, 'River Deck', 'available', '{"x":4,"y":2}'::jsonb, 'Romantic river view', '2025-10-02 12:00:00+00', '2025-10-19 09:00:00+00', 'c3ca7877-b87e-4809-b24a-1af4ab3aea8b', 'dining', 'standard', 'movable', true),
    ('fc9d5bd2-1ccf-4519-8332-c0dde0d227a4', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'R2', 6, 2, 6, 'Patio', 'reserved', '{"x":9,"y":7}'::jsonb, 'Heated outdoor table', '2025-10-02 12:05:00+00', '2025-10-19 09:00:00+00', 'c3ca7877-b87e-4809-b24a-1af4ab3aea8b', 'patio', 'standard', 'movable', true),
    ('e9a8ecea-d7f4-4308-8307-9fea67746288', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'H3', 4, 2, 6, 'High Top', 'occupied', '{"x":6,"y":3}'::jsonb, 'Popular for happy hour', '2025-10-02 12:10:00+00', '2025-10-19 09:00:00+00', 'c3ca7877-b87e-4809-b24a-1af4ab3aea8b', 'bar', 'high_top', 'fixed', true),
    ('c565eda0-1ea9-4375-b35d-d7f35c471342', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'C4', 5, 2, NULL, 'Chef''s Table', 'available', '{"x":14,"y":5}'::jsonb, 'Interactive chef experience', '2025-10-02 12:15:00+00', '2025-10-19 09:00:00+00', '3daabeea-7e8f-4239-be4e-8445da67025c', 'private', 'booth', 'fixed', true),
    ('53808dd9-8fa2-4c3d-b2ad-d56398f83b37', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'L5', 8, 4, 8, 'Lounge', 'available', '{"x":11,"y":4}'::jsonb, 'Sectioned sofa area', '2025-10-02 12:20:00+00', '2025-10-19 09:00:00+00', '3daabeea-7e8f-4239-be4e-8445da67025c', 'lounge', 'sofa', 'movable', true);

INSERT INTO public.table_adjacencies (table_a, table_b, created_at)
VALUES
    ('81196066-fee5-4d0c-a42a-197080a88e66', '07ede2c8-e0a9-4d57-a306-695d8ccb526b', '2025-10-14 09:05:00+00'),
    ('bf1ee309-86a7-4d33-b157-ab398d3801ca', 'fc9d5bd2-1ccf-4519-8332-c0dde0d227a4', '2025-10-14 09:10:00+00'),
    ('c565eda0-1ea9-4375-b35d-d7f35c471342', '53808dd9-8fa2-4c3d-b2ad-d56398f83b37', '2025-10-14 09:15:00+00');

-- Merge groups temporarily removed due to connectivity validation complexity
-- INSERT INTO public.merge_groups (id, capacity, created_at, dissolved_at)
-- VALUES
--     ('83a72efe-1259-48b0-b2a0-caf4cae717d2', 6, '2025-10-15 09:00:00+00', NULL),
--     ('f5f24317-3bae-4f6a-8ea4-80543fd60707', 13, '2025-10-15 09:05:00+00', '2025-10-19 21:00:00+00');

-- INSERT INTO public.merge_group_members (merge_group_id, table_id, added_at)
-- VALUES
--     ('83a72efe-1259-48b0-b2a0-caf4cae717d2', '81196066-fee5-4d0c-a42a-197080a88e66', '2025-10-15 09:10:00+00'),
--     ('83a72efe-1259-48b0-b2a0-caf4cae717d2', '07ede2c8-e0a9-4d57-a306-695d8ccb526b', '2025-10-15 09:10:00+00'),
--     ('f5f24317-3bae-4f6a-8ea4-80543fd60707', 'c565eda0-1ea9-4375-b35d-d7f35c471342', '2025-10-15 09:15:00+00'),
--     ('f5f24317-3bae-4f6a-8ea4-80543fd60707', '53808dd9-8fa2-4c3d-b2ad-d56398f83b37', '2025-10-15 09:15:00+00');

INSERT INTO public.merge_rules (id, from_a, from_b, to_capacity, enabled, require_same_zone, require_adjacency, cross_category_merge, created_at, updated_at)
VALUES
    ('22b784dd-2f22-4258-b2eb-f5a5bf502a35', 2, 2, 4, true, true, true, false, '2025-10-12 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('068d40eb-1fbf-4127-ad3d-dbdf65a2b2e7', 4, 4, 8, true, true, false, true, '2025-10-12 09:05:00+00', '2025-10-19 09:00:00+00'),
    ('fab7c733-12bb-4031-b588-8d42c0c7628c', 2, 6, 8, false, false, false, true, '2025-10-12 09:10:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.restaurant_memberships (user_id, restaurant_id, role, created_at)
VALUES
    ('6babb126-c166-41a0-b9f2-57ef473b179b', 'ca450968-8837-4fb3-8fe7-753addb33373', 'owner', '2025-10-10 09:05:00+00'),
    ('6ec7390d-1542-4592-9e53-93d4eab22bca', 'ca450968-8837-4fb3-8fe7-753addb33373', 'manager', '2025-10-10 09:05:00+00'),
    ('0a5a867f-1a0a-4612-b549-f8004cdfe052', 'ca450968-8837-4fb3-8fe7-753addb33373', 'host', '2025-10-11 10:05:00+00'),
    ('5586f5b0-a17d-4ea0-a46f-83b8e313923c', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'server', '2025-10-12 12:05:00+00');

INSERT INTO public.restaurant_invites (
    id,
    restaurant_id,
    email,
    role,
    token_hash,
    status,
    expires_at,
    invited_by,
    accepted_at,
    revoked_at,
    created_at,
    updated_at
) VALUES
    ('3c0fd49d-ebdb-4fea-b06d-b3efccadaa22', 'ca450968-8837-4fb3-8fe7-753addb33373', 'souschef@sajiloreserve.test', 'manager', 'hash-invite-manager', 'pending', '2025-12-01 00:00:00+00', '6babb126-c166-41a0-b9f2-57ef473b179b', NULL, NULL, '2025-10-15 08:00:00+00', '2025-10-19 09:00:00+00'),
    ('c74dae89-b7af-4366-8bdb-d81e36a27ff5', 'ca450968-8837-4fb3-8fe7-753addb33373', 'events@sajiloreserve.test', 'host', 'hash-invite-host', 'accepted', '2025-11-01 00:00:00+00', '6ec7390d-1542-4592-9e53-93d4eab22bca', '2025-10-16 12:00:00+00', NULL, '2025-10-15 08:05:00+00', '2025-10-19 09:00:00+00'),
    ('f2b0cf1d-a1b0-4d22-8a9f-47d144d2f9a2', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'seasonal@sajilo-riverside.test', 'server', 'hash-invite-server', 'revoked', '2025-11-15 00:00:00+00', '0a5a867f-1a0a-4612-b549-f8004cdfe052', NULL, '2025-10-18 09:00:00+00', '2025-10-15 08:10:00+00', '2025-10-18 09:00:00+00'),
    ('aa5bad0b-efcc-441d-a72f-7d79f293c80d', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'consultant@sajilo-riverside.test', 'manager', 'hash-invite-consultant', 'expired', '2025-09-30 00:00:00+00', '6babb126-c166-41a0-b9f2-57ef473b179b', NULL, NULL, '2025-08-30 08:00:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.customers (
    id,
    restaurant_id,
    full_name,
    email,
    phone,
    marketing_opt_in,
    auth_user_id,
    notes,
    created_at,
    updated_at
) VALUES
    ('da55f417-dd49-4f56-bc2f-00679d27ae03', 'ca450968-8837-4fb3-8fe7-753addb33373', 'Aisha Sharma', 'aisha.sharma@example.com', '+447700900555', true, NULL, 'Prefers vegetarian options', '2025-10-10 18:00:00+00', '2025-10-19 09:00:00+00'),
    ('5f63933f-5de3-4fc1-97d7-db63f44a695c', 'ca450968-8837-4fb3-8fe7-753addb33373', 'Liam Patel', 'liam.patel@example.com', '+447700900556', false, '0a5a867f-1a0a-4612-b549-f8004cdfe052', 'Works nearby, frequent guest', '2025-10-11 12:00:00+00', '2025-10-19 09:00:00+00'),
    ('ae5737a0-ac6b-447e-af67-127dd451c658', 'ca450968-8837-4fb3-8fe7-753addb33373', 'Grace Chen', 'grace.chen@example.com', '+447700900557', true, NULL, 'Allergic to peanuts', '2025-10-12 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('e5224e60-c706-4d43-9fac-c2a6ab15cfce', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'Michael Brown', 'michael.brown@example.com', '+12125550111', true, NULL, 'Enjoys river-facing tables', '2025-10-12 15:00:00+00', '2025-10-19 09:00:00+00'),
    ('510ac669-753e-421c-b1cb-806e95643405', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'Nina Alvarez', 'nina.alvarez@example.com', '+12125550112', false, '6ec7390d-1542-4592-9e53-93d4eab22bca', 'Corporate account contact', '2025-10-13 12:00:00+00', '2025-10-19 09:00:00+00'),
    ('baedeb8a-c6e8-47f6-a861-9f07390d62b6', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'Omar Khan', 'omar.khan@example.com', '+12125550113', true, NULL, 'Prefers quiet seating', '2025-10-14 08:00:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.customer_profiles (
    customer_id,
    first_booking_at,
    last_booking_at,
    total_bookings,
    total_covers,
    total_cancellations,
    marketing_opt_in,
    last_marketing_opt_in_at,
    preferences,
    notes,
    updated_at
) VALUES
    ('da55f417-dd49-4f56-bc2f-00679d27ae03', '2025-09-01 18:00:00+00', '2025-10-18 19:00:00+00', 5, 12, 1, true, '2025-10-10 18:00:00+00', '{"seating_preference":"window"}'::jsonb, 'Vegetarian tasting menu fan', '2025-10-19 09:00:00+00'),
    ('5f63933f-5de3-4fc1-97d7-db63f44a695c', '2025-09-10 12:30:00+00', '2025-10-17 13:00:00+00', 3, 6, 0, false, NULL, '{"drink":"sparkling water"}'::jsonb, NULL, '2025-10-19 09:00:00+00'),
    ('ae5737a0-ac6b-447e-af67-127dd451c658', '2025-09-20 19:00:00+00', '2025-10-18 20:00:00+00', 4, 10, 0, true, '2025-10-12 09:00:00+00', '{"allergies":["peanuts"]}'::jsonb, 'Needs allergy note', '2025-10-19 09:00:00+00'),
    ('e5224e60-c706-4d43-9fac-c2a6ab15cfce', '2025-09-25 18:00:00+00', '2025-10-18 21:00:00+00', 6, 18, 2, true, '2025-10-12 15:00:00+00', '{"view":"river"}'::jsonb, 'Birthday coming up in November', '2025-10-19 09:00:00+00'),
    ('510ac669-753e-421c-b1cb-806e95643405', '2025-10-01 11:30:00+00', '2025-10-17 12:00:00+00', 2, 4, 0, false, NULL, '{"company":"Alvarez Consulting"}'::jsonb, 'Corporate lunches monthly', '2025-10-19 09:00:00+00'),
    ('baedeb8a-c6e8-47f6-a861-9f07390d62b6', '2025-09-28 20:00:00+00', '2025-10-18 20:30:00+00', 3, 7, 1, true, '2025-10-14 08:00:00+00', '{"seating":"quiet"}'::jsonb, 'Prefers low music volume', '2025-10-19 09:00:00+00');

INSERT INTO public.loyalty_programs (
    id,
    restaurant_id,
    name,
    is_active,
    accrual_rule,
    tier_definitions,
    pilot_only,
    created_at,
    updated_at
) VALUES
    ('79273ff4-ac71-4b8c-8c95-3c4d5473f092', 'ca450968-8837-4fb3-8fe7-753addb33373', 'Downtown Dining Club', true, '{"type":"per_guest","base_points":10,"points_per_guest":5,"minimum_party_size":1}'::jsonb, '[{"tier":"bronze","min_points":0},{"tier":"silver","min_points":100},{"tier":"gold","min_points":250}]'::jsonb, false, '2025-10-10 08:00:00+00', '2025-10-19 09:00:00+00'),
    ('d14878a0-ad25-4134-96f6-ae5cb5abc575', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'Riverside Rewards', true, '{"type":"per_spend","base_points":5,"points_per_currency":1,"minimum_spend":20}'::jsonb, '[{"tier":"bronze","min_points":0},{"tier":"silver","min_points":200},{"tier":"gold","min_points":400},{"tier":"platinum","min_points":700}]'::jsonb, true, '2025-10-12 08:00:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.loyalty_points (
    id,
    restaurant_id,
    customer_id,
    total_points,
    tier,
    created_at,
    updated_at
) VALUES
    ('4f4b3e5b-b384-4eb8-8cfc-b45424f20880', 'ca450968-8837-4fb3-8fe7-753addb33373', 'da55f417-dd49-4f56-bc2f-00679d27ae03', 45, 'bronze', '2025-10-18 18:00:00+00', '2025-10-19 09:00:00+00'),
    ('2aeedced-b4a5-42a4-bb56-d59ec9727033', 'ca450968-8837-4fb3-8fe7-753addb33373', '5f63933f-5de3-4fc1-97d7-db63f44a695c', 180, 'silver', '2025-10-18 18:05:00+00', '2025-10-19 09:00:00+00'),
    ('743e89a9-998a-4f08-99b6-7b82036be6bc', 'ca450968-8837-4fb3-8fe7-753addb33373', 'ae5737a0-ac6b-447e-af67-127dd451c658', 320, 'gold', '2025-10-18 18:10:00+00', '2025-10-19 09:00:00+00'),
    ('2b34421d-a476-4c1a-b97e-49f4194eed48', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'e5224e60-c706-4d43-9fac-c2a6ab15cfce', 720, 'platinum', '2025-10-18 18:15:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.bookings (
    id,
    restaurant_id,
    customer_id,
    booking_date,
    start_time,
    end_time,
    start_at,
    end_at,
    party_size,
    seating_preference,
    status,
    customer_name,
    customer_email,
    customer_phone,
    notes,
    reference,
    source,
    created_at,
    updated_at,
    booking_type,
    idempotency_key,
    pending_ref,
    details,
    marketing_opt_in,
    confirmation_token,
    confirmation_token_expires_at,
    confirmation_token_used_at,
    auth_user_id,
    checked_in_at,
    checked_out_at,
    loyalty_points_awarded
) VALUES
    ('9a6839c8-0769-4df0-93c1-d00ed4242767', 'ca450968-8837-4fb3-8fe7-753addb33373', 'da55f417-dd49-4f56-bc2f-00679d27ae03', '2025-10-20', '19:00:00', '21:00:00', '2025-10-20 19:00:00+00', '2025-10-20 21:00:00+00', 2, 'any', 'confirmed', 'Aisha Sharma', 'aisha.sharma@example.com', '+447700900555', 'Celebrating anniversary', 'SRX-DTN-001', 'web', '2025-10-14 10:00:00+00', '2025-10-19 09:00:00+00', 'dinner', NULL, NULL, '{"occasion":"anniversary","allergies":["none"]}'::jsonb, true, 'cfm-token-001', '2025-10-19 09:00:00+00', NULL, '6ec7390d-1542-4592-9e53-93d4eab22bca', NULL, NULL, 40),
    ('7f0ef837-3b4e-4b12-a9dc-758b609867c3', 'ca450968-8837-4fb3-8fe7-753addb33373', '5f63933f-5de3-4fc1-97d7-db63f44a695c', '2025-10-21', '12:00:00', '13:00:00', '2025-10-21 12:00:00+00', '2025-10-21 13:00:00+00', 3, 'indoor', 'pending', 'Liam Patel', 'liam.patel@example.com', '+447700900556', 'Team lunch', 'SRX-DTN-002', 'phone', '2025-10-15 09:00:00+00', '2025-10-19 09:00:00+00', 'lunch', 'guest-phone-call-123', 'PEND-20251021-01', '{"notes":"Flexible on timing"}'::jsonb, false, NULL, NULL, NULL, NULL, NULL, NULL, 0),
    ('a6c44539-d296-4bae-8554-bfc5af639dce', 'ca450968-8837-4fb3-8fe7-753addb33373', 'ae5737a0-ac6b-447e-af67-127dd451c658', '2025-10-19', '18:00:00', '19:30:00', '2025-10-19 18:00:00+00', '2025-10-19 19:30:00+00', 4, 'outdoor', 'cancelled', 'Grace Chen', 'grace.chen@example.com', '+447700900557', 'Cancelled due to travel', 'SRX-DTN-003', 'web', '2025-10-08 11:00:00+00', '2025-10-19 09:00:00+00', 'drinks', NULL, NULL, '{"cancel_reason":"travel"}'::jsonb, true, NULL, NULL, NULL, NULL, NULL, NULL, 0),
    ('c4c05ff9-8b8a-4f1d-89b4-0d17bda8f08c', 'ca450968-8837-4fb3-8fe7-753addb33373', '5f63933f-5de3-4fc1-97d7-db63f44a695c', '2025-10-18', '09:30:00', '10:30:00', '2025-10-18 09:30:00+00', '2025-10-18 10:30:00+00', 2, 'bar', 'completed', 'Liam Patel', 'liam.patel@example.com', '+447700900556', 'Breakfast meeting', 'SRX-DTN-004', 'walk_in', '2025-10-18 08:45:00+00', '2025-10-18 10:45:00+00', 'breakfast', NULL, NULL, '{"walk_in":true}'::jsonb, false, NULL, NULL, NULL, '0a5a867f-1a0a-4612-b549-f8004cdfe052', '2025-10-18 09:25:00+00', '2025-10-18 10:40:00+00', 15),
    ('0266ae6c-f40f-4946-8545-594eca1cb3b0', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'e5224e60-c706-4d43-9fac-c2a6ab15cfce', '2025-10-20', '20:00:00', '22:00:00', '2025-10-20 20:00:00+00', '2025-10-20 22:00:00+00', 5, 'window', 'no_show', 'Michael Brown', 'michael.brown@example.com', '+12125550111', 'VIP tasting', 'SRX-RIV-001', 'app', '2025-10-13 14:00:00+00', '2025-10-19 09:00:00+00', 'dinner', NULL, NULL, '{"chef_table":true}'::jsonb, true, 'cfm-token-002', '2025-10-19 09:00:00+00', NULL, NULL, NULL, NULL, 25),
    ('4f58c874-4b6f-4025-9f89-b25a23a2d47b', 'b19ad348-6a54-4821-863b-ac591e7790ae', '510ac669-753e-421c-b1cb-806e95643405', '2025-10-22', '13:00:00', '14:30:00', '2025-10-22 13:00:00+00', '2025-10-22 14:30:00+00', 6, 'quiet', 'pending_allocation', 'Nina Alvarez', 'nina.alvarez@example.com', '+12125550112', 'Corporate lunch requiring projector', 'SRX-RIV-002', 'email', '2025-10-16 12:00:00+00', '2025-10-19 09:00:00+00', 'lunch', NULL, 'ALLOC-REQ-20251022', '{"requires_projector":true}'::jsonb, false, NULL, NULL, NULL, '6ec7390d-1542-4592-9e53-93d4eab22bca', NULL, NULL, 10),
    ('b2396890-7d32-47f1-9c2b-9961977586ea', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'baedeb8a-c6e8-47f6-a861-9f07390d62b6', '2025-10-19', '17:00:00', '18:30:00', '2025-10-19 17:00:00+00', '2025-10-19 18:30:00+00', 3, 'booth', 'checked_in', 'Omar Khan', 'omar.khan@example.com', '+12125550113', 'Prefers quiet corner', 'SRX-RIV-003', 'app', '2025-10-12 09:30:00+00', '2025-10-19 17:05:00+00', 'drinks', NULL, NULL, '{"music_level":"low"}'::jsonb, true, 'cfm-token-003', '2025-10-19 09:00:00+00', '2025-10-19 17:05:00+00', '0a5a867f-1a0a-4612-b549-f8004cdfe052', '2025-10-19 17:05:00+00', NULL, 20);

INSERT INTO public.booking_versions (
    version_id,
    booking_id,
    restaurant_id,
    change_type,
    changed_by,
    changed_at,
    old_data,
    new_data,
    created_at
) VALUES
    ('ae38ae32-a134-405a-8873-03c46cdda347', '9a6839c8-0769-4df0-93c1-d00ed4242767', 'ca450968-8837-4fb3-8fe7-753addb33373', 'created', 'owner@sajiloreserve.test', '2025-10-14 10:00:00+00', NULL, '{"party_size":2,"status":"confirmed"}'::jsonb, '2025-10-14 10:00:00+00'),
    ('2480d3f9-2c22-4f44-ba91-0d61efe645fa', '7f0ef837-3b4e-4b12-a9dc-758b609867c3', 'ca450968-8837-4fb3-8fe7-753addb33373', 'updated', 'manager@sajiloreserve.test', '2025-10-17 09:00:00+00', '{"party_size":2}'::jsonb, '{"party_size":3}'::jsonb, '2025-10-17 09:00:00+00'),
    ('9725fd52-5474-4dc5-bff3-0dfaa6580275', 'a6c44539-d296-4bae-8554-bfc5af639dce', 'ca450968-8837-4fb3-8fe7-753addb33373', 'cancelled', 'host@sajiloreserve.test', '2025-10-18 08:00:00+00', '{"status":"confirmed"}'::jsonb, '{"status":"cancelled"}'::jsonb, '2025-10-18 08:00:00+00'),
    ('bf5ac2a4-ab96-4d4f-aee4-3c8b36d80b9e', '0266ae6c-f40f-4946-8545-594eca1cb3b0', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'deleted', 'system@automation', '2025-10-21 23:00:00+00', '{"status":"no_show"}'::jsonb, NULL, '2025-10-21 23:00:00+00');

INSERT INTO public.booking_state_history (
    booking_id,
    from_status,
    to_status,
    changed_by,
    changed_at,
    reason,
    metadata
) VALUES
    ('9a6839c8-0769-4df0-93c1-d00ed4242767', 'pending', 'confirmed', '6ec7390d-1542-4592-9e53-93d4eab22bca', '2025-10-14 10:00:00+00', 'Confirmed by manager', '{"channel":"web"}'::jsonb),
    ('7f0ef837-3b4e-4b12-a9dc-758b609867c3', NULL, 'pending', '0a5a867f-1a0a-4612-b549-f8004cdfe052', '2025-10-15 09:00:00+00', 'Initial request received', '{"channel":"phone"}'::jsonb),
    ('7f0ef837-3b4e-4b12-a9dc-758b609867c3', 'pending', 'pending_allocation', '5586f5b0-a17d-4ea0-a46f-83b8e313923c', '2025-10-18 09:00:00+00', 'Awaiting floor plan finalization', '{"note":"Need larger table"}'::jsonb),
    ('a6c44539-d296-4bae-8554-bfc5af639dce', 'confirmed', 'cancelled', '0a5a867f-1a0a-4612-b549-f8004cdfe052', '2025-10-18 08:00:00+00', 'Guest cancelled online', '{"channel":"web"}'::jsonb),
    ('c4c05ff9-8b8a-4f1d-89b4-0d17bda8f08c', 'confirmed', 'checked_in', '0a5a867f-1a0a-4612-b549-f8004cdfe052', '2025-10-18 09:25:00+00', 'Guest arrived early', '{"source":"host"}'::jsonb),
    ('c4c05ff9-8b8a-4f1d-89b4-0d17bda8f08c', 'checked_in', 'completed', '6ec7390d-1542-4592-9e53-93d4eab22bca', '2025-10-18 10:40:00+00', 'Bill settled', '{"payment":"card"}'::jsonb),
    ('b2396890-7d32-47f1-9c2b-9961977586ea', 'confirmed', 'checked_in', '5586f5b0-a17d-4ea0-a46f-83b8e313923c', '2025-10-19 17:05:00+00', 'Guest seated', '{"device":"ipad"}'::jsonb);

INSERT INTO public.booking_slots (
    id,
    restaurant_id,
    slot_date,
    slot_time,
    service_period_id,
    available_capacity,
    reserved_count,
    version,
    created_at,
    updated_at
) VALUES
    ('822de213-b875-4663-958f-f46d0553ce96', 'ca450968-8837-4fb3-8fe7-753addb33373', '2025-10-20', '19:00:00', '0504a631-bad3-4500-8c20-b6a14ad305be', 20, 8, 2, '2025-10-14 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('de55c1a2-89ab-4552-838a-641abc50b512', 'ca450968-8837-4fb3-8fe7-753addb33373', '2025-10-21', '12:00:00', '72cafd94-fb71-4b58-bc3e-abef2b745e2e', 25, 12, 3, '2025-10-15 09:00:00+00', '2025-10-19 09:00:00+00'),
    ('71a6bc43-9cc0-4e40-9fad-aa7414215cb4', 'b19ad348-6a54-4821-863b-ac591e7790ae', '2025-10-20', '20:00:00', 'afd32852-7900-4e1b-9943-f3b3b2d5808e', 18, 5, 1, '2025-10-13 14:00:00+00', '2025-10-19 09:00:00+00'),
    ('91707f20-4981-49c0-a1c8-42a5c45d0903', 'b19ad348-6a54-4821-863b-ac591e7790ae', '2025-10-22', '13:00:00', '26b4c774-67fa-40c5-8b38-4a46bc99dd42', 15, 6, 1, '2025-10-16 12:00:00+00', '2025-10-19 09:00:00+00');

INSERT INTO public.booking_table_assignments (
    id,
    booking_id,
    table_id,
    slot_id,
    assigned_at,
    assigned_by,
    notes,
    created_at,
    updated_at,
    idempotency_key,
    merge_group_id
) VALUES
    ('ad870be8-9a2e-482b-9533-f9046d83210a', '9a6839c8-0769-4df0-93c1-d00ed4242767', '81196066-fee5-4d0c-a42a-197080a88e66', '822de213-b875-4663-958f-f46d0553ce96', '2025-10-14 10:05:00+00', '6ec7390d-1542-4592-9e53-93d4eab22bca', 'Requested secluded table', '2025-10-14 10:05:00+00', '2025-10-19 09:00:00+00', 'assign-001', NULL),
    ('c40bb1cc-1b43-4ece-b7d8-1970c8878f89', '7f0ef837-3b4e-4b12-a9dc-758b609867c3', '9ac1b9e5-ebff-4a61-8dc3-5b8356482ada', 'de55c1a2-89ab-4552-838a-641abc50b512', '2025-10-18 09:10:00+00', '0a5a867f-1a0a-4612-b549-f8004cdfe052', 'Assigning lounge sofa', '2025-10-18 09:10:00+00', '2025-10-19 09:00:00+00', 'assign-002', NULL),
    ('dfd72179-94dd-4c90-adad-e0fb3b8ed592', '0266ae6c-f40f-4946-8545-594eca1cb3b0', 'c565eda0-1ea9-4375-b35d-d7f35c471342', '71a6bc43-9cc0-4e40-9fad-aa7414215cb4', '2025-10-14 14:00:00+00', '5586f5b0-a17d-4ea0-a46f-83b8e313923c', 'Chef table reserved', '2025-10-14 14:00:00+00', '2025-10-19 09:00:00+00', 'assign-003', NULL),
    ('2a925034-9436-416b-b55a-62b6fbeca53c', 'b2396890-7d32-47f1-9c2b-9961977586ea', '53808dd9-8fa2-4c3d-b2ad-d56398f83b37', '71a6bc43-9cc0-4e40-9fad-aa7414215cb4', '2025-10-19 16:30:00+00', '0a5a867f-1a0a-4612-b549-f8004cdfe052', 'Quiet lounge placement', '2025-10-19 16:30:00+00', '2025-10-19 17:05:00+00', 'assign-004', NULL);

INSERT INTO public.allocations (
    id,
    booking_id,
    resource_type,
    resource_id,
    created_at,
    updated_at,
    shadow,
    restaurant_id,
    "window",
    created_by,
    is_maintenance
) VALUES
    ('df857819-df20-4b7a-9726-2325cb4387f9', '9a6839c8-0769-4df0-93c1-d00ed4242767', 'table', '81196066-fee5-4d0c-a42a-197080a88e66', '2025-10-14 10:05:00+00', '2025-10-19 09:00:00+00', false, 'ca450968-8837-4fb3-8fe7-753addb33373', tstzrange('2025-10-20 18:45:00+00', '2025-10-20 21:15:00+00', '[)'), '6ec7390d-1542-4592-9e53-93d4eab22bca', false),
    -- Merge group allocation temporarily removed
    -- ('51456743-eb5d-407c-ba83-a77e753dcc92', '7f0ef837-3b4e-4b12-a9dc-758b609867c3', 'merge_group', '83a72efe-1259-48b0-b2a0-caf4cae717d2', '2025-10-18 09:10:00+00', '2025-10-19 09:00:00+00', false, 'ca450968-8837-4fb3-8fe7-753addb33373', tstzrange('2025-10-21 11:30:00+00', '2025-10-21 13:30:00+00', '[)'), '0a5a867f-1a0a-4612-b549-f8004cdfe052', false),
    ('8bceb36c-997d-4bee-8342-f0db953f7214', NULL, 'table', '75ff0ee8-2970-4666-b4b3-e8875957fcf3', '2025-10-01 09:20:00+00', '2025-10-19 09:00:00+00', true, 'ca450968-8837-4fb3-8fe7-753addb33373', tstzrange('2025-10-01 00:00:00+00', '2025-11-15 00:00:00+00', '[)'), '6babb126-c166-41a0-b9f2-57ef473b179b', true);

INSERT INTO public.capacity_metrics_hourly (restaurant_id, window_start, success_count, conflict_count, capacity_exceeded_count, created_at, updated_at)
VALUES
    ('ca450968-8837-4fb3-8fe7-753addb33373', '2025-10-18 18:00:00+00', 18, 2, 1, '2025-10-18 19:00:00+00', '2025-10-18 19:00:00+00'),
    ('ca450968-8837-4fb3-8fe7-753addb33373', '2025-10-19 20:00:00+00', 12, 1, 0, '2025-10-19 21:00:00+00', '2025-10-19 21:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', '2025-10-18 19:00:00+00', 15, 3, 2, '2025-10-18 20:00:00+00', '2025-10-18 20:00:00+00'),
    ('b19ad348-6a54-4821-863b-ac591e7790ae', '2025-10-19 21:00:00+00', 10, 0, 0, '2025-10-19 22:00:00+00', '2025-10-19 22:00:00+00');

INSERT INTO public.loyalty_point_events (
    id,
    restaurant_id,
    customer_id,
    booking_id,
    points_change,
    event_type,
    schema_version,
    metadata,
    created_at
) VALUES
    ('77707d3d-9f03-4344-9081-1db69dff8f9c', 'ca450968-8837-4fb3-8fe7-753addb33373', 'da55f417-dd49-4f56-bc2f-00679d27ae03', '9a6839c8-0769-4df0-93c1-d00ed4242767', 40, 'points_awarded', 1, '{"reason":"anniversary"}'::jsonb, '2025-10-20 21:05:00+00'),
    ('378b903a-0980-4d48-b62f-c26856eaf286', 'ca450968-8837-4fb3-8fe7-753addb33373', '5f63933f-5de3-4fc1-97d7-db63f44a695c', 'c4c05ff9-8b8a-4f1d-89b4-0d17bda8f08c', 15, 'points_awarded', 1, '{"channel":"walk_in"}'::jsonb, '2025-10-18 10:45:00+00'),
    ('df9de652-cb08-4dcd-a8de-11846fcc729a', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'e5224e60-c706-4d43-9fac-c2a6ab15cfce', '0266ae6c-f40f-4946-8545-594eca1cb3b0', -20, 'points_adjusted', 1, '{"reason":"no_show"}'::jsonb, '2025-10-21 00:00:00+00'),
    ('0fc96ed5-13d7-4339-85ac-4a91dbfced12', 'b19ad348-6a54-4821-863b-ac591e7790ae', 'baedeb8a-c6e8-47f6-a861-9f07390d62b6', 'b2396890-7d32-47f1-9c2b-9961977586ea', 20, 'points_awarded', 1, '{"note":"checked_in"}'::jsonb, '2025-10-19 18:30:00+00');

INSERT INTO public.analytics_events (
    id,
    event_type,
    schema_version,
    restaurant_id,
    booking_id,
    customer_id,
    emitted_by,
    payload,
    occurred_at,
    created_at
) VALUES
    ('8bceb36c-997d-4bee-8342-f0db953f7214', 'booking.created', '1.0', 'ca450968-8837-4fb3-8fe7-753addb33373', '9a6839c8-0769-4df0-93c1-d00ed4242767', 'da55f417-dd49-4f56-bc2f-00679d27ae03', 'server', '{"channel":"web","party_size":2}'::jsonb, '2025-10-14 10:00:00+00', '2025-10-14 10:00:00+00'),
    ('77707d3d-9f03-4344-9081-1db69dff8f9c', 'booking.cancelled', '1.0', 'ca450968-8837-4fb3-8fe7-753addb33373', 'a6c44539-d296-4bae-8554-bfc5af639dce', 'ae5737a0-ac6b-447e-af67-127dd451c658', 'server', '{"actor":"guest"}'::jsonb, '2025-10-18 08:00:00+00', '2025-10-18 08:00:00+00'),
    ('378b903a-0980-4d48-b62f-c26856eaf286', 'booking.allocated', '1.0', 'ca450968-8837-4fb3-8fe7-753addb33373', '7f0ef837-3b4e-4b12-a9dc-758b609867c3', '5f63933f-5de3-4fc1-97d7-db63f44a695c', 'automation', '{"merge_group":true}'::jsonb, '2025-10-18 09:10:00+00', '2025-10-18 09:10:00+00'),
    ('df9de652-cb08-4dcd-a8de-11846fcc729a', 'booking.waitlisted', '1.0', 'b19ad348-6a54-4821-863b-ac591e7790ae', '4f58c874-4b6f-4025-9f89-b25a23a2d47b', '510ac669-753e-421c-b1cb-806e95643405', 'server', '{"note":"awaiting larger table"}'::jsonb, '2025-10-18 12:00:00+00', '2025-10-18 12:00:00+00');

INSERT INTO public.audit_logs (id, entity, entity_id, action, actor, metadata, created_at)
VALUES
    ('8ee29342-2583-4ec9-ab23-4769a4c9f77a', 'booking', 'SRX-DTN-001', 'status_change', 'manager@sajiloreserve.test', '{"from":"pending","to":"confirmed"}'::jsonb, '2025-10-14 10:00:00+00'),
    ('c5c98de0-c460-45c4-94dd-0a3938817dda', 'restaurant', 'sajilo-reserve-downtown', 'policy_update', 'owner@sajiloreserve.test', '{"field":"booking_policy"}'::jsonb, '2025-10-12 08:00:00+00');

INSERT INTO public.profile_update_requests (id, profile_id, idempotency_key, payload_hash, applied_at)
VALUES
    ('41bf10cd-c622-4ed4-8e96-4f684f1c080a', '6ec7390d-1542-4592-9e53-93d4eab22bca', 'profile-manager-001', 'sha256:123abc', '2025-10-12 09:00:00+00'),
    ('91cf693c-5350-46f9-ab8d-b57e08f23ace', '0a5a867f-1a0a-4612-b549-f8004cdfe052', 'profile-host-001', 'sha256:789xyz', '2025-10-13 10:00:00+00');

INSERT INTO public.stripe_events (id, event_id, event_type, payload, processed, created_at)
VALUES
    ('13672ac8-7d0e-4ac8-af7b-68bb109b42d3', 'evt_test_001', 'payment_intent.succeeded', '{"object":"event","amount":12500}'::jsonb, true, '2025-10-18 10:40:00+00'),
    ('7f68211c-d115-4be9-a8e1-c5fbaad6a2e9', 'evt_test_002', 'charge.refunded', '{"object":"event","amount":5000}'::jsonb, false, '2025-10-19 11:00:00+00');

COMMIT;

\echo 'Seed data loaded successfully.'
