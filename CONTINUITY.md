# Continuity Ledger

Last updated: 2026-04-12T10:01:00Z

## Goal (incl. success criteria)

- Sync the guest-facing site-map implementation from the reference branch onto `Guest-Facing-Frontend`.
- Success: `/site-map` exists on this branch and reflects the guest route inventory.
- Success: `src/app/sitemap.ts` reuses the shared guest route inventory instead of a hardcoded list.
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
- Add a public guest-facing page directory that lists and categorizes the live guest routes from a canonical source of truth.
- Success: guests and the team can review the guest surface area on a single `/site-map` page.
- Success: the XML sitemap reuses the same guest route inventory and excludes non-indexable auth/receipt/helper routes.
- Migrate guest-facing pages toward shadcn preset `b1aKNEah8` while keeping the active `src/` codepaths canonical.
- Success: preset-driven visual migration lands on guest-facing pages without shadcn writing into stale root-level paths.
- Redesign the guest-facing booking journey around "The Luminous Precision Framework" and treat that attached design system as the visual source of truth.
- Success: the root design-system document becomes the authoritative guest-facing blueprint for booking entry, confirmation, receipt, and management views.
- Success: canonical booking journey components and routes are rebuilt to follow the no-line, tonal layering, glass, and editorial typography rules.
- Rebuild the booking journey again from the root booking routes using the design system as the only UI/UX source of truth, while preserving the public/auth access model and legacy redirect routes.
- Success: `/bookings`, `/restaurants/[slug]/book`, `/restaurants/[slug]/book/thank-you`, `/bookings/[bookingId]`, and `/bookings/recover/error` read as one consistent premium guest journey.
- Success: preserved redirects still land on visually consistent canonical targets without changing behavior.
- Use the inspected `b1aKNEah8` Shadcn preset only as a guest-facing reference; do not let it alter non-guest surfaces or the repo-wide Shadcn foundation.

## Constraints/Assumptions

- Follow root, `src/app/AGENTS.md`, and `server/AGENTS.md` rules.
- Prefer the existing ops summary rules over a new reporting side path.
- Scheduled outbound delivery is SMS-only through Twilio.
- Supabase remains remote-only; no local DB workflows.
- The manager notification number and summary toggle must live on `restaurants` as the canonical profile-owned config.
- Guest-facing route categorization should stay in-app and reflect the real App Router structure instead of documentation-only prose.
- The shadcn CLI currently reports resolved paths under `/components` and `/app/globals.css`; that mismatch must be handled before applying a preset broadly.
- The new design system overrides prior guest-facing aesthetic direction for this booking redesign task.

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
- For guest-facing booking UI, the Luminous Precision design system document is the sole visual source of truth for this task.
- The current redesign pass should treat existing luminous styling as provisional; route and shared-component decisions should be re-judged against `/GUEST_FACING_DESIGN_SYSTEM.md`, not prior local styling choices.
- The preset-driven adjustments for this pass must stay inside guest/public booking codepaths and must not migrate the repo to `base` or monorepo structure.
- The manager daily summary SMS copy should use the compact one-line venue-prefixed format approved in chat, with lunch and dinner counts always shown and `Other` only when needed.

## State

- Phase 4: `tasks/site-map-sync-from-reference-20260412-0932/` is implemented and browser-verified on `Guest-Facing-Frontend`, including stale generated metadata file cleanup so `/site-map`, `/sitemap.xml`, and `/robots.txt` resolve from the App Router paths.
- Phase 6: manager-summary SMS cutover is implemented, deployed, and now aligned to the real production Supabase project `vrdiqfudmwydclqpydee`.
- Phase 4: `tasks/stack-party-time-fields-20260411-2040/` is implemented and browser-verified for the ops booking edit dialog layout adjustment.
- Phase 3/4: guest confirmation SMS + first-confirmation email rule is implemented in code and covered by focused automated verification.
- Phase 3/4: guest/public booking submission errors now normalize to friendly copy in the shared booking wizard path.
- Phase 3/4: guest booking lifecycle SMS now covers confirmation, updates, and cancellations.
- Phase 6: Cloudflare booking short links are implemented, provisioned, and wired into Vercel production for guest confirmation/update SMS.
- Phase 4: guest-facing page directory work is implemented and verified with shared catalog, public `/site-map`, and sitemap/footer wiring.
- Phase 4: guest style preset migration is implemented on guest-facing surfaces only, with task artifacts and browser verification in place.
- Phase 4: luminous booking journey redesign is implemented on the canonical booking path and backed by browser verification/artifacts.
- Phase 1/2: a new task folder exists at `tasks/booking-journey-design-system-rebuild-20260411-1954/` for a full route-by-route rebuild of the booking journey using the design system as the only visual source of truth.
- Phase 3: updating the manager daily summary SMS formatter to the approved compact venue-name copy under `tasks/manager-summary-sms-copy-20260412-0916/`.
- Phase 4 complete for the manager summary SMS copy update; focused Vitest coverage and full TypeScript checks are green.

