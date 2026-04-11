# Continuity Ledger

Last updated: 2026-04-11T18:22:00Z

## Goal (incl. success criteria)

- Add a daily manager booking summary service that sends today's active bookings and covers, including lunch/dinner breakdown, around 10:00.
- Success: canonical backend summary data includes a service-period breakdown suitable for messaging.
- Success: a Cloudflare Worker can schedule, queue, dedupe, and send the daily summary through Twilio SMS.
- Success: the job stays dormant until the restaurant-level config and Cloudflare secrets are present.
- Success: restaurant operators can CRUD the manager notification number and opt-in toggle from Restaurant Profile without direct database edits.
- Add guest booking confirmation SMS alongside the first booking confirmation email, with a richer ICS attachment for confirmed bookings.
- Success: only the first confirmation email is sent automatically for a booking lifecycle.
- Success: guest confirmation SMS is wired into the same first-confirmed event path.
- Success: ICS content includes manage-booking context and richer reservation details.
- Ensure guest booking failures show friendly human-readable guidance instead of raw backend codes.
- Add guest SMS notifications for booking updates and cancellations while keeping reminders/review requests email-only.
- Replace long guest SMS manage-booking URLs with branded Cloudflare short links under a Nabatable-owned domain.
- Polish guest SMS copy so confirmation, update, and cancellation messages read like clear transactional event notices.

## Constraints/Assumptions

- Follow root, `src/app/AGENTS.md`, and `server/AGENTS.md` rules.
- Prefer the existing ops summary rules over a new reporting side path.
- Scheduled outbound delivery is SMS-only through Twilio.
- Supabase remains remote-only; no local DB workflows.
- The manager notification number and summary toggle must live on `restaurants` as the canonical profile-owned config.

## Key decisions

- Reuse `getTodayBookingsSummary` as the canonical source and extend it with service-period breakdown data.
- Use Cloudflare Workers + Cron + Queues + Durable Objects as the runtime path.
- Use Twilio Messaging Services for production SMS delivery.
- Keep Twilio credentials and sender config as Cloudflare secrets.
- Store the manager notification number on `restaurants.manager_notification_phone` and the on/off state on `restaurants.manager_daily_summary_enabled`.
- Remove the live WhatsApp-specific code path after the SMS path is verified.
- Reuse the canonical booking lifecycle side-effects path for guest confirmation delivery instead of introducing a second notification path.
- Reuse the existing email delivery log to enforce the first-confirmation email rule.
- Extend the existing ICS builder in `lib/reservations/calendar-event.ts` rather than creating a second calendar generator.
- Prefer centralized guest error mapping over per-screen string handling.
- Keep guest SMS limited to high-signal lifecycle moments: confirmation, updated, and cancelled.
- Short links should remain an indirection layer over the existing signed manage-booking URL rather than replacing the current booking recovery token model.
- For dynamic booking links, prefer a Cloudflare Worker with a strongly consistent backing store over Bulk Redirects or KV-only.

## State

- Phase 6: manager-summary SMS cutover is implemented, deployed, and now aligned to the real production Supabase project `vrdiqfudmwydclqpydee`.
- Phase 3/4: guest confirmation SMS + first-confirmation email rule is implemented in code and covered by focused automated verification.
- Phase 3/4: guest/public booking submission errors now normalize to friendly copy in the shared booking wizard path.
- Phase 3/4: guest booking lifecycle SMS now covers confirmation, updates, and cancellations.
- Phase 6: Cloudflare booking short links are implemented, provisioned, and wired into Vercel production for guest confirmation/update SMS.

## Done

