# Progressive Rollout Strategy

Last updated: 2026-01-29

## Overview

This document describes the progressive rollout strategy for deploying new features and changes to production using feature flags and phased exposure.

## Rollout Lifecycle

### 1. Development

- Feature developed behind a feature flag
- Flag defaults to `false` in all environments
- Local testing with flag enabled manually

### 2. Internal Testing

- Deploy to staging with flag enabled for team
- Run E2E and manual QA
- Verify observability (metrics, logs, traces)

### 3. Canary Rollout (10%)

**Target**: Small percentage of production traffic

```typescript
// Example flag configuration
{
  featureKey: 'feat.booking.new-flow',
  exposure: 0.10, // 10% of users
  enabledFor: ['internal_users'], // Always on for team
}
```

**Duration**: 24-48 hours  
**Monitoring**:

- Error rates (compare to baseline)
- Performance metrics (P95, P99 latency)
- User engagement metrics
- Sentry issues specific to the feature

**Go/No-Go Decision**:

- ✅ Go: Error rate < baseline + 5%, no P0/P1 issues
- ❌ No-Go: Rollback if error rate spikes, user complaints, or critical bugs

### 4. Gradual Expansion (50%)

**Target**: Half of production traffic

```typescript
{
  featureKey: 'feat.booking.new-flow',
  exposure: 0.50, // 50% of users
  enabledFor: ['internal_users'],
}
```

**Duration**: 48-72 hours  
**Monitoring**: Same as canary, plus business metrics (conversion, retention)

### 5. Full Rollout (100%)

**Target**: All production traffic

```typescript
{
  featureKey: 'feat.booking.new-flow',
  exposure: 1.0, // 100% of users
}
```

**Duration**: 1 week minimum before flag removal

### 6. Flag Cleanup

After 1-2 weeks of stable 100% rollout:

- Remove flag checks from code
- Remove flag from env configuration
- Update flag audit allowlist if needed
- Document removal in changelog

## Feature Flag Naming Convention

Use hierarchical naming:

```
feat.<area>.<name>
```

Examples:

- `feat.booking.enhanced-validation`
- `feat.guest.social-login`
- `feat.ops.bulk-actions`

## Exposure Strategies

### Percentage-Based (Random)

```typescript
// lib/env.ts
export const features = {
  newFlow: env.NEXT_PUBLIC_FEAT_NEW_FLOW === 'true',
};

// server/feature-flags.ts
export function isFeatureEnabled(featureKey: string, userId?: string, exposure = 1.0): boolean {
  // Hash userId for deterministic exposure
  const hash = hashCode(userId || 'anonymous');
  return hash % 100 < exposure * 100;
}
```

### User-Based (Targeted)

```typescript
export function isFeatureEnabledForUser(
  featureKey: string,
  userId: string,
  allowList: string[],
): boolean {
  return allowList.includes(userId);
}
```

### Context-Based (Segment)

```typescript
export function isFeatureEnabledForSegment(
  featureKey: string,
  userSegment: 'internal' | 'beta' | 'premium' | 'free',
): boolean {
  const enabledSegments = getEnabledSegments(featureKey);
  return enabledSegments.includes(userSegment);
}
```

## Kill Switch

Every feature must support instant disabling:

```typescript
// Environment variable controls
if (env.KILL_SWITCH_NEW_FLOW === 'true') {
  return false; // Feature disabled globally
}
```

Update via Vercel/hosting provider env vars (no redeploy needed).

## Metrics & Observability

### Required Metrics

- **Adoption**: % of users exposed, % using feature
- **Performance**: P50/P95/P99 latency, error rates
- **Business**: Conversion, engagement, revenue impact

### Dashboards

Create feature-specific dashboard:

- Sentry: Filter issues by feature flag context
- Observability: Tag events with `feature: <key>`
- Analytics: Track feature-specific events

### Alerting

Set alerts for:

- Error rate > baseline + 10%
- P99 latency > 2x baseline
- Zero adoption (flag misconfigured)

## Rollout Checklist

Before enabling a feature flag:

- [ ] Feature fully tested in staging
- [ ] Observability instrumented (logs, metrics, traces)
- [ ] Kill switch tested and documented
- [ ] Rollback runbook prepared
- [ ] On-call engineer notified
- [ ] Business stakeholders informed

## References

- [Feature Flags Implementation](server/feature-flags.ts)
- [Environment Schema](config/env.schema.ts)
- [Rollback Runbook](docs/runbooks/rollback.md)
- [Observability Setup](docs/observability.md)
