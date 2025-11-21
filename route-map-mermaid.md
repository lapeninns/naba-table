```mermaid
flowchart TD
    subgraph Pages
        partners["/partners"]
        class partners public;
        app["/app"]
        class app public;
        bookings["/bookings"]
        class bookings public;
        contact["/contact"]
        class contact public;
        guest["/guest"]
        class guest public;
        root["/"]
        privacy_policy["/privacy-policy"]
        class privacy_policy public;
        product["/product"]
        class product public;
        reserve["/reserve"]
        class reserve public;
        restaurants["/restaurants"]
        class restaurants public;
        terms["/terms"]
        class terms public;
        thank_you["/thank-you"]
        class thank_you public;
        walk_in["/walk-in"]
        class walk_in public;
        account_bookings["/account/bookings"]
        class account_bookings public;
        account_my_bookings["/account/my-bookings"]
        class account_my_bookings public;
        account_profile["/account/profile"]
        class account_profile public;
        app_analytics["/app/analytics"]
        class app_analytics public;
        app_bookings["/app/bookings"]
        class app_bookings public;
        app_customers["/app/customers"]
        class app_customers public;
        app_login["/app/login"]
        class app_login public;
        app_management["/app/management"]
        class app_management public;
        app_seating["/app/seating"]
        class app_seating public;
        app_settings["/app/settings"]
        class app_settings public;
        app_walk_in["/app/walk-in"]
        class app_walk_in public;
        auth_signin["/auth/signin"]
        class auth_signin public;
        bookings__bookingId["/bookings/:bookingId"]
        class bookings__bookingId public;
        guest_bookings["/guest/bookings"]
        class guest_bookings public;
        guest_dashboard["/guest/dashboard"]
        class guest_dashboard public;
        guest_my_bookings["/guest/my-bookings"]
        class guest_my_bookings public;
        guest_browse["/guest/browse"]
        class guest_browse public;
        guest_reserve["/guest/reserve"]
        class guest_reserve public;
        guest_restaurant["/guest/restaurant"]
        class guest_restaurant public;
        guest_signin["/guest/signin"]
        class guest_signin public;
        guest_thank_you["/guest/thank-you"]
        class guest_thank_you public;
        guest_contact["/guest/contact"]
        class guest_contact public;
        guest_privacy_policy["/guest/privacy-policy"]
        class guest_privacy_policy public;
        guest_product["/guest/product"]
        class guest_product public;
        guest_terms["/guest/terms"]
        class guest_terms public;
        guest_restaurants["/guest/restaurants"]
        class guest_restaurants public;
        item__slug["/item/:slug"]
        class item__slug public;
        reserve__reservationId["/reserve/:reservationId"]
        class reserve__reservationId public;
        restaurants__slug["/restaurants/:slug"]
        class restaurants__slug public;
        account_invite__token["/account/invite/:token"]
        class account_invite__token public;
        account_profile_manage["/account/profile/manage"]
        class account_profile_manage public;
        app_analytics_rejections["/app/analytics/rejections"]
        class app_analytics_rejections public;
        app_management_team["/app/management/team"]
        class app_management_team public;
        app_seating_capacity["/app/seating/capacity"]
        class app_seating_capacity public;
        app_seating_floor_plan["/app/seating/floor-plan"]
        class app_seating_floor_plan public;
        app_seating_tables["/app/seating/tables"]
        class app_seating_tables public;
        app_settings_restaurant["/app/settings/restaurant"]
        class app_settings_restaurant public;
        bookings__bookingId_thank_you["/bookings/:bookingId/thank-you"]
        class bookings__bookingId_thank_you public;
        guest_invite__token["/guest/invite/:token"]
        class guest_invite__token public;
        guest_profile_manage["/guest/profile/manage"]
        class guest_profile_manage public;
        guest_item__slug["/guest/item/:slug"]
        class guest_item__slug public;
        guest_reserve__reservationId["/guest/reserve/:reservationId"]
        class guest_reserve__reservationId public;
        guest_auth_signin["/guest/auth/signin"]
        class guest_auth_signin public;
        guest_bookings__bookingId["/guest/bookings/:bookingId"]
        class guest_bookings__bookingId public;
        guest_bookings_new["/guest/bookings/new"]
        class guest_bookings_new public;
        guest_restaurants__slug["/guest/restaurants/:slug"]
        class guest_restaurants__slug public;
        guest_account_bookings["/guest/account/bookings"]
        class guest_account_bookings public;
        guest_account_dashboard["/guest/account/dashboard"]
        class guest_account_dashboard public;
        guest_account_my_bookings["/guest/account/my-bookings"]
        class guest_account_my_bookings public;
        guest_account_profile["/guest/account/profile"]
        class guest_account_profile public;
        reserve_r__slug["/reserve/r/:slug"]
        class reserve_r__slug public;
        restaurants__slug_book["/restaurants/:slug/book"]
        class restaurants__slug_book public;
        guest_reserve_r__slug["/guest/reserve/r/:slug"]
        class guest_reserve_r__slug public;
        guest_bookings__bookingId_thank_you["/guest/bookings/:bookingId/thank-you"]
        class guest_bookings__bookingId_thank_you public;
        guest_restaurants__slug_book["/guest/restaurants/:slug/book"]
        class guest_restaurants__slug_book public;
        guest_account_invite__token["/guest/account/invite/:token"]
        class guest_account_invite__token public;
    end

    subgraph API
        api["/api"]
        subgraph Core
            api_auth_callback["/api/auth/callback"]
            class api_auth_callback public;
            api_availability["/api/availability"]
            class api_availability public;
            api_bookings__id_history["/api/bookings/:id/history"]
            class api_bookings__id_history public;
            api_bookings__id["/api/bookings/:id"]
            class api_bookings__id public;
            api_bookings_confirm["/api/bookings/confirm"]
            class api_bookings_confirm public;
            api_bookings["/api/bookings"]
            class api_bookings public;
            api_config_merge_rules["/api/config/merge-rules"]
            class api_config_merge_rules public;
            api_config_service_policy["/api/config/service-policy"]
            class api_config_service_policy public;
            api_events["/api/events"]
            class api_events public;
            api_lead["/api/lead"]
            class api_lead public;
            api_profile_image["/api/profile/image"]
            class api_profile_image public;
            api_profile["/api/profile"]
            class api_profile public;
            api_reservations__reservationId_confirmation["/api/reservations/:reservationId/confirmation"]
            class api_reservations__reservationId_confirmation public;
            api_restaurants__slug_calendar_mask["/api/restaurants/:slug/calendar-mask"]
            class api_restaurants__slug_calendar_mask public;
            api_restaurants__slug_schedule["/api/restaurants/:slug/schedule"]
            class api_restaurants__slug_schedule public;
            api_restaurants["/api/restaurants"]
            class api_restaurants public;
            api_staff_auto_confirm["/api/staff/auto/confirm"]
            class api_staff_auto_confirm public;
            api_staff_auto_quote["/api/staff/auto/quote"]
            class api_staff_auto_quote public;
            api_team_invitations__token_accept["/api/team/invitations/:token/accept"]
            class api_team_invitations__token_accept public;
            api_team_invitations__token["/api/team/invitations/:token"]
            class api_team_invitations__token public;
            api_webhook_resend["/api/webhook/resend"]
            class api_webhook_resend public;
        end
        subgraph v1
            api_v1_bookings["/api/v1/bookings"]
            class api_v1_bookings public;
            api_v1_events["/api/v1/events"]
            class api_v1_events public;
            api_v1_lead["/api/v1/lead"]
            class api_v1_lead public;
            api_v1_ops_bookings__id["/api/v1/ops/bookings/:id"]
            class api_v1_ops_bookings__id public;
            api_v1_ops_bookings_export["/api/v1/ops/bookings/export"]
            class api_v1_ops_bookings_export public;
            api_v1_ops_bookings["/api/v1/ops/bookings"]
            class api_v1_ops_bookings public;
            api_v1_ops_bookings_status_summary["/api/v1/ops/bookings/status-summary"]
            class api_v1_ops_bookings_status_summary public;
            api_v1_ops_customers_export["/api/v1/ops/customers/export"]
            class api_v1_ops_customers_export public;
            api_v1_ops_customers["/api/v1/ops/customers"]
            class api_v1_ops_customers public;
            api_v1_ops_dashboard_changes["/api/v1/ops/dashboard/changes"]
            class api_v1_ops_dashboard_changes public;
            api_v1_ops_dashboard_heatmap["/api/v1/ops/dashboard/heatmap"]
            class api_v1_ops_dashboard_heatmap public;
            api_v1_ops_dashboard_rejections["/api/v1/ops/dashboard/rejections"]
            class api_v1_ops_dashboard_rejections public;
            api_v1_ops_dashboard_summary["/api/v1/ops/dashboard/summary"]
            class api_v1_ops_dashboard_summary public;
            api_v1_ops_dashboard_vips["/api/v1/ops/dashboard/vips"]
            class api_v1_ops_dashboard_vips public;
            api_v1_ops_restaurants__id_details["/api/v1/ops/restaurants/:id/details"]
            class api_v1_ops_restaurants__id_details public;
            api_v1_ops_restaurants__id_hours["/api/v1/ops/restaurants/:id/hours"]
            class api_v1_ops_restaurants__id_hours public;
            api_v1_ops_restaurants__id["/api/v1/ops/restaurants/:id"]
            class api_v1_ops_restaurants__id public;
            api_v1_ops_restaurants__id_service_periods["/api/v1/ops/restaurants/:id/service-periods"]
            class api_v1_ops_restaurants__id_service_periods public;
            api_v1_ops_restaurants["/api/v1/ops/restaurants"]
            class api_v1_ops_restaurants public;
            api_v1_ops_team_invitations__inviteId["/api/v1/ops/team/invitations/:inviteId"]
            class api_v1_ops_team_invitations__inviteId public;
            api_v1_ops_team_invitations["/api/v1/ops/team/invitations"]
            class api_v1_ops_team_invitations public;
            api_v1_ops_team_memberships["/api/v1/ops/team/memberships"]
            class api_v1_ops_team_memberships public;
            api_v1_profile_image["/api/v1/profile/image"]
            class api_v1_profile_image public;
            api_v1_profile["/api/v1/profile"]
            class api_v1_profile public;
            api_v1_restaurants__slug_schedule["/api/v1/restaurants/:slug/schedule"]
            class api_v1_restaurants__slug_schedule public;
            api_v1_restaurants["/api/v1/restaurants"]
            class api_v1_restaurants public;
            api_v1_test_bookings["/api/v1/test/bookings"]
            class api_v1_test_bookings public;
            api_v1_test_leads["/api/v1/test/leads"]
            class api_v1_test_leads public;
            api_v1_test_playwright_session["/api/v1/test/playwright-session"]
            class api_v1_test_playwright_session public;
            api_v1_test_reservations__reservationId_confirmation["/api/v1/test/reservations/:reservationId/confirmation"]
            class api_v1_test_reservations__reservationId_confirmation public;
        end
        subgraph Test
            api_test_bookings["/api/test/bookings"]
            class api_test_bookings public;
            api_test_invitations["/api/test/invitations"]
            class api_test_invitations public;
            api_test_leads["/api/test/leads"]
            class api_test_leads public;
            api_test_playwright_session["/api/test/playwright-session"]
            class api_test_playwright_session public;
            api_test_reservations__reservationId_confirmation["/api/test/reservations/:reservationId/confirmation"]
            class api_test_reservations__reservationId_confirmation public;
            api_test_email["/api/test-email"]
            class api_test_email public;
        end
        subgraph Ops
            api_ops_allowed_capacities["/api/ops/allowed-capacities"]
            class api_ops_allowed_capacities public;
            api_ops_bookings__id_assign_tables["/api/ops/bookings/:id/assign-tables"]
            class api_ops_bookings__id_assign_tables public;
            api_ops_bookings__id_assignment_context["/api/ops/bookings/:id/assignment-context"]
            class api_ops_bookings__id_assignment_context public;
            api_ops_bookings__id_check_in["/api/ops/bookings/:id/check-in"]
            class api_ops_bookings__id_check_in public;
            api_ops_bookings__id_check_out["/api/ops/bookings/:id/check-out"]
            class api_ops_bookings__id_check_out public;
            api_ops_bookings__id_history["/api/ops/bookings/:id/history"]
            class api_ops_bookings__id_history public;
            api_ops_bookings__id_manual_context["/api/ops/bookings/:id/manual-context"]
            class api_ops_bookings__id_manual_context public;
            api_ops_bookings__id_no_show["/api/ops/bookings/:id/no-show"]
            class api_ops_bookings__id_no_show public;
            api_ops_bookings__id["/api/ops/bookings/:id"]
            class api_ops_bookings__id public;
            api_ops_bookings__id_status["/api/ops/bookings/:id/status"]
            class api_ops_bookings__id_status public;
            api_ops_bookings__id_tables__tableId["/api/ops/bookings/:id/tables/:tableId"]
            class api_ops_bookings__id_tables__tableId public;
            api_ops_bookings__id_tables["/api/ops/bookings/:id/tables"]
            class api_ops_bookings__id_tables public;
            api_ops_bookings__id_undo_no_show["/api/ops/bookings/:id/undo-no-show"]
            class api_ops_bookings__id_undo_no_show public;
            api_ops_bookings_export["/api/ops/bookings/export"]
            class api_ops_bookings_export public;
            api_ops_bookings["/api/ops/bookings"]
            class api_ops_bookings public;
            api_ops_bookings_status_summary["/api/ops/bookings/status-summary"]
            class api_ops_bookings_status_summary public;
            api_ops_customers_export["/api/ops/customers/export"]
            class api_ops_customers_export public;
            api_ops_customers["/api/ops/customers"]
            class api_ops_customers public;
            api_ops_dashboard_changes["/api/ops/dashboard/changes"]
            class api_ops_dashboard_changes public;
            api_ops_dashboard_heatmap["/api/ops/dashboard/heatmap"]
            class api_ops_dashboard_heatmap public;
            api_ops_dashboard_rejections["/api/ops/dashboard/rejections"]
            class api_ops_dashboard_rejections public;
            api_ops_dashboard_summary["/api/ops/dashboard/summary"]
            class api_ops_dashboard_summary public;
            api_ops_dashboard_vips["/api/ops/dashboard/vips"]
            class api_ops_dashboard_vips public;
            api_ops_occasions["/api/ops/occasions"]
            class api_ops_occasions public;
            api_ops_restaurants__id_details["/api/ops/restaurants/:id/details"]
            class api_ops_restaurants__id_details public;
            api_ops_restaurants__id_hours["/api/ops/restaurants/:id/hours"]
            class api_ops_restaurants__id_hours public;
            api_ops_restaurants__id_logo["/api/ops/restaurants/:id/logo"]
            class api_ops_restaurants__id_logo public;
            api_ops_restaurants__id["/api/ops/restaurants/:id"]
            class api_ops_restaurants__id public;
            api_ops_restaurants__id_service_periods["/api/ops/restaurants/:id/service-periods"]
            class api_ops_restaurants__id_service_periods public;
            api_ops_restaurants["/api/ops/restaurants"]
            class api_ops_restaurants public;
            api_ops_settings_strategic_config["/api/ops/settings/strategic-config"]
            class api_ops_settings_strategic_config public;
            api_ops_strategies_simulate["/api/ops/strategies/simulate"]
            class api_ops_strategies_simulate public;
            api_ops_tables__id["/api/ops/tables/:id"]
            class api_ops_tables__id public;
            api_ops_tables["/api/ops/tables"]
            class api_ops_tables public;
            api_ops_tables_timeline["/api/ops/tables/timeline"]
            class api_ops_tables_timeline public;
            api_ops_team_invitations__inviteId["/api/ops/team/invitations/:inviteId"]
            class api_ops_team_invitations__inviteId public;
            api_ops_team_invitations["/api/ops/team/invitations"]
            class api_ops_team_invitations public;
            api_ops_team_memberships["/api/ops/team/memberships"]
            class api_ops_team_memberships public;
            api_ops_zones__id["/api/ops/zones/:id"]
            class api_ops_zones__id public;
            api_ops_zones["/api/ops/zones"]
            class api_ops_zones public;
        end
        subgraph Owner
            api_owner_restaurants__id_details["/api/owner/restaurants/:id/details"]
            class api_owner_restaurants__id_details public;
            api_owner_restaurants__id_hours["/api/owner/restaurants/:id/hours"]
            class api_owner_restaurants__id_hours public;
            api_owner_restaurants__id_service_periods["/api/owner/restaurants/:id/service-periods"]
            class api_owner_restaurants__id_service_periods public;
            api_owner_team_invitations__inviteId["/api/owner/team/invitations/:inviteId"]
            class api_owner_team_invitations__inviteId public;
            api_owner_team_invitations["/api/owner/team/invitations"]
            class api_owner_team_invitations public;
            api_owner_team_memberships["/api/owner/team/memberships"]
            class api_owner_team_memberships public;
        end
    end
    root --> app
    root --> guest
    root --> terms
    root --> contact
    root --> product
    root --> reserve
    root --> walk_in
    root --> partners
    root --> bookings
    root --> thank_you
    app --> app_login
    root --> restaurants
    app --> app_seating
    app --> app_walk_in
    guest --> guest_terms
    app --> app_bookings
    app --> app_settings
    guest --> guest_browse
    guest --> guest_signin
    app --> app_analytics
    app --> app_customers
    guest --> guest_reserve
    guest --> guest_contact
    guest --> guest_product
    root --> privacy_policy
    app --> app_management
    guest --> guest_bookings
    guest --> guest_dashboard
    guest --> guest_thank_you
    guest --> guest_restaurant
    guest --> guest_my_bookings
    guest --> guest_restaurants
    restaurants --> restaurants__slug
    app_seating --> app_seating_tables
    guest_bookings --> guest_bookings_new
    bookings --> bookings__bookingId
    app_management --> app_management_team
    guest --> guest_privacy_policy
    app_seating --> app_seating_capacity
    reserve --> reserve__reservationId
    account_profile --> account_profile_manage
    app_seating --> app_seating_floor_plan
    restaurants__slug --> restaurants__slug_book
    app_settings --> app_settings_restaurant
    guest_restaurants --> guest_restaurants__slug
    app_analytics --> app_analytics_rejections
    guest_bookings --> guest_bookings__bookingId
    guest_reserve --> guest_reserve__reservationId
    guest_restaurants__slug --> guest_restaurants__slug_book
    bookings__bookingId --> bookings__bookingId_thank_you
    guest_bookings__bookingId --> guest_bookings__bookingId_thank_you
    api --> api_lead
    api --> api_events
    api --> api_profile
    api --> api_bookings
    api --> api_test_email
    api --> api_restaurants
    api --> api_availability
    api_bookings --> api_bookings__id
    api_ops_zones --> api_ops_zones__id
    api_profile --> api_profile_image
    api_ops_tables --> api_ops_tables__id
    api_bookings --> api_bookings_confirm
    api_ops_bookings --> api_ops_bookings__id
    api_v1_profile --> api_v1_profile_image
    api_ops_bookings --> api_ops_bookings_export
    api_ops_restaurants --> api_ops_restaurants__id
    api_ops_tables --> api_ops_tables_timeline
    api_v1_ops_bookings --> api_v1_ops_bookings__id
    api_bookings__id --> api_bookings__id_history
    api_ops_customers --> api_ops_customers_export
    api_v1_ops_bookings --> api_v1_ops_bookings_export
    api_v1_ops_restaurants --> api_v1_ops_restaurants__id
    api_ops_bookings__id --> api_ops_bookings__id_status
    api_ops_bookings__id --> api_ops_bookings__id_tables
    api_v1_ops_customers --> api_v1_ops_customers_export
    api_ops_bookings__id --> api_ops_bookings__id_history
    api_ops_bookings__id --> api_ops_bookings__id_no_show
    api_ops_restaurants__id --> api_ops_restaurants__id_logo
    api_ops_bookings__id --> api_ops_bookings__id_check_in
    api_ops_restaurants__id --> api_ops_restaurants__id_hours
    api_ops_bookings__id --> api_ops_bookings__id_check_out
    api_ops_bookings --> api_ops_bookings_status_summary
    api_ops_restaurants__id --> api_ops_restaurants__id_details
    api_v1_ops_restaurants__id --> api_v1_ops_restaurants__id_hours
    api_ops_bookings__id --> api_ops_bookings__id_undo_no_show
    api_ops_bookings__id --> api_ops_bookings__id_assign_tables
    api_ops_team_invitations --> api_ops_team_invitations__inviteId
    api_team_invitations__token --> api_team_invitations__token_accept
    api_v1_ops_bookings --> api_v1_ops_bookings_status_summary
    api_v1_ops_restaurants__id --> api_v1_ops_restaurants__id_details
    api_ops_bookings__id --> api_ops_bookings__id_manual_context
    api_ops_bookings__id_tables --> api_ops_bookings__id_tables__tableId
    api_owner_team_invitations --> api_owner_team_invitations__inviteId
    api_v1_ops_team_invitations --> api_v1_ops_team_invitations__inviteId
    api_ops_bookings__id --> api_ops_bookings__id_assignment_context
    api_ops_restaurants__id --> api_ops_restaurants__id_service_periods
    api_v1_ops_restaurants__id --> api_v1_ops_restaurants__id_service_periods
    classDef public stroke:#16a34a,stroke-width:2px;
    classDef auth stroke:#2563eb,stroke-width:2px;
    classDef admin stroke:#dc2626,stroke-width:2px;
    classDef owner stroke:#7c3aed,stroke-width:2px;
    classDef mixed stroke:#f59e0b,stroke-width:2px;
```
