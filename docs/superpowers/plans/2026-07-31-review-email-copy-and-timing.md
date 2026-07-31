# Review-Request Email Copy + Send-Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise post-visit Google-review conversion by rewriting the three default review-request email variants (no photo ask, experience-first framing, booking specifics), adding a one-tap star row to the review email, and deferring review sends out of the 16:00–19:00 commute window to the 19:00 evening peak.

**Architecture:** All copy lives in the code-level defaults array in `lib/restaurants/email-template-defaults.ts` (venues without custom templates pick these up automatically). The star row is a new helper in `server/emails/base.ts`, wired into the shared `renderHtml` in `server/emails/bookings.ts`, gated so it only appears on review-request emails whose CTA is a genuine Google review URL. Timing is a new post-event-only branch in `adjustToOptimalSendTime` in `server/jobs/booking-side-effects.ts`.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, pnpm. Emails are hand-rolled table-based HTML strings (no react-email).

## Global Constraints

- **Scope is the `review_request` template family only.** Other families (`request_received`, `confirmation`) also mention photos in their `cue` fields — do NOT touch them.
- **All five stars must link to the SAME destination.** Never branch destination by rating (Google prohibits review gating). Never mention rewards/incentives in review copy (the repo has a game-rewards system; do not connect them).
- **No new template variables.** The global variable map is exactly `name, firstName, venue, date, time, party` (`lib/restaurants/email-templates.ts:96-112`). `{{occasion}}` is out of scope: no global variable exists and occasions live in a separate `booking_occasions` table — adding it means a join plus editor/validation changes, disproportionate for copy work.
- **Keep existing variant ids** `review-request-default-1/2/3` — they seed deterministic variant selection (`pickDeterministicTemplateVariant`); changing ids reshuffles which guests get which variant.
- **`{{party}}` renders as a formatted noun** ("2 People" / "1 Person") — copy must read naturally around that exact substitution.
- **Contract test coupling:** any token used in a variant must be listed in that family's `recommendedVariables` (enforced by `tests/lib/restaurants/email-template-defaults.test.ts:70`), and every `recommendedVariables` entry must be in the global key list.
- **Commute deferral targets 19:00, not 20:00.** `isWithinOptimalHours` is `hour >= 9 && hour < 20`; a 20:00 send would be treated as after-hours by existing rules and cascade to next morning. 19:00 reuses the existing `eveningFallback` constant. Applies to `post-event` mode only — pre-event reminders at 17:00 are intentional and must not change.
- **Email HTML constraints:** table layout, inline styles only, no external images/assets, `role="presentation"`, escape all dynamic text with `escapeHtml`. Star glyph is `&#9733;` (★), colour `#F59E0B` (amber), min 44px tap target.
- **Europe/London in July is BST (UTC+1)** — all test fixtures below depend on this.
- Commit after each task; do NOT push (push to `main` auto-deploys on Vercel — leave deploy to the user).
- Before any `git add`, run `git checkout -- next-env.d.ts` if it is dirty (Next dev flips it to a dev variant that breaks CI typecheck).
- Run tests with `pnpm exec vitest run <file>` from the repo root.

---

### Task 1: Rewrite the review_request default variants

**Files:**

- Modify: `lib/restaurants/email-template-defaults.ts:339-384` (the `review_request` family object)
- Test: `tests/lib/restaurants/email-template-defaults.test.ts`

**Interfaces:**

