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

