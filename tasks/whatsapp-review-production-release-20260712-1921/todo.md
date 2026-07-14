# Todo

- [x] Research and scope are current.
- [x] Plan is approved for the selected tier.
- [x] Implementation is complete inside scope.
- [x] Verification is complete and recorded truthfully.
- [x] Review or self-review is complete for the tier.

## Task 7A staging release candidate

- [x] Staging identity and environment contract were verified without exposing secrets.
- [x] Local notification, Worker, security, type, lint, governance, and formatting gates were run.
- [x] An isolated Cloudflare staging D1 was created, initialized, and read back.
- [x] Final Twilio template approval and provider-assigned categories were read back without PII.
- [x] The release guard matches the final approved post-visit review `_20260713_v3` definition.
- [x] Canonical staging database authentication is restored and Vercel Preview Supabase values are
      isolated from unchanged production/development values.
- [x] Supabase staging migration/list/SQL proof is complete through the review-ledger migration.
- [x] The user authorized staging-only historical replay; the Micro-Spec radius and safe runner were
      extended test-first with production/non-migration refusal.
- [x] Preserve 144 legacy drink items, 64 modifier groups, and 149 modifier options as exact JSON;
      prove 144 canonical items/extensions and lock archive access to service role.
- [x] Rerun `--include-all` after the archive/parity guard; all 17 versions are now aligned.
- [ ] Drift proof remains blocked independently because the remote-only baseline cannot build the
      local shadow database (`public.restaurants` is absent at the second historical migration).
- [x] Cloudflare staging Worker deploy and version readback succeeded after the bounded retry.
- [x] Staging Worker authenticated-create and GET redirect smoke passed; the disposable row was
      cleaned.
- [x] Configure approved sender/SIDs on the release-branch Preview, deploy the staged app, and prove
      `/api/health` returns 200 with the staging database connected.
- [x] Remove the retired test phone from staging through a production-refusing transaction and prove
      production already contains no matching phone value.
- [x] Read production migration history; only `20260712204500` remains pending.
- [ ] Merge the CI-green release, apply the single production ledger migration, configure production
      app/Worker SIDs, and verify the first eligible real-guest lifecycle/review processing.
