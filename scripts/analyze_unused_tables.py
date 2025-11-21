import re
import os
import glob

def get_defined_tables(root_dir):
    tables = set()
    create_table_pattern = re.compile(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)',
        re.IGNORECASE
    )
    
    # Scan schema.sql
    schema_path = os.path.join(root_dir, 'supabase/schema.sql')
    if os.path.exists(schema_path):
        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                for line in f:
                    match = create_table_pattern.search(line)
                    if match:
                        tables.add(match.group(1))
        except Exception as e:
            print(f"Error reading schema.sql: {e}")

    # Scan migrations
    migration_files = glob.glob(os.path.join(root_dir, 'supabase/migrations/*.sql'))
    for file_path in migration_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Use findall for migrations as they might be multi-line or multiple in one file
                matches = create_table_pattern.findall(content)
                for match in matches:
                    tables.add(match)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            
    return tables

def get_used_tables():
    # This list is from the previous analysis of the codebase
    return {
        'allocations', 'allowed_capacities', 'analytics_events', 'audit_logs',
        'booking_assignment_attempts', 'booking_assignment_idempotency',
        'booking_assignment_state_history', 'booking_confirmation_results',
        'booking_occasions', 'booking_slots', 'booking_state_history',
        'booking_table_assignments', 'booking_versions', 'bookings',
        'capacity_observability_hold_metrics', 'capacity_observability_rpc_conflicts',
        'capacity_observability_selector_metrics', 'capacity_outbox',
        'current_bookings', 'customer_profiles', 'customers', 'demand_profiles',
        'feature_flag_overrides', 'leads', 'loyalty_point_events', 'loyalty_points',
        'loyalty_programs', 'merge_rules', 'observability_events',
        'profile_update_requests', 'profiles', 'restaurant_invites',
        'restaurant_memberships', 'restaurant_operating_hours',
        'restaurant_service_periods', 'restaurants', 'service_policy',
        'strategic_configs', 'table_adjacencies', 'table_hold_members',
        'table_hold_windows', 'table_holds', 'table_inventory',
        'table_scarcity_metrics', 'user_profiles', 'waiting_list', 'zones',
        'restaurant_capacity_rules' # Added this one as we found it used in code
    }

if __name__ == "__main__":
    root_dir = os.getcwd()
    defined_tables = get_defined_tables(root_dir)
    used_tables = get_used_tables()
    
    unused_tables = defined_tables - used_tables
    
    print(f"Total tables defined in schema+migrations: {len(defined_tables)}")
    print(f"Total tables used in code: {len(used_tables)}")
    print(f"Potential unused tables ({len(unused_tables)}):")
    
    for table in sorted(unused_tables):
        print(f"- {table}")
