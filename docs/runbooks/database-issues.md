# Database Issues Runbook

## Symptoms

- Health check returns `"database": "unreachable"`
- Booking operations timing out
- 500 errors with "connection refused" or "timeout" messages
- Sentry alerts for database connection errors

## Diagnosis

### 1. Check Health Endpoint

```bash
curl https://app.nabatable.com/api/health | jq .
```

### 2. Check Supabase Status

1. Visit [Supabase Status](https://status.supabase.com/)
2. Check project dashboard: Database → Health

### 3. Check Connection Pool

In Supabase Dashboard:

- Go to Database → Connections
- Check active connections vs. limit
- Look for connection leaks (high idle connections)

### 4. Check Recent Migrations

```bash
# List migration status
pnpm db:status

# Check for drift
pnpm db:check-drift
```

## Resolution

### Connection Pool Exhausted

**Symptoms**: "too many connections" errors

**Fix**:

1. Restart the application (Vercel will create new instances)
2. If persistent, check for connection leaks in code
3. Consider increasing pool size in Supabase settings

### Slow Queries

**Symptoms**: Timeouts, high latency

**Fix**:

1. Check Supabase Dashboard → Database → Query Performance
2. Look for missing indexes on frequently queried columns
3. Check for N+1 queries in recent deployments

### Migration Issues

**Symptoms**: Schema errors, missing columns/tables

**Fix**:

1. Check migration status: `pnpm db:status`
2. If drift detected: coordinate with team before fixing
3. Apply pending migrations (staging first): `pnpm db:migrate`

### Complete Outage

**Symptoms**: All database operations failing

**Escalation**:

1. Check Supabase status page
2. If Supabase issue: wait for resolution, communicate to users
3. If configuration issue: check environment variables in Vercel
4. Contact Supabase support if needed

## Prevention

- Monitor connection pool usage
- Set up alerts for slow queries (>1s)
- Run `pnpm db:check-drift` in CI
- Test migrations in staging before production