- Consumes: `TEMPLATE_DEFINITIONS` export (already imported by the test file).
- Produces: the `review_request` family with `recommendedVariables: ['firstName', 'venue', 'date', 'party']` and three variants whose `ask` and `cue` are `''`. Task 2's render test relies on `ask: ''` meaning no `renderNote('⭐', …)` block appears.

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('restaurant email template defaults', …)` block in `tests/lib/restaurants/email-template-defaults.test.ts` (after the `it` at line 88; `TEMPLATE_DEFINITIONS` is already imported):

```ts
it('review request defaults carry no photo ask and lead with the guest experience @contract', () => {
  const family = TEMPLATE_DEFINITIONS.find((definition) => definition.key === 'review_request');
  expect(family).toBeDefined();
  expect(family!.recommendedVariables).toEqual(
    expect.arrayContaining(['firstName', 'venue', 'date', 'party']),
  );
  for (const variant of family!.defaultVariants) {
    expect(variant.ask.trim()).toBe('');
    expect(variant.cue.trim()).toBe('');
    for (const field of ['subject', 'preheader', 'headline', 'intro', 'cue', 'ask'] as const) {
      expect(variant[field].toLowerCase()).not.toContain('photo');
    }
    expect(variant.subject).toMatch(/how (was|did)/i);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/lib/restaurants/email-template-defaults.test.ts -t "no photo ask"`
Expected: FAIL — current variants have non-empty `ask` (photo lines) and variants 2/3 subjects (`Would you review {{venue}}?`, `Tell us about your experience at {{venue}}`) don't match `/how (was|did)/i`.

- [ ] **Step 3: Replace the family definition**

In `lib/restaurants/email-template-defaults.ts`, replace the entire `review_request` object (currently lines 339–384) with:

```ts
  {
    key: 'review_request',
    title: 'Review Request',
    description: 'Post-visit review prompts.',
    group: 'review',
    supportsCtaLabel: true,
    recommendedVariables: ['firstName', 'venue', 'date', 'party'],
    authoringHints: [
      'Lead with the guest experience ("How was your visit?"), not the venue ask.',
      'Keep the effort low: no photo requests or extra tasks before the review link.',
      'Variants should differ in tone, not in the destination or ask.',
    ],
    defaultVariants: [
      {
        id: 'review-request-default-1',
        name: 'Quick Review',
        subject: 'How was your visit to {{venue}}?',
        preheader: 'A quick review helps and only takes a moment.',
        headline: 'How was everything?',
        intro:
          'Thanks for visiting {{venue}} on {{date}}. Could you spare 30 seconds to leave a quick review?',
        cue: '',
        ask: '',
        ctaLabel: 'Leave a Review',
      },
      {
        id: 'review-request-default-2',
        name: 'Warm Host',
        subject: '{{firstName}}, how was your visit to {{venue}}?',
        preheader: 'We would love to hear how your visit went.',
        headline: 'How was your visit?',
        intro:
          'It was a pleasure hosting {{party}} at {{venue}} on {{date}}. If you have 30 seconds, we would love to hear how it went.',
        cue: '',
        ask: '',
        ctaLabel: 'Leave a Review',
      },
      {
        id: 'review-request-default-3',
        name: 'Short and Direct',
        subject: 'Your {{date}} visit to {{venue}} — how was it?',
        preheader: 'Tap a star — it takes 30 seconds.',
        headline: 'How was it?',
        intro:
          'You joined us at {{venue}} on {{date}} — how was it? A 30-second review helps future guests choose.',
        cue: '',
        ask: '',
        ctaLabel: 'Leave a Review',
      },
    ],
  },
```

Copy notes (why this exact text): every subject asks about _their_ visit (experience-first); `{{date}}`/`{{party}}` reactivate the specific memory; "30 seconds" names the effort cost; tone varies (neutral / warm / terse) but destination and ask are identical across variants.

- [ ] **Step 4: Run the full defaults test file**

Run: `pnpm exec vitest run tests/lib/restaurants/email-template-defaults.test.ts`
Expected: PASS — including the pre-existing contract tests (`only uses placeholders from each family recommended variables…` passes because `date`/`party` are now in `recommendedVariables`; `ships three complete default variants…` passes because it never requires `ask`/`cue` to be non-empty).

- [ ] **Step 5: Commit**

```bash
git checkout -- next-env.d.ts 2>/dev/null; git add lib/restaurants/email-template-defaults.ts tests/lib/restaurants/email-template-defaults.test.ts
git commit -m "feat(emails): experience-first review-request defaults with booking specifics

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: One-tap star row in review-request emails

**Files:**

- Modify: `server/emails/base.ts` (add `renderStarRow` next to `renderButton`, which is at line 109)
- Modify: `server/emails/bookings.ts` (import `renderStarRow`; gate + insert in `renderHtml`)
- Test: create `tests/server/emails/booking-review-email-render.test.ts`

**Interfaces:**

- Consumes: `escapeHtml`, `EMAIL_FONT_STACK` (already in `base.ts`); `safeGoogleReviewUrl` from `@/lib/security/safe-url` (already imported in `bookings.ts:19`); `renderHtml` is already exported (`bookings.ts:390`).
- Produces: `renderStarRow(href: string): string` exported from `@/server/emails/base`. Renders 5 identical-destination star links + caption "Tap a star to rate your visit".

- [ ] **Step 1: Write the failing test**

Create `tests/server/emails/booking-review-email-render.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config', () => ({
  default: { email: { supportEmail: 'support@example.com' } },
}));
vi.mock('@/lib/site-url', () => ({
  getTrustedAppOrigin: () => 'https://app.nabatable.com',
  getTrustedSiteOrigin: () => 'https://nabatable.com',
}));
vi.mock('@/libs/resend', () => ({
  createEmailIdempotencyKey: vi.fn(() => 'idempotency-key'),
  sendEmail: vi.fn(),
  isEmailRecipientSuppressedError: vi.fn(() => false),
}));
vi.mock('@/server/bookings/manage-url', () => ({
  buildBookingManageUrl: () => 'https://nabatable.com/bookings/manage/booking-1',
}));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: vi.fn() }));
vi.mock('@/server/emails/email-delivery-log', () => ({
  findLatestEmailDeliveryByMessageId: vi.fn(),
  hasRecentEmailDelivery: vi.fn(),
  recordEmailDeliveryLog: vi.fn(),
}));

import { renderHtml } from '@/server/emails/bookings';

const REVIEW_URL = 'https://g.page/r/example/review';

const booking = {
  id: 'booking-1',
  restaurant_id: 'rest-1',
  status: 'completed',
  party_size: 2,
  reference: 'TESTREF',
  start_at: '2026-07-12T12:00:00.000Z',
  end_at: '2026-07-12T13:30:00.000Z',
  notes: null,
  customer_name: 'Guest Example',
  customer_email: 'guest@example.com',
} as never;

const venue = {
  name: 'Old Crown',
  address: '1 High Street, London',
  phone: '+44 20 7946 0000',
  timezone: 'Europe/London',
} as never;

const summary = { date: 'Sat 12 Jul', startTime: '1:00 PM', endTime: '2:30 PM', party: '2 People' };

function renderReviewEmail(overrides: { ctaUrl?: string; emailType?: string } = {}) {
  return renderHtml({
    booking,
    venue,
    summary,
    subject: 'How was your visit to Old Crown?',
    preheader: 'A quick review helps and only takes a moment.',
    headline: 'How was everything?',
    intro: 'Thanks for visiting Old Crown on Sat 12 Jul.',
    cue: '',
    ask: '',
    ctaLabel: 'Leave a Review',
    ctaUrl: REVIEW_URL,
    emailType: 'review_request',
    ...overrides,
  });
}

describe('review-request email rendering', () => {
  it('renders five same-destination star links with a caption @contract', () => {
    const html = renderReviewEmail();
    expect(html).toContain('Tap a star to rate your visit');
    expect(html.split('&#9733;').length - 1).toBe(5);
    // 5 star links + 1 CTA button, all pointing at the review destination.
    expect(html.split('g.page/r/example/review').length - 1).toBeGreaterThanOrEqual(6);
    expect(html).toContain('aria-label="Rate 5 stars"');
  });

  it('omits the star row when the CTA is not a review destination @contract', () => {
    const html = renderReviewEmail({ ctaUrl: undefined });
    expect(html).not.toContain('Tap a star to rate your visit');
    expect(html).not.toContain('&#9733;');
  });

  it('omits the star row on non-review emails even with a review-looking URL @contract', () => {
    const html = renderReviewEmail({ emailType: 'created' });
    expect(html).not.toContain('Tap a star to rate your visit');
  });

  it('renders no photo/ask note blocks when cue and ask are empty @contract', () => {
    const html = renderReviewEmail();
    expect(html).not.toContain('📸');
    expect(html).not.toContain('⭐');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/server/emails/booking-review-email-render.test.ts`
Expected: FAIL on the first test — no star row exists yet ("Tap a star" not found). Tests 2–4 may already pass; that's fine. If the import of `@/server/emails/bookings` throws at module load, the failing module is visible in the stack — stub that module the same way as the mocks above (stub every _value_ import `bookings.ts` takes from it; type-only imports need nothing).

- [ ] **Step 3: Add `renderStarRow` to `server/emails/base.ts`**

Insert directly after the `renderButton` function (line 109ff), matching its string-template style:

```ts
export function renderStarRow(href: string): string {
  const starLink = (count: number) =>
    `<td align="center" style="padding:0 2px;"><a href="${escapeHtml(href)}" aria-label="Rate ${count} star${count === 1 ? '' : 's'}" style="display:inline-block;min-width:44px;font-family:${EMAIL_FONT_STACK};font-size:32px;line-height:44px;color:#F59E0B;text-decoration:none;">&#9733;</a></td>`;

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        ${[1, 2, 3, 4, 5].map(starLink).join('')}
      </tr>
      <tr>
        <td colspan="5" align="center" style="padding:4px 0 20px;">
          <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:13px;color:#6B7280;">Tap a star to rate your visit</p>
        </td>
      </tr>
    </table>`;
}
```

Design notes: all five links share one `href` (review-gating compliance); ★ text glyph renders in every major client with no image hosting; 44px line-height/min-width is the touch floor; amber `#F59E0B` is the universal star colour (the violet `COLORS.review` accent stays on the hero icon).

- [ ] **Step 4: Wire it into `renderHtml` in `server/emails/bookings.ts`**

4a. Add `renderStarRow` to the existing `@/server/emails/base` import (lines 29–38):

```ts
import {
  COLORS,
  renderButton,
  renderEmailBase,
  renderGridBox,
  renderNote,
  renderStarRow,
  escapeHtml,
  EMAIL_FONT_STACK,
  type EmailAnnotation,
} from '@/server/emails/base';
```

4b. In `renderHtml`, right after `const safeCtaUrl = …` (line 434), add:

```ts
// One-tap star row: only on review requests, and only when the CTA is a genuine
// Google review destination (never for the manage-booking fallback URL).
const reviewStarUrl = emailType === 'review_request' ? safeGoogleReviewUrl(safeCtaUrl) : null;
```

4c. In the `contentHtml` template, between the `<!-- Notes -->` line (`${booking.notes ? renderNote('📝', booking.notes) : ''}`) and the `<!-- CTA Button -->` comment, insert:

```ts
          <!-- One-Tap Star Row -->
          ${reviewStarUrl ? renderStarRow(reviewStarUrl) : ''}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/server/emails/booking-review-email-render.test.ts`
Expected: PASS (4/4).

Note on test 1's `>= 6` count: `safeGoogleReviewUrl` returns a _normalized_ URL, so the star hrefs may differ from the button href by a trailing slash or lowercased host — which is why the assertion counts the substring `g.page/r/example/review` rather than exact-URL equality.

- [ ] **Step 6: Run neighbouring email suites to catch regressions**

Run: `pnpm exec vitest run tests/server/restaurant-email-templates.test.ts tests/server/emails/`
Expected: PASS — star row is additive and gated, no other email type renders it.

- [ ] **Step 7: Commit**

```bash
git checkout -- next-env.d.ts 2>/dev/null; git add server/emails/base.ts server/emails/bookings.ts tests/server/emails/booking-review-email-render.test.ts
git commit -m "feat(emails): one-tap star row on review-request emails

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Defer post-event sends out of the 16:00–19:00 commute window

**Files:**

- Modify: `server/jobs/booking-side-effects.ts:227-232` (constants) and `:278-360` (`adjustToOptimalSendTime`)
- Test: `tests/server/jobs/booking-side-effects.test.ts`

**Interfaces:**

- Consumes: existing `OPTIMAL_SEND_HOURS`, `getLocalHour`, `isWithinOptimalHours`, `ScheduleMode` — all internal to the same file.
- Produces: no signature changes. Behaviour change: `adjustToOptimalSendTime(t, tz, 'post-event')` proposed at local 16:00–18:59 now lands at local 19:00–19:59 same day (minutes preserved). `'pre-event'` behaviour is byte-for-byte unchanged.

- [ ] **Step 1: Write the failing tests**

Add to the `describe('processBookingCreatedSideEffects', …)` block in `tests/server/jobs/booking-side-effects.test.ts` (after the `it` ending at line 191; the mock-client shape is copied from the test at lines 110–161). July ⇒ BST ⇒ London = UTC+1:

```ts
it('defers a commute-window review send to the 7 PM evening peak @contract', async () => {
  // Given: visit ends 14:00 London; +3h review delay proposes 17:00 London (commute).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime('2026-07-12T13:30:00.000Z');
  emailQueueEnabled.value = true;
  const completed = {
    ...pendingBooking,
    status: 'completed',
    end_at: '2026-07-12T13:00:00.000Z',
  };
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              email_send_review_request: true,
              google_review_url: 'https://g.page/r/example/review',
              timezone: 'Europe/London',
            },
            error: null,
          }),
        })),
      })),
    })),
  };

  // When
  await enqueueCheckOutSideEffects(completed as never, completed.restaurant_id, {
    supabase: client as never,
  });

  // Then: pushed from 17:00 to 19:00 London (18:00Z), minutes preserved.
  expect(enqueueEmailJobMock).toHaveBeenCalledWith(
    expect.objectContaining({
      bookingId: completed.id,
      type: 'review_request',
      scheduledFor: '2026-07-12T18:00:00.000Z',
    }),
    expect.objectContaining({ jobId: `review_request:${completed.id}` }),
  );
});

