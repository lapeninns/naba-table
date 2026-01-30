# Runbooks

Operational runbooks for incident response and common operational tasks.

## Incident Response

- [Database Issues](./database-issues.md) - Supabase connection problems, slow queries, migration issues
- [Booking Failures](./booking-failures.md) - Failed bookings, capacity errors, assignment failures
- [Email Delivery](./email-delivery.md) - Email queue issues, delivery failures

## Quick Reference

### Health Check Endpoints

```bash
# Application health (includes database probe)
curl https://app.nabatable.com/api/health

# Expected response (healthy):
# {"status":"healthy","database":"connected","version":"<commit-sha>"}

# Expected response (degraded):
# {"status":"degraded","database":"unreachable","version":"<commit-sha>"}
```

### Key Monitoring Links

- **Vercel Dashboard**: https://vercel.com/lapeninns/nabatable
- **Sentry Issues**: https://sentry.io/organizations/lapeninns/issues/
- **Supabase Dashboard**: https://supabase.com/dashboard/project/<project-id>
- **Resend Dashboard**: https://resend.com/emails

### Emergency Contacts

| Role             | Contact    |
| ---------------- | ---------- |
| On-call Engineer | @lapeninns |
| Database Admin   | @lapeninns |
