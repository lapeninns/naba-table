# Web service degradation runbook

1. Correlate the alert with Vercel deployment metadata, trace IDs, route-level latency, and PostHog exception context.
2. Check Supabase, Resend, Twilio, Cloudflare, and Google Business Profile dependency status as applicable.
3. Disable only an owned, registered feature flag when it safely isolates the regression; record the linked removal issue.
4. Roll back the deployment when it is causal and validate public health plus a representative booking flow.
5. Capture the timeline, customer impact, root cause, and prevention action in the incident record.
