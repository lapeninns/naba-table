# Redis & Vercel Configuration Status

## **Redis Tasks (Background Jobs)**

### **Email Queue: `pending-booking-emails`**

**Purpose**: Schedules and processes booking-related emails

**Queue Name**: `pending-booking-emails`  
**DLQ (Dead Letter Queue)**: `pending-booking-emails-dlq`

**Job Types:**

```typescript
-request_received - // Pending booking confirmation
  confirmation - // Booking confirmed
  updated - // Booking modified
  cancelled - // Booking cancelled
  reminder_24h - // 24-hour reminder
  reminder_short - // 2-hour "Table Ready" reminder
  review_request - // Post-visit review request
  booking_rejected - // Booking rejected by restaurant
  restaurant_cancellation; // Restaurant cancelled booking
```

**Configuration:**

- **Max Attempts**: 5
- **Backoff**: Exponential (60s base delay)
- **Retention**:
  - ✅ Remove on complete
  - ❌ Keep failed jobs (for debugging)

---

## **Redis Connection Status**

### **Upstash Redis (Rate Limiting & Cache)**

**URL**: `https://settled-frog-13193.upstash.io`  
**Token**: `ATOJAAIncD***` (configured)

**Used For:**

- Rate limiting (API requests)
- Capacity cache invalidation
- Distributed coordination

**Status**: ✅ Configured

---

### **Queue Redis (BullMQ for Email Jobs)**

**Configuration Required:**

```bash
QUEUE_REDIS_URL=<redis_url>
# OR
QUEUE_REDIS_HOST=<host>
QUEUE_REDIS_PORT=<port>
QUEUE_REDIS_USERNAME=<username>
QUEUE_REDIS_PASSWORD=<password>
QUEUE_REDIS_TLS=true
```

**Status in Staging**: ⚠️ Check `.env.staging`

---

## **Vercel Cron Jobs**

### **Email Processing Cron**

**Path**: `/api/cron/process-emails`  
**Schedule**: `*/5 * * * *` (Every 5 minutes)

**What It Does:**

1. Polls the `pending-booking-emails` queue
2. Processes scheduled emails
3. Sends emails via Resend
4. Handles retries for failed jobs

**Status**: ✅ Configured in `vercel.json`

---

## **Current Task Queue Totals**

### **To Check Queue Status:**

**Option 1: Via Code (API endpoint)**

```typescript
// Add a debug endpoint to check queue status
GET /api/admin/queue-status

// Returns:
{
  pending: 10,
  active: 2,
  completed: 150,
  failed: 3,
  delayed: 5
}
```

**Option 2: Via Redis CLI**

```bash
# Connect to Redis
redis-cli -u $QUEUE_REDIS_URL

# Check queue keys
KEYS pending-booking-emails:*

# Get pending jobs count
LLEN pending-booking-emails:wait

# Get failed jobs count
ZCARD pending-booking-emails:failed

# Get active jobs
LLEN pending-booking-emails:active
```

**Option 3: Via BullBoard (if installed)**

```
Navigate to: /admin/queues
(if BullBoard dashboard is set up)
```

---

## **Email Queue Workflow**

```
┌─────────────────────────────────────┐
│  Booking Created                    │
│  └─> enqueueBookingCreatedSideEffects│
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Add Jobs to Redis Queue            │
│  - Confirmation (immediate)         │
│  - 24h Reminder (scheduled)         │
│  - 2h Reminder (scheduled)          │
│  - Review (scheduled)               │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Vercel Cron (Every 5 min)          │
│  /api/cron/process-emails           │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Email Worker Processes Jobs        │
│  - Check scheduled time             │
│  - Send via Resend                  │
│  - Mark complete or retry           │
└─────────────────────────────────────┘
```

---

## **Potential Issues to Check**

### **1. Stuck Jobs in Queue**

**Symptoms:**