it('keeps evening-peak review sends at their proposed time @contract', async () => {
  // Given: visit ends 16:30 London; +3h proposes 19:30 London — already past the commute.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime('2026-07-12T16:00:00.000Z');
  emailQueueEnabled.value = true;
  const completed = {
    ...pendingBooking,
    status: 'completed',
    end_at: '2026-07-12T15:30:00.000Z',
  };
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              email_send_review_request: true,
              google_review_url: 'https://g.page/r/example/review',
              timezone: 'Europe/London',
            },
            error: null,
          }),
        })),
      })),
    })),
  };

  // When
  await enqueueCheckOutSideEffects(completed as never, completed.restaurant_id, {
    supabase: client as never,
  });

  // Then: unchanged — 19:30 London is 18:30Z.
  expect(enqueueEmailJobMock).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'review_request',
      scheduledFor: '2026-07-12T18:30:00.000Z',
    }),
    expect.objectContaining({ jobId: `review_request:${completed.id}` }),
  );
});
```

(`pendingBooking.customer_email` is `guest@example.com` — valid, so the email path runs; no WhatsApp consent fields on the fixture, so only the email job is asserted.)

- [ ] **Step 2: Run the tests to verify the first fails**

Run: `pnpm exec vitest run tests/server/jobs/booking-side-effects.test.ts -t "commute-window"`
Expected: FAIL — actual `scheduledFor` is `2026-07-12T16:00:00.000Z` (17:00 London is "within optimal hours" today, so no adjustment happens).

Also run: `pnpm exec vitest run tests/server/jobs/booking-side-effects.test.ts -t "evening-peak"`
Expected: PASS already (documents the boundary before the change).

- [ ] **Step 3: Implement the commute deferral**

3a. Extend the constants block (lines 227–232):

```ts
const OPTIMAL_SEND_HOURS = {
  morningStart: 9, // 9 AM - earliest optimal send time
  eveningEnd: 20, // 8 PM - latest optimal send time
  eveningFallback: 19, // 7 PM - fallback for pre-event emails that would land in sleep hours
  nextDayStart: 10, // 10 AM - comfortable start time for pushed emails
  commuteStart: 16, // 4 PM - start of the late-afternoon commute dead zone (post-event only)
};
```

3b. In `adjustToOptimalSendTime` (line 278), replace the "already within optimal hours" early return:

```ts
const proposedDate = new Date(proposedTimeMs);
const localHour = getLocalHour(proposedDate, timezone);

