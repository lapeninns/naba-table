# Alerting Configuration

This document describes the alerting setup for Nab a Table production monitoring.

## Alert Channels

| Channel | Purpose            | Configuration                      |
| ------- | ------------------ | ---------------------------------- |
| Email   | Critical alerts    | Sentry → Project Settings → Alerts |
| Slack   | Team notifications | Vercel/Sentry integrations         |
| GitHub  | CI/CD failures     | GitHub Actions notifications       |

## Configured Alerts

### Sentry Alerts

#### High Error Rate

- **Trigger**: >10 errors in 5 minutes
- **Severity**: Critical
- **Action**: Email notification to on-call
- **Runbook**: [booking-failures.md](./runbooks/booking-failures.md)

```yaml
# Sentry Alert Rule Configuration
name: High Error Rate
conditions:
  - type: event_frequency
    value: 10
    interval: 5m
actions:
  - type: email
    targetType: Team
filters:
  - type: level
    value: error
```

#### New Issue Alert

- **Trigger**: First occurrence of a new issue
- **Severity**: Warning
- **Action**: Slack notification

#### Performance Regression

- **Trigger**: P95 response time >2s for 10 minutes
- **Severity**: Warning
- **Action**: Slack notification

### Vercel Alerts

#### Deployment Failed

- **Trigger**: Build or deployment failure
- **Channel**: GitHub commit status + Email
- **Action**: Investigate build logs

#### Function Error Spike

- **Trigger**: >5% error rate on serverless functions
- **Channel**: Vercel dashboard notification
- **Action**: Check function logs

### Supabase Alerts

#### Database Connection Pool

- **Trigger**: >80% connection pool utilization
- **Severity**: Warning
- **Action**: Review connection usage

#### Slow Queries

- **Trigger**: Queries taking >1s
- **Channel**: Supabase dashboard
- **Action**: Review query performance

## Setting Up Alerts

### Sentry Alert Rules

1. Go to **Sentry → Alerts → Create Alert**
2. Choose alert type:
   - **Issues**: For error tracking
   - **Metrics**: For performance monitoring
3. Configure conditions:
   ```
   When: An event is seen
   If: The issue is seen more than 10 times in 5 minutes
   Then: Send an email to Team
   ```
4. Set action interval (e.g., 30 minutes between alerts)

### Vercel Notifications

1. Go to **Project Settings → Notifications**
2. Enable:
   - [ ] Deployment failed
   - [ ] Domain configuration issues
   - [ ] Usage alerts
3. Connect Slack integration for team notifications

### Custom Alerting Script

For custom alerting needs, use the metrics system:

```typescript
import { incrementCounter, Metrics } from '@/lib/metrics';
import { logger } from '@/lib/logger';

// Track errors for alerting
try {
  await processBooking(data);
} catch (error) {
  incrementCounter(Metrics.API_ERROR_COUNT, 1, {
    tags: { endpoint: '/api/bookings', error_type: error.name },
  });

  // Log for Sentry capture
  logger.error('Booking processing failed', { error, bookingData: data });
  throw error;
}
```

## Alert Response Procedures

### P1 - Critical (Immediate Response)

- Production down
- Data loss risk
- Security incident

**Response**: Page on-call immediately, begin incident response.

### P2 - High (Response within 1 hour)

- Major feature broken
- High error rate (>5%)
- Performance degradation (>3x normal)

**Response**: Investigate and communicate status.

### P3 - Medium (Response within 4 hours)

- Minor feature issues
- Elevated error rate (1-5%)
- Non-critical warnings

**Response**: Schedule investigation, monitor for escalation.

### P4 - Low (Response within 24 hours)

- Cosmetic issues
- Minor warnings
- Improvement opportunities

**Response**: Add to backlog, address in normal sprint.

## Testing Alerts

To verify alerting is working:

1. **Sentry Test**:

   ```bash
   curl https://app.nabatable.com/api/sentry-example-api
   ```

2. **Check Sentry Dashboard**: Verify the test error appears

3. **Verify Notification**: Confirm alert was received in configured channel

## Maintenance

- Review alert rules quarterly
- Adjust thresholds based on traffic patterns
- Remove stale or noisy alerts
- Document any changes in this file