## Done

- Ported the guest-facing route catalog, `/site-map` page, sitemap reuse, and footer link pattern from `origin/codex/FrontendImprovementsofguestfacing`.
- Moved stale untracked `public/robots.txt`, `public/sitemap.xml`, and `public/sitemap-0.xml` into `~/.Trash/` to remove Next.js metadata route conflicts.
- Captured browser verification artifacts for `/site-map`, `/sitemap.xml`, and `/robots.txt` under `tasks/site-map-sync-from-reference-20260412-0932/artifacts/`.
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
- Updated the manager daily summary SMS formatter to use the compact venue-prefixed one-line copy with lunch/dinner splits, and threaded the venue name through the Cloudflare summary preview path.
- Provisioned Cloudflare D1 + KV for short links, uploaded `INTERNAL_LINKS_TOKEN`, deployed the worker, and smoke-tested `/health`.
- Added `BOOKING_SHORT_LINKS_BASE_URL`, `BOOKING_SHORT_LINKS_INTERNAL_URL`, and `BOOKING_SHORT_LINKS_INTERNAL_TOKEN` to Vercel production, then redeployed `app.nabatable.com` (`dpl_5y8uGJpBSuWtjLc7D9r3qXVxay4h`).
- Verified a live short link for booking `8B9BG33T5B`: token `4UTIJrXJum2J`, public redirect `302` to the exact real manage URL, and a delivered one-segment SMS (`SM86591c78d25ea86396cbe99d0cb996bf`).
- Created task artifacts under `tasks/sms-copy-polish-20260411-1547/`.
- Refined guest SMS builders to use the restaurant-first transactional layout the user requested: venue line, blank line, event sentence, details, reference, blank line, and manage/action line.
- Attached the custom domain `go.nabatable.com` to the booking-short-links worker and redeployed it (`ecc512bf-814e-4bc1-8f4b-8b66ed503735`).
- Repointed Vercel production `BOOKING_SHORT_LINKS_BASE_URL` and `BOOKING_SHORT_LINKS_INTERNAL_URL` to `https://go.nabatable.com`, then redeployed production (`dpl_FW9wfTT8FHu7TsWPojkdM8NMrP7R`).
- Verified `https://go.nabatable.com/m/4UTIJrXJum2J` redirects to the real manage-booking recovery URL and sent a live branded-domain proof SMS; Twilio delivered `SM7b5681f1b819f89f0005b22d8129390c` with the requested layout in `2` segments.
- Simplified the visible guest harness UX so the root is a categorized page directory and child routes focus on mocked page review plus metadata, not mind-map/CTA analysis.
- Created task artifacts under `tasks/guest-facing-pages-directory-20260411-1726/`.
- Added `src/app/guest-facing-pages.ts` as the canonical guest route catalog and wired it into `src/app/sitemap.ts`.
- Added the public `/site-map` route plus footer links on both marketing footer variants.
- Verified `/site-map` in Chrome DevTools on desktop and mobile; captured screenshots, Lighthouse report, and performance trace artifacts.
- Created task artifacts under `tasks/luminous-booking-journey-redesign-20260411-1759/`.
- Documented the Luminous Precision booking redesign scope, constraints, and implementation plan in the new task folder.
- Added `/GUEST_FACING_DESIGN_SYSTEM.md` as the root guest-facing design-system source of truth and wired that precedence into `src/guest/AGENTS.md` plus the repo-local Nabatable skills.
- Rebuilt the canonical public/guest booking shells, wizard steps, and shared booking components around tonal layering, glass surfaces, gradient CTAs, and Manrope/Inter typography.
- Fixed the booking flow's custom-control labeling so Chrome DevTools and Lighthouse accessibility checks now pass on the public booking page.
- Captured updated browser proof under `tasks/luminous-booking-journey-redesign-20260411-1759/artifacts/`, including final screenshots, Lighthouse reports, and a performance trace.

