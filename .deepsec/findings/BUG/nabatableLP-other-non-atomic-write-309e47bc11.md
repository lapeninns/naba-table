# [BUG] Restaurant and owner membership creation are not atomic

**File:** [`server/restaurants/create.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/create.ts#L197-L224) (lines 197, 216, 224)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-non-atomic-write`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createRestaurant() inserts the restaurant first, then inserts the owner membership. If membership creation fails, it attempts a best-effort delete of the restaurant but ignores any delete error. A delete failure or transient database issue can leave an active restaurant with no owner membership, making it public but unmanageable through normal tenant access.

## Recommendation

Create the restaurant and owner membership in one transactional RPC. If keeping application-side compensation, check and surface cleanup failures and avoid making the restaurant active until membership creation is confirmed.

## Revalidation

**Verdict:** true-positive

The current function still inserts the restaurant first and inserts the owner membership in a separate Supabase call. If the membership insert returns an error, the code attempts a compensating restaurant delete but does not inspect or surface the delete result. I found no transactional RPC or database wrapper used by createRestaurant, and the routes still call this helper directly. A failure after the restaurant insert but before a successful membership insert can therefore leave the restaurant row committed without an owner membership. Public restaurant queries use active restaurant rows, so such an orphan can become guest-visible while normal tenant management cannot reach it. I would downgrade this from HIGH_BUG to BUG because the user cannot directly control the membership insert fields; the concrete trigger is a DB/service failure or interrupted process rather than an adversarial cross-tenant primitive.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
