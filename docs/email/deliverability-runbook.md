# Email Deliverability Runbook

Goal: maximize the share of Resend emails that land in the **Primary** inbox (out of
Spam and the Gmail Promotions tab).

> Reality check: no sender controls 100% of placement — recipient-side rules and
> engagement are part of the equation. Everything below is what *we* control. Done well,
> it moves authenticated transactional mail from "spam/promotions" to "Primary for
> essentially everyone who hasn't manually filtered us."

---

## 1. Authentication (DNS) — STATUS: ✅ already correct

Verified for the sending domain `notifications.nabatable.com` (Resend / Amazon SES):

| Record | Location | Status |
| --- | --- | --- |
| DKIM | `resend._domainkey.notifications.nabatable.com` | ✅ present, aligned (`d=` matches From) |
| SPF | `send.notifications.nabatable.com` → `v=spf1 include:amazonses.com ~all` | ✅ correct (Return-Path subdomain) |
| MX (bounce) | `send.notifications.nabatable.com` → `feedback-smtp.eu-west-1.amazonses.com` | ✅ |
| DMARC | `_dmarc.notifications.nabatable.com` → `p=quarantine` | ✅ passing with relaxed alignment |

**⚠️ Do not send from the apex `nabatable.com`.** It has a `p=quarantine` DMARC policy but
**no DKIM/SPF**, so any mail with `From: @nabatable.com` will fail auth and be quarantined.
Confirm `RESEND_FROM` in production is `no-reply@notifications.nabatable.com` (the
subdomain), never the apex.

---

## 2. One-click List-Unsubscribe — STATUS: ✅ shipped (this change)

Implemented in code:

- `List-Unsubscribe` (HTTPS one-click + `mailto:` fallback) and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers are attached to every
  single-recipient send in `libs/resend.ts`.
- Endpoint: `src/app/api/email/unsubscribe/route.ts`
  - `POST` = RFC 8058 one-click (what Gmail/Yahoo call directly) → suppresses immediately.
  - `GET` = confirmation page only; it never mutates, so link scanners/prefetchers can't
    accidentally unsubscribe anyone.
- Backing store: `public.email_unsubscribes` (email-keyed, migration
  `20260621120000_email_unsubscribes.sql`). Works for **all** recipients, including guests
  without an account. Checked at send time alongside the existing profile-bound flag.
- Resend `email.bounced` / `email.complained` webhooks also write to this list.

**Deploy requirements:**
1. Run the migration (`20260621120000_email_unsubscribes.sql`).
2. `SESSION_RECOVERY_ACCESS_TOKEN_SECRET` must be set (it signs the unsubscribe token). If
   absent, the system degrades safely to a `mailto:`-only unsubscribe (no one-click).
3. The public site origin must resolve correctly (`NEXT_PUBLIC_SITE_URL` /
   `config.domainName`) so the unsubscribe URL is absolute and reachable.

### Transactional vs marketing split (categories)

Every send is tagged with a category (`server/emails/email-categories.ts`) that is either
**essential** or **optional**:

| Essential (always delivered) | Optional (suppressible) |
| --- | --- |
| `booking_confirmation`, `booking_update`, `booking_reminder`, `auth`, `team_invitation`, `operational` | `review_request`, `marketing` |

Suppression has **two tiers** (`email_unsubscribes.reason`):

- **Hard** (`bounce`, `complaint`, `manual`, or the profile `is_email_suppressed` flag):
  stops **all** mail — the address is undeliverable, flagged us as spam, or was deliberately
  blocked.
- **Soft** (`one_click` from List-Unsubscribe): stops **optional** mail only. Booking
  confirmations, reminders, and auth still send.

So a guest who clicks "unsubscribe" stops review requests and marketing but **keeps getting
booking-critical emails** — the compliant, restaurant-friendly default. The
`List-Unsubscribe` header is still attached to all single-recipient mail (deliverability
benefit); only its *effect* is scoped to optional categories.

New optional mail (campaigns, newsletters) must pass `category: 'marketing'` (or
`'review_request'`) to `sendEmail` to be suppressible; untagged sends default to essential
so transactional mail can never be dropped by accident.

---

## 3. Reputation & warm-up — the dominant lever now (ACTION REQUIRED)

For correctly-authenticated transactional mail, spam placement is almost always
**reputation + engagement**, not config.

- [ ] **Set up Google Postmaster Tools** (https://postmaster.google.com) for
  `nabatable.com` + `notifications.nabatable.com`. This is the ground truth for domain
  reputation, spam rate, and authentication pass rates. Check weekly.
- [ ] **Keep the spam-complaint rate < 0.10%** (Gmail's threshold; aim < 0.05%). The
  suppression list + one-click unsubscribe directly help here.
- [ ] **Warm up volume gradually** if `notifications.nabatable.com` is new or low-volume.
  Avoid sudden spikes; ramp daily volume over ~2–4 weeks.
- [ ] **Watch bounces.** Hard-bounce rate should stay low; the webhook already suppresses
  bounced/complained addresses automatically.

---

## 4. From / Reply-To brand consistency (ACTION / DECISION)

Today: `From: <restaurant name> <no-reply@notifications.nabatable.com>`,
`Reply-To: info@lapeninns.com`.

- The cross-domain Reply-To (`lapeninns.com` vs `nabatable.com`) is a mild trust ding and
  can confuse filters. Consider a Reply-To on the sending org domain (e.g.
  `support@nabatable.com`) for consistency, or keep `lapeninns.com` if that's the
  recognized brand — but be consistent across From, links, and Reply-To.
- A recognizable From name drives opens, and opens drive Primary placement. Recipients who
  booked at a specific restaurant should see that restaurant's name (already the case via
  `fromName: venue.name`).

---

## 5. Staying out of the Promotions tab (Gmail-specific)

Promotions ≠ Spam — it's content classification. Our booking emails already include a
`schema.org` `FoodEstablishmentReservation` annotation, which Gmail uses to keep
reservations in Primary. To reinforce:

- Keep emails text-forward; minimize the number of links and large images.
- Avoid marketing language ("deal", "offer", "% off") in transactional templates.
- Keep multipart (HTML **+** plain text) — already done for booking emails.
- Don't over-use Resend **click/open tracking** on transactional mail: link-wrapping
  rewrites URLs to a tracking domain, which can nudge Promotions and slightly dilute
  domain alignment. Prefer tracking off (or minimal) for confirmations/reminders.
- Encourage high-value recipients to add the sender to their contacts — the single
  strongest "Primary" signal.

---

## Quick verification

```bash
# Auth (should all return records):
dig +short TXT resend._domainkey.notifications.nabatable.com   # DKIM
dig +short TXT send.notifications.nabatable.com                # SPF
dig +short MX  send.notifications.nabatable.com                # bounce MX
dig +short TXT _dmarc.notifications.nabatable.com              # DMARC

# After deploy, send a test to https://www.mail-tester.com and aim for 10/10,
# then send to a real Gmail account and confirm Primary placement + a working
# "Unsubscribe" link rendered by Gmail (proves the List-Unsubscribe header parsed).
```
