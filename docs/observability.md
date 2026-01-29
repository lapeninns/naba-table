# Observability & Monitoring

Last updated: 2026-01-29

## Overview

This document describes the monitoring, alerting, and observability setup for the Nabatable platform.

## Monitoring Stack

| Tool             | Purpose                      | Dashboard URL                                                        |
| ---------------- | ---------------------------- | -------------------------------------------------------------------- |
| Sentry           | Error tracking, performance  | https://sentry.io/organizations/lapeninns/                           |
| Sentry Profiling | CPU profiling (10% sampling) | https://sentry.io/organizations/lapeninns/ → Performance → Profiling |
| Vercel Analytics | Web vitals, traffic          | https://vercel.com/lapeninns/nabatable/analytics                     |
| Vercel Logs      | Application logs             | https://vercel.com/lapeninns/nabatable/logs                          |
| PostHog          | Product analytics            | https://app.posthog.com/                                             |
| Supabase         | Database metrics             | https://supabase.com/dashboard/project/vrdiqfudmwydclqpydee          |

## Sentry Configuration

### Error Tracking

All exceptions are automatically captured with:

- User context (authenticated user ID)
- Request context (URL, headers)
- Release version
- Environment tags

### Performance Monitoring

```typescript
// Configured in sentry.server.config.ts and sentry.edge.config.ts
tracesSampleRate: 1.0,        // 100% of transactions
profilesSampleRate: 0.1,       // 10% profiling
```

### Key Transactions to Monitor

| Transaction             | Alert Threshold | Description      |
| ----------------------- | --------------- | ---------------- |
| `POST /api/bookings`    | P95 > 2s        | Booking creation |
| `GET /api/ops/bookings` | P95 > 1s        | Dashboard load   |
| `POST /api/auth/*`      | P95 > 3s        | Authentication   |

## Health Checks

### Endpoints

| Endpoint         | Purpose               | Expected Response                 |
| ---------------- | --------------------- | --------------------------------- |
| `/api/health`    | Basic health check    | `{ status: "ok" }`                |
| `/api/health/db` | Database connectivity | `{ status: "ok", latency: <ms> }` |

### Vercel Cron Health

Scheduled jobs are monitored via:

1. Vercel Cron dashboard
2. Sentry cron monitoring (when configured)

## Alerting

### Current Setup

Alerts are configured through Sentry:

- **Error spike**: >10 errors in 5 minutes
- **P95 latency**: Exceeds threshold for key transactions
- **New issues**: First occurrence of new error types

### Future Enhancements (Recommended)

For production-grade alerting, consider adding:

1. **PagerDuty/OpsGenie Integration**

   ```yaml
   # Example Sentry integration
   Sentry → Settings → Integrations → PagerDuty
   ```

2. **Uptime Monitoring**
   - Vercel native (included)
   - External: Pingdom, UptimeRobot, or Better Uptime

3. **Database Alerts**
   - Supabase Dashboard → Database → Alerts
   - CPU, Memory, Connection limits

## Log Management

### Structured Logging

Use the logger from `lib/logger.ts`:

```typescript
import { logger } from '@/lib/logger';

logger.info('Booking created', { bookingId, userId });
logger.error('Payment failed', { error, bookingId });
```

### Log Levels

| Level   | Use Case                  |
| ------- | ------------------------- |
| `error` | Exceptions, failures      |
| `warn`  | Degraded states, retries  |
| `info`  | Business events, auditing |
| `debug` | Development diagnostics   |

### Vercel Log Drains (Optional)

For long-term log retention, configure log drains:

- Datadog
- Logtail
- Papertrail

## Metrics Collection

### Current Metrics

1. **Web Vitals** (via Vercel Analytics)
   - LCP, FCP, CLS, TTFB, FID

2. **API Latency** (via Sentry)
   - P50, P95, P99 for all routes

3. **Database** (via Supabase)
   - Query latency, connection pool, row counts

### Custom Metrics (Future)

For custom business metrics, consider:

```typescript
// Example: Track booking conversion
analytics.track('booking_completed', {
  restaurant_id: restaurantId,
  party_size: partySize,
  booking_lead_time_hours: leadTime,
});
```

## Incident Response

### Severity Levels

| Level | Description             | Response Time |
| ----- | ----------------------- | ------------- |
| P0    | Service down, data loss | Immediate     |
| P1    | Major feature broken    | < 1 hour      |
| P2    | Minor feature broken    | < 4 hours     |
| P3    | Cosmetic, non-blocking  | Next sprint   |

### Runbooks

- [Rollback Procedures](./runbooks/rollback.md)

## Dashboard Links

### Production Monitoring

- **Sentry Issues**: [Link](https://sentry.io/organizations/lapeninns/issues/)
- **Sentry Performance**: [Link](https://sentry.io/organizations/lapeninns/performance/)
- **Vercel Deployments**: [Link](https://vercel.com/lapeninns/nabatable/deployments)
- **Supabase Database**: [Link](https://supabase.com/dashboard/project/vrdiqfudmwydclqpydee)

### Analytics

- **Vercel Analytics**: [Link](https://vercel.com/lapeninns/nabatable/analytics)
- **PostHog**: [Link](https://app.posthog.com/)

## Related Documentation

- [Architecture](./architecture.md)
- [Rollback Runbook](./runbooks/rollback.md)
- [Production Readiness](./production-readiness-checklist.md)