## Now

- Hand off the site-map sync cleanly with the route catalog, metadata cleanup, and verification artifacts recorded.
- Hand off the small ops edit-dialog layout tweak cleanly; `ScheduleAwareTimestampPicker` now stacks date, party size, and time vertically in the canonical edit flow.
- Hand off the luminous booking redesign cleanly with task artifacts, updated skill/rule precedence, and captured browser verification evidence.
- Rebuild the booking journey from the current live code, not from earlier redesign notes, so the public entry, wizard, detail, thank-you, recovery, and receipt surfaces converge on one visual system.
- Keep the preset translation isolated to guest-facing pages only; no ops/admin/auth/global UI migration.
- Hand off the guest-facing page directory change cleanly with task artifacts and captured verification evidence.
- Hand off the guest-only preset migration cleanly; the requested monorepo reinstall path is incompatible with this repo, so the delivered change ports the preset language into guest/public codepaths only.
- Hand off the corrected live production state cleanly; manager-summary SMS is deployed, branded as `NABATABLE`, and pointed at the real production database.
- Monitor the next real guest confirmation/update on production to confirm the app-generated SMS body contains the Cloudflare short link instead of the long URL.
- Deploy the friendly guest booking error-copy fix after review.
- Decide whether to keep the current event-style SMS layout as-is or do one more cost-focused tightening pass to try to reduce confirmation SMS from `2` segments to `1`.
- Monitor any follow-up requests to adjust route categories or add future guest routes into the shared catalog.
- Preserve guest booking/account behavior while keeping ops-facing surfaces untouched.

## Next

- If requested, stage or commit the site-map sync once the user has reviewed the diff.
- If a follow-up request comes in, fix the dev harness `dev-restaurant` schedule/calendar-mask `404` responses so edit-dialog availability can be fully exercised in-browser.
- Continue tightening the booking-flow spacing and component psychology now that the party-size controller regression is fixed at the form-state level.
- Implement the new `booking-journey-design-system-rebuild-20260411-1954` plan across the route shells and shared booking components, then recapture browser proof.
- Verify the guest confirmation SMS flow end to end from a real booking creation or first confirm transition, now that the app can mint Cloudflare short links in production.
- Verify one real guest update SMS and one real guest cancellation SMS on production using the new event-style copy.
- Promote the same SMS worker/config to additional restaurants as Nabatable expands.
- Run the new `tests/e2e/guest-booking.spec.ts` duplicate-booking regression once the Playwright server lock issue is cleared.
- If deployed, verify one real booking update and one real cancellation on production to confirm SMS delivery.
- If desired, add click analytics/revocation on top of the D1 short-link service without changing the guest SMS contract.
- Investigate the existing `/restaurants` hydration mismatch separately if it reproduces outside this style migration task.
- If needed, validate the redesigned booking detail/receipt surfaces on their real route variants beyond the shared dev harness/public booking path proof already captured.
- Investigate the dev-only Turbopack preload `404` for the stale wizard-step chunk if it persists outside local development.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/site-map-sync-from-reference-20260412-0932/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/guest-facing-pages.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/(public)/(marketing)/site-map/page.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/sitemap.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/layouts/Footer.tsx
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
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/guest-facing-pages.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/(public)/(marketing)/site-map/page.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/sitemap.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/layouts/Footer.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/guest-facing-pages-directory-20260411-1726/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/components.json
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/(public)/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/guest/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/layouts/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/landing/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/guest-style-preset-migration-20260411-1736/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/luminous-booking-journey-redesign-20260411-1759/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-journey-design-system-rebuild-20260411-1954/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/stack-party-time-fields-20260411-2040/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/booking/list/BookingListClient.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/booking/detail/ReservationDetailClient.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/booking/ui/BookingComponents.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/reserve/features/reservations/wizard/ui/
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx
