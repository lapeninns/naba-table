# Deep Diagnostic: Why Jobs Aren't Being Created

## Summary of Findings

Based on the diagnostics, here are the **actual issues**:

---

## ⚠️ Issue #1: QUEUE_REDIS Not Configured

### **Problem:**

```bash
# Environment check shows:
QUEUE_REDIS_URL: NOT SET
QUEUE_REDIS_HOST: NOT SET
```

### **What This Means:**

Even if `FEATURE_EMAIL_QUEUE_ENABLED=true`, the queue **cannot queue jobs** without a Redis connection configured for BullMQ.

**Code flow:**

```typescript
// lib/queue/redis.ts
function buildRedisOptions(): RedisOptions {
  const config = env.queue;

  if (config.redisUrl) {
    // Use connection string
  } else if (config.host) {
    // Use host/port
  } else {
    throw new Error('Queue Redis configuration missing'); // ← THROWS HERE
  }
}
```

---

## ⚠️ Issue #2: Two Different Redis Instances

You have:

1. **Upstash Redis** (for cache/rate-limiting):

   ```
   UPSTASH_REDIS_REST_URL=https://settled-frog-13193.upstash.io
   UPSTASH_REDIS_REST_TOKEN=ATOJAAIncD...
   ```

2. **Queue Redis** (for BullMQ): **NOT CONFIGURED**

These are **different** Redis instances used for different purposes!

---

## 🔍 Deep Dive: How Queue Creation Works

### **Step 1: Booking Created**

```typescript
// /api/bookings or /api/ops/bookings
await insertBookingRecord(...);
```

### **Step 2: Enqueue Side Effects**

```typescript
await enqueueBookingCreatedSideEffects({
  booking,
  restaurantId,
  emailProvided: true,
});
```

### **Step 3: Check Feature Flag**

```typescript
if (isEmailQueueEnabled()) {  // ← Checks FEATURE_EMAIL_QUEUE_ENABLED
  await enqueueEmailJob(...);  // ← Attempts to queue
}
```

### **Step 4: Queue Job Creation**

```typescript
// server/queue/email.ts
function ensureQueueSetup(): void {
  if (!emailQueue) {
    emailQueue = new Queue(EMAIL_QUEUE_NAME, {
      connection: getRedisConnection(), // ← GETS REDIS HERE
    });
  }
}

// lib/queue/redis.ts
export function getRedisConnection(): IORedis {
  const options = buildRedisOptions(); // ← THROWS if not configured!
  return new IORedis(options);
}
```

### **💥 Failure Point:**

If `QUEUE_REDIS_URL` is not set, `getRedisConnection()` **throws an error**, which means:

- Job creation fails silently (caught in try/catch)
- Falls back to inline sending
- Scheduled jobs (24h, 2h reminders) are **lost**

---

## 🧪 Test: Reproduce the Issue

### **Create a Test Booking:**

```typescript
// What happens:
POST /api/bookings
  → insertBookingRecord() ✅ Success
  → enqueueBookingCreatedSideEffects()
    → isEmailQueueEnabled() = true ✅
    → enqueueEmailJob()
      → ensureQueueSetup()
        → getRedisConnection()
          → buildRedisOptions()
            → THROWS: "Queue Redis configuration missing" ❌
      → CATCH: Fall back to inline send
        → sendBookingConfirmationEmail() ✅ Immediate email sent
        → BUT: No reminder jobs created ❌
```

---

## ✅ The Complete Fix

### **Option 1: Use Upstash for Both (Recommended)**

Add to `.env.local`:

```bash
# Enable queue
FEATURE_EMAIL_QUEUE_ENABLED=true

# Configure queue Redis (reuse Upstash)
QUEUE_REDIS_URL=redis://default:<TOKEN>@settled-frog-13193.upstash.io:6379
```

Add to `.env.staging`:

```bash
FEATURE_EMAIL_QUEUE_ENABLED=true
QUEUE_REDIS_URL=redis://default:<TOKEN>@settled-frog-13193.upstash.io:6379
```

Add to Vercel (Production):

```
FEATURE_EMAIL_QUEUE_ENABLED=true
QUEUE_REDIS_URL=redis://default:<TOKEN>@settled-frog-13193.upstash.io:6379
```

---

### **Option 2: Separate Redis for Queue**

If you want a dedicated Redis for the queue:

