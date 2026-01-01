# Pre-Deployment Checklist: Optional Contact Fields

## ⚠️ CRITICAL - DO NOT SKIP

Before pushing this update to production, you MUST complete these steps in order:

---

## **Step 1: Run Database Migration** 🚨 REQUIRED

### **Local/Staging:**

```bash
# Option A: If using Supabase CLI
supabase db push

# Option B: If using Supabase Dashboard
# 1. Go to https://app.supabase.com/project/YOUR_PROJECT/sql
# 2. Copy contents of supabase/migrations/20251231_optional_contact_fields.sql
# 3. Run the SQL

# Option C: Using psql directly
psql YOUR_DATABASE_URL < supabase/migrations/20251231_optional_contact_fields.sql
```

### **Verification:**

```sql
-- Check columns are now nullable
SELECT
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'customers'
  AND column_name IN ('email', 'phone');

-- Expected result:
-- email  | YES | NULL
-- phone  | YES | NULL

-- Check constraint exists
SELECT
  conname,
  pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'customers_contact_required';

-- Expected: customers_contact_required exists
```

---

## **Step 2: Test Walk-In Bookings** ✅

### **Local Testing:**

1. **Start dev server:**

   ```bash
   pnpm run dev
   ```

2. **Navigate to:** `http://localhost:3000/walk-in`

3. **Test Cases:**

   **Test A: Email Only** ✅

   ```
   Name: John Smith
   Email: john@example.com
   Phone: [empty]
   → Should succeed
   ```

   **Test B: Phone Only** ✅

   ```
   Name: Jane Doe
   Email: [empty]
   Phone: 07467586751
   → Should succeed
   ```

   **Test C: Both Empty** ❌

   ```
   Name: Bob Brown
   Email: [empty]
   Phone: [empty]
   → Should show validation errors on both fields
   ```

   **Test D: Both Filled** ✅

   ```
   Name: Alice Wonder
   Email: alice@example.com
   Phone: 07123456789
   → Should succeed
   ```

4. **Verify Database:**

   ```sql
   SELECT
     customer_name,
     customer_email,
     customer_phone,
     source
   FROM bookings
   WHERE source = 'walk-in'
   ORDER BY created_at DESC
   LIMIT 10;

   -- Verify:
   -- - No fake emails (walkin+...@system.local)
   -- - No fake phones (000-...)
   -- - NULL for missing fields
   ```

---

## **Step 3: Test Public Bookings** ✅

### **Ensure No Regression:**

1. **Navigate to:** `http://localhost:3000/restaurants/YOUR-SLUG/book`

2. **Test Public Booking:**

   ```
   Name: Test Guest
   Email: test@example.com
   Phone: 07987654321
   → Should still require BOTH fields
   → Should succeed
   ```

3. **Test Validation:**
   ```
   Name: Test Guest
   Email: [empty]
   Phone: 07987654321
   → Should show "Email is required"
   ```

---

## **Step 4: Check Email System** 📧

### **Test Email Sending:**

1. **Create booking with email:**

   ```
   Email: your-test@email.com
   Phone: NULL
   ```

   ✅ Should receive confirmation email

2. **Create booking with phone only:**

   ```
   Email: NULL
   Phone: 07467586751
   ```

   ✅ Should NOT receive email (graceful skip)

3. **Check logs:**
   ```bash
   # Look for:
   "No recipient email found for type created (booking ...)"
   # This is normal for phone-only bookings
   ```

---

## **Step 5: Production Deployment** 🚀

### **Deployment Order (CRITICAL):**

```
1. Database Migration FIRST  ← Run migration
   ↓
2. Wait 30 seconds            ← Ensure migration completes
   ↓
3. Deploy Code                ← Push to production
```

### **Commands:**

