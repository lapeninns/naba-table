# 🔴 CRITICAL: Email Queue Jobs Not Being Created - Diagnosis

**Date**: 2026-01-01  
**Severity**: HIGH  
**Impact**: All booking confirmation emails and reminders are NOT being queued

---

## **Root Cause Found** ⚠️

### **Feature Flag Disabled**

```typescript
// server/feature-flags.ts (line 191-193)
export function isEmailQueueEnabled(): boolean {
  return env.featureFlags.emailQueueEnabled ?? false; // ← DEFAULTS TO FALSE!
}
```

**Environment Variable Missing:**

```bash
# .env.local - NOT SET
# .env.staging - NOT SET
FEATURE_EMAIL_QUEUE_ENABLED=true  # ← THIS IS MISSING!
```

---

## **Impact Analysis**

### **What's Happening:**

```typescript
// server/jobs/booking-side-effects.ts (line 364)
if (isEmailQueueEnabled()) {
  await enqueueEmailJob(...);  // ← NEVER EXECUTES
} else {
  await sendEmailInlineWithDelay(...);  // ← FALLBACK: Inline sending
}
```

**Result:**

- ✅ Immediate emails: **WORKING** (sent inline)
- ❌ Scheduled emails (24h, 2h, review): **NOT WORKING** (need queue)

---

## **Evidence**

### **Check #1: Redis Queue is Empty**

```
⏳ Waiting:  0
⏰ Delayed:  0
```

**Expected**: Should have ~3 delayed jobs per confirmed booking

### **Check #2: Feature Flag Check**

```typescript
// From code inspection:
isEmailQueueEnabled() === false; // ← Jobs never created!
```

### **Check #3: Booking Flow**

```
Booking Created
    ↓
processBookingCreatedSideEffects()
    ↓
if (isEmailQueueEnabled()) {  ← FALSE
    enqueueEmailJob(...);      ← SKIPPED
} else {
    sendEmailInlineWithDelay(...);  ← Used instead (can't schedule far future)
}
```

---

## **What's Working vs What's Broken**

| Email Type           | Timing     | Status        | Method      |
| -------------------- | ---------- | ------------- | ----------- |
| **Confirmation**     | Immediate  | ✅ Working    | Inline send |
| **Request Received** | Immediate  | ✅ Working    | Inline send |
| **24h Reminder**     | 24h before | ❌ **BROKEN** | Needs queue |
| **2h Reminder**      | 2h before  | ❌ **BROKEN** | Needs queue |
| **Review Request**   | 3h after   | ❌ **BROKEN** | Needs queue |

---

## **The Fix** 🛠️

### **Option 1: Enable Email Queue (Recommended)**

**Add to `.env.local`:**

```bash
FEATURE_EMAIL_QUEUE_ENABLED=true
```

**Add to `.env.staging`:**

```bash
FEATURE_EMAIL_QUEUE_ENABLED=true
```

**Add to Vercel Production Environment Variables:**

```
FEATURE_EMAIL_QUEUE_ENABLED=true
```

---

### **Option 2: Verify Queue Redis is Configured**

The queue also needs:

```bash
# Check if these are set:
QUEUE_REDIS_URL=...
# OR
QUEUE_REDIS_HOST=...
QUEUE_REDIS_PORT=...
```

**Current**: Using Upstash for cache, but might not be set for queue.

---

## **Diagnostic Steps Completed**

### **✅ Checked Redis**

```bash
curl "https://settled-frog-13193.upstash.io/llen/pending-booking-emails:wait"
# Result: 0 jobs

curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:delayed"
# Result: 0 delayed jobs
```

**Conclusion**: No jobs exist = jobs not being created

---

### **✅ Checked Code**

```typescript
// booking-side-effects.ts line 529-546
if (!SUPPRESS_EMAILS && shouldSendEmail && booking.status === "confirmed") {
  await scheduleReminderJob(..., "reminder_24h", ...);  // ← Tries to schedule
  await scheduleReminderJob(..., "reminder_short", ...);  // ← Tries to schedule
}

// But inside scheduleReminderJob (line 364):
if (isEmailQueueEnabled()) {  // ← Returns FALSE!
  await enqueueEmailJob(...);  // ← NEVER CALLED
}
```

