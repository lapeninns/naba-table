# Observability Guide

This document provides an overview of the observability stack for Nab a Table and links to monitoring dashboards.

## Monitoring Stack

| Component         | Tool                              | Purpose                                    |
| ----------------- | --------------------------------- | ------------------------------------------ |
| Error Tracking    | [Sentry](https://sentry.io)       | Exception tracking, performance monitoring |
| Product Analytics | [PostHog](https://posthog.com)    | User behavior, feature usage               |
| Web Analytics     | [Plausible](https://plausible.io) | Privacy-friendly traffic analytics         |
| Logging           | Custom (lib/logger.ts)            | Structured JSON logs with redaction        |
| Hosting           | [Vercel](https://vercel.com)      | Deployment logs, function metrics          |
| Database          | [Supabase](https://supabase.com)  | Query performance, connection pools        |
| Email             | [Resend](https://resend.com)      | Delivery rates, bounces                    |

## Dashboard Links

### Production Monitoring

| Dashboard    | URL                                                    | What to Monitor                           |
| ------------ | ------------------------------------------------------ | ----------------------------------------- |
| **Vercel**   | https://vercel.com/lapeninns/nabatable                 | Deployments, function invocations, errors |
| **Sentry**   | https://sentry.io/organizations/lapeninns/issues/      | Unhandled exceptions, performance issues  |
| **PostHog**  | https://app.posthog.com                                | Feature flags, user journeys, funnels     |
| **Supabase** | https://supabase.com/dashboard/project/YOUR_PROJECT_ID | Database health, query performance        |
| **Resend**   | https://resend.com/emails                              | Email delivery, bounces, complaints       |

### Key Metrics to Watch

#### Application Health

- `/api/health` endpoint status (should be 200)
- Error rate in Sentry (target: <1%)
- P95 API response time (target: <500ms)

#### Business Metrics (PostHog)

- Booking completion rate
- Time to complete booking flow
- Feature flag exposure rates

#### Infrastructure

- Vercel function duration and cold starts
- Database connection pool utilization
- Email queue depth

## Distributed Tracing

All requests are tagged with tracing headers for correlation:

| Header         | Purpose                          |
| -------------- | -------------------------------- |
| `x-request-id` | Unique ID for each request       |
| `x-trace-id`   | Trace ID for distributed tracing |

### Finding a Request

1. Get the `x-request-id` from response headers or logs
2. Search in Sentry: `request_id:<id>`
3. Search in Vercel logs: filter by request ID
4. Correlate with database queries in Supabase logs

## Alerting

### Current Alerts

| Alert             | Trigger              | Channel           |
| ----------------- | -------------------- | ----------------- |
| High error rate   | >5% errors in 5 min  | Sentry → Email    |
| Deployment failed | Build/deploy failure | Vercel → GitHub   |
| Database degraded | Health check fails   | Manual monitoring |

### Setting Up Alerts

#### Sentry Alerts

1. Go to Sentry → Alerts → Create Alert
2. Set conditions (error count, users affected)
3. Configure notification channel

#### Vercel Notifications

1. Project Settings → Notifications
2. Enable deployment failure alerts
3. Connect to Slack/Email

## Incident Response

When investigating issues:

1. **Check health**: `curl https://app.nabatable.com/api/health`
2. **Check Sentry**: Look for new/spiking issues
3. **Check Vercel**: Look for deployment issues or function errors
4. **Check Supabase**: Look for database connection issues
5. **Follow runbooks**: See [runbooks/](./runbooks/) for specific scenarios

## Log Levels

The application uses structured JSON logging with these levels:

| Level   | When to Use                            |
| ------- | -------------------------------------- |
| `error` | Unrecoverable errors, exceptions       |
| `warn`  | Recoverable issues, deprecations       |
| `info`  | Business events, request completion    |
| `debug` | Detailed debugging (off in production) |

### Searching Logs

In Vercel:

1. Go to Logs tab
2. Filter by function, level, or search text
3. Use `x-request-id` to find related logs

## Adding New Instrumentation

### Adding a New Metric

```typescript
import { logger } from '@/lib/logger';

// Log with structured data
logger.info('booking_created', {
  bookingId: booking.id,
  restaurantId: booking.restaurantId,
  partySize: booking.partySize,
  duration: endTime - startTime,
});
```

### Adding a New Analytics Event

```typescript
import { track } from '@/lib/analytics';

track('feature_used', {
  feature: 'table_assignment',
  variant: 'auto',
});
```