// If already within optimal hours, no adjustment needed
if (isWithinOptimalHours(localHour)) {
  const delayMs = proposedTimeMs - Date.now();
  return Math.max(0, delayMs);
}
```

with:

```ts
const proposedDate = new Date(proposedTimeMs);
const localHour = getLocalHour(proposedDate, timezone);

// POST-EVENT sends proposed during the late-afternoon commute (4 PM - 7 PM) engage
// poorly; defer them to the 7 PM post-work evening peak (minutes preserved).
// Pre-event reminders are exempt: a 5 PM reminder for an 8 PM booking is intentional.
const inCommuteWindow =
  localHour >= OPTIMAL_SEND_HOURS.commuteStart && localHour < OPTIMAL_SEND_HOURS.eveningFallback;
if (mode === 'post-event' && inCommuteWindow) {
  const deferred = new Date(proposedDate);
  deferred.setHours(deferred.getHours() + (OPTIMAL_SEND_HOURS.eveningFallback - localHour));
  return Math.max(0, deferred.getTime() - Date.now());
}

// If already within optimal hours, no adjustment needed
if (isWithinOptimalHours(localHour)) {
  const delayMs = proposedTimeMs - Date.now();
  return Math.max(0, delayMs);
}
```

3c. Update the two doc comments so they don't lie about the new behaviour:

- In the banner (lines 219–225), append one bullet: `// - Commute dead zone (post-event only): 4 PM - 7 PM sends defer to 7 PM`
- In the `adjustToOptimalSendTime` JSDoc "For POST-EVENT emails" section (line 263-264), add: ` *   - If proposed between 4 PM and 7 PM, defer to 7 PM the same evening`