```bash
# Get a free Redis from:
# - Upstash (another instance)
# - Redis Cloud
# - Railway
# - Render

# Then set:
FEATURE_EMAIL_QUEUE_ENABLED=true
QUEUE_REDIS_URL=<your_redis_url>
```

---

## 🔬 Verify Current State

### **Check if Jobs Are Being Attempted:**

Look for these in your logs (Vercel or local):

```
# Success (if configured):
[queue] Enqueued reminder_24h for booking abc123

# Failure (if not configured):
[jobs][booking.created][queue] Error: Queue Redis configuration missing
[jobs][booking.created][email-fallback] Inline send fallback used
```

---

### **Check Database for Recent Bookings:**

Run this SQL in Supabase:

```sql
SELECT
  id,
  reference,
  customer_name,
  customer_email,
  status,
  source,
  created_at,
  start_at
FROM bookings
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;
```

**Questions to answer:**

1. How many bookings in last 24h?
2. How many have `status = 'confirmed'`?
3. How many have non-null `customer_email`?

**Expected queue jobs** = (confirmed bookings with email) × 3 (24h + 2h + review)

---

## 📊 Expected vs Actual

### **If you had 5 confirmed bookings in last 24h:**

| Metric                     | Expected | Actual | Status      |
| -------------------------- | -------- | ------ | ----------- |
| **Confirmation emails**    | 5 sent   | 5 sent | ✅ (inline) |
| **24h reminders queued**   | 5 jobs   | 0 jobs | ❌          |
| **2h reminders queued**    | 5 jobs   | 0 jobs | ❌          |
| **Review requests queued** | 5 jobs   | 0 jobs | ❌          |
| **Total delayed jobs**     | 15       | 0      | ❌          |

---

## 🎯 Action Plan

### **Step 1: Configure Queue Redis**

```bash
# Add to .env.local
cat >> .env.local << 'EOF'

# Queue Configuration
FEATURE_EMAIL_QUEUE_ENABLED=true
QUEUE_REDIS_URL=redis://default:<TOKEN>@settled-frog-13193.upstash.io:6379
EOF
```

---

### **Step 2: Restart Dev Server**

```bash
# Kill current server (Ctrl+C)
# Restart
pnpm run dev
```

---

### **Step 3: Test with a Booking**

```bash
# Create test booking via UI
# Navigate to: http://localhost:3000/walk-in
# Fill in details and submit
```

---

### **Step 4: Verify Queue**

```bash
# Check Redis
curl "https://settled-frog-13193.upstash.io/zcard/pending-booking-emails:delayed" \
  -H "Authorization: Bearer YOUR_UPSTASH_REDIS_REST_TOKEN"

# Expected: {"result":3}  (3 reminder jobs)
```

---

### **Step 5: Deploy to Production**

```bash
# Add to Vercel environment variables
# Then redeploy
vercel --prod
```

---

## 🐛 Debugging if Still Not Working

If after adding `QUEUE_REDIS_URL` jobs still don't appear:

### **Check 1: Logs**

```bash
# Look for:
[queue] Enqueued <type> for booking <id>  # ← Success
# or
[jobs][booking.created][queue] Error...  # ← Failure
```

### **Check 2: Feature Flag**

```typescript
// Add logging in server/jobs/booking-side-effects.ts
console.log('[DEBUG] isEmailQueueEnabled:', isEmailQueueEnabled());
console.log('[DEBUG] FEATURE_EMAIL_QUEUE_ENABLED:', process.env.FEATURE_EMAIL_QUEUE_ENABLED);
```

### **Check 3: Redis Connection**

```bash
# Test Redis connection
redis-cli -u redis://default:<TOKEN>@settled-frog-13193.upstash.io:6379 ping
# Should return: PONG
```

---

## 📝 Summary

**Root Causes:**

1. ✅ `FEATURE_EMAIL_QUEUE_ENABLED` - You said it's true
2. ❌ `QUEUE_REDIS_URL` - **NOT CONFIGURED** (this is the blocker!)

**Impact:**

- Immediate emails: ✅ Working
- Scheduled reminders: ❌ Being lost

**Fix:**

```bash
QUEUE_REDIS_URL=redis://default:<TOKEN>@settled-frog-13193.upstash.io:6379
```

**This is why your queue is empty - jobs fail to be created due to missing Redis connection for BullMQ!**
