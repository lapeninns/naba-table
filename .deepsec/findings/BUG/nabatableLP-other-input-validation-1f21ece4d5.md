# [BUG] CSV numeric cells accept trailing junk

**File:** [`server/menu/import.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/menu/import.ts#L207-L241) (lines 207, 241)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-input-validation`

## Finding

parseDecimalCell uses Number.parseFloat and parseIntegerCell uses Number.parseInt, both of which accept partial numeric prefixes. Values such as "12abc" or "10foo" are imported as 12 and 10 instead of being rejected. Because those parsed numbers then pass the Zod schema, malformed CSV data can silently corrupt prices, scores, nutrition fields, and modifier limits.

## Recommendation

Validate the entire trimmed cell before parsing, for example with strict decimal/integer regexes or Number(trimmed) plus a full-format check. Reject cells with any trailing or embedded non-numeric characters.
