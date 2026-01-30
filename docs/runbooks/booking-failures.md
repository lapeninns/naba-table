# Booking Failures Runbook

## Symptoms

- Guests unable to complete bookings
- "No availability" errors when slots should be open
- Table assignment failures
- Soft hold expiration issues

## Diagnosis

### 1. Check Recent Errors in Sentry

Filter by:

- Tag: `transaction:/api/bookings`
- Level: error
- Time: last 1 hour

### 2. Check Capacity State

```sql
-- Check bookings for a specific date/restaurant
SELECT
  b.id,
  b.status,
  b.party_size,
  b.booking_date,
  b.booking_time,
  a.resource_id as table_id
FROM bookings b
LEFT JOIN allocations a ON a.booking_id = b.id
WHERE b.restaurant_id = '<restaurant-id>'
  AND b.booking_date = '<date>'
ORDER BY b.booking_time;
```

### 3. Check Soft Holds

```sql
-- Check for stuck soft holds
SELECT * FROM soft_holds
WHERE restaurant_id = '<restaurant-id>'
  AND expires_at > now()
ORDER BY created_at DESC;
```

### 4. Check Feature Flags

```typescript
// In server console or via API
import { isFeatureFlagEnabled } from '@/server/feature-flags';
console.log({
  selectorScoring: isSelectorScoringEnabled(),
  selectorLookahead: isSelectorLookaheadEnabled(),
});
```

## Resolution

### "No Availability" When Slots Should Be Open

**Possible causes**:

1. Soft holds blocking capacity (check and clean up expired holds)
2. Table assignment algorithm too restrictive
3. Service period configuration incorrect

**Fix**:

```sql
-- Clean up expired soft holds (safe operation)
DELETE FROM soft_holds WHERE expires_at < now();
```

### Table Assignment Failures

**Symptoms**: Booking created but no tables assigned

**Fix**:

1. Check table configuration (mobility, capacity, adjacency)
2. Run manual assignment from ops dashboard
3. If systematic: check assignment algorithm logs in Sentry

### Duplicate Bookings

**Symptoms**: Same guest, same time, multiple records

**Fix**:

1. Identify duplicates:

```sql
SELECT guest_email, booking_date, booking_time, COUNT(*)
FROM bookings
WHERE status != 'cancelled'
GROUP BY guest_email, booking_date, booking_time
HAVING COUNT(*) > 1;
```

2. Cancel duplicates via ops dashboard (keeps audit trail)

### Stuck in "Pending" Status

**Symptoms**: Bookings not transitioning to confirmed

**Fix**:

1. Check if table assignment ran
2. Check for errors in booking side-effects job
3. Manually confirm via ops dashboard if needed

## Prevention

- Monitor soft hold cleanup job
- Alert on high pending booking counts
- Test capacity edge cases in staging
- Regular capacity audits for each restaurant
