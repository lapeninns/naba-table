# Review Pass 2: Bookings Hub

## Coverage Verdict

- insufficient: pass-1 fixed the biggest structural misses, but the hub still leaves one real guest entry path and some source-of-truth card copy unpinned, so meaningful frontend drift could still satisfy the current section.

## Remaining Gaps

- The direct `Sign in` CTA on `/bookings` still has no behavioral assertion. VAL-HUB-003 only proves the button is visible; nothing in VAL-HUB-001 through VAL-HUB-006 verifies that it still links to `/auth/signin?redirectedFrom=/bookings`, so a broken or altered return target could slip through hub coverage.
- VAL-HUB-002 and VAL-HUB-003 both claim each card “keeps its current supporting text,” but their evidence only names the headings, visible actions, and `/restaurants` destination. The actual supporting paragraphs and the `Browse restaurants` CTA label are still not explicitly asserted, so card-copy drift remains under-covered.

## Optional Tightening

- Extend VAL-HUB-002 evidence to assert `Find a restaurant, pick a date and time, and confirm your reservation.` and the visible CTA label `Browse restaurants`, not just the card title plus destination URL.
- Extend VAL-HUB-003 with either a direct click assertion for `Sign in` to `/auth/signin?redirectedFrom=/bookings` or an explicit sign-in link-target check, and pin the current supporting copy `Sign in to see your upcoming and past bookings, or make changes where available.`
- If the “guest shell” wording in VAL-HUB-001 needs to stay, make the evidence observable by naming shared chrome such as the guest navbar/footer rather than leaving shell verification to screenshots alone.

## Evidence

- `validation-contract.md:10-18` says VAL-HUB-002/003 preserve each card’s “current supporting text,” but the listed evidence only requires `visible-text(\`Book a table\`)`, `visible-text(\`Manage bookings\`)`, `visible-actions(\`View my bookings\`,\`Sign in\`)`, and the `/restaurants` click result.
- `src/app/(public)/bookings/page.tsx:40-50` defines the book card’s full source-of-truth UI as `Book a table`, `Find a restaurant, pick a date and time, and confirm your reservation.`, and the CTA label `Browse restaurants`.
- `src/app/(public)/bookings/page.tsx:60-78` defines the manage card’s current supporting copy and the direct sign-in target `Link href="/auth/signin?redirectedFrom=/bookings"`, but no VAL-HUB item currently asserts that hub-specific sign-in handoff.
- `validation-contract.md:20-26` covers only the `View my bookings` path in signed-out and signed-in states, confirming that the alternate hub entry CTA is still uncovered behaviorally.
- `src/app/(public)/bookings/layout.tsx:1-4` and `src/components/layouts/GuestLayout.tsx:12-16` show the hub’s shell requirement is implemented through `GuestLayout`, `GuestNavbar`, `main`, and `Footer`, which is stronger than the current screenshot-only shell evidence in VAL-HUB-001.
