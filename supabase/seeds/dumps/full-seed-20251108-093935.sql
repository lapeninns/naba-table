-- Full database seed dump
-- Generated: Sat Nov  8 09:43:04 GMT 2025
-- Database: Production Supabase

-- IMPORTANT: This will TRUNCATE all tables and reset data!
-- Run with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/dumps/full-seed-20251108-093935.sql

BEGIN;

-- Truncate tables (respects FK constraints with CASCADE)


-- ============================================
-- restaurants
-- ============================================

--
-- PostgreSQL database dump
--

\restrict hSmxd0AOWYnaZicdDQcYIWanBHj8egY4htSRFIjkuN1gichOaVRr1JdC87mUh4b

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: restaurants; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.restaurants VALUES ('359d7726-f56f-4bcd-9be5-c3b240b8713f', 'White Horse Pub', 'white-horse-pub-waterbeach', 'Europe/London', 50, '2025-11-07 18:23:57.052909+00', '2025-11-07 20:46:06.572833+00', 'whitehorse@lapeninns.com', NULL, NULL, NULL, 15, 236, true, 15, 'https://mqtchcaavsucsdjskptc.supabase.co/storage/v1/object/public/restaurant-branding/359d7726-f56f-4bcd-9be5-c3b240b8713f/mhpb083g-88e78f61-cff7-49e1-8ce2-3e2a124643a6.png?v=mhpb083g');


--
-- PostgreSQL database dump complete
--

\unrestrict hSmxd0AOWYnaZicdDQcYIWanBHj8egY4htSRFIjkuN1gichOaVRr1JdC87mUh4b


-- ============================================
-- zones
-- ============================================

--
-- PostgreSQL database dump
--

\restrict UnPFeptC5BaE6Uk6WmAZ7CEfHhBMmnPlq2U5yH2PiHqEb9sKN3LwziwzAoAwzrg

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: zones; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.zones VALUES ('81429804-3f66-47da-984b-4284ce941eed', '359d7726-f56f-4bcd-9be5-c3b240b8713f', 'Main Bar', 1, '2025-11-07 18:23:57.052909+00', '2025-11-07 18:23:57.052909+00', 'indoor');
INSERT INTO public.zones VALUES ('da80cdb7-9a53-4b7c-8d66-543718d56a4f', '359d7726-f56f-4bcd-9be5-c3b240b8713f', 'Dining Room', 2, '2025-11-07 18:23:57.052909+00', '2025-11-07 18:23:57.052909+00', 'indoor');
INSERT INTO public.zones VALUES ('e53e2e62-7659-4c64-b96f-ce2db9145338', '359d7726-f56f-4bcd-9be5-c3b240b8713f', 'Garden', 3, '2025-11-07 18:23:57.052909+00', '2025-11-07 18:23:57.052909+00', 'outdoor');


--
-- PostgreSQL database dump complete
--

\unrestrict UnPFeptC5BaE6Uk6WmAZ7CEfHhBMmnPlq2U5yH2PiHqEb9sKN3LwziwzAoAwzrg


-- ============================================
-- allowed_capacities
-- ============================================

--
-- PostgreSQL database dump
--

\restrict xB58rPYdAJlivJMkvJ2gt6SrlSbdWoegb5Z7LcV91jSduM8AkQOVmEEg0h4fuph

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: allowed_capacities; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.allowed_capacities VALUES ('359d7726-f56f-4bcd-9be5-c3b240b8713f', 2, '2025-11-07 18:23:57.052909+00', '2025-11-07 18:23:57.052909+00');
INSERT INTO public.allowed_capacities VALUES ('359d7726-f56f-4bcd-9be5-c3b240b8713f', 4, '2025-11-07 18:23:57.052909+00', '2025-11-07 18:23:57.052909+00');
INSERT INTO public.allowed_capacities VALUES ('359d7726-f56f-4bcd-9be5-c3b240b8713f', 6, '2025-11-07 18:23:57.052909+00', '2025-11-07 18:23:57.052909+00');
INSERT INTO public.allowed_capacities VALUES ('359d7726-f56f-4bcd-9be5-c3b240b8713f', 8, '2025-11-07 18:23:57.052909+00', '2025-11-07 18:23:57.052909+00');


