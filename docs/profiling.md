# Performance profiling

Each deployable application exposes a `profile` script. Profiles are local diagnostic
artifacts and are ignored under `.profiles/`.

- Web/API: `pnpm profile` starts Next.js with Node CPU profiling enabled.
- Booking short links: `pnpm --filter @nabatable/booking-short-links profile`.
- Email queue gateway: `pnpm --filter @nabatable/email-queue-gateway profile`.
- SMS summary gateway: `pnpm --filter @nabatable/sms-summary-gateway profile`.

Worker scripts enable Node CPU profiles for the local Wrangler/Miniflare process and expose
an inspector port for the Worker isolate. Connect Chrome DevTools to the reported inspector
endpoint, exercise the slow request or queue path, then export a CPU profile or flame chart.

Never profile production with guest payloads. Reproduce with sanitized local fixtures, record
the commit SHA and scenario beside the profile, and remove the artifact after analysis.
