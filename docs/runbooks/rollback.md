# Rollback Runbook

Last updated: 2026-01-29

## Overview

This runbook provides step-by-step procedures for rolling back deployments, disabling features, and recovering from production incidents.

## Types of Rollback

### 1. Feature Flag Rollback (Fastest)

**When to use**: Isolate a problematic feature without full deployment rollback

**Steps**:

1. **Disable feature flag via environment variable**

   ```bash
   # Via Vercel dashboard or CLI
   vercel env add KILL_SWITCH_<FEATURE_NAME> true production

   # Or update existing flag
   vercel env rm NEXT_PUBLIC_FEAT_<FEATURE_NAME> production
   vercel env add NEXT_PUBLIC_FEAT_<FEATURE_NAME> false production
   ```

2. **Verify flag propagation** (typically < 1 minute)

   ```bash
   curl https://yourdomain.com/api/health | jq '.flags'
   ```

3. **Monitor error rates** in Sentry

4. **Notify stakeholders** via Slack/incident channel

**Expected Impact**: Feature disabled within 1-2 minutes; no full redeployment needed.

---

### 2. Version Rollback (Medium Speed)

**When to use**: Full deployment needs to be reverted

**Steps**:

1. **Identify last known good deployment**

   ```bash
   # Via Vercel
   vercel ls --prod

   # Or via Git
   git log --oneline -10
   ```

2. **Promote previous deployment** (Vercel)

   ```bash
   vercel promote <deployment-url> --prod
   ```

   OR **Redeploy previous commit** (if using git-based CD)

   ```bash
   git revert <bad-commit-sha>
   git push origin main
   ```

3. **Verify rollback**

   ```bash
   curl https://yourdomain.com/api/health
   # Check version/commit hash in response
   ```

4. **Monitor metrics** for 15-30 minutes

5. **Document incident** in post-mortem

**Expected Impact**: Rollback complete within 5-10 minutes; downtime possible during deployment.

---

### 3. Database Migration Rollback (Slow/High Risk)

**When to use**: Database schema or data change needs to be reverted

⚠️ **WARNING**: Always test migration rollback in staging first

**Steps**:

1. **Stop application traffic** (if migration is breaking)

   ```bash
   vercel scale <deployment> 0
   ```

2. **Run compensating migration**

   Via Supabase CLI:

   ```bash
   # Create compensating migration
   supabase migration new rollback_<original_migration_name>

   # Edit to reverse changes
   vim supabase/migrations/<timestamp>_rollback_*.sql

   # Apply to staging first
   supabase db push --linked --project-ref <staging-ref>

   # Verify staging
   pnpm db:check-drift

   # Apply to production
   supabase db push --linked --project-ref <prod-ref>
   ```

3. **Verify data integrity**

   ```sql
   -- Run validation queries
   SELECT COUNT(*) FROM <affected_table>;
   ```

4. **Restore application traffic**

   ```bash
   vercel scale <deployment> 1
   ```

5. **Monitor logs and errors** for 1 hour

**Expected Impact**: 15-60 minutes downtime; potential data loss if migration involved data transformation.

---

### 4. Hotfix Deployment (Fast Forward)

**When to use**: Critical bug requires immediate fix without full rollback

**Steps**:

1. **Create hotfix branch**

   ```bash
   git checkout -b hotfix/<issue-description> main
   ```

2. **Apply minimal fix**
   - Keep changes scoped to the bug only
   - Add regression test if possible

3. **Fast-track validation**

   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```

4. **Deploy to staging**

   ```bash
   git push origin hotfix/<issue-description>
   # Trigger staging deploy (PR or direct)
   ```

5. **Manual smoke test in staging**

6. **Merge and deploy to production**

   ```bash
   gh pr create --title "hotfix: <description>" --body "Critical fix for <issue>"
   gh pr merge --squash --auto
   ```

7. **Monitor production** for 30 minutes

**Expected Impact**: Fix deployed within 10-20 minutes; no rollback needed.

---

## Decision Tree

```
Is the issue isolated to a single feature?
├─ Yes → Use Feature Flag Rollback (#1)
└─ No → Is the entire deployment broken?
    ├─ Yes → Use Version Rollback (#2)
    └─ No → Does it involve database schema?
        ├─ Yes → Use Database Migration Rollback (#3)
        └─ No → Can it be fixed quickly?
            ├─ Yes (< 1 hour) → Use Hotfix Deployment (#4)
            └─ No → Use Version Rollback (#2)
```

## Pre-Rollback Checklist

Before executing any rollback:

- [ ] Incident documented in issue tracker
- [ ] On-call engineer notified
- [ ] Stakeholders informed (PM, support, leadership)
- [ ] Backup/snapshot verified (for DB rollbacks)
- [ ] Staging environment tested (if applicable)

## Post-Rollback Checklist

After rollback is complete:

- [ ] Verify application is stable
- [ ] Monitor error rates for 30-60 minutes
- [ ] Update incident timeline
- [ ] Schedule post-mortem (within 24-48 hours)
- [ ] Document root cause and prevention plan

## Communication Template

**Incident Notification** (Slack/incident channel):

```
🚨 Incident: <Brief description>
Severity: P0/P1/P2
Impact: <User-facing impact>
Action: Rolling back via <method>
ETA: <time>
Owner: @<on-call>
```

**Rollback Complete**:

```
✅ Rollback complete
Method: <feature flag / version / DB>
Status: Monitoring
Next steps: <post-mortem / fix ETA>
```

## Rollback Testing

Regularly test rollback procedures:

- **Quarterly**: Full version rollback in staging
- **Monthly**: Feature flag disable/enable drill
- **Per migration**: Test compensating migration in staging

## Emergency Contacts

- **On-call Engineer**: See PagerDuty rotation
- **Database Admin**: @db-team
- **Infrastructure**: @infra-team
- **Incident Commander**: @engineering-manager

## References

- [Progressive Rollout Strategy](docs/rollout-strategy.md)
- [Feature Flags](server/feature-flags.ts)
- [Database Migrations Log](docs/DATABASE_MIGRATIONS.md)
- [Sentry](https://sentry.io/organizations/<org>/issues/)
- [Vercel Dashboard](https://vercel.com/<team>/<project>)