- [ ] **Step 4: Run the file's full suite**

Run: `pnpm exec vitest run tests/server/jobs/booking-side-effects.test.ts`
Expected: PASS — both new tests plus all pre-existing ones. The existing review test (`end_at` 18:00Z → proposes 22:00 London → next-morning push) and the reminder-replacement test (pre-event mode) are untouched by the post-event-only branch.

- [ ] **Step 5: Commit**

```bash
git checkout -- next-env.d.ts 2>/dev/null; git add server/jobs/booking-side-effects.ts tests/server/jobs/booking-side-effects.test.ts
git commit -m "feat(jobs): defer commute-window review sends to the 7 PM evening peak

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Full verification sweep

**Files:**

- No new changes expected; fixes only if a check fails.

**Interfaces:**

- Consumes: all changes from Tasks 1–3.
- Produces: green targeted suites, clean typecheck/lint/governance, working tree with committed work only.

- [ ] **Step 1: Run every touched suite together**

Run: `pnpm exec vitest run tests/lib/restaurants/email-template-defaults.test.ts tests/server/emails/booking-review-email-render.test.ts tests/server/jobs/booking-side-effects.test.ts tests/server/restaurant-email-templates.test.ts`
Expected: PASS.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (If `next-env.d.ts` causes a `.next/dev/types` error, run `git checkout -- next-env.d.ts` and re-run.)

- [ ] **Step 3: Lint the touched files**

Run: `pnpm exec eslint lib/restaurants/email-template-defaults.ts server/emails/base.ts server/emails/bookings.ts server/jobs/booking-side-effects.ts`
Expected: no errors (repo lint skips `tests/`).

- [ ] **Step 4: Governance guard**

Run: `pnpm guard:micro-specs`
Expected: PASS (no micro-spec covers these files today; the guard confirms nothing drifted).

- [ ] **Step 5: Optional visual check of the star row**

If a visual check is wanted: start `pnpm dev` and use the dev template preview route (`src/app/(public)/dev/api/restaurant-email-template-preview/route.ts`) with `templateKey=review_request` for a venue whose `google_review_url` is set — stars appear above the CTA button; venues without a review URL show no star row (correct gating). Skip if running headless.

- [ ] **Step 6: Confirm clean tree**

Run: `git status --short && git log --oneline -4`
Expected: no unstaged changes (except possibly `next-env.d.ts` — restore it with `git checkout -- next-env.d.ts`), three feature commits on top.

---

## Explicitly out of scope (agreed follow-ups, do not build here)

- `{{occasion}}` variable (needs `booking_occasions` join + variable-map/editor changes).
- Per-star rating capture / redirect-tracking endpoint (would enable click analytics per rating; today all stars are plain links to the same URL).
- `email.opened` / `email.clicked` webhook statuses, the 72-hour second ask, and the GBP `newReviewUri` auto-populate — separate planned work.
- Any change to WhatsApp review content or Twilio templates.
