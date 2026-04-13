---
task: sms-delivery-observability
timestamp_utc: 2026-04-13T12:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

- Verification surface: `http://localhost:3000/dev/ops-booking-dialog`
- Why this surface: it exercises the real booking-details dialog and `GuestProfilePanel` through the repo's dev harness with mock ops services, without needing an authenticated restaurant session.
- Verified interaction:
  - Opened the booking dialog dev harness.
  - Switched to the `History` tab in booking details.
  - Confirmed the `SMS Delivery` section renders alongside `Email Delivery`.
  - Expanded the SMS delivery accordion and verified the grouped mock history shows a `queued` event followed by `delivered`.
- Console & network:
  - No blocking console errors from the SMS delivery surface.
  - Harness route and assets loaded successfully over local dev.

## Test Outcomes

- `pnpm exec vitest run tests/lib/twilio-sms.test.ts tests/lib/sms-delivery-grouping.test.ts tests/server/sms/bookings.test.ts tests/server/bookings/confirmation-notifications.test.ts`
  - Passed: 4 files, 13 tests
- `pnpm exec vitest run tests/lib/twilio-sms.test.ts tests/server/sms/backfill.test.ts`
  - Passed: 2 files, 13 tests
- `pnpm typecheck`
  - Passed
- `pnpm build`
  - Passed

## Migration Verification

- Supabase CLI dry runs remained blocked by Postgres authentication failure from this machine.
- Applied `supabase/migrations/20260413130000_add_sms_delivery_log.sql` through the Supabase Management API in staging (`ndxmivcrehsacuerwxtm`) and production (`vrdiqfudmwydclqpydee`).
- Recorded migration version `20260413130000` in `supabase_migrations.schema_migrations` for both remote environments using the existing Management API migration-history pattern already present in the project.
- Verified both environments return `200 []` from the REST surface for `sms_delivery_log`, which clears the earlier `PGRST205` failure mode behind the “Delivery tracking unavailable” banner.
- Added a Twilio historical backfill script and ran it in production dry-run/apply mode for the last 30 days.
- Production backfill result:
  - 71 Twilio messages fetched
  - 61 candidate outbound SMS messages after filtering
  - 8 high-confidence matches
  - 0 ambiguous matches
  - 8 inserted rows
  - 0 insert failures
- Post-apply dry-run idempotency check:
  - 9 already recorded
  - 0 remaining matches
  - 0 ambiguous matches
- Post-apply verification shows `sms_delivery_log` now contains 9 total production rows, including 8 rows with `metadata.source = twilio_historical_backfill`.

## Artifacts

- Browser screenshot: `artifacts/sms-delivery-panel-dev-harness.png`
- Staging verification: `artifacts/staging-migration-verify-20260413-1402-fixed.txt`
- Production migration apply: `artifacts/production-migration-apply-20260413-1401.jsonl`
- Production verification: `artifacts/production-migration-verify-20260413-1401.txt`
- Production backfill dry run: `artifacts/sms-backfill-production-dry-run-2026-04-13T141752Z.json`
- Production backfill apply: `artifacts/sms-backfill-production-apply-2026-04-13T141818Z.json`
- Production backfill post-apply dry run: `artifacts/sms-backfill-production-dry-run-2026-04-13T141909Z.json`
- Production backfill verification: `artifacts/sms-backfill-production-verify-2026-04-13T1419Z.json`

## Known Issues

- [x] Browser proof completed on the booking-details History tab via the dev harness.
- [x] Remote migration applied and verified in staging and production via the Supabase Management API fallback.
- [x] Historical Twilio SMS backfill applied in production for the initial 30-day window with zero ambiguous auto-links.
- [ ] Older historical coverage still depends on future dry-run windows and may be limited when Twilio body/reference data is no longer available.

## Sign-off

- [x] Engineering
- [ ] QA
