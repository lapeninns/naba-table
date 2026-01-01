# Production Diagnostic Report

**Date**: 2026-01-01  
**Environment**: Vercel Production

---

## ✅ Configuration Status: CORRECT

### **Environment Variables:**

```
✅ FEATURE_EMAIL_QUEUE_ENABLED: true
✅ QUEUE_REDIS_URL: rediss://default:***@settled-frog-13193.upstash.io:6379
✅ UPSTASH_REDIS_REST_URL: https://settled-frog-13193.upstash.io
✅ UPSTASH_REDIS_REST_TOKEN: ***
```

### **Configuration Issues:**

- ✅ Using TLS (rediss://)
- ✅ No newline issues detected
- ✅ Redis connection successful

---

## 📊 Current Queue Status

```
Waiting:   0 jobs
Active:    0 jobs
Delayed:   0 jobs
Failed:    0 jobs
Completed: 0 jobs
───────────────────
Total:     0 jobs
```

**No queue keys found** - Queue has never had jobs OR all jobs processed and removed

---

## 🔍 Next Steps: Find Out Why Queue is Empty

### **Hypothesis 1: No Recent Bookings** ✓

**Action**: Check Supabase for recent bookings

Run this SQL:

```sql
-- See: docs/diagnostics/production-booking-check.sql
SELECT COUNT(*) FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

**Expected**:

- If 0: Queue empty is normal (no bookings)
- If > 0: Investigate why jobs weren't created

---

### **Hypothesis 2: Jobs Being Created But Immediately Processed** ✓

**What this means**:

- Immediate emails (confirmation) sent inline
- Delayed jobs (24h, 2h reminders) should persist

**Check**: Look for delayed jobs specifically

```bash
curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:delayed" \
  -H "Authorization: Bearer TOKEN"
```

**If delayed = 0**: Jobs aren't being created OR no future bookings

---

### **Hypothesis 3: Jobs Failing to Be Created** ❌

**Symptoms**:

- Bookings exist
- Emails being sent (immediate)
- But no delayed jobs

**Check Vercel Logs**:

```bash
# Get recent logs
vercel logs --since 24h | grep -E "(queue|jobs|booking.created)"

# Or via Vercel Dashboard:
# https://vercel.com/dashboard → Logs → Filter: "queue"
```

**Look for**:

```
✅ Success:
[queue] Enqueued reminder_24h for booking <id>

❌ Failure:
[jobs][booking.created][queue] Error: ...
```

---

### **Hypothesis 4: Cron Processing Too Fast** ⚡

**What this means**:

- Jobs created
- Cron processes within 5 min
- Jobs removed on completion

**Check**: Cron execution logs

```bash
# Via CLI
vercel logs --since 24h | grep "process-emails"

# Via Dashboard
# Vercel → Cron Jobs → /api/cron/process-emails → View Logs
```

**Look for**:

```
✅ Healthy:
[cron] Processing 3 jobs from queue
[cron] Sent reminder_24h for booking abc123

⚠️ Problem:
[cron] No jobs to process (consistently)
```

---

## 🎯 Recommended Actions (In Order)

### **Step 1: Check Database** 🔍

```bash
# How many bookings in last 24h?
# How many are confirmed with email?
# Run: docs/diagnostics/production-booking-check.sql
```

---

### **Step 2: Check Vercel Logs** 📋

```bash
# Method A: CLI
vercel logs --since 1h | grep -i queue

# Method B: Dashboard
# Go to: https://vercel.com/dashboard
# Project → Logs
# Filter: "queue" or "[jobs]"
```

**What to look for**:

- ✅ `[queue] Enqueued...` = Jobs being created
- ❌ `Error:` = Something failing
- ⚠️ Nothing = Jobs not being attempted

---

### **Step 3: Force a Test Booking** 🧪

**Option A: Via UI**

```
1. Go to production URL
2. Create a booking (walk-in or public)
3. Immediately check queue:
   curl .../delayed
4. Should show 3 jobs (if confirmed booking with email)
```

**Option B: Via API Test Endpoint**

```bash
# If you have test endpoint:
curl -X POST https://your-production-url.vercel.app/api/test/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "...",
    "status": "confirmed",
    "email": "test@example.com"
  }'
```

---

### **Step 4: Check Cron Logs** ⏰

```bash
# Recent cron executions
vercel logs --since 24h | grep "/api/cron/process-emails"

# Expected output every 5 minutes:
# GET /api/cron/process-emails 200
```

**Questions**:

1. Is cron running? (should see entries every 5 min)
2. Are jobs being processed? (look for "Processing X jobs")
3. Any errors? (look for 500 errors or exceptions)

---

## 📈 Expected Behavior

### **Normal Flow:**

```
Booking Created (confirmed, has email)
  ↓
Immediate: Confirmation email sent & removed
  ↓
Delayed: 3 jobs added to queue
  - reminder_24h (scheduled 24h before start)
  - reminder_short (scheduled 2h before start)
  - review_request (scheduled 3h after end)
  ↓
Queue status: delayed = 3
  ↓
Cron runs every 5 min, checks scheduled times
  ↓
When time arrives: Send email, remove job
  ↓
Queue status: delayed = 2 (then 1, then 0)
```

### **If booking is in 2 days:**

- Delayed jobs = 3 (all waiting)
- Active jobs = 0
- These should persist until their scheduled time

---

## 🚨 Red Flags

| Symptom              | Problem           | Action                      |
| -------------------- | ----------------- | --------------------------- |
| Delayed = 0 always   | Jobs not created  | Check logs for job creation |
| Active > 0 for hours | Jobs stuck        | Clear active queue          |
| Failed > 0 growing   | Delivery failures | Check failed job details    |
| No cron logs         | Cron not running  | Check Vercel cron config    |

---

## 📝 Commands to Run Now

### **1. Check for bookings:**

```bash
# Run in Supabase SQL Editor (production)
# Use: docs/diagnostics/production-booking-check.sql
```

### **2. Check Vercel logs:**

```bash
vercel logs --since 1h --output raw | grep -E "(queue|booking.created|process-emails)"
```

### **3. Monitor queue in real-time:**

```bash
# Save as monitor-queue.sh
while true; do
  echo "$(date) - Delayed jobs:"
  curl -s "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:delayed" \
    -H "Authorization: Bearer TOKEN" | jq .result
  sleep 60
done
```

---

## 💡 Most Likely Scenarios

### **Scenario A: Low Traffic** (80% likely)

- Few bookings in production
- Queue processes fast
- Empty queue is normal

**Verify**: Check booking count in database

---

### **Scenario B: Jobs Created & Processed** (15% likely)

- Jobs being created correctly
- Cron processing within 5 minutes
- Immediate jobs removed on completion
- Delayed jobs waiting (but you'd see them)

**Verify**: Check cron logs, look for "Enqueued" messages

---

### **Scenario C: Jobs Failing to Create** (5% likely)

- Configuration issue in runtime
- Error during job creation
- Fallback to inline send

**Verify**: Check logs for errors

---

## 🎯 Next Action: Choose One

1. **Quick Check**: Run `production-booking-check.sql` (2 min)
2. **Deep Dive**: Check Vercel logs for job creation (5 min)
3. **Live Test**: Create test booking and monitor queue (10 min)

**Recommendation**: Start with #1 (database check) to see if there's any activity to investigate.
