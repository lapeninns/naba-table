# Data Retention

This document describes baseline retention expectations.

## Principles

- Keep only what is needed for operations, security, and legal obligations.
- Prefer aggregation over raw event retention.
- Minimize PII in logs and analytics.

## Defaults

- Observability events: retain for a limited period appropriate for troubleshooting.
- Analytics: consent-gated via `nat_consent` cookie.
