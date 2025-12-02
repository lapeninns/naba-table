## Database Functions

Extracted from migration files:

CREATE FUNCTION public.assign_tables_atomic(
CREATE FUNCTION public.assign_tables_atomic_v2(
CREATE FUNCTION public.confirm_hold_assignment_with_transition(
CREATE OR REPLACE FUNCTION "public"."allocations_overlap"("a" "tstzrange", "b" "tstzrange") RETURNS boolean
CREATE OR REPLACE FUNCTION "public"."allowed_capacities_set_updated_at"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."apply_booking_state_transition"("p_booking_id" "uuid", "p_status" "public"."booking_status", "p_checked_in_at" timestamp with time zone, "p_checked_out_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_history_from" "public"."booking_status", "p_history_to" "public"."booking_status", "p_history_changed_by" "uuid", "p_history_changed_at" timestamp with time zone, "p_history_reason" "text", "p_history_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("status" "public"."booking_status", "checked_in_at" timestamp with time zone, "checked_out_at" timestamp with time zone, "updated_at" timestamp with time zone)
CREATE OR REPLACE FUNCTION "public"."are_tables_connected"("table_ids" "uuid"[]) RETURNS boolean
CREATE OR REPLACE FUNCTION "public"."assign_table_to_booking"("p_booking_id" "uuid", "p_table_id" "uuid", "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
CREATE OR REPLACE FUNCTION "public"."assign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[], "p_window" "tstzrange", "p_assigned_by" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS TABLE("table_id" "uuid", "assignment_id" "uuid", "merge_group_id" "uuid")
CREATE OR REPLACE FUNCTION "public"."booking_status_summary"("p_restaurant_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_status_filter" "public"."booking_status"[] DEFAULT NULL::"public"."booking_status"[]) RETURNS TABLE("status" "public"."booking_status", "total" bigint)
CREATE OR REPLACE FUNCTION "public"."capacity_metrics_hourly_updated_at"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."create_booking_with_capacity_check"("p_restaurant_id" "uuid", "p_customer_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_party_size" integer, "p_booking_type" "text", "p_customer_name" "text", "p_customer_email" "text", "p_customer_phone" "text", "p_seating_preference" "text", "p_notes" "text" DEFAULT NULL::"text", "p_marketing_opt_in" boolean DEFAULT false, "p_idempotency_key" "text" DEFAULT NULL::"text", "p_source" "text" DEFAULT 'api'::"text", "p_auth_user_id" "uuid" DEFAULT NULL::"uuid", "p_client_request_id" "text" DEFAULT NULL::"text", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_loyalty_points_awarded" integer DEFAULT 0) RETURNS "jsonb"
CREATE OR REPLACE FUNCTION "public"."generate_booking_reference"() RETURNS "text"
CREATE OR REPLACE FUNCTION "public"."get_or_create_booking_slot"("p_restaurant_id" "uuid", "p_slot_date" "date", "p_slot_time" time without time zone, "p_default_capacity" integer DEFAULT 999) RETURNS "uuid"
CREATE OR REPLACE FUNCTION "public"."increment_booking_slot_version"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."increment_capacity_metrics"("p_restaurant_id" "uuid", "p_window_start" timestamp with time zone, "p_success_delta" integer DEFAULT 0, "p_conflict_delta" integer DEFAULT 0, "p_capacity_exceeded_delta" integer DEFAULT 0) RETURNS "void"
CREATE OR REPLACE FUNCTION "public"."log_table_assignment_change"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."on_allocations_refresh"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."on_booking_status_refresh"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."refresh_table_status"("p_table_id" "uuid") RETURNS "void"
CREATE OR REPLACE FUNCTION "public"."set_booking_instants"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."set_booking_reference"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."sync_table_adjacency_symmetry"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."unassign_table_from_booking"("p_booking_id" "uuid", "p_table_id" "uuid") RETURNS boolean
CREATE OR REPLACE FUNCTION "public"."unassign_tables_atomic"("p_booking_id" "uuid", "p_table_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_merge_group_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("table_id" "uuid", "merge_group_id" "uuid")
CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."user_restaurants"() RETURNS SETOF "uuid"
CREATE OR REPLACE FUNCTION "public"."user_restaurants_admin"() RETURNS SETOF "uuid"
CREATE OR REPLACE FUNCTION "public"."validate_merge_group_members"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION "public"."validate_table_adjacency"() RETURNS "trigger"
CREATE OR REPLACE FUNCTION public.apply_booking_state_transition(
CREATE OR REPLACE FUNCTION public.assign_merged_tables(
CREATE OR REPLACE FUNCTION public.assign_single_table(
CREATE OR REPLACE FUNCTION public.assign_tables_atomic_v2(
CREATE OR REPLACE FUNCTION public.confirm_hold_assignment_tx(
CREATE OR REPLACE FUNCTION public.confirm_hold_assignment_with_transition(
CREATE OR REPLACE FUNCTION public.create_booking_with_capacity_check(
CREATE OR REPLACE FUNCTION public.current_restaurant_id() RETURNS uuid
CREATE OR REPLACE FUNCTION public.enforce_bar_drinks_only()
CREATE OR REPLACE FUNCTION public.get_or_create_booking_slot(
CREATE OR REPLACE FUNCTION public.is_holds_strict_conflicts_enabled()
CREATE OR REPLACE FUNCTION public.is_table_available_v2(
CREATE OR REPLACE FUNCTION public.prune_allocations_history(
CREATE OR REPLACE FUNCTION public.refresh_table_status(p_table_id uuid) RETURNS void
CREATE OR REPLACE FUNCTION public.require_restaurant_context() RETURNS uuid
CREATE OR REPLACE FUNCTION public.set_hold_conflict_enforcement(enabled boolean)
CREATE OR REPLACE FUNCTION public.set_restaurant_context(p_restaurant_id uuid) RETURNS uuid
CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
CREATE OR REPLACE FUNCTION public.set_updated_at()
CREATE OR REPLACE FUNCTION public.sync_table_hold_windows()
CREATE OR REPLACE FUNCTION public.update_booking_with_capacity_check(
CREATE OR REPLACE FUNCTION public.update_table_hold_windows()
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
CREATE OR REPLACE FUNCTION public.validate_booking_capacity_after_assignment(p_booking_id uuid)
CREATE OR REPLACE FUNCTION validate_booking_has_assignments()
CREATE OR REPLACE FUNCTION;
CREATE OR REPLACE TRIGGER "allocations_updated_at" BEFORE UPDATE ON "public"."allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "allowed_capacities_touch_updated_at" BEFORE UPDATE ON "public"."allowed_capacities" FOR EACH ROW EXECUTE FUNCTION "public"."allowed_capacities_set_updated_at"();
CREATE OR REPLACE TRIGGER "booking_slots_increment_version" BEFORE UPDATE ON "public"."booking_slots" FOR EACH ROW EXECUTE FUNCTION "public"."increment_booking_slot_version"();
CREATE OR REPLACE TRIGGER "booking_slots_updated_at" BEFORE UPDATE ON "public"."booking_slots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "booking_table_assignments_audit" AFTER INSERT OR DELETE ON "public"."booking_table_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."log_table_assignment_change"();
CREATE OR REPLACE TRIGGER "booking_table_assignments_updated_at" BEFORE UPDATE ON "public"."booking_table_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "bookings_set_instants" BEFORE INSERT OR UPDATE OF "booking_date", "start_time", "end_time", "restaurant_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_instants"();
CREATE OR REPLACE TRIGGER "bookings_set_reference" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_reference"();
CREATE OR REPLACE TRIGGER "bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "capacity_metrics_hourly_set_updated_at" BEFORE UPDATE ON "public"."capacity_metrics_hourly" FOR EACH ROW EXECUTE FUNCTION "public"."capacity_metrics_hourly_updated_at"();
CREATE OR REPLACE TRIGGER "customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "merge_group_members_validate_connectivity" BEFORE INSERT ON "public"."merge_group_members" FOR EACH ROW EXECUTE FUNCTION "public"."validate_merge_group_members"();
CREATE OR REPLACE TRIGGER "merge_rules_updated_at" BEFORE UPDATE ON "public"."merge_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "restaurant_capacity_rules_updated_at" BEFORE UPDATE ON "public"."restaurant_capacity_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "restaurant_operating_hours_updated_at" BEFORE UPDATE ON "public"."restaurant_operating_hours" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "restaurant_service_periods_updated_at" BEFORE UPDATE ON "public"."restaurant_service_periods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "restaurants_updated_at" BEFORE UPDATE ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "service_policy_updated_at" BEFORE UPDATE ON "public"."service_policy" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "set_restaurant_invites_updated_at" BEFORE UPDATE ON "public"."restaurant_invites" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "table_adjacencies_sync" AFTER INSERT OR DELETE ON "public"."table_adjacencies" FOR EACH ROW EXECUTE FUNCTION "public"."sync_table_adjacency_symmetry"();
CREATE OR REPLACE TRIGGER "table_adjacencies_validate" BEFORE INSERT ON "public"."table_adjacencies" FOR EACH ROW EXECUTE FUNCTION "public"."validate_table_adjacency"();
CREATE OR REPLACE TRIGGER "table_inventory_updated_at" BEFORE UPDATE ON "public"."table_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "trg_allocations_refresh" AFTER INSERT OR DELETE OR UPDATE ON "public"."allocations" FOR EACH ROW EXECUTE FUNCTION "public"."on_allocations_refresh"();
CREATE OR REPLACE TRIGGER "trg_booking_status_refresh" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."on_booking_status_refresh"();
CREATE OR REPLACE TRIGGER "update_loyalty_points_updated_at" BEFORE UPDATE ON "public"."loyalty_points" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "update_loyalty_programs_updated_at" BEFORE UPDATE ON "public"."loyalty_programs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "zones_updated_at" BEFORE UPDATE ON "public"."zones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

## Database Views

CREATE MATERIALIZED VIEW public.capacity_selector_rejections_v1 AS
CREATE OR REPLACE VIEW public.capacity_observability_hold_metrics AS
CREATE OR REPLACE VIEW public.capacity_observability_rpc_conflicts AS
CREATE OR REPLACE VIEW public.capacity_observability_selector_metrics AS

## Database Triggers

'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I.%I
CREATE OR REPLACE TRIGGER "allocations_updated_at" BEFORE UPDATE ON "public"."allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "allowed_capacities_touch_updated_at" BEFORE UPDATE ON "public"."allowed_capacities" FOR EACH ROW EXECUTE FUNCTION "public"."allowed_capacities_set_updated_at"();
CREATE OR REPLACE TRIGGER "booking_slots_increment_version" BEFORE UPDATE ON "public"."booking_slots" FOR EACH ROW EXECUTE FUNCTION "public"."increment_booking_slot_version"();
CREATE OR REPLACE TRIGGER "booking_slots_updated_at" BEFORE UPDATE ON "public"."booking_slots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "booking_table_assignments_audit" AFTER INSERT OR DELETE ON "public"."booking_table_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."log_table_assignment_change"();
CREATE OR REPLACE TRIGGER "booking_table_assignments_updated_at" BEFORE UPDATE ON "public"."booking_table_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "bookings_set_instants" BEFORE INSERT OR UPDATE OF "booking_date", "start_time", "end_time", "restaurant_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_instants"();
CREATE OR REPLACE TRIGGER "bookings_set_reference" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_reference"();
CREATE OR REPLACE TRIGGER "bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "capacity_metrics_hourly_set_updated_at" BEFORE UPDATE ON "public"."capacity_metrics_hourly" FOR EACH ROW EXECUTE FUNCTION "public"."capacity_metrics_hourly_updated_at"();
CREATE OR REPLACE TRIGGER "customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "merge_group_members_validate_connectivity" BEFORE INSERT ON "public"."merge_group_members" FOR EACH ROW EXECUTE FUNCTION "public"."validate_merge_group_members"();
CREATE OR REPLACE TRIGGER "merge_rules_updated_at" BEFORE UPDATE ON "public"."merge_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "restaurant_capacity_rules_updated_at" BEFORE UPDATE ON "public"."restaurant_capacity_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "restaurant_operating_hours_updated_at" BEFORE UPDATE ON "public"."restaurant_operating_hours" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "restaurant_service_periods_updated_at" BEFORE UPDATE ON "public"."restaurant_service_periods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "restaurants_updated_at" BEFORE UPDATE ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "service_policy_updated_at" BEFORE UPDATE ON "public"."service_policy" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "set_restaurant_invites_updated_at" BEFORE UPDATE ON "public"."restaurant_invites" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "table_adjacencies_sync" AFTER INSERT OR DELETE ON "public"."table_adjacencies" FOR EACH ROW EXECUTE FUNCTION "public"."sync_table_adjacency_symmetry"();
CREATE OR REPLACE TRIGGER "table_adjacencies_validate" BEFORE INSERT ON "public"."table_adjacencies" FOR EACH ROW EXECUTE FUNCTION "public"."validate_table_adjacency"();
CREATE OR REPLACE TRIGGER "table_inventory_updated_at" BEFORE UPDATE ON "public"."table_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "trg_allocations_refresh" AFTER INSERT OR DELETE OR UPDATE ON "public"."allocations" FOR EACH ROW EXECUTE FUNCTION "public"."on_allocations_refresh"();
CREATE OR REPLACE TRIGGER "trg_booking_status_refresh" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."on_booking_status_refresh"();
CREATE OR REPLACE TRIGGER "update_loyalty_points_updated_at" BEFORE UPDATE ON "public"."loyalty_points" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "update_loyalty_programs_updated_at" BEFORE UPDATE ON "public"."loyalty_programs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER "zones_updated_at" BEFORE UPDATE ON "public"."zones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();
CREATE OR REPLACE TRIGGER set_user_profiles_updated_at
CREATE TRIGGER bar_tables_drinks_only
CREATE TRIGGER booking_assignment_validation
CREATE TRIGGER table_hold_members_sync_delete
CREATE TRIGGER table_hold_members_sync_insert
CREATE TRIGGER table_holds_sync_update
CREATE TRIGGER trg_capacity_outbox_updated_at
CREATE TRIGGER update_demand_profiles_updated_at
EXECUTE $$CREATE TRIGGER merge_rules_updated_at
EXECUTE $$CREATE TRIGGER waiting_list_updated_at

## RLS Policies

CREATE POLICY "Admins and owners can delete bookings" ON "public"."bookings" FOR DELETE USING (("restaurant_id" IN ( SELECT "rm"."restaurant_id"
CREATE POLICY "Admins and owners can delete customers" ON "public"."customers" FOR DELETE USING (("restaurant_id" IN ( SELECT "rm"."restaurant_id"
CREATE POLICY "Customers can view their table assignments" ON "public"."booking_table_assignments" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Ops can manage simulation runs" ON public.strategic_simulation_runs
CREATE POLICY "Ops managers can manage strategic configs" ON public.strategic_configs
CREATE POLICY "Owners and admins can manage memberships" ON "public"."restaurant_memberships" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants_admin"() AS "user_restaurants_admin"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants_admin"() AS "user_restaurants_admin")));
CREATE POLICY "Owners and managers can manage demand profiles" ON public.demand_profiles
CREATE POLICY "Owners and managers can manage scarcity metrics" ON public.table_scarcity_metrics
CREATE POLICY "Owners and managers manage invites" ON "public"."restaurant_invites" USING (("restaurant_id" IN ( SELECT "rm"."restaurant_id"
CREATE POLICY "Public can view booking slots" ON "public"."booking_slots" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Public can view table inventory" ON "public"."table_inventory" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Restaurant staff can view analytics" ON "public"."analytics_events" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Restaurant staff can view booking versions" ON "public"."booking_versions" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Service role can manage adjacencies" ON "public"."table_adjacencies" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage allocations" ON "public"."allocations" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage allowed capacities" ON "public"."allowed_capacities" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage analytics events" ON "public"."analytics_events" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage audit logs" ON "public"."audit_logs" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage booking slots" ON "public"."booking_slots" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage booking versions" ON "public"."booking_versions" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage capacity rules" ON "public"."restaurant_capacity_rules" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage customer profiles" ON "public"."customer_profiles" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage loyalty events" ON "public"."loyalty_point_events" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage loyalty points" ON "public"."loyalty_points" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage loyalty programs" ON "public"."loyalty_programs" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage merge group members" ON "public"."merge_group_members" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage merge groups" ON "public"."merge_groups" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage merge rules" ON "public"."merge_rules" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage operating hours" ON "public"."restaurant_operating_hours" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage profiles" ON "public"."profiles" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage service periods" ON "public"."restaurant_service_periods" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage service policy" ON "public"."service_policy" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage stripe events" ON "public"."stripe_events" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage table assignments" ON "public"."booking_table_assignments" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage table hold members" ON public.table_hold_members
CREATE POLICY "Service role can manage table holds" ON public.table_holds
CREATE POLICY "Service role can manage table inventory" ON "public"."table_inventory" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage zones" ON "public"."zones" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "Staff can create bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can create customers" ON "public"."customers" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can manage adjacencies" ON "public"."table_adjacencies" TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Staff can manage allowed capacities" ON "public"."allowed_capacities" TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can manage booking slots" ON "public"."booking_slots" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can manage capacity rules" ON "public"."restaurant_capacity_rules" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can manage operating hours" ON "public"."restaurant_operating_hours" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can manage service periods" ON "public"."restaurant_service_periods" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can manage table assignments" ON "public"."booking_table_assignments" USING ((EXISTS ( SELECT 1
CREATE POLICY "Staff can manage table inventory" ON "public"."table_inventory" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can manage zones" ON "public"."zones" TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can update bookings" ON "public"."bookings" FOR UPDATE USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can update customers" ON "public"."customers" FOR UPDATE USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can view allocations for their restaurants" ON "public"."allocations" FOR SELECT TO "authenticated" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can view bookings" ON "public"."bookings" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can view customer profiles" ON "public"."customer_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Staff can view customers" ON "public"."customers" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Staff can view merge rules" ON "public"."merge_rules" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Staff can view service policy" ON "public"."service_policy" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Staff can view table hold members" ON public.table_hold_members
CREATE POLICY "Staff can view table holds" ON public.table_holds
CREATE POLICY "Tenant service role can manage allocations archive"
CREATE POLICY "Tenant service role can manage allocations"
CREATE POLICY "Tenant service role can manage booking confirmation results"
CREATE POLICY "Tenant service role can manage bookings"
CREATE POLICY "Tenant service role can manage capacity outbox"
CREATE POLICY "Tenant service role can manage customers"
CREATE POLICY "Tenant service role can manage holds"
CREATE POLICY "Tenant service role can manage table assignments"
CREATE POLICY "Tenant service role can manage table hold members"
CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));
CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));
CREATE POLICY "Users can view demand profiles for their restaurants" ON public.demand_profiles
CREATE POLICY "Users can view memberships in their restaurants" ON "public"."restaurant_memberships" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));
CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
CREATE POLICY "Users can view scarcity metrics for their restaurants" ON public.table_scarcity_metrics
CREATE POLICY "Users can view simulation runs for their restaurants" ON public.strategic_simulation_runs
CREATE POLICY "Users can view strategic configs for their restaurants" ON public.strategic_configs
CREATE POLICY "anon_read_all" ON "public"."restaurants" FOR SELECT TO "anon" USING (true);
CREATE POLICY "authenticated_can_create" ON "public"."restaurants" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));
CREATE POLICY "authenticated_read_all" ON "public"."restaurants" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "owners_admins_can_update" ON "public"."restaurants" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "rm"."restaurant_id"
CREATE POLICY "owners_can_delete" ON "public"."restaurants" FOR DELETE TO "authenticated" USING (("id" IN ( SELECT "rm"."restaurant_id"
CREATE POLICY "profile_update_requests_delete" ON "public"."profile_update_requests" FOR DELETE USING (("auth"."uid"() = "profile_id"));
CREATE POLICY "profile_update_requests_insert" ON "public"."profile_update_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "profile_id"));
CREATE POLICY "profile_update_requests_select" ON "public"."profile_update_requests" FOR SELECT USING (("auth"."uid"() = "profile_id"));
CREATE POLICY "profile_update_requests_update" ON "public"."profile_update_requests" FOR UPDATE USING (("auth"."uid"() = "profile_id")) WITH CHECK (("auth"."uid"() = "profile_id"));
CREATE POLICY "service_role_all_access" ON "public"."restaurants" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "service_role_read_all" ON "public"."restaurants" FOR SELECT TO "service_role" USING (true);
EXECUTE $$CREATE POLICY "Public can insert leads"
EXECUTE $$CREATE POLICY "Service role can manage merge rules"
EXECUTE $$CREATE POLICY "Service role can read leads"
EXECUTE $$CREATE POLICY "Service role manage waiting list"
EXECUTE $$CREATE POLICY "Staff can view merge rules"
EXECUTE $$CREATE POLICY "Staff manage waiting list"

## Database Indexes

CREATE INDEX "allocations_resource_window_idx" ON "public"."allocations" USING "gist" ("resource_type", "resource_id", "window");
CREATE INDEX "allowed_capacities_restaurant_idx" ON "public"."allowed_capacities" USING "btree" ("restaurant_id", "capacity");
CREATE INDEX "bookings_restaurant_date_status_idx" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_date", "status");
CREATE INDEX "idx_analytics_events_booking_id" ON "public"."analytics_events" USING "btree" ("booking_id");
CREATE INDEX "idx_analytics_events_customer_id" ON "public"."analytics_events" USING "btree" ("customer_id") WHERE ("customer_id" IS NOT NULL);
CREATE INDEX "idx_analytics_events_event_type" ON "public"."analytics_events" USING "btree" ("event_type");
CREATE INDEX "idx_analytics_events_occurred_at" ON "public"."analytics_events" USING "btree" ("occurred_at" DESC);
CREATE INDEX "idx_analytics_events_restaurant_id" ON "public"."analytics_events" USING "btree" ("restaurant_id");
CREATE INDEX "idx_analytics_events_restaurant_occurred" ON "public"."analytics_events" USING "btree" ("restaurant_id", "occurred_at" DESC);
CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");
CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);
CREATE INDEX "idx_audit_logs_entity_id" ON "public"."audit_logs" USING "btree" ("entity", "entity_id");
CREATE INDEX "idx_booking_slots_date_range" ON "public"."booking_slots" USING "btree" ("restaurant_id", "slot_date");
CREATE INDEX "idx_booking_slots_lookup" ON "public"."booking_slots" USING "btree" ("restaurant_id", "slot_date", "slot_time");
CREATE INDEX "idx_booking_slots_service_period" ON "public"."booking_slots" USING "btree" ("service_period_id", "slot_date");
CREATE INDEX "idx_booking_state_history_booking" ON "public"."booking_state_history" USING "btree" ("booking_id", "changed_at" DESC);
CREATE INDEX "idx_booking_state_history_changed_at" ON "public"."booking_state_history" USING "btree" ("changed_at");
CREATE INDEX "idx_booking_table_assignments_booking" ON "public"."booking_table_assignments" USING "btree" ("booking_id");
CREATE INDEX "idx_booking_table_assignments_slot" ON "public"."booking_table_assignments" USING "btree" ("slot_id");
CREATE INDEX "idx_booking_table_assignments_table" ON "public"."booking_table_assignments" USING "btree" ("table_id", "assigned_at");
CREATE INDEX "idx_booking_versions_booking_id" ON "public"."booking_versions" USING "btree" ("booking_id");
CREATE INDEX "idx_booking_versions_changed_at" ON "public"."booking_versions" USING "btree" ("changed_at" DESC);
CREATE INDEX "idx_booking_versions_restaurant_id" ON "public"."booking_versions" USING "btree" ("restaurant_id");
CREATE INDEX "idx_bookings_auth_user" ON "public"."bookings" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);
CREATE INDEX "idx_bookings_client_request_id" ON "public"."bookings" USING "btree" ("client_request_id");
CREATE INDEX "idx_bookings_confirmation_token" ON "public"."bookings" USING "btree" ("confirmation_token") WHERE ("confirmation_token" IS NOT NULL);
CREATE INDEX "idx_bookings_created" ON "public"."bookings" USING "btree" ("restaurant_id", "created_at" DESC);
CREATE INDEX "idx_bookings_customer" ON "public"."bookings" USING "btree" ("customer_id");
CREATE INDEX "idx_bookings_date" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_date");
CREATE INDEX "idx_bookings_datetime" ON "public"."bookings" USING "btree" ("restaurant_id", "start_at", "end_at");
CREATE INDEX "idx_bookings_idempotency_key" ON "public"."bookings" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);
CREATE INDEX "idx_bookings_pending_ref" ON "public"."bookings" USING "btree" ("pending_ref") WHERE ("pending_ref" IS NOT NULL);
CREATE INDEX "idx_bookings_reference" ON "public"."bookings" USING "btree" ("reference");
CREATE INDEX "idx_bookings_restaurant" ON "public"."bookings" USING "btree" ("restaurant_id");
CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("restaurant_id", "status");
CREATE INDEX "idx_capacity_metrics_hourly_window" ON "public"."capacity_metrics_hourly" USING "btree" ("window_start" DESC);
CREATE INDEX "idx_customer_profiles_updated_at" ON "public"."customer_profiles" USING "btree" ("updated_at" DESC);
CREATE INDEX "idx_customers_auth_user" ON "public"."customers" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);
CREATE INDEX "idx_customers_email_normalized" ON "public"."customers" USING "btree" ("restaurant_id", "email_normalized");
CREATE INDEX "idx_customers_phone_normalized" ON "public"."customers" USING "btree" ("restaurant_id", "phone_normalized");
CREATE INDEX "idx_customers_restaurant" ON "public"."customers" USING "btree" ("restaurant_id");
CREATE INDEX "idx_loyalty_point_events_booking" ON "public"."loyalty_point_events" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);
CREATE INDEX "idx_loyalty_point_events_customer" ON "public"."loyalty_point_events" USING "btree" ("customer_id");
CREATE INDEX "idx_loyalty_points_restaurant_customer" ON "public"."loyalty_points" USING "btree" ("restaurant_id", "customer_id");
CREATE INDEX "idx_loyalty_programs_restaurant" ON "public"."loyalty_programs" USING "btree" ("restaurant_id");
CREATE INDEX "idx_memberships_restaurant" ON "public"."restaurant_memberships" USING "btree" ("restaurant_id");
CREATE INDEX "idx_memberships_user" ON "public"."restaurant_memberships" USING "btree" ("user_id");
CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email") WHERE ("email" IS NOT NULL);
CREATE INDEX "idx_profiles_has_access" ON "public"."profiles" USING "btree" ("has_access");
CREATE INDEX "idx_restaurant_capacity_rules_scope" ON "public"."restaurant_capacity_rules" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer), "effective_date");
CREATE INDEX "idx_restaurant_operating_hours_scope" ON "public"."restaurant_operating_hours" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer), "effective_date");
CREATE INDEX "idx_restaurant_service_periods_scope" ON "public"."restaurant_service_periods" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer));
CREATE INDEX "idx_restaurants_active" ON "public"."restaurants" USING "btree" ("is_active");
CREATE INDEX "idx_restaurants_slug" ON "public"."restaurants" USING "btree" ("slug");
CREATE INDEX "idx_stripe_events_created_at" ON "public"."stripe_events" USING "btree" ("created_at" DESC);
CREATE INDEX "idx_stripe_events_event_id" ON "public"."stripe_events" USING "btree" ("event_id");
CREATE INDEX "idx_stripe_events_event_type" ON "public"."stripe_events" USING "btree" ("event_type");
CREATE INDEX "idx_stripe_events_processed" ON "public"."stripe_events" USING "btree" ("processed") WHERE ("processed" = false);
CREATE INDEX "idx_table_inventory_lookup" ON "public"."table_inventory" USING "btree" ("restaurant_id", "status", "capacity");
CREATE INDEX "idx_table_inventory_section" ON "public"."table_inventory" USING "btree" ("restaurant_id", "section");
CREATE INDEX "restaurant_invites_restaurant_status_idx" ON "public"."restaurant_invites" USING "btree" ("restaurant_id", "status", "expires_at" DESC);
CREATE INDEX "table_adjacencies_table_b_idx" ON "public"."table_adjacencies" USING "btree" ("table_b");
CREATE INDEX "table_inventory_zone_idx" ON "public"."table_inventory" USING "btree" ("zone_id");
CREATE INDEX IF NOT EXISTS allocations_archive_booking_idx ON public.allocations_archive USING btree (booking_id);
CREATE INDEX IF NOT EXISTS allocations_archive_restaurant_idx ON public.allocations_archive USING btree (restaurant_id);
CREATE INDEX IF NOT EXISTS allocations_booking_id_idx ON public.allocations(booking_id);
CREATE INDEX IF NOT EXISTS allocations_resource_idx ON public.allocations(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS allocations_restaurant_id_idx ON public.allocations(restaurant_id);
CREATE INDEX IF NOT EXISTS allocations_window_gist_idx ON public.allocations USING gist("window");
CREATE INDEX IF NOT EXISTS analytics_events_restaurant_occurred_idx
CREATE INDEX IF NOT EXISTS bai_rest_bk_idx
CREATE INDEX IF NOT EXISTS booking_assignment_idempo_bkid_key_idx
CREATE INDEX IF NOT EXISTS booking_assignment_idempotency_created_idx
CREATE INDEX IF NOT EXISTS booking_confirmation_results_created_idx
CREATE INDEX IF NOT EXISTS booking_confirmation_results_hold_idx
CREATE INDEX IF NOT EXISTS booking_occasions_active_idx
CREATE INDEX IF NOT EXISTS booking_occasions_audit_key_idx
CREATE INDEX IF NOT EXISTS booking_occasions_display_order_idx
CREATE INDEX IF NOT EXISTS booking_slots_available_idx
CREATE INDEX IF NOT EXISTS booking_table_assignments_booking_id_idx ON public.booking_table_assignments(booking_id);
CREATE INDEX IF NOT EXISTS booking_table_assignments_merge_group_idx
CREATE INDEX IF NOT EXISTS booking_table_assignments_slot_id_idx ON public.booking_table_assignments(slot_id);
CREATE INDEX IF NOT EXISTS booking_table_assignments_table_id_idx ON public.booking_table_assignments(table_id);
CREATE INDEX IF NOT EXISTS bookings_booking_date_start_time_idx ON public.bookings(restaurant_id, booking_date, start_time);
CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS bookings_restaurant_date_idx
CREATE INDEX IF NOT EXISTS bookings_restaurant_id_idx ON public.bookings(restaurant_id);
CREATE INDEX IF NOT EXISTS bta_booking_id_idx
CREATE INDEX IF NOT EXISTS bta_table_id_idx
CREATE INDEX IF NOT EXISTS bta_table_window_gist
CREATE INDEX IF NOT EXISTS bta_window_gist
CREATE INDEX IF NOT EXISTS capacity_outbox_booking_idx ON public.capacity_outbox(booking_id);
CREATE INDEX IF NOT EXISTS capacity_outbox_dispatch_idx
CREATE INDEX IF NOT EXISTS capacity_outbox_next_attempt_idx ON public.capacity_outbox(next_attempt_at);
CREATE INDEX IF NOT EXISTS capacity_outbox_restaurant_idx ON public.capacity_outbox(restaurant_id);
CREATE INDEX IF NOT EXISTS capacity_outbox_status_idx ON public.capacity_outbox(status);
CREATE INDEX IF NOT EXISTS idx_allocations_restaurant
CREATE INDEX IF NOT EXISTS idx_allocations_window_gist
CREATE INDEX IF NOT EXISTS idx_booking_table_assignments_booking_id
CREATE INDEX IF NOT EXISTS idx_bookings_auto_assign_idempotency_key
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_date_end
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_date_start
CREATE INDEX IF NOT EXISTS idx_bta_booking_end
CREATE INDEX IF NOT EXISTS idx_bta_booking_start
CREATE INDEX IF NOT EXISTS idx_customers_user_profile_id
CREATE INDEX IF NOT EXISTS idx_table_hold_members_hold
CREATE INDEX IF NOT EXISTS idx_table_hold_members_table
CREATE INDEX IF NOT EXISTS idx_table_holds_restaurant_end
CREATE INDEX IF NOT EXISTS idx_table_holds_restaurant_expires
CREATE INDEX IF NOT EXISTS idx_table_holds_restaurant_start
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON public.user_profiles (phone);
CREATE INDEX IF NOT EXISTS mas_active_state_idx
CREATE INDEX IF NOT EXISTS mas_booking_state_idx
CREATE INDEX IF NOT EXISTS mas_restaurant_state_idx
CREATE INDEX IF NOT EXISTS observability_events_booking_idx
CREATE INDEX IF NOT EXISTS observability_events_created_at_idx
CREATE INDEX IF NOT EXISTS observability_events_restaurant_occurred_idx
CREATE INDEX IF NOT EXISTS observability_events_source_idx
CREATE INDEX IF NOT EXISTS outbox_status_next_attempt_idx
CREATE INDEX IF NOT EXISTS table_hold_members_table_active_idx
CREATE INDEX IF NOT EXISTS table_hold_members_table_idx
CREATE INDEX IF NOT EXISTS table_hold_windows_restaurant_idx
CREATE INDEX IF NOT EXISTS table_hold_windows_table_id_idx ON public.table_hold_windows(table_id);
CREATE INDEX IF NOT EXISTS table_hold_windows_table_idx
CREATE INDEX IF NOT EXISTS table_hold_windows_window_gist_idx ON public.table_hold_windows USING gist(hold_window);
CREATE INDEX IF NOT EXISTS table_holds_active_booking_idx
CREATE INDEX IF NOT EXISTS table_holds_active_restaurant_idx
CREATE INDEX IF NOT EXISTS table_holds_booking_idx
CREATE INDEX IF NOT EXISTS table_holds_expires_at_idx
CREATE INDEX IF NOT EXISTS table_holds_restaurant_id_idx ON public.table_holds(restaurant_id);
CREATE INDEX IF NOT EXISTS table_holds_restaurant_idx
CREATE INDEX IF NOT EXISTS table_holds_session_idx
CREATE INDEX IF NOT EXISTS table_holds_status_idx
CREATE INDEX IF NOT EXISTS table_holds_zone_start_idx
CREATE INDEX IF NOT EXISTS thw_table_window_gist
CREATE INDEX IF NOT EXISTS thw_window_gist
CREATE INDEX idx_capacity_selector_rejections_v1_restaurant_date
CREATE INDEX idx_demand_profiles_restaurant_day_window ON public.demand_profiles(restaurant_id, day_of_week, service_window);
CREATE INDEX idx_demand_profiles_updated_at ON public.demand_profiles(updated_at);
CREATE INDEX idx_table_scarcity_metrics_computed_at ON public.table_scarcity_metrics(computed_at);
CREATE INDEX idx_table_scarcity_metrics_restaurant_type ON public.table_scarcity_metrics(restaurant_id, table_type);
CREATE UNIQUE INDEX "booking_table_assignments_booking_id_idempotency_key_key" ON "public"."booking_table_assignments" USING "btree" ("booking_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);
CREATE UNIQUE INDEX "merge_rules_from_to_idx" ON "public"."merge_rules" USING "btree" ("from_a", "from_b", "to_capacity");
CREATE UNIQUE INDEX "profile_update_requests_profile_key_idx" ON "public"."profile_update_requests" USING "btree" ("profile_id", "idempotency_key");
CREATE UNIQUE INDEX "restaurant_invites_pending_unique_email" ON "public"."restaurant_invites" USING "btree" ("restaurant_id", "email_normalized") WHERE ("status" = 'pending'::"text");
CREATE UNIQUE INDEX "restaurant_invites_token_hash_key" ON "public"."restaurant_invites" USING "btree" ("token_hash");
CREATE UNIQUE INDEX "zones_restaurant_name_idx" ON "public"."zones" USING "btree" ("restaurant_id", "lower"("name"));
CREATE UNIQUE INDEX IF NOT EXISTS capacity_outbox_dedupe
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_normalized_uniq
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_normalized_uniq
CREATE UNIQUE INDEX IF NOT EXISTS customers_restaurant_id_user_profile_id_unique
CREATE UNIQUE INDEX IF NOT EXISTS table_adjacencies_canonical_unique
CREATE UNIQUE INDEX IF NOT EXISTS table_inventory_restaurant_table_number_key
CREATE UNIQUE INDEX IF NOT EXISTS thm_unique
CREATE UNIQUE INDEX IF NOT EXISTS zones_restaurant_name_key
CREATE UNIQUE INDEX capacity_outbox_dedupe_unique
EXECUTE $$CREATE INDEX waiting_list_restaurant_date_time_idx
EXECUTE $$CREATE UNIQUE INDEX merge_rules_from_to_idx
EXECUTE $$CREATE UNIQUE INDEX waiting_list_customer_unique_idx
EXECUTE 'CREATE INDEX IF NOT EXISTS booking_table_assignments_merge_group_idx

## Custom Types (ENUMs)

CREATE TYPE "public"."analytics_event_type" AS ENUM (
CREATE TYPE "public"."booking_change_type" AS ENUM (
CREATE TYPE "public"."booking_status" AS ENUM (
CREATE TYPE "public"."booking_type" AS ENUM (
CREATE TYPE "public"."capacity_override_type" AS ENUM (
CREATE TYPE "public"."loyalty_tier" AS ENUM (
CREATE TYPE "public"."seating_preference_type" AS ENUM (
CREATE TYPE "public"."table_category" AS ENUM (
CREATE TYPE "public"."table_mobility" AS ENUM (
CREATE TYPE "public"."table_seating_type" AS ENUM (
CREATE TYPE "public"."table_status" AS ENUM (
CREATE TYPE public.manual_assignment_session_state AS ENUM (
CREATE TYPE public.table_hold_status AS ENUM (
