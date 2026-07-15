# Dynamic application security testing

The scheduled `DAST baseline` workflow runs the pinned OWASP ZAP baseline against isolated staging deployments for all four applications. Configure these repository variables with HTTPS staging origins:

- `DAST_WEB_URL`
- `DAST_BOOKING_LINKS_URL`
- `DAST_EMAIL_GATEWAY_URL`
- `DAST_SMS_GATEWAY_URL`

The workflow deliberately fails when a target is absent. Never point authenticated or active-scan jobs at production. Baseline reports are retained as workflow artifacts and findings must be triaged with the `area:security` label.