- Confirmed the existing ops dashboard summary path could be extended without creating a second business-rules path.
- Removed the exploratory Vercel/Meta route and env wiring.
- Created task artifacts under `tasks/whatsapp-booking-summary-20260411-0951/`.
- Added the shared daily summary formatter and service breakdown contract.
- Added the original Cloudflare `whatsapp-summary-gateway` Worker and later replaced it with the SMS-only `sms-summary-gateway` Worker.
- Added focused tests plus Cloudflare deploy/smoke scripts.
- Verified with targeted Vitest coverage and full `pnpm typecheck`.
- Added `restaurants.manager_daily_summary_enabled` and made `restaurants` the canonical source for the manager number + opt-in toggle.
- Added `restaurants.manager_notification_phone` plumbing through the Restaurant Profile UI and API.
- Renamed the worker/runtime to `cloudflare/sms-summary-gateway`, created SMS queues, deployed `https://nabatable-sms-summary-gateway.amanshresthaaaaa.workers.dev`, and uploaded all required Cloudflare secrets.
- Cleaned up all Twilio WhatsApp content templates, the old Cloudflare WhatsApp worker, and the old WhatsApp queues.
- Applied the remote schema updates and enabled Old Crown Girton with `manager_notification_phone = +447467586751` and `manager_daily_summary_enabled = true`.
- Verified the SMS dry-run response and attempted live sends both directly in Twilio CLI and through the deployed Worker.
- Browser-verified the Restaurant Profile field + toggle on `/dev/ops-settings-restaurant` and captured `tasks/whatsapp-booking-summary-20260411-0951/artifacts/restaurant-profile-manager-sms-summary.png`.
- Created task artifacts under `tasks/booking-confirmation-sms-ics-20260411-1405/`.
- Added a shared Twilio SMS helper under `lib/twilio/sms.ts` and pointed the Cloudflare worker at it.
- Added `server/bookings/confirmation-notifications.ts` to centralize the first-confirmation delivery rule.
- Wired guest confirmation SMS into the canonical booking side-effects and auto-assign confirmation paths.
- Moved booking manage-link generation into `server/bookings/manage-url.ts` and reused it in both email and SMS confirmation content.
- Enriched the canonical ICS payload/content with manage URL, venue phone, booking type, seating preference, and notes.
- Verified with `pnpm vitest run tests/server/bookings/confirmation-notifications.test.ts tests/lib/calendar-event.test.ts tests/cloudflare/sms-summary-gateway.test.ts` and `pnpm typecheck`.
- Updated Old Crown Girton live config to `manager_notification_phone = +447467586751` with `manager_daily_summary_enabled = true`.
- Replaced the Twilio GB alpha sender from `OLDCROWN` to `NABATABLE` and verified a live delivered SMS from `NABATABLE`.
- Redeployed the SMS worker to production (`Version ID: 7a6faffc-90ff-4a1b-9dd9-42d51f382871`).
- Deployed the app to Vercel production and aliased it to `https://app.nabatable.com` (`dpl_2LqX6KMbD9Nt84Ga9MMEr2RkHVyF`).
- Production smoke checks passed for `https://app.nabatable.com/api/health` and `https://nabatable-sms-summary-gateway.amanshresthaaaaa.workers.dev/health`.
- Confirmed the repo link / `.env.local` still target staging project `ndxmivcrehsacuerwxtm`, while Vercel production uses project `vrdiqfudmwydclqpydee`.
- Applied `20260411113000`, `20260411130500`, and `20260411143000` to production project `vrdiqfudmwydclqpydee`, recorded them in `supabase_migrations.schema_migrations`, and removed the legacy `restaurant_whatsapp_summary_settings` table there.
- Updated all production restaurants to use `manager_notification_phone = +447467586751`; production currently has 6 restaurants and 1 enabled daily-summary recipient.
- Rotated the live Cloudflare SMS worker `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets from staging to production and redeployed the worker.
- Added the missing Twilio env vars to Vercel production and redeployed the app so guest confirmation SMS can run on the live app server.
- Fixed the guest confirmation logic so pending bookings do not send a misleading confirmation email, and an existing confirmation email log no longer suppresses the actual confirmation SMS.
- Fixed guest/public booking error normalization so the shared API client preserves server `error` text and the booking wizard prefers user-friendly code mappings over technical backend strings.
- Added a deterministic dev-only harness at `/dev/guest-booking-error` and captured browser proof in `tasks/guest-booking-error-copy-20260411-1444/artifacts/guest-booking-error-alert.png`.
- Added booking update and cancellation SMS builders/senders in `server/sms/bookings.ts`.
- Wired update/cancel SMS into `server/jobs/booking-side-effects.ts` and verified with focused Vitest coverage plus `pnpm typecheck`.
- Added Twilio request support for `ShortenUrls=true` behind `TWILIO_SHORTEN_URLS`, ready for activation once Twilio link-shortening domain onboarding is complete.
- Allowed cancelled booking emails to keep their `.ics` attachment so calendar clients receive `METHOD:CANCEL` / `STATUS:CANCELLED` events.
- Created task artifacts under `tasks/sms-link-shortening-cancelled-ics-20260411-1512/`.
- Created planning artifacts under `tasks/cloudflare-booking-short-links-20260411-1522/`.
- Confirmed a real demo SMS using booking `8B9BG33T5B` delivered with the long manage URL, reinforcing the need for a branded short-link service.
- Implemented `server/bookings/short-link.ts` and switched guest confirmation/update SMS to request Cloudflare short links with a long-link fallback.
- Added the dedicated worker under `cloudflare/booking-short-links/` with D1-backed storage, optional KV caching, an authenticated internal create-link route, and a public redirect route.
- Provisioned Cloudflare D1 + KV for short links, uploaded `INTERNAL_LINKS_TOKEN`, deployed the worker, and smoke-tested `/health`.
- Added `BOOKING_SHORT_LINKS_BASE_URL`, `BOOKING_SHORT_LINKS_INTERNAL_URL`, and `BOOKING_SHORT_LINKS_INTERNAL_TOKEN` to Vercel production, then redeployed `app.nabatable.com` (`dpl_5y8uGJpBSuWtjLc7D9r3qXVxay4h`).
- Verified a live short link for booking `8B9BG33T5B`: token `4UTIJrXJum2J`, public redirect `302` to the exact real manage URL, and a delivered one-segment SMS (`SM86591c78d25ea86396cbe99d0cb996bf`).
- Created task artifacts under `tasks/sms-copy-polish-20260411-1547/`.
- Refined guest SMS builders to use the restaurant-first transactional layout the user requested: venue line, blank line, event sentence, details, reference, blank line, and manage/action line.
- Attached the custom domain `go.nabatable.com` to the booking-short-links worker and redeployed it (`ecc512bf-814e-4bc1-8f4b-8b66ed503735`).
- Repointed Vercel production `BOOKING_SHORT_LINKS_BASE_URL` and `BOOKING_SHORT_LINKS_INTERNAL_URL` to `https://go.nabatable.com`, then redeployed production (`dpl_FW9wfTT8FHu7TsWPojkdM8NMrP7R`).
- Verified `https://go.nabatable.com/m/4UTIJrXJum2J` redirects to the real manage-booking recovery URL and sent a live branded-domain proof SMS; Twilio delivered `SM7b5681f1b819f89f0005b22d8129390c` with the requested layout in `2` segments.
- Simplified the visible guest harness UX so the root is a categorized page directory and child routes focus on mocked page review plus metadata, not mind-map/CTA analysis.

