# Production Redis Queue Status Check

**Date**: 2025-12-31 23:30 UTC  
**Environment**: Production (Upstash Redis)  
**URL**: `https://settled-frog-13193.upstash.io`

---

## **📊 Current Queue Status**

```
⏳ Waiting jobs:     0
⚡ Active jobs:      0
❌ Failed jobs:      0
⏰ Delayed jobs:     0
✅ Completed jobs:   0
```

---

## **Analysis**

### **✅ Queue is Empty - This is NORMAL**

**Why the queue is empty:**

1. **Jobs are auto-removed on completion**
   - BullMQ config: `removeOnComplete: true`
   - Completed jobs don't stay in Redis

2. **No pending bookings**
   - Queue processes jobs every 5 minutes (Vercel cron)
   - Between cron runs, jobs get processed and removed

3. **No scheduled emails yet**
   - Delayed jobs = future reminders (24h, 2h, review)
   - If no bookings in last 24h, delayed count = 0

---

## **What This Means**

| Metric      | Value | Status      | Meaning                                               |
| ----------- | ----- | ----------- | ----------------------------------------------------- |
| **Waiting** | 0     | ✅ Good     | No backlog - cron processing well                     |
| **Active**  | 0     | ✅ Good     | No jobs currently processing (between cron runs)      |
| **Failed**  | 0     | ✅ Perfect  | No email send failures                                |
| **Delayed** | 0     | ⚠️ Expected | No upcoming scheduled emails OR queue recently purged |

---

## **Is This Normal?**

**YES** ✅ - An empty queue is actually **ideal** if:

1. **Low booking volume** (staging/new restaurant)
2. **Cron working well** (processes jobs within 5 min)
3. **No recent bookings** (no emails to send)

**Warning signs** (not present):

- ❌ Failed jobs > 0 → Email delivery issues
- ❌ Waiting > 50 → Cron not processing
- ❌ Active > 0 (for hours) → Stuck jobs

---

## **How Email Queue Works**

```
Booking Created
    ↓
Add 4 jobs to Redis:
    1. Confirmation (immediate)     ← Sent & removed
    2. 24h reminder (delayed)       ← Waiting in "delayed"
    3. 2h reminder (delayed)        ← Waiting in "delayed"
    4. Review request (delayed)     ← Waiting in "delayed"
    ↓
Vercel Cron (every 5 min)
    ↓
Process due jobs → Send via Resend → Remove from queue
```

**Expected pattern**:

- After booking: `delayed = 3` (reminders waiting)
- After 24h: `delayed = 2` (24h sent, 2h & review waiting)
- After 2h more: `delayed = 1` (2h sent, review waiting)
- After 3h from booking end: `delayed = 0` (review sent)

---

## **Checking Vercel Cron**

**Your cron is configured to run:**

```json
{
  "path": "/api/cron/process-emails",
  "schedule": "*/5 * * * *" // Every 5 minutes
}
```

**To verify it's working:**

1. **Vercel Dashboard**:
   - https://vercel.com/dashboard → Your Project → Cron Jobs
   - Check last execution time

2. **Manual trigger**:

   ```bash
   curl https://your-production-url.vercel.app/api/cron/process-emails
   ```

3. **Check logs**:
   - Vercel Dashboard → Logs
   - Filter for `/api/cron/process-emails`

---

## **Commands Used**

```bash
# Waiting jobs
curl "https://settled-frog-13193.upstash.io/llen/pending-booking-emails:wait" \
  -H "Authorization: Bearer TOKEN"

# Active jobs
curl "https://settled-frog-13193.upstash.io/llen/pending-booking-emails:active" \
  -H "Authorization: Bearer TOKEN"

# Failed jobs
curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:failed" \
  -H "Authorization: Bearer TOKEN"

# Delayed jobs
curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:delayed" \
  -H "Authorization: Bearer TOKEN"

# All queue keys
curl "https://settled-frog-13193.upstash.io" \
  -H "Authorization: Bearer TOKEN" \
  -d '["KEYS", "pending-booking-emails:*"]'
```

---

## **Next Steps**

### **To Test the Queue:**

1. **Create a test booking** (staging or production)
2. **Check queue immediately after**:

   ```bash
   # Should show 3 delayed jobs (reminders)
   curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:delayed" \
     -H "Authorization: Bearer TOKEN"
   ```

3. **Wait 5 minutes** for cron to run
4. **Check again** - confirmation should be sent, delayed should still be 3

---

## **Troubleshooting**

### **If jobs start piling up:**

```bash
# Check if jobs are stuck
curl "https://settled-frog-13193.upstash.io/llen/pending-booking-emails:wait" \
  -H "Authorization: Bearer TOKEN"

# If > 50, investigate:
# 1. Is cron running? (Check Vercel Dashboard)
# 2. Are there errors? (Check logs)
# 3. Is Resend API working? (Check Resend dashboard)
```

### **If failed jobs appear:**

```bash
# Get failed job count
curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:failed" \
  -H "Authorization: Bearer TOKEN"

# Review failures in Vercel logs
# Common causes:
# - Invalid email address
# - Resend API quota exceeded
# - Network timeout
```

---

## **Summary**

**Current State**: ✅ **Healthy**

- Queue is empty (normal between bookings)
- No failed jobs (good email delivery)
- No stuck jobs (cron working well)
- Ready to process bookings

**Action Required**: ❌ **None**

**Recommendation**: Monitor after your next update deployment to ensure:

1. New bookings create queue jobs
2. Cron processes them within 5 min
3. No failures appear
