# [HIGH_BUG] Availability save path depends on non-atomic replace operations

**File:** [`src/components/features/restaurant-settings/AvailabilityOccasionsCommandCenter.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/AvailabilityOccasionsCommandCenter.tsx#L196) (lines 196)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The command center renders the unified availability manager, whose save path calls operating-hours, service-period, and turn-band replacement APIs. The traced server implementations delete all existing rows for the restaurant and then insert replacements outside a transaction (`server/restaurants/operatingHours.ts`, `servicePeriods.ts`, and `turnBands.ts`). If an insert fails after the delete, the restaurant can be left with missing hours, service windows, or turn bands, breaking guest availability.

## Recommendation

Move each replace operation into a single database transaction/RPC that validates, deletes, inserts, and rolls back atomically on failure. Consider an advisory lock per restaurant during availability saves.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)