--
-- PostgreSQL database dump complete
--

\unrestrict xB58rPYdAJlivJMkvJ2gt6SrlSbdWoegb5Z7LcV91jSduM8AkQOVmEEg0h4fuph


-- ============================================
-- table_adjacencies
-- ============================================

--
-- PostgreSQL database dump
--

\restrict Qt39dN4Z2soTVsiiOsEgKkO9gp2CTrBrfHTQxPpGQetghg5xichkNc6mhsoBwwT

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: table_adjacencies; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

\unrestrict Qt39dN4Z2soTVsiiOsEgKkO9gp2CTrBrfHTQxPpGQetghg5xichkNc6mhsoBwwT


-- ============================================
-- bookings
-- ============================================

--
-- PostgreSQL database dump
--

\restrict MnXO08IZD5ug4ZLjXD34XCl3v6PKvuzQrWY2HN4lFsG1OMgGCX4tHRRZHsAHAiT

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.bookings VALUES ('35eef281-1995-4a58-8728-fd5acb9fcf77', '359d7726-f56f-4bcd-9be5-c3b240b8713f', '619cec54-806c-465f-9e3e-24f82960e2a7', '2025-11-27', '17:00:00', '19:00:00', '2025-11-27 17:00:00+00', '2025-11-27 19:00:00+00', 12, 'any', 'confirmed', 'Aman Shrestha', 'amanshresthaaaaa@gmail.com', '+447467586751', NULL, 'T374Y858LU', 'api', '2025-11-07 22:23:52.205682+00', '2025-11-07 22:24:15.424733+00', 'dinner', 'e8c1f9a9-787d-45eb-914f-5bbd6ff2792e', 'e8c1f9a9-787d-45eb-914f-5bbd6ff2792e', NULL, '{"fallback": "missing_rpc_booking_record"}', true, 'dWvGSGx3k8dGSVedTr1WljluFjJkzLq1PMVBr0Op0qY', '2025-11-07 23:24:15.122+00', NULL, NULL, NULL, NULL, 0, NULL, 'da80cdb7-9a53-4b7c-8d66-543718d56a4f', 'booking-35eef281-1995-4a58-8728-fd5acb9fcf77-auto-assign-054fa7f45722');
INSERT INTO public.bookings VALUES ('296816c3-6e4c-46f2-9594-ade6d6992344', '359d7726-f56f-4bcd-9be5-c3b240b8713f', '619cec54-806c-465f-9e3e-24f82960e2a7', '2025-11-26', '18:00:00', '21:56:00', '2025-11-26 18:00:00+00', '2025-11-26 21:56:00+00', 12, 'any', 'confirmed', 'Aman Shrestha', 'amanshresthaaaaa@gmail.com', '+447467586751', '', 'I5IEYB59GY', 'api', '2025-11-07 20:47:09.612269+00', '2025-11-07 21:43:34.115193+00', 'dinner', '1351e060-764b-4f63-a962-d1ba8df344dd', '1351e060-764b-4f63-a962-d1ba8df344dd', NULL, '{"fallback": "missing_rpc_booking_record"}', true, 'Wl80VbkqJZp1x4WvQrJdQ6XWyQCwlqwGi9ny-XaBBqo', '2025-11-07 21:47:32.032+00', NULL, NULL, NULL, NULL, 0, NULL, '81429804-3f66-47da-984b-4284ce941eed', 'booking-296816c3-6e4c-46f2-9594-ade6d6992344-auto-assign-c03fca85680f');
INSERT INTO public.bookings VALUES ('38ca2be3-818d-484d-bb49-95cff4e9f1d4', '359d7726-f56f-4bcd-9be5-c3b240b8713f', '619cec54-806c-465f-9e3e-24f82960e2a7', '2025-11-27', '19:00:00', '22:56:00', '2025-11-27 19:00:00+00', '2025-11-27 22:56:00+00', 5, 'any', 'confirmed', 'Aman Shrestha', 'amanshresthaaaaa@gmail.com', '+447467586751', '', 'WHW37ZHFM3', 'api', '2025-11-07 20:28:30.187252+00', '2025-11-07 22:25:23.139342+00', 'dinner', '0474e0f3-db5b-4f01-afd4-72e143789e80', '0474e0f3-db5b-4f01-afd4-72e143789e80', NULL, '{"fallback": "missing_rpc_booking_record"}', true, 'CU5nDWSQ3yy3JRX4DSjc-Me_3xtRXJtFI1wSv9fxR-Y', '2025-11-07 21:28:48.72+00', NULL, NULL, NULL, NULL, 0, NULL, 'da80cdb7-9a53-4b7c-8d66-543718d56a4f', 'booking-38ca2be3-818d-484d-bb49-95cff4e9f1d4-auto-assign-596daab24ece');
INSERT INTO public.bookings VALUES ('406666b5-8b48-438a-9362-c6950bc0dbaa', '359d7726-f56f-4bcd-9be5-c3b240b8713f', '619cec54-806c-465f-9e3e-24f82960e2a7', '2025-11-28', '13:00:00', '16:56:00', '2025-11-28 13:00:00+00', '2025-11-28 16:56:00+00', 5, 'any', 'confirmed', 'Aman Shrestha', 'amanshresthaaaaa@gmail.com', '+447467586751', '', 'Y3RA7G2G20', 'api', '2025-11-07 22:04:52.468356+00', '2025-11-07 22:06:26.213526+00', 'lunch', '0aebc325-80b8-49fb-87fe-56c077f10c26', '0aebc325-80b8-49fb-87fe-56c077f10c26', NULL, '{"fallback": "missing_rpc_booking_record"}', true, 'QQYNFBIiB33cbC66XJQn6oWeYuRaENLxG5H8oI-89tY', '2025-11-07 23:05:15.112+00', NULL, NULL, NULL, NULL, 0, NULL, 'da80cdb7-9a53-4b7c-8d66-543718d56a4f', 'booking-406666b5-8b48-438a-9362-c6950bc0dbaa-auto-assign-c3cc27d89552');
INSERT INTO public.bookings VALUES ('50fb0cb3-0cf9-41f8-9dba-40a4fb4e6d6a', '359d7726-f56f-4bcd-9be5-c3b240b8713f', '619cec54-806c-465f-9e3e-24f82960e2a7', '2025-11-19', '13:00:00', '16:56:00', '2025-11-19 13:00:00+00', '2025-11-19 16:56:00+00', 5, 'any', 'confirmed', 'Aman Shrestha', 'amanshresthaaaaa@gmail.com', '+447467586751', '', 'PGNSTOXE6Y', 'api', '2025-11-08 09:26:29.725164+00', '2025-11-08 09:28:01.762316+00', 'lunch', '225ca28f-8aeb-4f6d-839b-9ba850c9476e', '225ca28f-8aeb-4f6d-839b-9ba850c9476e', NULL, '{"fallback": "missing_rpc_booking_record"}', true, 'Q05-aFsWADDGcXFVoF9khtj8s2lqqygETOD6L8C9Xp4', '2025-11-08 10:26:52.792+00', NULL, NULL, NULL, NULL, 0, NULL, 'da80cdb7-9a53-4b7c-8d66-543718d56a4f', 'booking-50fb0cb3-0cf9-41f8-9dba-40a4fb4e6d6a-auto-assign-9ebe57047fbe');


