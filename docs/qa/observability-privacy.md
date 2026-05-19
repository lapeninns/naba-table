# Observability and Privacy QA

Sprint 14 adds a focused local entrypoint for observability, analytics, logging, and artifact-safety coverage:

```sh
pnpm run qa:observability-privacy
```

The command runs:

- client-error route tests for rate limiting, payload size, safe report acceptance, malformed payload rejection, and redacted logging.
- logger redaction tests for nested objects, errors, URL query strings, auth/cookie/API-key headers, tokens, emails, and phones.
- analytics schema and PostHog tests that keep event payloads allowlisted and avoid sensitive route/query data.
- QA artifact redaction and run directory tests.
- SMS phone redaction and security-event observability tests.
- dual-sync operational alert dry-run and event-emission tests.
- observability dashboard and alert config parse tests.
- a command-composition QA test so the selector stays intentional.

This suite is local and mocked. It must not send real analytics, create external alerts, or retain unredacted customer/provider data in logs or artifacts.

Tags: `@p2`, `@observability`, `@security`, `@api`, `@contract`.
