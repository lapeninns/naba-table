---
task: run-guest-e2e
timestamp_utc: 2025-12-19T11:14:11Z
owner: github:@amankumarshrestha
reviewers: [github:@qa]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Test Outcomes

- Failed: `pnpm run test:e2e:guest` (chromium headless shell missing).
- Failed after install: `pnpm run test:e2e:guest` (still missing `chromium_headless_shell` x64 path).
- Failed with override: `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac-arm64 pnpm run test:e2e:guest` (chromium headless shell launch permission denied).
- Failed headed attempt: `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac-arm64 pnpm exec playwright test tests/e2e/guest --project=chromium --headed` (global setup still launches headless shell; same permission error).

## Artifacts

- `tasks/run-guest-e2e-20251219-1113/artifacts/test_output.log`
- `tasks/run-guest-e2e-20251219-1113/artifacts/test_output_rerun.log`
- `tasks/run-guest-e2e-20251219-1113/artifacts/test_output_rerun2.log`
- `tasks/run-guest-e2e-20251219-1113/artifacts/test_output_headed.log`

## Notes

- Playwright host platform auto-detection resolves to mac-x64 because `os.cpus()` returns empty, so Chromium executable path is x64; override fixes path but headless shell still fails to launch due to Mach port permission errors.
