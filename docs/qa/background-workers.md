# Background Workers QA

Sprint 9 adds a focused local entrypoint for webhooks, cron routes, queues, and worker-style endpoints:

```sh
pnpm run qa:background-workers
```

The command selects:

- Resend webhook signature, size, delivery-log, suppression, and side-effect boundary tests.
- Twilio SMS status webhook signature, content-type, size, and parameter-boundary tests.
- cron route authentication tests for `CRON_SECRET` protected jobs.
- email queue authorization and dry-run processing tests.
- email processing security tests that keep external delivery mocked.
- dual-sync queue job contract, retry, worker, auto-export, and state-refresh tests.
- Cloudflare booking short-link and SMS summary worker tests.
- Cloudflare email queue gateway worker authorization and durable-object routing tests.
- Vercel cron configuration parse tests.
- a command-composition QA test so the selector stays intentional.

This suite is local and mocked. It must not contact production or staging, publish provider changes, send real email/SMS, or run cron work without the route-level auth and dry-run/mocking guards covered by the selected tests.