- Emails not sending
- Queue growing indefinitely
- Jobs stuck in "active" state

**How to Check:**

```bash
# Via Redis CLI
LLEN pending-booking-emails:active  # Should be 0 when idle
LLEN pending-booking-emails:wait    # Pending jobs
ZCARD pending-booking-emails:failed # Failed jobs
```

**Fix:**

```typescript
// Clear stuck active jobs (use with caution!)
await emailQueue.clean(0, 'active');

// Retry failed jobs
await emailQueue.retryJobs({ count: 100 });
```

---

### **2. Dead Letter Queue (DLQ) Filling Up**

**Symptoms:**

- Jobs exhausted all retry attempts
- DLQ growing

**How to Check:**

```bash
LLEN pending-booking-emails-dlq:wait
```

**Action:**

1. Review failed jobs for patterns
2. Fix underlying issue (email provider, validation, etc.)
3. Re-queue if fixable

---

### **3. Cron Not Running**

**Symptoms:**

- Scheduled emails not sent
- Queue building up

**How to Check:**

1. Go to Vercel Dashboard → Your Project → Cron Jobs
2. Check last execution time
3. Check logs for errors

**Fix:**

- Ensure cron is enabled in Vercel
- Check `/api/cron/process-emails` endpoint works manually
- Verify Redis connection

---

## **Environment Variables to Verify**

### **Staging (.env.staging):**

```bash
# Email
RESEND_API_KEY=re_***
RESEND_FROM=notifications@oldcrown.co.uk

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://settled-frog-13193.upstash.io
UPSTASH_REDIS_REST_TOKEN=ATOJAAIncD***

# Queue Redis (check if set)
QUEUE_REDIS_URL=<?>
```

### **Production:**

```bash
# Same as staging + verify all are set
```

---

## **Commands to Check Tasks**

### **1. Check Pending Emails:**

```bash
# Via API (create debug endpoint)
curl https://your-app.vercel.app/api/admin/queue-status

# Or via Next.js console
pnpm run dev
# Then navigate to /api/admin/queue-status
```

### **2. Manually Trigger Cron:**

```bash
# Local
curl http://localhost:3000/api/cron/process-emails

# Production
curl https://your-app.vercel.app/api/cron/process-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### **3. Check Redis Connection:**

```bash
# Test connection
redis-cli -u $QUEUE_REDIS_URL ping
# Should return: PONG
```

---

## **Health Check Recommendations**

### **Create Queue Status Endpoint:**

**File**: `src/app/api/admin/queue-status/route.ts`

```typescript
import { getEmailQueue } from '@/server/queue/email';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const queue = getEmailQueue();

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return NextResponse.json({
      status: 'ok',
      queue: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + delayed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
```

---

## **Summary**

| Component           | Status          | Notes                    |
| ------------------- | --------------- | ------------------------ |
| **Redis (Upstash)** | ✅ Configured   | Rate limiting & cache    |
| **Queue Redis**     | ⚠️ Check config | BullMQ backend           |
| **Email Queue**     | ✅ Set up       | `pending-booking-emails` |
| **Vercel Cron**     | ✅ Active       | Runs every 5 minutes     |
| **DLQ**             | ✅ Configured   | Captures failed jobs     |
| **Worker**          | ✅ Ready        | Processes email jobs     |

---

## **Action Items**

1. **Verify Queue Redis Configuration**:

   ```bash
   # Check if QUEUE_REDIS_URL is set
   echo $QUEUE_REDIS_URL
   ```

2. **Create Queue Status Endpoint** (recommended)

3. **Monitor Vercel Cron Logs**:
   - Go to Vercel Dashboard
   - Check cron execution history
   - Look for errors

4. **Check for Stuck Jobs**:
   ```bash
   # If you have redis-cli access
   LLEN pending-booking-emails:active
   LLEN pending-booking-emails:wait
   ```

---

**Need me to create the queue status endpoint or check anything specific?**
