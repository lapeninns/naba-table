# 🚨 DEBUG BUILD READY - Deploy to Find Root Cause

## Summary

We've confirmed **9 confirmed bookings with emails but 0 queue jobs** - a critical bug.

I've added comprehensive debug logging to identify exactly where and why jobs are failing to be created.

---

## ✅ Debug Logging Added

### **What Will Be Logged:**

1. **Booking Creation Start**:

   ```
   [DEBUG][booking.created] START { bookingId, status, email, source }
   ```

2. **Email Validation**:

   ```
   [DEBUG][booking.created] Email check { shouldSendEmail, normalizedEmail }
   ```

3. **Reminder Scheduling Decision**:

   ```
   [DEBUG][booking.created] Scheduling reminders
   OR
   [DEBUG][booking.created] Skipping reminders { reason }
   ```

4. **Queue Status Check**:

   ```
   [DEBUG][reminder-job] Queue status { queueEnabled, FEATURE_EMAIL_QUEUE_ENABLED }
   ```

5. **Enqueue Attempt**:

   ```
   [DEBUG][reminder-job] Attempting to enqueue { variant, delayMinutes }
   ```

6. **Success/Failure**:
   ```
   [DEBUG][reminder-job] Successfully enqueued
   OR
   [DEBUG][reminder-job] Failed to enqueue { error, stack }
   ```

---

## 🚀 Deployment Steps

### **Step 1: Deploy to Production**

```bash
# Commit changes
git add server/jobs/booking-side-effects.ts
git commit -m "debug: add comprehensive logging for job creation"

# Push to production
git push origin main

# Vercel will auto-deploy
# OR manually: vercel --prod
```

---

### **Step 2: Create Test Booking**

After deployment (wait ~2 minutes):

1. Go to production URL
2. Create ONE walk-in booking:
   - Name: Debug Test
   - Email: test@example.com
   - Phone: filled in
   - Date: 2 days from now
   - **Make sure it gets CONFIRMED**

---

### **Step 3: Check Logs Immediately**

Go to Vercel Dashboard → Logs → Filter by the booking ID

**Look for these debug messages in order:**

```
✅ Expected Success Pattern:
[DEBUG][booking.created] START
[DEBUG][booking.created] Email check { shouldSendEmail: true }
[DEBUG][booking.created] Scheduling reminders
[DEBUG][booking.created] Scheduling 24h reminder...
[DEBUG][reminder-job] Queue status { queueEnabled: true }
[DEBUG][reminder-job] Attempting to enqueue { variant: 'reminder_24h' }
[DEBUG][reminder-job] Successfully enqueued
[DEBUG][booking.created] Scheduling 2h reminder...
[DEBUG][reminder-job] Successfully enqueued
[DEBUG][booking.created] Reminders scheduled successfully
```

```
❌ Failure Patterns to Look For:

Pattern 1: Queue Disabled
[DEBUG][reminder-job] Queue status { queueEnabled: false }
→ FEATURE_EMAIL_QUEUE_ENABLED not being read correctly

Pattern 2: Skipping Reminders
[DEBUG][booking.created] Skipping reminders { reason: '...' }
→ Email/status check failing

Pattern 3: Enqueue Error
[DEBUG][reminder-job] Failed to enqueue { error: '...' }
→ Redis connection or BullMQ issue

Pattern 4: No Logs At All
→ Side effects not being called
→ Check if enqueueBookingCreatedSideEffects is called
```

---

## 🔍 Diagnosis Based on Logs

### **Scenario A: `queueEnabled: false`**

**Problem**: Feature flag not loading

**Solution**:

```bash
# Check Vercel env vars again
vercel env ls

# Ensure FEATURE_EMAIL_QUEUE_ENABLED=true
# Redeploy if missing
```

---

### **Scenario B: Connection Error**

**Problem**: Redis connection failing

**Logs will show**:

```
Failed to enqueue { error: 'Connection refused' }
# or
{ error: 'ECONNREFUSED' }
# or
{ error: 'getaddrinfo ENOTFOUND' }
```

**Solution**:

```bash
# Test Redis URL format
# Current: rediss://default:...@settled-frog-13193.upstash.io:6379

# Try alternative format:
QUEUE_REDIS_URL=redis://:PASSWORD@settled-frog-13193.upstash.io:6379
```

---

### **Scenario C: Skipping Reminders**

**Problem**: Status check failing

**Logs will show**:

```
Skipping reminders { reason: 'not confirmed' }
```

**Solution**: Check why bookings aren't being marked as confirmed

---

### **Scenario D: No Logs**

**Problem**: Side effects not being called

**Solution**: Check if `enqueueBookingCreatedSideEffects` is called in booking API routes

---

## 📋 Checklist

- [ ] Build passes locally (`pnpm run build` ✅)
- [ ] Commit debug changes
- [ ] Push to production
- [ ] Wait for Vercel deployment (~2 min)
- [ ] Create test booking in production
- [ ] Check Vercel logs for debug output
- [ ] Identify failure pattern
- [ ] Apply fix based on logs
- [ ] Remove debug logging after fix

---

## 🎯 Expected Outcome

After deployment and test booking, the debug logs will tell us EXACTLY:

1. **Is the code path being reached?**
2. **Is the feature flag enabled at runtime?**
3. **Is the queue connection working?**
4. **What specific error is occurring?**

**This will give us the smoking gun to fix the issue!**

---

## ⚠️ Temporary Impact

**Debug logging will:**

- ✅ Be visible in Vercel logs
- ✅ Help identify the issue
- ⚠️ Add noise to production logs (temporary)

**Plan**: Remove debug logs once issue is identified and fixed

---

## 🚀 Ready to Deploy

```bash
# Commands to run:
git add server/jobs/booking-side-effects.ts
git commit -m "debug: comprehensive logging for missing queue jobs"
git push origin main

# Then wait for deployment and test!
```

**Status**: ✅ Build passing, debug logging added, ready to deploy!