## Now

- Guest pages dev harness work is in the final verification/doc-sync stage after upgrading all mapped child pages to fuller mocks.
- Hand off the corrected live production state cleanly; manager-summary SMS is deployed, branded as `NABATABLE`, and pointed at the real production database.
- Monitor the next real guest confirmation/update on production to confirm the app-generated SMS body contains the Cloudflare short link instead of the long URL.
- Deploy the friendly guest booking error-copy fix after review.
- Decide whether to keep the current event-style SMS layout as-is or do one more cost-focused tightening pass to try to reduce confirmation SMS from `2` segments to `1`.

## Next

- Verify the guest confirmation SMS flow end to end from a real booking creation or first confirm transition, now that the app can mint Cloudflare short links in production.
- Verify one real guest update SMS and one real guest cancellation SMS on production using the new event-style copy.
- Promote the same SMS worker/config to additional restaurants as Nabatable expands.
- Run the new `tests/e2e/guest-booking.spec.ts` duplicate-booking regression once the Playwright server lock issue is cleared.
- If deployed, verify one real booking update and one real cancellation on production to confirm SMS delivery.
- If desired, add click analytics/revocation on top of the D1 short-link service without changing the guest SMS contract.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/ops/bookings.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/lib/ops/daily-booking-summary.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/lib/reservations/calendar-event.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/lib/twilio/sms.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/bookings/confirmation-notifications.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/bookings/manage-url.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/types/ops.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/RestaurantProfileSection.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/components/ops/restaurants/RestaurantDetailsForm.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/ops/restaurants/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/cloudflare/sms-summary-gateway/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/jobs/booking-side-effects.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/jobs/auto-assign.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/sms/bookings.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/supabase/migrations/20260411130500_add_manager_notification_phone.sql
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/supabase/migrations/20260411143000_manager_daily_summary_sms_cutover.sql
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/whatsapp-booking-summary-20260411-0951/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-confirmation-sms-ics-20260411-1405/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/guest-booking-error-copy-20260411-1444/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-update-cancel-sms-20260411-1458/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/sms-link-shortening-cancelled-ics-20260411-1512/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/cloudflare-booking-short-links-20260411-1522/