--
-- PostgreSQL database dump complete
--

\unrestrict MnXO08IZD5ug4ZLjXD34XCl3v6PKvuzQrWY2HN4lFsG1OMgGCX4tHRRZHsAHAiT


-- ============================================
-- booking_table_assignments
-- ============================================

--
-- PostgreSQL database dump
--

\restrict 0t2fZf60XJOLhgTasTa6zPyANuZZe3vwkkU5Kory9DG6VM7l0mrgF46kFSnX8Pe

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: booking_table_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.booking_table_assignments VALUES ('20cb6b87-68d2-4a1c-91ad-86db776dc93c', '38ca2be3-818d-484d-bb49-95cff4e9f1d4', '21b0c526-1d36-49bd-91a2-b9d8e7367281', 'b0dd583b-fa3b-44f0-af20-fc101fbd9ae4', '2025-11-07 20:28:58.257319+00', NULL, NULL, '2025-11-07 20:28:58.257319+00', '2025-11-07 20:29:00.738121+00', 'booking-38ca2be3-818d-484d-bb49-95cff4e9f1d4-auto-assign-596daab24ece', '2025-11-27 19:00:00+00', '2025-11-27 20:35:00+00', NULL, 'd28e285f-b014-4882-9126-22be9bf97114');
INSERT INTO public.booking_table_assignments VALUES ('84b01dce-9714-4643-9324-c884034342ff', '38ca2be3-818d-484d-bb49-95cff4e9f1d4', '98bb1543-c1f0-48e5-ae31-b94fc93eeb84', 'b0dd583b-fa3b-44f0-af20-fc101fbd9ae4', '2025-11-07 20:28:58.257319+00', NULL, NULL, '2025-11-07 20:28:58.257319+00', '2025-11-07 20:29:00.738121+00', 'booking-38ca2be3-818d-484d-bb49-95cff4e9f1d4-auto-assign-596daab24ece', '2025-11-27 19:00:00+00', '2025-11-27 20:35:00+00', NULL, 'd28e285f-b014-4882-9126-22be9bf97114');
INSERT INTO public.booking_table_assignments VALUES ('5f40d614-e8f7-4660-8beb-050c1f0faf83', '296816c3-6e4c-46f2-9594-ade6d6992344', '7bb29004-71b2-423d-935c-9e6e70cbb88e', '6a511add-ec27-4730-9e38-75a4f28004ad', '2025-11-07 20:47:23.257222+00', NULL, NULL, '2025-11-07 20:47:23.257222+00', '2025-11-07 20:47:26.024372+00', 'booking-296816c3-6e4c-46f2-9594-ade6d6992344-auto-assign-c03fca85680f', '2025-11-26 18:00:00+00', '2025-11-26 19:05:00+00', NULL, NULL);
INSERT INTO public.booking_table_assignments VALUES ('c3a66aa4-f46f-469e-9700-4293532274cc', '406666b5-8b48-438a-9362-c6950bc0dbaa', '21b0c526-1d36-49bd-91a2-b9d8e7367281', '9478b2bf-ad50-44f2-9224-e5faddc81ee5', '2025-11-07 22:05:06.343902+00', NULL, NULL, '2025-11-07 22:05:06.343902+00', '2025-11-07 22:05:08.864283+00', 'booking-406666b5-8b48-438a-9362-c6950bc0dbaa-auto-assign-c3cc27d89552', '2025-11-28 13:00:00+00', '2025-11-28 14:30:00+00', NULL, '6fefb21a-641f-445b-8735-e3385352d302');
INSERT INTO public.booking_table_assignments VALUES ('9f50eecf-0bef-4193-8976-8dae030d4c69', '406666b5-8b48-438a-9362-c6950bc0dbaa', '98bb1543-c1f0-48e5-ae31-b94fc93eeb84', '9478b2bf-ad50-44f2-9224-e5faddc81ee5', '2025-11-07 22:05:06.343902+00', NULL, NULL, '2025-11-07 22:05:06.343902+00', '2025-11-07 22:05:08.864283+00', 'booking-406666b5-8b48-438a-9362-c6950bc0dbaa-auto-assign-c3cc27d89552', '2025-11-28 13:00:00+00', '2025-11-28 14:30:00+00', NULL, '6fefb21a-641f-445b-8735-e3385352d302');
INSERT INTO public.booking_table_assignments VALUES ('745db867-50ea-49d4-a0d0-72dac9830831', '35eef281-1995-4a58-8728-fd5acb9fcf77', '21b0c526-1d36-49bd-91a2-b9d8e7367281', '200d66a2-e96e-4796-955f-526dce91103d', '2025-11-07 22:24:06.121726+00', NULL, NULL, '2025-11-07 22:24:06.121726+00', '2025-11-07 22:24:09.243276+00', 'booking-35eef281-1995-4a58-8728-fd5acb9fcf77-auto-assign-054fa7f45722', '2025-11-27 17:00:00+00', '2025-11-27 18:35:00+00', NULL, '2c68afe0-5c98-4ae0-94bc-e113238ac882');
INSERT INTO public.booking_table_assignments VALUES ('d38194ec-ef92-4b12-ba9a-98bfbbf3cd27', '35eef281-1995-4a58-8728-fd5acb9fcf77', '98bb1543-c1f0-48e5-ae31-b94fc93eeb84', '200d66a2-e96e-4796-955f-526dce91103d', '2025-11-07 22:24:06.121726+00', NULL, NULL, '2025-11-07 22:24:06.121726+00', '2025-11-07 22:24:09.243276+00', 'booking-35eef281-1995-4a58-8728-fd5acb9fcf77-auto-assign-054fa7f45722', '2025-11-27 17:00:00+00', '2025-11-27 18:35:00+00', NULL, '2c68afe0-5c98-4ae0-94bc-e113238ac882');
INSERT INTO public.booking_table_assignments VALUES ('fdd8de69-1f8c-49c8-8a02-e8303c30475c', '50fb0cb3-0cf9-41f8-9dba-40a4fb4e6d6a', '21b0c526-1d36-49bd-91a2-b9d8e7367281', 'a1235f82-342f-4fce-87a1-66c6a39bd03b', '2025-11-08 09:26:43.702256+00', NULL, NULL, '2025-11-08 09:26:43.702256+00', '2025-11-08 09:26:46.310025+00', 'booking-50fb0cb3-0cf9-41f8-9dba-40a4fb4e6d6a-auto-assign-9ebe57047fbe', '2025-11-18 12:00:00+00', '2025-11-18 13:30:00+00', NULL, 'cc21b9eb-8148-4430-9d47-05223f108d09');
INSERT INTO public.booking_table_assignments VALUES ('2ffa5d89-efa7-4efa-b51c-00571b054dc4', '50fb0cb3-0cf9-41f8-9dba-40a4fb4e6d6a', '98bb1543-c1f0-48e5-ae31-b94fc93eeb84', 'a1235f82-342f-4fce-87a1-66c6a39bd03b', '2025-11-08 09:26:43.702256+00', NULL, NULL, '2025-11-08 09:26:43.702256+00', '2025-11-08 09:26:46.310025+00', 'booking-50fb0cb3-0cf9-41f8-9dba-40a4fb4e6d6a-auto-assign-9ebe57047fbe', '2025-11-18 12:00:00+00', '2025-11-18 13:30:00+00', NULL, 'cc21b9eb-8148-4430-9d47-05223f108d09');


--
-- PostgreSQL database dump complete
--

\unrestrict 0t2fZf60XJOLhgTasTa6zPyANuZZe3vwkkU5Kory9DG6VM7l0mrgF46kFSnX8Pe


COMMIT;

-- Seed data dump completed successfully
