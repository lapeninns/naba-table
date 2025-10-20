#!/bin/bash

##############################################################################
# Project Cleanup Script - SajiloReserveX
# 
# This script removes:
# - All .md documentation files (except essential ones)
# - All test files (*.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx)
# - Legacy code and backup directories
# - Temporary/cache directories
# - Report and result directories
#
# SAFETY: This script uses `rm -i` (interactive mode) by default.
# Add `-f` flag to force deletion without prompts.
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FORCE_DELETE=false
DRY_RUN=false

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE_DELETE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -f, --force    Force deletion without confirmation prompts"
            echo "  --dry-run      Show what would be deleted without actually deleting"
            echo "  -h, --help     Show this help message"
            echo ""
            echo "This script will remove:"
            echo "  - Documentation files (.md) except essential project docs"
            echo "  - All test files (*.test.ts, *.spec.ts, etc.)"
            echo "  - Legacy code and backups"
            echo "  - Temporary directories and reports"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

PROJECT_ROOT="/Users/amankumarshrestha/Downloads/SajiloReserveX"
cd "$PROJECT_ROOT"

# Colors for status
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to safely delete items
safe_delete() {
    local item="$1"
    local description="$2"
    
    if [ ! -e "$item" ]; then
        return 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would delete: $description ($item)"
        return 0
    fi
    
    if [ "$FORCE_DELETE" = true ]; then
        rm -rf "$item"
        print_success "Deleted: $description"
    else
        echo -n "Delete $description? (y/n) "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            rm -rf "$item"
            print_success "Deleted: $description"
        fi
    fi
}

# Function to delete files matching a pattern
delete_pattern() {
    local pattern="$1"
    local description="$2"
    
    if [ "$DRY_RUN" = true ]; then
        local count=$(find . -name "$pattern" 2>/dev/null | grep -v node_modules | wc -l)
        if [ "$count" -gt 0 ]; then
            print_info "[DRY RUN] Would delete $count files matching: $description ($pattern)"
            find . -name "$pattern" 2>/dev/null | grep -v node_modules | head -5
            if [ "$count" -gt 5 ]; then
                echo "    ... and $((count - 5)) more"
            fi
        fi
        return 0
    fi
    
    if [ "$FORCE_DELETE" = true ]; then
        find . -name "$pattern" -not -path "*/node_modules/*" -delete
        print_success "Deleted all files matching: $description"
    else
        local count=$(find . -name "$pattern" 2>/dev/null | grep -v node_modules | wc -l)
        if [ "$count" -gt 0 ]; then
            echo -n "Delete $count files matching $description? (y/n) "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                find . -name "$pattern" -not -path "*/node_modules/*" -delete
                print_success "Deleted $count files matching: $description"
            fi
        fi
    fi
}

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        SajiloReserveX Project Cleanup Script          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN MODE - No files will actually be deleted"
    echo ""
fi

print_info "Starting cleanup..."
echo ""

# ============================================================================
# 1. DELETE TEST FILES
# ============================================================================
echo -e "${YELLOW}→ Removing Test Files${NC}"
delete_pattern "*.test.ts" "TypeScript test files"
delete_pattern "*.test.tsx" "TypeScript React test files"
delete_pattern "*.spec.ts" "TypeScript spec files"
delete_pattern "*.spec.tsx" "TypeScript React spec files"
echo ""

# ============================================================================
# 2. DELETE MARKDOWN DOCUMENTATION (except essential ones)
# ============================================================================
echo -e "${YELLOW}→ Removing Documentation Files (.md)${NC}"

# Files to keep
KEEP_MD="README.md"

if [ "$DRY_RUN" = true ]; then
    md_count=$(find . -maxdepth 1 -name "*.md" -type f | wc -l)
    if [ "$md_count" -gt 0 ]; then
        print_info "[DRY RUN] Would delete $md_count markdown files in project root"
        find . -maxdepth 1 -name "*.md" -type f | head -5
        if [ "$md_count" -gt 5 ]; then
            echo "    ... and $((md_count - 5)) more"
        fi
    fi
else
    md_files=$(find . -maxdepth 1 -name "*.md" -type f)
    if [ -n "$md_files" ]; then
        if [ "$FORCE_DELETE" = true ]; then
            echo "$md_files" | while read -r md_file; do
                basename_file=$(basename "$md_file")
                if [ "$basename_file" != "$KEEP_MD" ]; then
                    rm "$md_file"
                    print_success "Deleted: $basename_file"
                fi
            done
        else
            echo "Found markdown files in project root:"
            echo "$md_files"
            echo -n "Delete these markdown files (excluding README.md)? (y/n) "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                echo "$md_files" | while read -r md_file; do
                    basename_file=$(basename "$md_file")
                    if [ "$basename_file" != "$KEEP_MD" ]; then
                        rm "$md_file"
                        print_success "Deleted: $basename_file"
                    fi
                done
            fi
        fi
    fi
fi
echo ""

# ============================================================================
# 3. DELETE LEGACY DIRECTORIES
# ============================================================================
echo -e "${YELLOW}→ Removing Legacy & Backup Directories${NC}"
safe_delete "backups" "Backup directory"
safe_delete ".reserve-dist" "Reserve distribution cache"
safe_delete "playwright-report" "Playwright test reports"
safe_delete "test-results" "Test results directory"
safe_delete "reports" "Reports directory"
echo ""

# ============================================================================
# 4. DELETE LEGACY CODE DIRECTORIES
# ============================================================================
echo -e "${YELLOW}→ Removing Legacy Code${NC}"

# Remove test configuration files that aren't needed
safe_delete "playwright.component.config.ts" "Playwright component config"
safe_delete "vitest.config.ts" "Vitest configuration"
echo ""

# ============================================================================
# 5. DELETE LEGACY SCRIPTS
# ============================================================================
echo -e "${YELLOW}→ Removing Legacy Scripts${NC}"
safe_delete "test-email.mjs" "Legacy test email script"
safe_delete "squash_migrations.sh" "Migration squash script"
echo ""

# ============================================================================
# 6. DELETE OTHER UNNECESSARY FILES
# ============================================================================
echo -e "${YELLOW}→ Removing Other Unnecessary Files${NC}"
safe_delete ".qodo" "Qodo cache directory"
safe_delete ".reserve-dist" "Reserve build cache"
safe_delete "restaurant.json" "Sample restaurant data"
safe_delete "openapi.yaml" "OpenAPI specification (if not needed)"
echo ""

# ============================================================================
# 7. CLEANUP SUMMARY
# ============================================================================
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}║        DRY RUN SUMMARY - No files were deleted      ║${NC}"
else
    echo -e "${BLUE}║            Cleanup Complete!                        ║${NC}"
fi
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Show remaining test files if any
remaining_tests=$(find . -path ./node_modules -prune -o \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \) -type f -print 2>/dev/null | wc -l)
if [ "$remaining_tests" -gt 0 ]; then
    print_warning "Found $remaining_tests test files that may need manual review"
fi

print_success "Cleanup script finished!"
echo ""
echo "Next steps:"
echo "  1. Review any remaining files"
echo "  2. Run: npm install (or pnpm install) to ensure dependencies are intact"
echo "  3. Run: npm run build to verify the project still builds"
echo ""
