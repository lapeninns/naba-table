---
task: supabase-security-hardening
timestamp_utc: 2025-12-24T10:41:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
completed: true
completed_at: 2025-12-24T11:23:00Z
---

# Implementation Checklist - COMPLETED ✅

## Setup

- [x] Review all 34 functions in Supabase SQL Editor
- [x] Check for any dependent objects on extensions
- [x] Ensure database backup/PITR is enabled

---

## Phase 0: Enable RLS on Tables (CRITICAL - ERROR Level) ✅

> ✅ **COMPLETED**: All 7 tables now have RLS enabled with appropriate policies.

### Tables Affected (7)

- [x] `booking_assignment_attempts`
- [x] `observability_events`
- [x] `table_merge_graph`
- [x] `_migrations`
- [x] `manual_assignment_sessions`
- [x] `booking_occasions_audit`
- [x] `booking_state_history`

### Verification

- [x] Run `03_enable_rls_tables.sql`
- [x] Verify RLS is enabled
- [x] Verify policies are created
- [x] Test application:
  - [x] Booking creation still works
  - [x] Table assignments still work
  - [x] Dashboard loads correctly

---

## Phase 1: Fix Function Search Paths ✅

> ✅ **COMPLETED**: All functions now have `search_path = public`

### Important Lesson Learned

- **DO NOT** use `search_path = ''` (empty string)
- **USE** `search_path = public` instead
- Empty search_path prevents functions from finding tables!

### Verification

- [x] Run corrected `01_fix_function_search_paths.sql`
- [x] Verify all functions show `search_path=public` in config
- [x] Test booking creation
- [x] Confirm no "relation does not exist" errors

---

## Phase 1.5: Create Missing audit_logs Table ✅

> ✅ **COMPLETED**: Table created and verified with 271+ rows

- [x] Run `04_create_audit_logs.sql`
- [x] Verify table exists in public schema
- [x] Enable RLS
- [x] Create service_role policy

---

## Phase 2: Move Extensions (DEFERRED)

> ⏳ **DEFERRED**: Not critical, can be done later

- [ ] Run dependency check query
- [ ] Run `02_move_extensions.sql`
- [ ] Test all extension-dependent features

---

## Phase 3: Enable Leaked Password Protection (TODO)

> ⏳ **PENDING**: Dashboard action

- [ ] Open Supabase Dashboard → Authentication → Settings
- [ ] Enable "Check passwords against HaveIBeenPwned database"
- [ ] Save settings
- [ ] Test with known compromised password

---

## Phase 4: Upgrade Postgres Version (TODO)

> ⏳ **PENDING**: Requires maintenance window

- [ ] Schedule maintenance window
- [ ] Initiate upgrade from Dashboard
- [ ] Verify new version

---

## Notes

- **Function search paths**: Use `public`, NOT empty string!
- **Extension migration**: Deferred - working fine in public schema
- **Password protection**: Low priority, can enable anytime
- **Postgres upgrade**: Schedule for next maintenance window

## Lessons Learned

1. **Empty search_path breaks functions** - Always use `search_path = public`
2. **TypeScript types don't guarantee DB schema** - Verify tables exist before migration
3. **Test immediately after migration** - Catch issues early
4. **Fallback paths work** - The system gracefully degraded during issues

---

**COMPLETED**: 2025-12-24T11:23:00Z
