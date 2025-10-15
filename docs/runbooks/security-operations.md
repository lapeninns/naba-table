# Security Operations Runbook

**Version**: 1.0  
**Last Updated**: 2025-01-15  
**Maintainer**: Engineering Team  
**Related Task**: route-versioning-auth-cleanup-20251015-0704

---

## Table of Contents

1. [PII Access Rules](#pii-access-rules)
2. [Webhook Strategy](#webhook-strategy)
3. [Test Endpoint Gating](#test-endpoint-gating)
4. [Authorization Monitoring](#authorization-monitoring)
5. [Incident Response](#incident-response)
6. [Security Checklist](#security-checklist)

---

## 1. PII Access Rules

### 1.1 What is PII in Our System?

**Personally Identifiable Information (PII)**:

- Customer email addresses
- Customer phone numbers
- Customer full names
- Customer physical addresses (if collected)
- Payment information (if stored)
- Authentication tokens/session IDs

**Non-PII** (safe for public/limited access):

- Booking references (e.g., "AB1234")
- Restaurant names and addresses
- Booking dates, times, party sizes
- Seating preferences, booking types
- Restaurant IDs, Booking IDs (UUIDs)

---

### 1.2 Who Can Access Customer PII?

| Role                        | Access Level         | Scope                   | Justification                 |
| --------------------------- | -------------------- | ----------------------- | ----------------------------- |
| **Guest (Unauthenticated)** | None                 | N/A                     | No PII exposure               |
| **Guest with Token**        | Own booking only     | Limited (1-hour window) | Confirmation page             |
| **Customer (Auth)**         | Own data only        | All own bookings        | Account management            |
| **Staff**                   | Restaurant customers | Assigned restaurants    | Operational needs             |
| **Owner/Admin**             | Restaurant customers | Owned restaurants       | Full management               |
| **Service Role**            | All data             | System-wide             | Background jobs, integrations |

---

### 1.3 API Endpoints and PII Exposure

#### Public Endpoints (No Auth)

| Endpoint                               | PII Exposed | Protection                               |
| -------------------------------------- | ----------- | ---------------------------------------- |
| `GET /api/bookings/confirm?token=xxx`  | None        | Token-gated, 1-hour expiry, one-time use |
| `GET /api/restaurants`                 | None        | Public data only                         |
| `GET /api/restaurants/[slug]/schedule` | None        | Public data only                         |
| `POST /api/bookings`                   | Accepts PII | Rate limited, idempotent                 |

#### Guest Lookup (Minimal Auth)

| Endpoint                        | PII Exposed  | Protection                               |
| ------------------------------- | ------------ | ---------------------------------------- |
| `GET /api/bookings?email&phone` | Email, phone | Hash-based lookup, rate limited (20/min) |

#### Authenticated User

| Endpoint                 | PII Exposed            | Protection                    |
| ------------------------ | ---------------------- | ----------------------------- |
| `GET /api/bookings?me=1` | Own email, phone, name | Session required, user-scoped |
| `GET /api/profile`       | Own profile data       | Session required              |

#### Staff (Ops)

| Endpoint                        | PII Exposed              | Protection                             |
| ------------------------------- | ------------------------ | -------------------------------------- |
| `GET /api/ops/bookings`         | Names, emails, phones    | Membership required, restaurant-scoped |
| `GET /api/ops/customers`        | Full customer data       | Membership required, restaurant-scoped |
| `GET /api/ops/customers/export` | Full customer data (CSV) | Membership required, logged            |

#### Owner/Admin

| Endpoint      | PII Exposed   | Protection                |
| ------------- | ------------- | ------------------------- |
| Same as staff | Same as staff | Admin membership required |

---

### 1.4 Audit Logging for PII Access

**What Gets Logged**:

- Route accessed
- User ID (not name/email)
- Restaurant ID
- Timestamp
- Result (success/403)

**What is NOT Logged** (to protect PII):

- Customer email addresses (plain text)
- Customer phone numbers (plain text)
- Customer names
- Request/response bodies with PII

**Exception**: PII may be logged in encrypted/hashed form for security investigations.

**Log Retention**:

- Standard logs: 90 days
- Security logs: 1 year
- Compliance logs: As required by GDPR (can be longer for legal reasons)

---

### 1.5 GDPR Compliance

**Right to Access**:

- Customers can request all their data via email
- Fulfill within 30 days
- Export script: `server/gdpr/export-customer-data.ts` (if implemented)

**Right to Erasure** ("Right to be Forgotten"):

- Soft delete customer records (retain for legal/accounting, anonymize PII)
- Purge after retention period
- Script: `server/gdpr/anonymize-customer.ts` (if implemented)

**Data Minimization**:

- Only collect necessary PII
- Confirmation tokens don't contain PII
- Logs use IDs, not names/emails

**Breach Notification**:

- If PII is exposed: Notify DPA within 72 hours
- Notify affected customers "without undue delay"
- Document breach in security incident log

---

## 2. Webhook Strategy

No inbound webhooks are currently active; legacy Mailgun and Inngest handlers have been removed.

- Any future inbound integration must implement HMAC verification, replay protection, and structured logging before launch.
- Outbound notifications (emails, analytics) are dispatched synchronously inside their respective API routes.

---

## 3. Test Endpoint Gating

### 3.1 Test Endpoints Overview

**Purpose**: Support E2E testing by creating test data and auth sessions.

**Routes**:

- `POST /api/test/bookings` - Create test bookings
- `POST /api/test/invitations` - Create test invitations
- `POST /api/test/leads` - Create test leads
- `POST /api/test/playwright-session` - Create test auth session
- `GET /api/test/reservations/[id]/confirmation` - Get test confirmation

**Risk**: Expose privileged operations if not properly gated.

---

### 3.2 Current Gating Mechanism

**Method**: Environment variable check

**Implementation** (example):

```typescript
// src/app/api/test/bookings/route.ts
export async function POST(req: NextRequest) {
  // CRITICAL: Gate check at the very top
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  // ... test endpoint logic
}
```

**Environment Values**:

- `development` - Test endpoints enabled ✅
- `test` - Test endpoints enabled ✅
- `production` - Test endpoints disabled ❌

---

### 3.3 Verification

**Manual Check**:

```bash
# Should return 404 in production
curl https://production-domain.com/api/test/bookings
# Expected: {"error":"Not available"}

# Should work in development
curl http://localhost:3000/api/test/bookings
# Expected: Actual response or 400 (needs body)
```

**Automated Check** (in CI/CD):

```bash
# Add to deployment tests
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://$DEPLOY_URL/api/test/bookings)
if [ $RESPONSE -ne 404 ]; then
  echo "ERROR: Test endpoint not gated in production!"
  exit 1
fi
```

---

### 3.4 Alternative Gating (Feature Flag)

**Better Approach** (more explicit):

```typescript
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  if (!env.features.testEndpoints) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  // ... test endpoint logic
}
```

**Environment Configuration**:

```env
# .env.development
NEXT_PUBLIC_FEATURE_TEST_ENDPOINTS=true

# .env.production
NEXT_PUBLIC_FEATURE_TEST_ENDPOINTS=false
```

**Benefits**:

- More explicit than NODE_ENV
- Can be controlled independently
- Easier to audit

---

### 3.5 Adding New Test Endpoints

**Checklist**:

- [ ] Add gating check at top of handler
- [ ] Use `NODE_ENV === 'production'` check OR feature flag
- [ ] Return 404 (not 403) when gated (don't reveal existence)
- [ ] Verify endpoint returns 404 in production environment
- [ ] Document endpoint in this runbook
- [ ] Add comment explaining why endpoint exists

---

## 4. Authorization Monitoring

### 4.1 What to Monitor

**Key Metrics**:

- 401 rate (unauthenticated requests)
- 403 rate (authorization failures)
- Auth warning logs (membership/role denials)
- Rate limit hits (429 responses)

**Patterns to Watch For**:

- Sudden spike in 403s (potential attack or misconfiguration)
- Single user with many 403s (brute force or exploration)
- 403s from unexpected routes (security test or vulnerability scan)
- Geographic anomalies (access from unusual locations)

---

### 4.2 Querying Auth Logs

**Find Frequent Auth Failures** (potential attack):

```bash
# Assuming logs are in JSON format
cat logs/app.log | \
  grep '\[auth:' | \
  jq -r '.userId' | \
  sort | uniq -c | sort -rn | head -10
```

**Find Users Denied by Role**:

```bash
cat logs/app.log | \
  grep '\[auth:role\]' | \
  jq -c '{userId, restaurantId, required: .requiredRoles, actual: .actualRole}'
```

**403 Rate by Route**:

```bash
cat logs/access.log | \
  awk '$9 == 403 {print $7}' | \
  sort | uniq -c | sort -rn
```

---

### 4.3 Alerts

**Recommended Alert Thresholds**:

| Metric                | Threshold       | Action                         |
| --------------------- | --------------- | ------------------------------ |
| 403 rate > 5%         | 5-minute window | Warning alert                  |
| 403 rate > 10%        | 5-minute window | Critical alert + investigate   |
| Auth warnings > 100   | 1-minute window | Investigate (potential attack) |
| Single user > 10 403s | 1-minute window | Investigate (brute force?)     |

**Alert Destinations**:

- Slack channel: #security-alerts
- PagerDuty (for critical alerts)
- Email: security@company.com

---

### 4.4 Dashboard Queries

**Grafana/Datadog Example**:

```sql
-- 403 Rate by Route (last 1 hour)
SELECT
  route,
  COUNT(*) as failure_count,
  COUNT(DISTINCT user_id) as unique_users
FROM http_logs
WHERE
  status_code = 403
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY route
ORDER BY failure_count DESC;

-- Auth Role Denials (last 24 hours)
SELECT
  actual_role,
  required_roles,
  COUNT(*) as denial_count
FROM auth_logs
WHERE
  message LIKE '%[auth:role]%'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY actual_role, required_roles;
```

---

## 5. Incident Response

### 5.1 Unauthorized Access Detected

**Symptoms**:

- Sudden spike in 403 errors
- User accessing routes they shouldn't have access to
- Auth warning logs showing repeated denials

**Immediate Actions**:

1. **Assess Scope** (5 minutes):

   ```bash
   # Check logs for pattern
   grep '\[auth:' logs/app.log | tail -100

   # Identify affected user(s)
   grep 'userId.*suspected-user-id' logs/app.log
   ```

2. **Verify Current State** (2 minutes):

   ```bash
   # Check if user still has access
   curl -H "Authorization: Bearer <token>" \
     https://api.example.com/api/ops/restaurants

   # Should return 403 if properly blocked
   ```

3. **Block if Necessary** (immediate):

   ```bash
   # If attack is ongoing, revoke user session
   # Supabase Admin API:
   curl -X DELETE "https://PROJECT.supabase.co/auth/v1/admin/users/<user-id>/sessions" \
     -H "Authorization: Bearer <service-role-key>"
   ```

4. **Document** (10 minutes):
   - What was accessed
   - When it started
   - How it was detected
   - Actions taken
   - User ID and restaurant ID (if applicable)

5. **Notify** (30 minutes):
   - Engineering lead
   - Security team
   - If PII was accessed: Legal/compliance team

---

### 5.2 Data Leak Investigation

**Symptoms**:

- PII exposed in logs
- PII returned in API response when it shouldn't be
- Customer data visible to wrong user

**Immediate Actions**:

1. **Stop the Leak** (immediate):
   - Deploy hotfix to remove PII exposure
   - Disable affected endpoint if necessary
   - Rotate any exposed secrets

2. **Assess Impact** (1 hour):

   ```bash
   # How many users affected?
   grep 'leaked-pii-pattern' logs/app.log | \
     awk '{print $3}' | sort -u | wc -l

   # Time window?
   grep 'leaked-pii-pattern' logs/app.log | \
     head -1  # First occurrence
   grep 'leaked-pii-pattern' logs/app.log | \
     tail -1  # Last occurrence
   ```

3. **Evidence Preservation** (immediately):

   ```bash
   # Copy logs to secure location
   cp logs/app.log /secure/incident-$(date +%Y%m%d-%H%M).log
   chmod 400 /secure/incident-*.log
   ```

4. **GDPR Notification Requirements**:
   - If high risk to individuals: Notify within 72 hours
   - Document in breach register
   - Contact Data Protection Authority if required

5. **Customer Notification**:
   - Draft notification email (get legal approval)
   - Explain what happened, what data, what we're doing
   - Offer support/monitoring if applicable

---

### 5.3 Compromised Token

**Symptoms**:

- Confirmation token used multiple times (should be one-time)
- Token used after expiry
- Token seen in unusual location (logs, URL shorteners, etc.)

**Immediate Actions**:

1. **Invalidate Token** (immediate):

   ```sql
   -- Mark token as used
   UPDATE bookings
   SET confirmation_token_used_at = NOW()
   WHERE confirmation_token = '<suspected-token>';
   ```

2. **Assess Damage**:

   ```sql
   -- Check if token was used
   SELECT
     id,
     confirmation_token_used_at,
     created_at
   FROM bookings
   WHERE confirmation_token = '<suspected-token>';
   ```

3. **Risk Assessment**:
   - Confirmation tokens only expose single booking details (low risk)
   - No PII in token itself
   - Limited damage (1 booking, no modification possible)

4. **User Notification** (if high severity):
   - Email customer that confirmation link was accessed
   - Offer to resend confirmation if needed

---

## 6. Security Checklist

### 6.1 Pre-Deployment Security Review

**Code Changes**:

- [ ] No secrets committed (check git diff)
- [ ] Auth checks present on all privileged routes
- [ ] PII not logged in plain text
- [ ] Webhooks have signature verification
- [ ] Test endpoints gated properly
- [ ] Rate limiting on public endpoints
- [ ] Input validation with Zod schemas
- [ ] SQL injection prevention (parameterized queries only)

**Configuration**:

- [ ] Environment variables documented
- [ ] Secrets rotated (if changed)
- [ ] CORS configured correctly
- [ ] CSP headers in place

**Monitoring**:

- [ ] Alerts configured for 403 spikes
- [ ] Log aggregation working
- [ ] Dashboard queries updated

---

### 6.2 Post-Deployment Verification

**Within 1 Hour**:

- [ ] Test endpoints return 404 in production
- [ ] Auth flows working (signin, api access)
- [ ] No unexpected 401/403 spike
- [ ] No console errors in logs

**Within 24 Hours**:

- [ ] Review auth failure logs for patterns
- [ ] Check 403 rate (should be < 2%)
- [ ] Verify monitoring/alerts working
- [ ] Check for any customer reports of issues

---

### 6.3 Monthly Security Audit

- [ ] Review auth logs for unusual patterns
- [ ] Rotate webhook signing keys
- [ ] Check for deprecated dependencies (security vulnerabilities)
- [ ] Review and prune old test data
- [ ] Verify test endpoints still gated
- [ ] Review GDPR data retention compliance
- [ ] Check for exposed secrets in git history
- [ ] Audit user roles and permissions

---

## 7. Contact Information

**Security Team**:

- Email: security@company.com
- Slack: #security
- On-call: PagerDuty rotation

**Escalation**:

- P0 (Critical): Page on-call engineer immediately
- P1 (High): Notify security team within 1 hour
- P2 (Medium): Create ticket, notify within 24 hours
- P3 (Low): Create ticket, handle in normal sprint

**External Resources**:

- Supabase Support: https://supabase.com/support
- GDPR Guidance: https://gdpr.eu/
- OWASP Top 10: https://owasp.org/www-project-top-ten/

---

## 8. Changelog

| Date       | Version | Changes                                                            |
| ---------- | ------- | ------------------------------------------------------------------ |
| 2025-01-15 | 1.0     | Initial runbook created (Phase 6 of route-versioning-auth-cleanup) |

---

**End of Runbook**
