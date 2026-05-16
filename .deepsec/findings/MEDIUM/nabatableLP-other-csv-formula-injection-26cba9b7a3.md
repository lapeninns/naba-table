# [MEDIUM] Guest-controlled customer names flow into customer CSV export

**File:** [`server/ops/customers.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/customers.ts#L122-L450) (lines 122, 123, 124, 235, 236, 237, 450)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getCustomersWithHistory maps customer identity fields including name, email, and phone into records consumed by /api/ops/customers/export. Public booking creation upserts customer full_name from guest-supplied name, and the export route passes these records to generateCSV without formula neutralization. A guest can use a name beginning with a spreadsheet formula metacharacter, causing the exported customer CSV to execute a formula when opened by staff.

## Recommendation

Apply CSV formula neutralization in the shared CSV helper or customer export route before emitting customer-controlled fields, and add tests covering formula prefixes and leading whitespace/control-character variants.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
