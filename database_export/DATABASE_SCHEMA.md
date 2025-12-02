# Database Schema Documentation

Generated: 2025-12-02T14:37:46.303Z

Supabase URL: https://mqtchcaavsucsdjskptc.supabase.co

---

## Table: `allocations`

Unable to determine - table is empty

---

## Table: `allowed_capacities`

| Column        | Type   | Sample Value                         |
| ------------- | ------ | ------------------------------------ |
| restaurant_id | string | 486de541-a307-4414-b0b1-f774a0e4a9fa |
| capacity      | number | 2                                    |
| created_at    | string | 2025-11-26T00:29:18.800678+00:00     |
| updated_at    | string | 2025-11-26T00:29:18.800678+00:00     |

---

## Table: `analytics_events`

Unable to determine - table is empty

---

## Table: `audit_logs`

| Column     | Type   | Sample Value                                       |
| ---------- | ------ | -------------------------------------------------- |
| id         | string | 6090785d-561c-4224-b7e4-21a40e02cf3e               |
| entity     | string | booking                                            |
| entity_id  | string | 020ec382-85bf-4d5c-976e-e1b203582270               |
| action     | string | booking.created                                    |
| actor      | string | amanshresthaaaaa@gmail.com                         |
| metadata   | object | {"changes":[{"after":"cbdea463-1fc8-43a2-9909-b039 |
| created_at | string | 2025-11-20T20:55:35.464583+00:00                   |

---

## Table: `booking_assignment_idempotency`

Unable to determine - table is empty

---

## Table: `booking_confirmation_results`

Unable to determine - table is empty

---

## Table: `booking_occasions`

| Column                   | Type    | Sample Value                                       |
| ------------------------ | ------- | -------------------------------------------------- |
| key                      | string  | lunch                                              |
| label                    | string  | Lunch                                              |
| short_label              | string  | Lunch                                              |
| description              | string  | Midday dining experience with hearty pub classics. |
| availability             | object  | [{"end":"15:30","kind":"time_window","start":"11:4 |
| default_duration_minutes | number  | 90                                                 |
| display_order            | number  | 10                                                 |
| is_active                | boolean | true                                               |
| created_at               | string  | 2025-11-26T00:29:18.57117+00:00                    |
| updated_at               | string  | 2025-11-26T00:29:18.57117+00:00                    |
| is_builtin               | boolean | false                                              |
| deleted_at               | object  | NULL                                               |
| created_by               | object  | NULL                                               |
| updated_by               | object  | NULL                                               |

---

## Table: `booking_occasions_audit`

| Column        | Type   | Sample Value                                       |
| ------------- | ------ | -------------------------------------------------- |
| id            | string | 95bd0aca-7821-44bc-9e52-1526c8e8e52d               |
| occasion_key  | string | christmas_party                                    |
| action        | string | delete                                             |
| before_change | object | {"key":"christmas_party","label":"Christmas Party" |
| after_change  | object | {"key":"christmas_party","label":"Christmas Party" |
| changed_by    | string | 8f8fdb5c-ba74-45ae-9281-81ab43a04b37               |
| changed_at    | string | 2025-11-26T00:14:27.602429+00:00                   |

---

## Table: `booking_slots`

| Column             | Type   | Sample Value                         |
| ------------------ | ------ | ------------------------------------ |
| id                 | string | 7e189f27-6016-4bcf-8598-abcad64dfc5b |
| restaurant_id      | string | 486de541-a307-4414-b0b1-f774a0e4a9fa |
| slot_date          | string | 2025-12-17                           |
| slot_time          | string | 19:45:00                             |
| service_period_id  | string | 7e32d65a-0861-49e8-8371-39f0c2df5c11 |
| available_capacity | number | 999                                  |
| reserved_count     | number | 0                                    |
| version            | number | 1                                    |
| created_at         | string | 2025-11-26T22:17:56.682764+00:00     |
| updated_at         | string | 2025-11-26T22:17:56.682764+00:00     |

---

## Table: `booking_state_history`

Unable to determine - table is empty

---

## Table: `booking_table_assignments`

Unable to determine - table is empty

---

## Table: `booking_versions`

Unable to determine - table is empty

---

## Table: `bookings`

Unable to determine - table is empty

---

## Table: `capacity_outbox`

| Column          | Type   | Sample Value                                       |
| --------------- | ------ | -------------------------------------------------- |
| id              | string | 92afaeb7-a5e1-4c0c-a3bc-d64c22dc1620               |
| created_at      | string | 2025-11-20T20:55:39.199385+00:00                   |
| updated_at      | string | 2025-11-20T20:55:39.199385+00:00                   |
| status          | string | pending                                            |
| event_type      | string | capacity.assignment.sync                           |
| dedupe_key      | string | 020ec382-85bf-4d5c-976e-e1b203582270:2025-11-26T19 |
| attempt_count   | number | 0                                                  |
| next_attempt_at | object | NULL                                               |
| restaurant_id   | string | cbdea463-1fc8-43a2-9909-b0393f530e94               |
| booking_id      | string | 020ec382-85bf-4d5c-976e-e1b203582270               |
| idempotency_key | string | api-020ec382-85bf-4d5c-976e-e1b203582270           |
| payload         | object | {"endAt":"2025-11-26T21:00:00Z","startAt":"2025-11 |

---

## Table: `customer_profiles`

| Column                   | Type    | Sample Value                         |
| ------------------------ | ------- | ------------------------------------ |
| customer_id              | string  | a1ff674e-70d8-4965-b876-b329a791a9d0 |
| first_booking_at         | string  | 2025-11-28T15:27:17.5288+00:00       |
| last_booking_at          | string  | 2025-12-01T16:12:42.806659+00:00     |
| total_bookings           | number  | 5                                    |
| total_covers             | number  | 23                                   |
| total_cancellations      | number  | 7                                    |
| marketing_opt_in         | boolean | false                                |
| last_marketing_opt_in_at | object  | NULL                                 |
| preferences              | object  | {}                                   |
| notes                    | object  | NULL                                 |
| updated_at               | string  | 2025-12-01T16:12:43.859177+00:00     |

---

## Table: `customers`

| Column           | Type    | Sample Value                         |
| ---------------- | ------- | ------------------------------------ |
| id               | string  | a1ff674e-70d8-4965-b876-b329a791a9d0 |
| restaurant_id    | string  | 486de541-a307-4414-b0b1-f774a0e4a9fa |
| full_name        | string  | Aman Shrestha                        |
| email            | string  | amanshresthaaaaa@gmail.com           |
| phone            | string  | 07451748292                          |
| email_normalized | string  | amanshresthaaaaa@gmail.com           |
| phone_normalized | string  | 07451748292                          |
| marketing_opt_in | boolean | false                                |
| auth_user_id     | object  | NULL                                 |
| notes            | object  | NULL                                 |
| created_at       | string  | 2025-11-26T21:35:06.374009+00:00     |
| updated_at       | string  | 2025-12-02T12:59:56.584463+00:00     |
| user_profile_id  | object  | NULL                                 |

---

## Table: `demand_profiles`

Unable to determine - table is empty

---

## Table: `feature_flag_overrides`

Unable to determine - table is empty

---

## Table: `loyalty_point_events`

Unable to determine - table is empty

---

## Table: `loyalty_points`

Unable to determine - table is empty

---

## Table: `loyalty_programs`

Unable to determine - table is empty

---

## Table: `observability_events`

| Column        | Type   | Sample Value                                       |
| ------------- | ------ | -------------------------------------------------- |
| id            | string | 4eb9ad91-1c6e-4f66-af68-e65a430dcd2e               |
| created_at    | string | 2025-11-26T10:49:24.167862+00:00                   |
| source        | string | api.ops                                            |
| event_type    | string | ops_bookings.list                                  |
| severity      | string | info                                               |
| context       | object | {"staff_id":"a9dd6781-b60d-4dab-a40d-689d804136f8" |
| restaurant_id | object | NULL                                               |
| booking_id    | object | NULL                                               |

---

## Table: `profile_update_requests`

| Column          | Type   | Sample Value                                       |
| --------------- | ------ | -------------------------------------------------- |
| id              | string | fbb4f7f6-5847-4a12-8f43-a5458d5e4ada               |
| profile_id      | string | 35a70a11-f097-4a61-af5e-e849a1a5dd21               |
| idempotency_key | string | 97d9fcac-7772-41c1-8823-a3a3b8cf6d57               |
| payload_hash    | string | 813d80efa5fe82b9ce29346e87e43b01e1c4ee9171c872ca4c |
| applied_at      | string | 2025-11-27T21:30:40.815866+00:00                   |

---

## Table: `profiles`

| Column     | Type    | Sample Value                         |
| ---------- | ------- | ------------------------------------ |
| id         | string  | 35a70a11-f097-4a61-af5e-e849a1a5dd21 |
| email      | string  | amanshresthaaaaa@gmail.com           |
| name       | string  | Aman Shrestha                        |
| phone      | string  | 07467586750                          |
| image      | object  | NULL                                 |
| created_at | string  | 2025-11-26T19:48:10.684398+00:00     |
| updated_at | string  | 2025-11-27T21:30:40.648072+00:00     |
| has_access | boolean | true                                 |

---

## Table: `restaurant_capacity_rules`

Unable to determine - table is empty

---

## Table: `restaurant_invites`

Unable to determine - table is empty

---

## Table: `restaurant_memberships`

| Column        | Type   | Sample Value                         |
| ------------- | ------ | ------------------------------------ |
| user_id       | string | a9dd6781-b60d-4dab-a40d-689d804136f8 |
| restaurant_id | string | 486de541-a307-4414-b0b1-f774a0e4a9fa |
| role          | string | manager                              |
| created_at    | string | 2025-11-26T00:57:33.997093+00:00     |

---

## Table: `restaurant_operating_hours`

| Column         | Type    | Sample Value                         |
| -------------- | ------- | ------------------------------------ |
| id             | string  | 6f647cc9-de9b-4123-a97f-38e6bc4c8918 |
| restaurant_id  | string  | 486de541-a307-4414-b0b1-f774a0e4a9fa |
| day_of_week    | number  | 0                                    |
| effective_date | object  | NULL                                 |
| opens_at       | string  | 12:00:00                             |
| closes_at      | string  | 22:00:00                             |
| is_closed      | boolean | false                                |
| notes          | object  | NULL                                 |
| created_at     | string  | 2025-11-26T00:29:18.800678+00:00     |
| updated_at     | string  | 2025-11-26T00:29:18.800678+00:00     |

---

## Table: `restaurant_service_periods`

| Column         | Type   | Sample Value                         |
| -------------- | ------ | ------------------------------------ |
| id             | string | 46e9ac24-17f5-4672-8498-904d43a79ca3 |
| restaurant_id  | string | 486de541-a307-4414-b0b1-f774a0e4a9fa |
| name           | string | Sunday Lunch                         |
| day_of_week    | number | 0                                    |
| start_time     | string | 12:00:00                             |
| end_time       | string | 15:00:00                             |
| created_at     | string | 2025-11-26T00:29:18.800678+00:00     |
| updated_at     | string | 2025-11-26T00:29:18.800678+00:00     |
| booking_option | string | lunch                                |

---

## Table: `restaurants`

| Column                                  | Type    | Sample Value                              |
| --------------------------------------- | ------- | ----------------------------------------- |
| id                                      | string  | 486de541-a307-4414-b0b1-f774a0e4a9fa      |
| name                                    | string  | White Horse Pub                           |
| slug                                    | string  | white-horse-pub-waterbeach                |
| timezone                                | string  | Europe/London                             |
| capacity                                | number  | 50                                        |
| created_at                              | string  | 2025-11-26T00:29:18.800678+00:00          |
| updated_at                              | string  | 2025-11-30T23:43:35.729637+00:00          |
| contact_email                           | string  | info@whitehorsewaterbeach.co.uk           |
| contact_phone                           | string  | 01223 860000                              |
| address                                 | string  | Waterbeach, Cambridge CB25 9JU            |
| booking_policy                          | object  | NULL                                      |
| reservation_interval_minutes            | number  | 15                                        |
| reservation_default_duration_minutes    | number  | 90                                        |
| is_active                               | boolean | true                                      |
| reservation_last_seating_buffer_minutes | number  | 30                                        |
| logo_url                                | object  | NULL                                      |
| email_send_reminder_24h                 | boolean | true                                      |
| email_send_reminder_short               | boolean | true                                      |
| email_send_review_request               | boolean | true                                      |
| google_map_url                          | string  | https://maps.app.goo.gl/fG6XfSRRYpNvK5Eb8 |

---

## Table: `service_policy`

Unable to determine - table is empty

---

## Table: `strategic_configs`

Unable to determine - table is empty

---

## Table: `table_adjacencies`

| Column     | Type   | Sample Value                         |
| ---------- | ------ | ------------------------------------ |
| table_a    | string | 0c6a69df-c0d3-4c5f-ab6f-0e79f0dc7050 |
| table_b    | string | b5a39c61-2790-46d4-a826-5a1979c25301 |
| created_at | string | 2025-11-26T22:07:14.762394+00:00     |

---

## Table: `table_hold_members`

Unable to determine - table is empty

---

## Table: `table_hold_windows`

Unable to determine - table is empty

---

## Table: `table_holds`

Unable to determine - table is empty

---

## Table: `table_inventory`

| Column         | Type    | Sample Value                         |
| -------------- | ------- | ------------------------------------ |
| id             | string  | e20937d5-fd1e-4888-bcf1-def13b627a10 |
| restaurant_id  | string  | 486de541-a307-4414-b0b1-f774a0e4a9fa |
| table_number   | string  | MD2-205                              |
| capacity       | number  | 2                                    |
| min_party_size | number  | 1                                    |
| max_party_size | object  | NULL                                 |
| section        | object  | NULL                                 |
| status         | string  | available                            |
| position       | object  | NULL                                 |
| notes          | object  | NULL                                 |
| created_at     | string  | 2025-11-26T00:29:18.800678+00:00     |
| updated_at     | string  | 2025-12-02T01:45:45.810631+00:00     |
| zone_id        | string  | 722b3790-70f2-4cd2-9acf-31682b8e2b28 |
| category       | string  | dining                               |
| seating_type   | string  | standard                             |
| mobility       | string  | movable                              |
| active         | boolean | true                                 |

---

## Table: `table_scarcity_metrics`

Unable to determine - table is empty

---

## Table: `user_profiles`

Unable to determine - table is empty

---

## Table: `zones`

| Column        | Type    | Sample Value                         |
| ------------- | ------- | ------------------------------------ |
| id            | string  | 4b013494-6d4a-4fcb-a734-48278d49959a |
| restaurant_id | string  | 486de541-a307-4414-b0b1-f774a0e4a9fa |
| name          | string  | Main Dining 1 - Inside               |
| sort_order    | number  | 1                                    |
| created_at    | string  | 2025-11-26T00:29:18.800678+00:00     |
| updated_at    | string  | 2025-11-26T00:29:18.800678+00:00     |
| area_type     | string  | indoor                               |
| active        | boolean | true                                 |

---
