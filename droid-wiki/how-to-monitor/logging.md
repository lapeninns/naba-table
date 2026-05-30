# Logging

Logging and reporting code lives in `lib/logger.ts`, `lib/monitoring/clientReporter.ts`, `src/instrumentation.ts`, `src/instrumentation-client.ts`, and `src/app/api/client-error/route.ts`.

## Rules of thumb

- Avoid logging secrets, tokens, raw customer PII, provider payload secrets, or service-role material.
- Use the existing logger/redaction tests before expanding observable fields.
- Client error reporting and analytics should preserve privacy expectations in `pnpm run qa:observability-privacy`.

Related: [Debugging](../how-to-contribute/debugging.md), [Security](../security.md).
