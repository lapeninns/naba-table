# Email queue gateway

The gateway batches queued jobs and posts them to the configured
`APP_PROCESS_EMAILS_URL`, authenticated with `APP_PROCESS_EMAILS_TOKEN`.

For a Vercel deployment protected by Deployment Protection, provision the optional
Worker secret `VERCEL_AUTOMATION_BYPASS_SECRET` for that environment. The queue
consumer sends it as `x-vercel-protection-bypass` only on the request to
`APP_PROCESS_EMAILS_URL`; the processing bearer remains required independently.
Redirects are not followed. A redirect or failed app response follows the existing
retry and dead-letter handling, preserving jobs rather than reporting delivery.
An absent or blank bypass secret adds no bypass header.

Keep staging and production project secrets separate. Provision this secret through
the authorized release process, never in Wrangler vars or source files, and keep
Vercel protection enabled. Staging must point to the staging ops URL and run the
web app with `RESEND_USE_MOCK=true`; a queue drain alone does not establish that
mock delivery completed. Verify the stored job outcome and application result.

Run `pnpm --filter @nabatable/email-queue-gateway verify` for lint, types, coverage,
and the Worker dry-run build. The repository staging release procedure is in
[`docs/runbooks/staging-release.md`](../../docs/runbooks/staging-release.md).
