# 🚨 URGENT: Jobs Being Lost - Action Plan

**Date**: 2026-01-01  
**Severity**: HIGH  
**Impact**: Reminder emails and review requests NOT being sent

---

## 📊 **Confirmed Problem**

### **The Evidence:**

```
Last 7 days booking activity:
├─ Total bookings: 32
├─ Confirmed: 9
└─ Expected queue jobs: 27 (9 bookings × 3 jobs each)

Current queue status:
├─ Delayed jobs: 0 ❌
├─ Failed jobs: 0
└─ Total jobs: 0

CONCLUSION: Jobs are NOT being created!
```

---

## ✅ **What We Know Works:**

1. ✅ Configuration is correct (`FEATURE_EMAIL_QUEUE_ENABLED=true`)
2. ✅ Redis is connected (verified PONG)
3. ✅ Bookings are being created (32 in 7 days)
4. ✅ Some bookings are confirmed (9)

---

## ❌ **What's Broken:**

**Email jobs are NOT being enqueued despite correct configuration**

Possible causes:

1. **Runtime error** during job creation (caught silently)
2. **Email addresses missing** on confirmed bookings
3. **Source/channel** preventing job creation
4. **Feature flag** not loading correctly at runtime
5. **Redis connection** failing during queue operation (even though ping works)

---

## 🔍 **Immediate Diagnostic Steps**

### **Step 1: Check If Bookings Have Emails** ⚡

Run this SQL NOW:

```sql
SELECT
  id,
  reference,
  customer_email,
  customer_phone,
  status,
  source,
  created_at
FROM bookings
WHERE status = 'confirmed'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

**Look for:**

- How many have `customer_email` = NULL or empty?
- If ALL are missing email, that explains it (but unlikely)
- If SOME have email, why weren't jobs created for those?

---

### **Step 2: Check Vercel Logs via Dashboard** 🔍

Since CLI is having issues, use the web dashboard:

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Click "Logs" tab
4. Set filter to last 48 hours
5. Search for these terms (one at a time):
   - `queue`
   - `enqueue`
   - `[jobs]`
   - `booking.created`
   - `Error`

**What to look for:**

✅ **Success pattern:**

```
[jobs][booking.created] Processing side effects for booking abc123
[queue] Enqueued reminder_24h for booking abc123
[queue] Enqueued reminder_short for booking abc123
```

❌ **Failure patterns:**

```
[jobs][booking.created][queue] Error: ...
[queue] Failed to enqueue: ...
Error: Queue Redis configuration missing
Connection refused
ECONNREFUSED
```

⚠️ **Suspicious pattern:**

```
[jobs][booking.created][email-fallback] ...
(This means it tried queue, failed, fell back to inline send)
```

---

### **Step 3: Check Recent Deployment** 📦

```bash
# Check recent deployments
vercel ls

# Check if there was a recent deployment that might have broken something
```

**Questions:**

- When was last deployment?
- Does it coincide with jobs stopping?
- Were environment variables changed?

---

## 🧪 **Live Test: Force Job Creation**

### **Create a Test Booking in Production:**

**Via Vercel Function (if you have test endpoint):**

```bash
# If you have /api/test/bookings endpoint
curl -X POST https://your-production-url.vercel.app/api/test/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -d '{
    "status": "confirmed",
    "email": "test@example.com",
    "startAtOffset": "2 days"
  }'
```

**Via UI:**

1. Go to production URL
2. Create walk-in booking
3. Fill in email
4. Submit
5. **Immediately** check queue:

```bash
curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:delayed" \
  -H "Authorization: Bearer YOUR_UPSTASH_REDIS_REST_TOKEN"
```

**Expected**: `{"result":3}`  
**If 0**: Jobs definitely not being created

---

## 🐛 **Likely Root Causes (Ranked)**

### **#1: Redis Connection Failing During Queue Operations** (60%)

**Hypothesis**:

- Ping works (REST API)
- But BullMQ connection (ioredis) fails
- Jobs creation throws error
- Error caught and logged somewhere

**Check:**

- Vercel logs for connection errors
- Redis connection timeout issues
- TLS handshake failures

**Fix if confirmed:**

```bash
# Try different Redis URL format
QUEUE_REDIS_URL=rediss://:PASSWORD@HOST:PORT

