# [MEDIUM] Customer export can include formula-injection payloads from guest data

**File:** [`server/ops/customers.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/customers.ts#L122-L450) (lines 122, 123, 124, 450)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Customer history rows return customer name, email, and phone verbatim. The traced customer export route exports those fields through generateCSV, which does not neutralize spreadsheet formula prefixes. Because customer records are populated from guest booking/contact data, an attacker can store a name such as =HYPERLINK(...) and wait for staff to export the guests CSV, causing formula execution when opened in a spreadsheet application.

## Recommendation

Add CSV formula neutralization to the shared CSV generator or export accessors for all user-controlled customer fields, including values beginning with =, +, -, @, tab, or carriage return.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
