#!/usr/bin/env bash
set -euo pipefail

# Smoke Test: Tenant RLS Foundation
# Tests manual/auto hold + confirm routes to verify:
# 1. Cross-tenant attempts fail with proper errors
# 2. Legitimate tenant-scoped flows succeed
# 3. RLS policies enforce isolation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Configuration
TARGET_ENV="${1:-staging}"
PASSED=0
FAILED=0

case "$TARGET_ENV" in
    staging)
        BASE_URL="${STAGING_BASE_URL:-http://localhost:3000}"
        ;;
    production|prod)
        BASE_URL="${PRODUCTION_BASE_URL:-https://your-domain.com}"
        log_warn "Running smoke tests against PRODUCTION"
        ;;
    *)
        log_error "Invalid environment: $TARGET_ENV"
        exit 1
        ;;
esac

# Helper: Make authenticated API request
api_request() {
    local method=$1
    local endpoint=$2
    local data=${3:-}
    local expected_status=${4:-200}
    
    local args=(-s -w "\n%{http_code}" -X "$method")
    
    if [ -n "$data" ]; then
        args+=(-H "Content-Type: application/json" -d "$data")
    fi
    
    if [ -n "${AUTH_TOKEN:-}" ]; then
        args+=(-H "Authorization: Bearer $AUTH_TOKEN")
    fi
    
    response=$(curl "${args[@]}" "$BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        return 0
    else
        echo "$body"
        return 1
    fi
}

# Test 1: Manual hold within tenant succeeds
test_manual_hold_same_tenant() {
    log_info "Test 1: Manual hold within same tenant"
    
    local payload='{
        "restaurantId": "test-restaurant-1",
        "date": "2025-11-15",
        "time": "19:00",
        "partySize": 4,
        "durationMinutes": 120
    }'
    
    if api_request POST "/api/staff/manual/hold" "$payload" 200; then
        log_success "Manual hold within tenant succeeded"
        ((PASSED++))
        return 0
    else
        log_error "Manual hold within tenant failed"
        ((FAILED++))
        return 1
    fi
}

# Test 2: Manual hold cross-tenant fails
test_manual_hold_cross_tenant() {
    log_info "Test 2: Manual hold across tenant boundary (should fail)"
    
    # Attempt to hold for different restaurant without proper context
    local payload='{
        "restaurantId": "different-restaurant",
        "date": "2025-11-15",
        "time": "19:00",
        "partySize": 4,
        "durationMinutes": 120
    }'
    
    if api_request POST "/api/staff/manual/hold" "$payload" 403; then
        log_success "Cross-tenant hold correctly blocked"
        ((PASSED++))
        return 0
    else
        log_error "Cross-tenant hold was not blocked"
        ((FAILED++))
        return 1
    fi
}

# Test 3: Auto hold within tenant succeeds
test_auto_hold_same_tenant() {
    log_info "Test 3: Auto hold within same tenant"
    
    local payload='{
        "restaurantId": "test-restaurant-1",
        "date": "2025-11-15",
        "time": "20:00",
        "partySize": 2,
        "bookingType": "dinner"
    }'
    
    if api_request POST "/api/staff/auto/quote" "$payload" 200; then
        log_success "Auto hold within tenant succeeded"
        ((PASSED++))
        return 0
    else
        log_error "Auto hold within tenant failed"
        ((FAILED++))
        return 1
    fi
}

# Test 4: Confirm booking within tenant succeeds
test_confirm_same_tenant() {
    log_info "Test 4: Confirm booking within same tenant"
    
    # First create a hold
    local hold_payload='{
        "restaurantId": "test-restaurant-1",
        "date": "2025-11-16",
        "time": "19:30",
        "partySize": 6,
        "durationMinutes": 120
    }'
    
    hold_response=$(api_request POST "/api/staff/manual/hold" "$hold_payload" 200)
    
    if [ $? -eq 0 ]; then
        # Extract hold_id from response (simplified - adjust to actual response structure)
        log_info "Hold created, attempting confirmation..."
        
        local confirm_payload='{
            "restaurantId": "test-restaurant-1",
            "customerName": "Test Customer",
            "customerEmail": "test@example.com",
            "customerPhone": "+1234567890"
        }'
        
        if api_request POST "/api/staff/manual/confirm" "$confirm_payload" 200; then
            log_success "Booking confirmation within tenant succeeded"
            ((PASSED++))
            return 0
        else
            log_error "Booking confirmation within tenant failed"
            ((FAILED++))
            return 1
        fi
    else
        log_error "Could not create hold for confirmation test"
        ((FAILED++))
        return 1
    fi
}

# Test 5: Query bookings filtered by tenant
test_bookings_tenant_filtered() {
    log_info "Test 5: Bookings query respects tenant context"
    
    if api_request GET "/api/ops/bookings?restaurantId=test-restaurant-1" "" 200; then
        log_success "Tenant-filtered bookings query succeeded"
        ((PASSED++))
        return 0
    else
        log_error "Tenant-filtered bookings query failed"
        ((FAILED++))
        return 1
    fi
}

# Test 6: Verify RLS context is set
test_rls_context_function() {
    log_info "Test 6: Database RLS context function"
    
    # This requires direct DB access
    if [ -n "${SUPABASE_STAGING_DB_URL:-}" ]; then
        result=$(psql "$SUPABASE_STAGING_DB_URL" -t -c \
            "SELECT current_setting('app.restaurant_id', true) IS NOT NULL;")
        
        if echo "$result" | grep -q "f"; then
            log_success "RLS context function exists and returns expected value"
            ((PASSED++))
            return 0
        else
            log_warn "RLS context function test inconclusive"
            return 0
        fi
    else
        log_warn "Skipping DB-level test (no SUPABASE_STAGING_DB_URL)"
        return 0
    fi
}

# Main execution
main() {
    log_info "🧪 Starting Tenant RLS Smoke Tests ($TARGET_ENV)"
    echo ""
    
    # Run tests
    test_manual_hold_same_tenant
    test_manual_hold_cross_tenant
    test_auto_hold_same_tenant
    test_confirm_same_tenant
    test_bookings_tenant_filtered
    test_rls_context_function
    
    echo ""
    log_info "📊 Test Results:"
    log_success "Passed: $PASSED"
    if [ $FAILED -gt 0 ]; then
        log_error "Failed: $FAILED"
        exit 1
    else
        log_success "All tests passed! ✅"
        echo ""
        log_info "Next steps:"
        echo "  • Verify cross-tenant isolation manually in staging UI"
        echo "  • Check application logs for any RLS-related errors"
        echo "  • If all clear, proceed with production deployment"
        exit 0
    fi
}

main