# Or increase timeout
QUEUE_REDIS_CONNECTION_TIMEOUT=10000
```

---

### **#2: Bookings Created Without Email** (25%)

**Hypothesis**:

- Confirmed bookings exist
- But `customer_email` is NULL/empty
- Job creation skipped correctly

**Check:**

- Run SQL query from Step 1
- Look for pattern in booking source

**Fix if confirmed:**

- This is expected behavior (phone-only bookings)
- Not a bug

---

### **#3: Runtime Environment Variable Issue** (10%)

**Hypothesis**:

- Env vars set in Vercel
- But not loaded at runtime
- Feature flag evaluates to false

**Check:**

- Add logging to production
- Check if `process.env.FEATURE_EMAIL_QUEUE_ENABLED` is actually "true"

**Fix if confirmed:**

- Redeploy
- Verify env vars are in all environments (production, preview)

---

### **#4: Silent Error in Job Creation** (5%)

**Hypothesis**:

- Exception thrown during `enqueueEmailJob()`
- Caught by try/catch
- Logged but we haven't found logs yet

**Check:**

- Deeper log search
- Check for `[jobs][booking.created][queue]` errors

**Fix if confirmed:**

- Identify specific error
- Fix underlying issue

---

## 🎯 **Action Plan (Execute in Order)**

### **Priority 1: Get Visibility** 🔍

**A. Check booking emails:**

```sql
-- Run investigate-missing-jobs.sql in Supabase
```

**B. Check Vercel logs:**

- Use dashboard (CLI has issues)
- Search for error patterns
- Download logs if needed

---

### **Priority 2: Live Test** 🧪

**Create ONE test booking:**

1. Use production UI
2. Fill email explicitly
3. Monitor queue immediately
4. Check if job appears

**If job appears**: System works, older bookings might have had issues  
**If job doesn't appear**: Confirm jobs not being created

---

### **Priority 3: Add Debugging** 🔬

**Deploy a debugging version:**

Add to `server/jobs/booking-side-effects.ts`:

```typescript
async function processBookingCreatedSideEffects(...) {
  console.log('[DEBUG] Processing booking', booking.id);
  console.log('[DEBUG] isEmailQueueEnabled:', isEmailQueueEnabled());
  console.log('[DEBUG] shouldSendEmail:', shouldSendEmail);
  console.log('[DEBUG] customer_email:', booking.customer_email);

  if (shouldSendEmail && booking.status === 'confirmed') {
    console.log('[DEBUG] Attempting to schedule reminders...');
    try {
      await scheduleReminderJob(...);
      console.log('[DEBUG] Successfully scheduled reminders');
    } catch (error) {
      console.error('[DEBUG] Failed to schedule:', error);
      throw error;
    }
  }
}
```

Deploy and create test booking, then check logs.

---

## 📋 **Checklist**

- [ ] Run SQL to check if confirmed bookings have emails
- [ ] Check Vercel dashboard logs for errors
- [ ] Create test booking in production
- [ ] Verify queue after test booking
- [ ] If still no jobs, add debug logging and redeploy
- [ ] Check Vercel deployment history
- [ ] Verify env vars are actually loaded at runtime

---

## 📞 **Need More Info**

To help further, I need you to:

1. **Run the SQL query** and share results:
   - How many confirmed bookings have emails?
   - What are the booking sources?

2. **Check Vercel logs** and share:
   - Any errors related to queue/jobs?
   - Any connection errors?

3. **Test booking result**:
   - Create one test booking
   - Check queue immediately
   - Report if job appears

---

## 🚨 **Bottom Line**

**Status**: Jobs are being LOST ❌

**Evidence**: 9 confirmed bookings, 0 queue jobs

**Next Steps**:

1. Check if bookings have emails (SQL)
2. Check Vercel logs for errors
3. Create test booking to confirm

**This is a real issue that needs immediate attention!**