```bash
# 1. Apply migration to production database
supabase db push --linked  # If using Supabase
# OR run SQL directly via Supabase Dashboard

# 2. Verify migration succeeded
# Check database as shown in Step 1

# 3. Deploy code
git add .
git commit -m "feat: optional contact fields for ops walk-in bookings"
git push origin main

# 4. Deploy to Vercel/hosting
# (automatic if connected to git)
```

---

## **Step 6: Post-Deployment Verification** ✅

### **After Deployment:**

1. **Test in production:**
   - Create walk-in booking with email only
   - Create walk-in booking with phone only
   - Verify both succeed

2. **Check Sentry/logs** for errors:

   ```
   Search for: "violates not-null constraint"
   Expected: No errors
   ```

3. **Monitor for 1 hour:**
   - Check for any booking creation failures
   - Verify emails are being sent correctly
   - Check no fake contacts in database

---

## **Rollback Plan** 🔄

### **If Something Breaks:**

**Option 1: Revert Code Only**

```bash
git revert HEAD
git push origin main
```

**Option 2: Revert Migration (Nuclear)**

```sql
BEGIN;

-- Remove constraint
ALTER TABLE customers DROP CONSTRAINT customers_contact_required;

-- Make columns required again
ALTER TABLE customers
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL;

COMMIT;
```

⚠️ **WARNING**: This will fail if any NULL values exist!

**Option 3: Keep Migration, Revert Code**

- Safest option
- Keep database flexible
- Revert frontend/backend code
- Fix issues, redeploy

---

## **Breaking Changes Check** ✅

### **What Changed:**

| Component            | Change               | Breaking?                   |
| -------------------- | -------------------- | --------------------------- |
| Database schema      | Email/phone nullable | ⚠️ YES - requires migration |
| Ops booking endpoint | Already existed      | ❌ No                       |
| Public booking       | No changes           | ❌ No                       |
| Email system         | Already handles null | ❌ No                       |
| Frontend (ops)       | Helper text added    | ❌ No                       |
| Frontend (public)    | No changes           | ❌ No                       |

### **Impact Analysis:**

**✅ Safe (No Migration Impact):**

- Public bookings (still require both)
- Email sending (already checks for null)
- Existing bookings (unaffected)

**⚠️ Requires Migration:**

- New ops bookings with optional fields
- Database must be migrated first

**❌ Will Break if Migration Not Run:**

- Any ops booking with missing email/phone
- Error: "null value in column violates not-null constraint"

---

## **Final Checklist** ✅

Before pushing, confirm:

- [ ] Migration file created (`20251231_optional_contact_fields.sql`)
- [ ] Migration tested locally
- [ ] Database nullable verified
- [ ] Ops bookings work with email only
- [ ] Ops bookings work with phone only
- [ ] Ops bookings fail with neither (validation works)
- [ ] Public bookings still work (both required)
- [ ] No fake contacts generated
- [ ] Email system handles null gracefully
- [ ] Build passes (`pnpm run build`)
- [ ] Tests pass (`pnpm run test`)
- [ ] Migration ready for production
- [ ] Rollback plan understood

---

## **Current Status:**

| Item                      | Status                           |
| ------------------------- | -------------------------------- |
| **Code Changes**          | ✅ Complete                      |
| **Migration File**        | ✅ Created                       |
| **Migration Run (Local)** | ❌ **PENDING**                   |
| **Migration Run (Prod)**  | ❌ **PENDING**                   |
| **Manual Testing**        | ⚠️ **REQUIRED**                  |
| **Ready to Push**         | ❌ **NO - Run migration first!** |

---

## **Summary:**

**Can you push now?** ❌ **NO**

**Next steps:**

1. ✅ Run migration locally (Step 1)
2. ✅ Test all scenarios (Steps 2-4)
3. ✅ Run migration in production (Step 5)
4. ✅ Deploy code (Step 5)
5. ✅ Monitor (Step 6)

**Estimated time:** 30-45 minutes total

**Safe to push after:** Migration completed + tested ✅
