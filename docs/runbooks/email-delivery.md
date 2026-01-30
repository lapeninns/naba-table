# Email Delivery Runbook

## Symptoms

- Guests not receiving confirmation emails
- High email queue backlog
- Resend API errors in logs
- Email jobs failing repeatedly

## Diagnosis

### 1. Check Email Queue Status

```bash
# Via the queue status script
pnpm queue:email-worker --status
```

Or check Redis directly for queue depth.

### 2. Check Resend Dashboard

1. Visit [Resend Dashboard](https://resend.com/emails)
2. Check delivery rates and bounces
3. Look for API errors or rate limiting

### 3. Check Recent Email Errors

In Sentry, filter by:

- Tag: `module:email`
- Level: error

### 4. Verify Email Configuration

```bash
# Check Resend API status
pnpm email:check
```

## Resolution

### Queue Backlog

**Symptoms**: Emails delayed by hours

**Fix**:

1. Check worker is running: `pnpm queue:email-worker`
2. If stuck jobs, check for poison messages:

```bash
# View failed jobs
pnpm queue:email-worker --failed
```

3. Retry failed jobs or clear if unrecoverable

### Resend API Errors

**Symptoms**: 4xx/5xx errors from Resend

**Common causes**:

- Rate limiting (429): Back off and retry
- Invalid API key (401): Check RESEND_API_KEY env var
- Invalid recipient (400): Check email address format

**Fix**:

1. Check Resend status page
2. Verify API key in Vercel environment
3. Check email template rendering for errors

### Emails Going to Spam

**Symptoms**: Emails sent but not received

**Fix**:

1. Check SPF/DKIM/DMARC configuration
2. Verify sending domain in Resend
3. Review email content for spam triggers
4. Check domain reputation

### Template Rendering Errors

**Symptoms**: Jobs failing with template errors

**Fix**:

1. Check React Email templates compile:

```bash
pnpm email:preview
```

2. Verify all required data is passed to template
3. Check for null/undefined handling in templates

## Manual Email Resend

If a guest didn't receive their confirmation:

1. Find the booking in ops dashboard
2. Use "Resend Confirmation" action
3. Or via API:

```bash
curl -X POST https://app.nabatable.com/api/bookings/<id>/resend-email \
  -H "Authorization: Bearer <token>"
```

## Prevention

- Monitor queue depth with alerts
- Set up Resend webhooks for bounce/complaint tracking
- Regular review of email deliverability metrics
- Test email flow in staging before production changes
