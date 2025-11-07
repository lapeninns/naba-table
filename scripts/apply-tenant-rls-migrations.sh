#!/usr/bin/env bash
set -euo pipefail

# Apply Tenant RLS Foundation Migrations
# This script applies the outbox indexes and tenant RLS foundation migrations
# to staging and production environments.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
check_db_url() {
    local env_name=$1
    local var_name=$2
    
    if [ -z "${!var_name:-}" ]; then
        log_error "$env_name database URL not set. Please export $var_name"
        return 1
    fi
    
    log_success "$env_name database URL configured"
    return 0
}

# Apply a single migration file
apply_migration() {
    local db_url=$1
    local migration_file=$2
    local env_name=$3
    
    if [ ! -f "$migration_file" ]; then
        log_error "Migration file not found: $migration_file"
        return 1
    fi
    
    log_info "Applying $(basename "$migration_file") to $env_name..."
    
    if psql "$db_url" -f "$migration_file"; then
        log_success "Migration applied successfully"
        return 0
    else
        log_error "Migration failed"
        return 1
    fi
}

# Verify migration was applied
verify_migration() {
    local db_url=$1
    local check_query=$2
    local env_name=$3
    
    log_info "Verifying migration in $env_name..."
    
    if psql "$db_url" -t -c "$check_query" | grep -q "t"; then
        log_success "Migration verified"
        return 0
    else
        log_warn "Migration verification failed or incomplete"
        return 1
    fi
}

# Main execution
main() {
    log_info "🚀 Starting Tenant RLS Migration Process"
    echo ""
    
    # Determine target environment
    TARGET_ENV="${1:-staging}"
    
    case "$TARGET_ENV" in
        staging)
            check_db_url "Staging" "SUPABASE_STAGING_DB_URL" || exit 1
            DB_URL="$SUPABASE_STAGING_DB_URL"
            ;;
        production|prod)
            check_db_url "Production" "SUPABASE_PRODUCTION_DB_URL" || exit 1
            DB_URL="$SUPABASE_PRODUCTION_DB_URL"
            
            log_warn "⚠️  You are about to apply migrations to PRODUCTION"
            read -p "Type 'APPLY' to confirm: " confirm
            if [ "$confirm" != "APPLY" ]; then
                log_error "Production migration cancelled"
                exit 1
            fi
            ;;
        *)
            log_error "Invalid environment: $TARGET_ENV (use 'staging' or 'production')"
            exit 1
            ;;
    esac
    
    echo ""
    log_info "Target environment: $TARGET_ENV"
    echo ""
    
    # Step 1: Apply outbox indexes migration
    log_info "📦 Step 1/2: Applying capacity outbox indexes..."
    apply_migration \
        "$DB_URL" \
        "$MIGRATIONS_DIR/20251107093000_capacity_outbox_indexes.sql" \
        "$TARGET_ENV" || exit 1
    
    echo ""
    
    # Step 2: Apply tenant RLS foundation
    log_info "🔐 Step 2/2: Applying tenant RLS foundation..."
    apply_migration \
        "$DB_URL" \
        "$MIGRATIONS_DIR/20251107094000_tenant_rls_foundation.sql" \
        "$TARGET_ENV" || exit 1
    
    echo ""
    
    # Verify RLS context function exists
    log_info "🔍 Verifying tenant RLS setup..."
    verify_migration \
        "$DB_URL" \
        "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'set_restaurant_context');" \
        "$TARGET_ENV"
    
    echo ""
    log_success "✅ All migrations applied successfully to $TARGET_ENV"
    echo ""
    
    # Next steps
    log_info "📋 Next Steps:"
    echo "  1. Run smoke tests: ./scripts/smoke-test-tenant-rls.sh $TARGET_ENV"
    echo "  2. Verify cross-tenant isolation in staging"
    echo "  3. If staging passes, apply to production with: $0 production"
    echo "  4. Convert remaining ops/export APIs to use getTenantServiceSupabaseClient"
    echo ""
}

main "$@"