**Conclusion**: Code path is correct, but feature flag blocks execution

---

### **✅ Checked Vercel Cron**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/process-emails",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Conclusion**: Cron configured correctly, but has no jobs to process

---

## **Why This Wasn't Obvious**

1. **Immediate emails work** (sent inline, not queued)
2. **No error messages** (fallback silently used)
3. **Queue shows 0** (looks normal if no recent bookings)
4. **Feature flag defaults to false** (conservative default)

---

## **Recommended Actions**

### **Immediate (Required)**:

1. **Enable the feature flag:**

   ```bash
   # Add to .env.local
   echo "FEATURE_EMAIL_QUEUE_ENABLED=true" >> .env.local

   # Add to .env.staging
   echo "FEATURE_EMAIL_QUEUE_ENABLED=true" >> .env.staging
   ```

2. **Restart dev server:**

   ```bash
   # Kill current dev server
   # Run: pnpm run dev
   ```

3. **Add to Vercel:**
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Add: `FEATURE_EMAIL_QUEUE_ENABLED` = `true`
   - Deploy

---

### **Verification (After Fix)**:

1. **Create a test booking:**

   ```bash
   # Should be confirmed status
   ```

2. **Check Redis queue:**

   ```bash
   curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:delayed" \
     -H "Authorization: Bearer YOUR_UPSTASH_REDIS_REST_TOKEN"

   # Should show: {"result":3}  ← 3 delayed jobs (24h, 2h, review)
   ```

3. **Check endpoint:**

   ```bash
   curl http://localhost:3000/api/admin/queue-status

   # Should show delayed > 0
   ```

---

## **Additional Configuration Needed**

### **Queue Redis Connection**

If `FEATURE_EMAIL_QUEUE_ENABLED=true` is set but queue still empty, verify:

```bash
# Check if these are in your .env files:
QUEUE_REDIS_URL=<redis_url>

# OR separate credentials:
QUEUE_REDIS_HOST=<host>
QUEUE_REDIS_PORT=<port>
QUEUE_REDIS_PASSWORD=<password>
QUEUE_REDIS_TLS=true
```

**You might be able to reuse Upstash:**

```bash
# In .env.local and .env.staging:
QUEUE_REDIS_URL=redis://default:<TOKEN>@settled-frog-13193.upstash.io:6379
```

---

## **Timeline of Discovery**

1. **User noticed**: Queue shows 0 jobs
2. **Checked Redis**: Confirmed 0 jobs in production
3. **Checked code**: Found `isEmailQueueEnabled()` check
4. **Checked feature-flags.ts**: Defaults to `false`
5. **Checked env files**: Variable not set
6. **Root cause identified**: Feature flag disabled

---

## **Summary**

| Issue                | Status                                   |
| -------------------- | ---------------------------------------- |
| **Immediate emails** | ✅ Working (inline)                      |
| **Scheduled emails** | ❌ Broken (queue disabled)               |
| **Redis queue**      | ✅ Working (just empty)                  |
| **Vercel cron**      | ✅ Configured (no jobs to process)       |
| **Root cause**       | ⚠️ `FEATURE_EMAIL_QUEUE_ENABLED` not set |

---

## **Fix Commands**

```bash
# 1. Add to env files
echo "FEATURE_EMAIL_QUEUE_ENABLED=true" >> .env.local
echo "FEATURE_EMAIL_QUEUE_ENABLED=true" >> .env.staging

# 2. Restart dev server
# Ctrl+C, then: pnpm run dev

# 3. Create test booking
# Via UI at http://localhost:3000/walk-in

# 4. Verify queue
curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:delayed" \
  -H "Authorization: Bearer YOUR_UPSTASH_REDIS_REST_TOKEN"

# Expected: {"result":3}
```

---

**Once fixed, all reminder emails will start being queued and sent correctly!** 🎉
