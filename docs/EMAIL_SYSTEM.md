# Production Environment Variables for Email System

## Required for Email Queue (BullMQ)

```bash
# Redis connection for BullMQ queue
QUEUE_REDIS_URL=redis://username:password@host:port

# IMPORTANT: Redis must have eviction policy set to "noeviction"
# The current Redis Cloud instance uses "volatile-lru" which evicts keys
# This causes BullMQ delayed jobs to disappear before processing
#
# To fix in Redis Cloud:
# 1. Go to your Redis Cloud dashboard
# 2. Select your database
# 3. Configuration > Data Eviction Policy
# 4. Change from "volatile-lru" to "noeviction"
```

## Required for Cron Job Authentication

```bash
# Secret for authenticating Vercel cron requests
# Generate with: openssl rand -hex 32
CRON_SECRET=your-cron-secret-here

# Vercel automatically sends this as Authorization: Bearer <CRON_SECRET>
# for cron jobs defined in vercel.json
```

## Email Feature Flags

```bash
# Enable email queue (BullMQ) for scheduled emails
# When true: Scheduled emails are queued and processed by worker/cron
# Instant types still send inline: request_received, confirmation, updated, cancelled, restaurant_cancellation, booking_rejected
# When false: All emails are sent immediately (inline)
ENABLE_EMAIL_QUEUE=true

# Suppress all outbound emails (for load testing)
LOAD_TEST_DISABLE_EMAILS=false
SUPPRESS_EMAILS=false
```

## Vercel Cron Configuration

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-emails",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This runs every 5 minutes and processes up to 10 queued jobs per run.

## Email Types

The system supports these email types:

| Type                      | Trigger                   | Booking Status Required |
| ------------------------- | ------------------------- | ----------------------- |
| `request_received`        | Booking created (pending) | `pending`               |
| `confirmation`            | Booking confirmed         | `confirmed`             |
| `updated`                 | Booking details changed   | Any                     |
| `cancelled`               | Customer cancels          | `cancelled`             |
| `reminder_24h`            | 24h before booking        | `confirmed`             |
| `reminder_short`          | 2h before booking         | `confirmed`             |
| `review_request`          | 3h after visit ends       | `completed`             |
| `booking_rejected`        | Restaurant rejects        | `cancelled`             |
| `restaurant_cancellation` | Restaurant cancels        | `cancelled`             |

## Troubleshooting

### Jobs disappearing from queue

**Symptom**: Jobs are queued but show 0 when checking queue status

**Cause**: Redis eviction policy is set to `volatile-lru` instead of `noeviction`

**Solution**: Change Redis eviction policy to `noeviction` in your Redis provider dashboard

### Cron returning 401 Unauthorized

**Symptom**: Cron job logs show 401 error

**Cause**: `CRON_SECRET` environment variable not set or doesn't match

**Solution**:

1. Generate a secret: `openssl rand -hex 32`
2. Add to Vercel: Settings > Environment Variables > Add `CRON_SECRET`
3. Redeploy the application
