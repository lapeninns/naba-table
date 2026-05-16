# [MEDIUM] Menu import reads arbitrary uploaded CSVs into memory without size or rate limits

**File:** [`src/app/api/ops/restaurants/[id]/menu/import/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/menu/import/route.ts#L26-L65) (lines 26, 40, 47, 65)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-resource-exhaustion`

## Finding

After auth, the handler accepts multipart files and calls File.text() on up to three uploaded files, then parses and applies the import without an application-level file size cap, row cap, or rate limit. A compromised admin account can send very large or repeated imports to consume memory, CPU, and database work.

## Recommendation

Enforce Content-Length/File.size limits, CSV row limits, and per-user/per-restaurant rate limits before reading files. Prefer streaming parsing for larger imports.
