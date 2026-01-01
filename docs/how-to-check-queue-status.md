# How to Check Redis Queue & Cron Status

## **Quick Check: Queue Status**

### **Method 1: Via Browser/API (Easiest)**

I created an endpoint for you at:

```
http://localhost:3000/api/admin/queue-status
```

**Open in browser or run:**

```bash
curl http://localhost:3000/api/admin/queue-status | python3 -m json.tool
```

**Response shows:**

- ⏳ Waiting jobs (ready to process)
- ⚡ Active jobs (currently processing)
- ✅ Completed jobs
- ❌ Failed jobs
- ⏰ Delayed jobs (scheduled for future)

---

### **Method 2: Via Redis CLI (Direct)**

**If you have Redis connection details:**

```bash
# Connect to Redis
redis-cli -u $QUEUE_REDIS_URL

# Or if using separate credentials:
redis-cli -h $QUEUE_REDIS_HOST -p $QUEUE_REDIS_PORT -a $QUEUE_REDIS_PASSWORD

# Check queue counts
LLEN pending-booking-emails:wait      # Pending jobs
LLEN pending-booking-emails:active    # Currently processing
ZCARD pending-booking-emails:failed   # Failed jobs
ZCARD pending-booking-emails:delayed  # Scheduled jobs

# List all queue keys
KEYS pending-booking-emails:*
```

---

### **Method 3: Environment Check**

**Check if queue Redis is configured:**

```bash
# In your project directory
cat .env.local | grep QUEUE_REDIS

# Or check staging
cat .env.staging | grep QUEUE_REDIS

# Expected output:
# QUEUE_REDIS_URL=redis://...
# OR
# QUEUE_REDIS_HOST=...
# QUEUE_REDIS_PORT=...
```

---

## **Vercel Cron Jobs Status**

### **Check Cron Configuration**

**File**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/process-emails",
      "schedule": "*/5 * * * *" // Every 5 minutes
    }
  ]
}
```

---

### **Check Cron Execution**

**Via Vercel Dashboard:**

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Click "Cron Jobs" in sidebar
4. See:
   - ✅ Last execution time
   - ✅ Execution count
   - ✅ Success/failure rate
   - ✅ Execution logs

---

### **Manually Trigger Cron (Test)**

```bash
# Local
curl http://localhost:3000/api/cron/process-emails

# Staging/Production
curl https://your-app.vercel.app/api/cron/process-emails
```

---

## **What the Numbers Mean**

### **Queue Counts:**

| Count             | Meaning             | Good/Bad         |
| ----------------- | ------------------- | ---------------- |
| **Waiting: 0-10** | Normal queue        | ✅ Good          |
| **Waiting: 100+** | Jobs piling up      | ⚠️ Check cron    |
| **Active: 0-5**   | Normal processing   | ✅ Good          |
| **Active: 10+**   | Possible stuck jobs | ⚠️ Investigate   |
| **Failed: 0**     | No failures         | ✅ Perfect       |
| **Failed: 1-5**   | Some issues         | ⚠️ Review errors |
| **Failed: 10+**   | Systemic problem    | ❌ Action needed |
| **Delayed: any**  | Scheduled emails    | ✅ Normal        |

---

## **Common Queue Issues**

### **Issue 1: Jobs Not Processing**

**Symptoms:**

- Waiting count growing
- Active count = 0
- Emails not sending

**Check:**

```bash
# Is cron running?
curl http://localhost:3000/api/cron/process-emails

# Is Redis configured?
echo $QUEUE_REDIS_URL
```

**Fix:**

- Ensure cron is enabled in Vercel
- Verify Redis connection
- Check worker logs

---

### **Issue 2: Jobs Stuck in Active**

**Symptoms:**

- Active count stays high
- Same jobs for hours

**Fix:**

```bash
# Clean stuck jobs (via Redis)
# WARNING: Only do this if jobs truly stuck
redis-cli -u $QUEUE_REDIS_URL DEL pending-booking-emails:active
```

---

### **Issue 3: Many Failed Jobs**

**Symptoms:**

- Failed count growing
- Emails not delivered

**Check failed job details:**

```bash
curl http://localhost:3000/api/admin/queue-status | grep -A 5 "failed"
```

**Common causes:**

- Invalid email address
- Resend API error
- Missing booking data

---

## **Current Status (Best Guess)**

**Without direct access, here's what's likely:**

### **Development (localhost):**

```
Waiting:   0-5     (few test bookings)
Active:    0       (only when cron runs)
Failed:    0-2     (occasional test failures)
Delayed:   0-10    (upcoming reminders)
```

### **Production:**

```
Waiting:   0-20    (normal booking flow)
Active:    0-3     (processing during cron)
Failed:    0-5     (acceptable error rate)
Delayed:   50-200  (all scheduled reminders)
```

---

## **Action Items**

To get exact numbers, you can:

1. **✅ Open the endpoint I created:**

   ```
   http://localhost:3000/api/admin/queue-status
   ```

2. **✅ Check Vercel Dashboard:**
   - Cron execution history
   - Logs

3. **✅ If you have Redis access:**
   ```bash
   redis-cli -u $QUEUE_REDIS_URL
   LLEN pending-booking-emails:wait
   ```

---

## **Expected Queue Load**

**For a typical restaurant:**

- **Per day**: 10-50 bookings
- **Emails per booking**: ~4 (confirmation + reminders + review)
- **Total jobs/day**: 40-200
- **Queue at any moment**: 5-50 delayed jobs (future reminders)

---

**Want me to help you:**

1. Open the queue status endpoint in a browser?
2. Create a dashboard to monitor this?
3. Set up alerts for queue problems?
