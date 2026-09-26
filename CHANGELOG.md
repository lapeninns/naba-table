# Changelog

All notable changes are recorded here by Release Please from Conventional Commit history.

## Unreleased

### Changed

- Align the design-token layer with the Radix Luma brand spec: fluid display/headline type with inverse tracking, 14px/600 buttons with tactile press and 30% focus rings, tinted (never filled) destructive buttons, shadow-free resting cards, pill badges and status pills, plus new spacing, hero-rhythm and layout tokens. Retire the dead `--guest-*` and dark-only legacy aliases, regenerate `docs/tokens.json` from the stylesheet, and rewrite the token reference.

### Fixed

- Skip impossible email-pattern matches when Worker evidence strings contain no ASCII `@`, preserving redaction behavior and the existing oversized-evidence size limit and test timeout.
- Recover confirmed bookings without table assignments after inline assignment timeouts. Keep retries alive after the booking response, recheck tenant-scoped allocation and lifecycle state before each attempt, share creation idempotency across retries, preserve winning allocations on ambiguous confirmation failures, and record the interrupted assignment stage.

- Confirm unbound table holds atomically while retaining conflict locks and restoring the lease on failure. Show Google Business drift and dual-sync controls only for a linked account and location; preserve consumed OAuth states in regression coverage without rewriting applied migration history.

- Qualify the review scheduler hash function and persist booking-completion scheduling jobs with fenced retries, truthful cron failures and review-email deduplication. Add tenant-scoped historical recovery without automatic backfill.

- Create staff table holds through one atomic RPC and enforce live hold conflicts in database mutation paths. Keep the hold-window projection synchronized and release booking holds during terminal cleanup. Add deployed contention and persisted out-of-order SMS callback proofs.

- Release manual table assignments atomically with their allocation and idempotency state, allowing fresh-key reassignment while preserving partial merge groups, tenant boundaries and service-role-only RPC access. Add rollback SQL coverage for partial, final, repeated and legacy-wrapper releases.
- Recognize authenticated Supabase CLI temporary pooler roles in exact-project database safety validation.

### Added

- Record sanctioned protected-main Git delivery and add read-only post-deployment verification of customer-service health and source revisions, with a shared strict engine, an optional hourly Cloudflare observer, and an opt-in hosted executor.

- Support project-scoped Vercel automation protection credentials for the staging email consumer and exact-origin operational probes, without following redirects or weakening application authentication.

- Exercise synthetic guest recovery and cancellation, cross-tenant recovery denial and authenticated membership isolation, email queue persistence and deduplication, and exact SMS preview contracts in staging. Keep protection credentials scoped to staging web origins and disable credential-bearing traces.

- Apply Vercel `--skip-domain` only to production; custom staging deployments use their isolated environment aliases.

- Verify Resend webhook signatures locally without requiring an email-sending API key at build time. Preserve raw-body and timestamp verification for isolated staging.

- Record the isolated Vercel staging project and custom environment, enabling full environment-separation validation. Document the owner's choice to use provider health checks without an external alert service.

- Disposable Lima instance names now fit macOS socket limits under longer current-user CI paths, retaining deterministic retry identity and the private CI home.

- Private CI source fetches now use repository-scoped, read-only CI App installation tokens from Keychain, with identity checks, per-fetch revocation and credential-free guest bundles.

- Explicit current-user Mac runner setup alongside the dedicated-account default, with UID checks, private CI paths, isolated Lima/Docker state, ambient-environment clearing, and a `--no-start` staging option. This mode shares the existing macOS user security boundary; golden-image provisioning and qualification remain in progress.

- Golden image provisioning now handles Docker's blob CDN, applies daemon isolation before network creation, builds through the restricted job proxy, and removes the loopback build registry on failure as well as success, and exports both Lima disk layouts. A shared root-owned Corepack cache makes pinned pnpm available offline to non-root jobs.
- Mac runner preparation: pinned Ubuntu and Docker inputs, Node 22 service-account PATH, and provisioning checks that distinguish unresolved configuration from intentional rejection patterns.

- Content-bound Gitleaks review records for independently reviewed pre-existing false positives; changed source blobs and malformed scanner reports fail closed. Fixed the introduced synthetic Resend fixture without suppressing its finding.

- Local-first CI/CD: shared CI contracts and profiles (`scripts/ci/contracts`, `scripts/ci/profiles`, `config/ci/*`), the Mac controller (`pnpm ci:controller`), the disposable-VM executor (`pnpm ci:executor`), Lima/Docker/launchd infrastructure under `infra/local-ci/`, and the hosted release-gate bridge (`pnpm ci:gate`, `pnpm ci:contracts:validate`) with `release-gate.yml`, `hosted-profile-fallback.yml`, `fork-profile.yml` and `deploy.yml` (`Protected delivery`).
- `cloudflare/operational-control`: fourth Worker acting as the CI/monitoring control plane (GitHub webhook verification, coalesced gate dispatch, controller heartbeats, readiness probes, incidents, R2 evidence).
- Readiness endpoints (`GET /api/ready`, Worker `GET /ready`) authenticated with `MONITORING_TOKEN`, `config/observability/monitoring.yaml`, hourly `pnpm ops:verify` (`operational-verification.yml`), `pnpm ops:slo-evidence`, and incident deduplication in the error-insight webhook.
- Staging separation and delivery scripts: `env.staging` blocks for every Worker, `pnpm deploy:validate-separation`, `deploy:staging-lock`, `deploy:vercel:prebuilt`, `deploy:vercel:promote`, `deploy:workers`, `pnpm e2e:staging` (staging proof pack), `pnpm release:manifest` and `pnpm release:sbom` (CycloneDX 1.5).
- Database promotion safety: `pnpm db:plan-remote`, `db:sql-regression`, `db:check-migration-immutability` (`config/db/migration-checksums.json`), guarded `db:backup` and `db:restore-verify`, extended drift inventory.
- Backup and recovery: encrypted independent backups (`backup.yml`, every 12h), restore drills with signed evidence (`recovery-drill.yml`, `pnpm recovery:drill`, `pnpm recovery:evidence:check`), Cloudflare D1/KV/queue recovery tooling (`pnpm recovery:d1-backup`, `recovery:kv-rebuild`, `recovery:queue-reconcile`), `config/recovery/*` and `docs/runbooks/recovery.md`.
- Documentation: `docs/ci/local-first-ci.md`, `docs/ci/release-gate.md`, `docs/ci/governance.md`, `docs/runbooks/{local-ci,staging-release,monitoring,recovery}.md`.

### Changed

- Preserve the Supabase RPC client receiver when atomically removing table assignments, fixing operator unassignment failures before database access. Verify reassignment and terminal booking transitions with a genuine synthetic operator session.

- Route the ops app through an exact configured HTTPS origin, keep Supabase and CSRF cookies host-only on Vercel aliases, and bootstrap staging browser protection with separately scoped secure cookies. Preserve complete Vercel hostnames instead of inventing a `www` canonical alias.

- Route operational readiness probes through Cloudflare public Worker endpoints with `global_fetch_strictly_public`, covering same-account Worker destinations.

- Bind the public source SHA explicitly into the Vercel deployment runtime so readiness can verify prebuilt artifacts; retain exact-revision rejection. Sanitize Playwright transport errors before authenticated staging requests reach reports.

- Return per-job outcomes from the authenticated email-processing callback so the Cloudflare consumer can complete successful jobs. Call monitoring fetch without an object receiver so native Cloudflare requests reach their targets.

- Record verified staging short-link D1 and dedicated KV resources and the Cloudflare Worker subdomain. Placeholder-rejection tests now use explicit fixtures so provisioning cannot remove their coverage.

- CI evidence collection now records unsupported object names before upload and includes operational-control Worker reports, preserving the strict R2 key policy and complete Worker results.

- Executor jobs now keep home and the pnpm store on a disposable writable volume outside the source checkout, preserving the read-only container root and source-file checks.
- Job images include Python for admission-hook tests; executable temporary fixtures use job-home storage while `/tmp` remains `noexec`. CI test fixtures now handle Linux home paths and offline package-manager isolation.

- Record verified Nabatable CI repository, App, and workflow identities while retaining the unqualified-image release block. Document the approved bucket-scoped R2 evidence permission exception.

- PR hosted-lane failures now trigger an explicit Release gate refusal, with another gate dispatch after a newer hosted attempt completes.

- Error-insight incident counts and escalation state persist through service-role-only atomic Supabase updates; the new migration must be promoted before deploying the receiver.

- Security guards install checksum-pinned Gitleaks and TruffleHog; the five pre-existing CodeQL baseline alerts now link to review issues.
- Operational incident acknowledgement uses a dedicated bearer token; monitoring no longer requires a legacy execution workflow scheduled for Phase 4 retirement.

- `sms-summary-gateway` honours `DELIVERY_MODE=sink` (staging kill switch); staging Workers never deliver to providers.
- Legacy hosted suites (`test-suite.yml`, `e2e-smoke.yml`, `test-stability.yml`, `shadcn-primitives.yml`) carry removal headers; their required-check names are now mirrored by the release gate.
- `config/observability/monitoring.yaml` names `operational-verification.yml` as the hourly verifier; `RESTORE_VERIFY_DB_URL` is the single name for the drill's scratch DB URL.
- `deploy:workers` and `deploy:validate-separation` enumerate `operational-control`; lowercase `replace-me-*` R2 bucket placeholders are treated as unconfigured.

## [0.2.0](https://github.com/lapeninns/naba-table/compare/v0.1.0...v0.2.0) (2026-09-26)


### Features

* add delivery log retry actions ([4211669](https://github.com/lapeninns/naba-table/commit/4211669d9e4ce5969405d1a8552fcb653eb85b62))
* add delivery log retry actions ([4478dff](https://github.com/lapeninns/naba-table/commit/4478dff13d0eef51230d326f533d32bb78586d15))
* add email delivery auto refresh ([f9d50cc](https://github.com/lapeninns/naba-table/commit/f9d50cc9bff41c467a6d8790e1e2e5abb3a435c8))
* add email delivery auto refresh ([2ae48b5](https://github.com/lapeninns/naba-table/commit/2ae48b51fe928739fa72b8b6d4b4c1b9c259f468))
* add email delivery retry endpoint ([e28d472](https://github.com/lapeninns/naba-table/commit/e28d4725ce8a2e711b4537e1827de6131c43e451))
* add email delivery retry endpoint ([7eec49d](https://github.com/lapeninns/naba-table/commit/7eec49d4a286e868e7ea511f7d60f41a72f05455))
* add independent email delivery analytics summary ([344f5d7](https://github.com/lapeninns/naba-table/commit/344f5d78877b13f3d6d7f6fe2490bdebfddf6499))
* add independent email delivery analytics summary ([829cf6d](https://github.com/lapeninns/naba-table/commit/829cf6d1d52a6efda69a4973e88e86d4598b2cd4))
* add isolated hourly deployment observation on Cloudflare ([4228ccb](https://github.com/lapeninns/naba-table/commit/4228ccb5092633cad7b02df256d60bcd58ab68e1))
* add menu management and GBP business sync ([ad46b11](https://github.com/lapeninns/naba-table/commit/ad46b11478766991b8ddb89148de447fc0e2587b))
* add opt-in Sunday Roast bookings ([60d4a38](https://github.com/lapeninns/naba-table/commit/60d4a389fd77179956a7bec9fef7d234e34d4c16))
* add sms delivery observability ([72478fd](https://github.com/lapeninns/naba-table/commit/72478fd2f5ad627f597bea7824e82eedf41c0beb))
* add sms delivery observability ([a71f38d](https://github.com/lapeninns/naba-table/commit/a71f38dfbb55fa0839e6035234deb22a65b24292))
* add tracked WhatsApp-first review growth engine ([#130](https://github.com/lapeninns/naba-table/issues/130)) ([f522339](https://github.com/lapeninns/naba-table/commit/f522339d63500e4d17e86f8f5343805a576a86e2))
* backfill sms delivery history from twilio ([2dc6005](https://github.com/lapeninns/naba-table/commit/2dc6005369957e35c03fa89106dc6fa14f1af754))
* backfill sms delivery history from twilio ([edcad86](https://github.com/lapeninns/naba-table/commit/edcad86aab554b3a9ece3fded9af620474008f69))
* **booking:** align restaurant thank-you surface ([7547aea](https://github.com/lapeninns/naba-table/commit/7547aead513926b6bbfd153dfaf8f31c4d03f615))
* **booking:** align wizard loading and offline states ([594d919](https://github.com/lapeninns/naba-table/commit/594d919f7ee0b698614756997851639b66e66d5f))
* **booking:** clarify guest details hierarchy ([8105f58](https://github.com/lapeninns/naba-table/commit/8105f58db00eac7d6e962ada5caee1aed6f6d2e0))
* **booking:** clarify wizard progress and action rail ([c6fe066](https://github.com/lapeninns/naba-table/commit/c6fe0664dd992bf98aaa53fd38e08ae16c4997f0))
* **booking:** flatten wizard step surfaces ([fb34c14](https://github.com/lapeninns/naba-table/commit/fb34c14306e219a47d546ffee0f6dd211b466413))
* **booking:** integrate responsive wizard shell ([78b9c64](https://github.com/lapeninns/naba-table/commit/78b9c64f08f3c6ebb0f3c1aeb283da2fedc289bc))
* **booking:** prioritize confirmation reference ([13e35e6](https://github.com/lapeninns/naba-table/commit/13e35e6bc685655ebbfb19dae6c9d89337b39492))
* **booking:** redesign plan selection layout ([4df3caa](https://github.com/lapeninns/naba-table/commit/4df3caa9504c50aae0f80832ce8416f52e3d3bf1))
* **booking:** redesign review summary ([847d5a7](https://github.com/lapeninns/naba-table/commit/847d5a766bfeb40d6a9e69457b9696928d440aa5))
* **booking:** simplify responsive wizard layout ([856bbcd](https://github.com/lapeninns/naba-table/commit/856bbcdefc0c7786f7bf0770e893d3c6f748318c))
* **ci:** add local-first CI/CD control plane, protected delivery, and recovery tooling ([267deb8](https://github.com/lapeninns/naba-table/commit/267deb832b202fdced73345bca309b8295b71cad))
* **ci:** observe protected-main Git deployments ([13eff12](https://github.com/lapeninns/naba-table/commit/13eff12a579afaeb362b643f206949c8a36d8c54))
* **ci:** provision identities and qualify disposable self-hosted runners ([5738814](https://github.com/lapeninns/naba-table/commit/5738814154819fec1f93acb85db585c0da69a61c))
* **ci:** qualify isolated Actions runners and private source fetches ([6ce6338](https://github.com/lapeninns/naba-table/commit/6ce6338ead57d3009e44c6879042dec630561f2d))
* **ci:** stage Mac runner under an existing macOS user ([#139](https://github.com/lapeninns/naba-table/issues/139)) ([cbf101e](https://github.com/lapeninns/naba-table/commit/cbf101e897cb8c108181a11a727b42c1da2e4820))
* consolidate ops settings navigation and availability workflows ([6fc4334](https://github.com/lapeninns/naba-table/commit/6fc433419ef47028c2c23bec55290185599ec9d8))
* **design-system:** align tokens and primitives with the Luma spec ([b81a228](https://github.com/lapeninns/naba-table/commit/b81a22814bfc525a7b3e02d410d152d7e9623ff0))
* **email:** monthly venue report cron ([8a8691c](https://github.com/lapeninns/naba-table/commit/8a8691c28493c9aa6e87ea8ab9952137183f621b))
* **email:** one-click List-Unsubscribe + email-keyed suppression with transactional/marketing split ([#82](https://github.com/lapeninns/naba-table/issues/82)) ([d9f544b](https://github.com/lapeninns/naba-table/commit/d9f544b1c56ea31f0893024b2985652377911587))
* **floor-plan:** live floor plan with data and mutation hooks ([#177](https://github.com/lapeninns/naba-table/issues/177)) ([59d949a](https://github.com/lapeninns/naba-table/commit/59d949af55253a536e46a132a2eb439cda75d04f))
* **gbp:** harden synchronization end to end ([aac7268](https://github.com/lapeninns/naba-table/commit/aac726800dba05568774d40ad4a8049f405d5804))
* manage restaurant booking email templates ([5963c8f](https://github.com/lapeninns/naba-table/commit/5963c8f3a545c8a76d7d474d6d5a57365cc79507))
* manage restaurant booking email templates ([78801c6](https://github.com/lapeninns/naba-table/commit/78801c6cc9e3e4ce5fa7318763754931d4a3cb57))
* **mutations:** one reliable mutation architecture (audit implementation) ([#181](https://github.com/lapeninns/naba-table/issues/181)) ([f7eb958](https://github.com/lapeninns/naba-table/commit/f7eb958d56e400b86baf5a089981f3f692e4b478))
* **ops:** live service-view floor plan + remove legacy floor-plan code ([#81](https://github.com/lapeninns/naba-table/issues/81)) ([31de56c](https://github.com/lapeninns/naba-table/commit/31de56c6a2e97a3c9c4db137644077994f3b8b51))
* **platform:** reach Factory Level 5 readiness ([#97](https://github.com/lapeninns/naba-table/issues/97)) ([954873d](https://github.com/lapeninns/naba-table/commit/954873d242e87acd25ca1cc22d1b45507946aa22))
* qualify production deployment observation ([60dd7f6](https://github.com/lapeninns/naba-table/commit/60dd7f657c867af156044ec592c79392bd31f5cb))
* **reviews:** add tracked WhatsApp-first growth engine ([c4e3cf9](https://github.com/lapeninns/naba-table/commit/c4e3cf9e4606ac5f18ed980710c892eed66c96b4))
* **settings:** restaurant settings redesign, tables room view, perf and data-hook fixes ([#176](https://github.com/lapeninns/naba-table/issues/176)) ([86657bf](https://github.com/lapeninns/naba-table/commit/86657bffeb499fbe1bac061dc40232a28c91a82e))
* **settings:** restyle the Google Business Profile status pill to match the GBP page ([#183](https://github.com/lapeninns/naba-table/issues/183)) ([4d38c8a](https://github.com/lapeninns/naba-table/commit/4d38c8a07ffed927d1dc0c841a1df880ebb07212))
* **settings:** sidebar regroup, email templates and Google Business Profile redesigns ([#180](https://github.com/lapeninns/naba-table/issues/180)) ([d923f36](https://github.com/lapeninns/naba-table/commit/d923f3605ac6aac325b38d5548914d5f699c7a96))
* ship booking sms and short link improvements ([72865dc](https://github.com/lapeninns/naba-table/commit/72865dc0f7285891577a81e67e12f84bb1a9e820))
* ship booking sms and short link improvements ([b3fd613](https://github.com/lapeninns/naba-table/commit/b3fd613295d30619e1f51c5b18ffb28d71c544da))
* surface operating-hours notes in booking advisory ([2dbdce2](https://github.com/lapeninns/naba-table/commit/2dbdce280a8ec516d03ac57fd42c063dc953e980))
* surface operating-hours notes in booking advisory ([97fc86f](https://github.com/lapeninns/naba-table/commit/97fc86f7dc5ff4e9e9d1a7a2be001b9206506718))
* tighten manager daily summary sms copy ([3b56287](https://github.com/lapeninns/naba-table/commit/3b562879fd02e308b5a6bf6a182ae1db2b7a16c1))
* tighten manager daily summary sms copy ([42c3050](https://github.com/lapeninns/naba-table/commit/42c3050ba8007394d2c2148ea08fcaeab9d7630f))


### Bug Fixes

* address ops booking card review follow-ups ([2e34171](https://github.com/lapeninns/naba-table/commit/2e34171236602dc4355ca0349d1e86ecaf1a3f67))
* address ops booking card review follow-ups ([b92b6bf](https://github.com/lapeninns/naba-table/commit/b92b6bf914ce87ac069bdd629baffad2f149096c))
* align email delivery retry ids and refresh coverage ([c747360](https://github.com/lapeninns/naba-table/commit/c7473606f4c05d9de53e1864b6f58746f2db84d1))
* align email delivery retry ids and refresh coverage ([40d6957](https://github.com/lapeninns/naba-table/commit/40d6957afbb4238aa9abd48c7ef35d901013d5f1))
* align retry fixture success with live restaurant access ([51051ac](https://github.com/lapeninns/naba-table/commit/51051aca54fb35b46579f8255eb0609734c4e044))
* align retry fixture success with live restaurant access ([c3010a4](https://github.com/lapeninns/naba-table/commit/c3010a49021c43b040cb8ede1fdf072472491216))
* append app link to manager daily summary sms ([14e4a2d](https://github.com/lapeninns/naba-table/commit/14e4a2d6dd0d00e132056cf9064e77e438ebdd9c))
* attribute deployment observation failures to their step ([46a0829](https://github.com/lapeninns/naba-table/commit/46a082934770e21d6a3331f875177de90fb8f953))
* **auth:** stabilize app-host routing ([4b693b0](https://github.com/lapeninns/naba-table/commit/4b693b045c201a497f52d15a86fb4752a6a1753b))
* avoid oversized evidence redaction timeouts ([983a27e](https://github.com/lapeninns/naba-table/commit/983a27eb48c65d9cb7f612cfe4f274011ce5b527))
* bind booking lifecycle RPC calls ([b924d2f](https://github.com/lapeninns/naba-table/commit/b924d2fb822a28bf287bdc46adb45bd3990f8007))
* **booking:** compose consent privacy links ([0ecdd26](https://github.com/lapeninns/naba-table/commit/0ecdd26a376c40feb97c825310fc4737736d34ec))
* **booking:** dismiss summary on escape ([56eb90b](https://github.com/lapeninns/naba-table/commit/56eb90b0f20ad04adcfb179895fde34dd8a543e1))
* **booking:** enforce reference label contrast ([1c1e5cd](https://github.com/lapeninns/naba-table/commit/1c1e5cd949567fd90bd10e1c2c8a6dc84057cf6f))
* **booking:** improve dark wizard CTA contrast ([7e41041](https://github.com/lapeninns/naba-table/commit/7e4104132e23df5da6070125b7392b76812531b3))
* **booking:** increase reference label contrast ([d6c12a1](https://github.com/lapeninns/naba-table/commit/d6c12a14057ab4c371ccd2f9dea58bade758fc5b))
* **booking:** inherit wizard surface density ([fd9c6ae](https://github.com/lapeninns/naba-table/commit/fd9c6ae8dd08ffab8c2baf938fdab0b841690c18))
* **booking:** keep confirmation content above rail ([e55f2f9](https://github.com/lapeninns/naba-table/commit/e55f2f9e46e639233ef79a707b0d3949c6a2a307))
* **booking:** keep focused controls above rail ([cf44038](https://github.com/lapeninns/naba-table/commit/cf440381d772735293d701dd7abe428f5690303e))
* **booking:** recheck focus after layout settles ([a71f649](https://github.com/lapeninns/naba-table/commit/a71f649856ce06e69490ea70754105e05d548cdc))
* **booking:** recheck focus after panel transition ([c70f9b9](https://github.com/lapeninns/naba-table/commit/c70f9b9094ffede620d9d82cbd899e7b6b6b531c))
* **booking:** reserve trailing focus clearance ([eea59b4](https://github.com/lapeninns/naba-table/commit/eea59b485ad697b8e749218cb1ad4418fb06b91c))
* **bookings:** observability + guest copy for customer contact conflicts ([255cf54](https://github.com/lapeninns/naba-table/commit/255cf54287869613c13ffe424bc13bf11142ecf0))
* **bookings:** recover confirmed bookings without tables ([#160](https://github.com/lapeninns/naba-table/issues/160)) ([e039f37](https://github.com/lapeninns/naba-table/commit/e039f37da803a811da1bebf85ce7ea1b949e56a1))
* **bookings:** store WhatsApp consent phone as strict E.164 ([e8573fd](https://github.com/lapeninns/naba-table/commit/e8573fdcf4f81f5eb6967dc871d8af3d609b2b41))
* **booking:** strengthen party size label contrast ([68c7f77](https://github.com/lapeninns/naba-table/commit/68c7f77499842cb0f717d4e2d2f8645ef9d896c0))
* **booking:** use actual rail focus boundary ([8a67ff7](https://github.com/lapeninns/naba-table/commit/8a67ff777e873a4c9f242fcda1e9bc6dfa058c8d))
* **ci:** address Codex review on readiness revision, manifest coverage and gate trigger ([0debef0](https://github.com/lapeninns/naba-table/commit/0debef0c8a0b5bba9c1536b4af79fcf9867451b5))
* **ci:** align evidence collection with strict upload paths ([220ce39](https://github.com/lapeninns/naba-table/commit/220ce397313574ec2c468baf616ee62a773498b8))
* **ci:** baseline five pre-existing CodeQL error-level alerts with review records ([539ed0d](https://github.com/lapeninns/naba-table/commit/539ed0d0156dfb6731d29a91533d6a20c5c18d7d))
* **ci:** bind reviewed Gitleaks findings to source content ([64342bc](https://github.com/lapeninns/naba-table/commit/64342bc56b9a98cf1d20d622838dcae5fea0e031))
* **ci:** bound Lima socket paths without relocating CI home ([f89a73d](https://github.com/lapeninns/naba-table/commit/f89a73d567738fb25b2411846c126a510af5f39c))
* **ci:** clear development dependency audit ([f47157b](https://github.com/lapeninns/naba-table/commit/f47157be92cb63b501c91a0ad1f57b65eaff0f42))
* **ci:** isolate job home from source checkout ([c88bf22](https://github.com/lapeninns/naba-table/commit/c88bf2247e53a8c85e955a8012c1795fb74c491f))
* **ci:** keep pnpm runtime store in writable job workspace ([7818c6a](https://github.com/lapeninns/naba-table/commit/7818c6ad81ad84ec9658246b27c32610505034db))
* **ci:** persist incidents and recover failed hosted gate attempts ([88e8b7c](https://github.com/lapeninns/naba-table/commit/88e8b7c589771e17ebade97daa21cf88b8844a34))
* **ci:** qualify runner transport against the golden firewall ([bd55aee](https://github.com/lapeninns/naba-table/commit/bd55aee9e542d6cda8ab64b66796e2f3502e1009))
* **ci:** support isolated Linux test runtime and executable fixtures ([31d4300](https://github.com/lapeninns/naba-table/commit/31d4300485795feb6406549cc692e425e0aa69d5))
* close retry dialog before feedback ([d6a203e](https://github.com/lapeninns/naba-table/commit/d6a203e66bda17f553862b7f418a36e19913295c))
* close retry dialog before feedback ([b78274a](https://github.com/lapeninns/naba-table/commit/b78274aca7e6f453c6f99eef2b03051c40006ab6))
* confirm unbound holds and complete GBP settings [skip ci] ([f3f6bc2](https://github.com/lapeninns/naba-table/commit/f3f6bc2e15d2c670d646c2a30b2c71c859879eaf))
* **db:** govern production historical replay ([4ad85e1](https://github.com/lapeninns/naba-table/commit/4ad85e1efe88052afc11f4e67877d31668cbe28d))
* **db:** record 20260905113000_durable_operational_incidents in the migration checksum baseline ([538d0ed](https://github.com/lapeninns/naba-table/commit/538d0ed6655ed6b07ff70e49f244285a11ab9dee))
* **db:** track GBP profile lineage repair ([39fe76a](https://github.com/lapeninns/naba-table/commit/39fe76a5af0e066a0e14e40159163845f5af3a85))
* deepsec remediation — auth hardening, secret scan, restaurant settings, QA coverage ([6abe47a](https://github.com/lapeninns/naba-table/commit/6abe47a6cae734fdf34b1adb6abda57447bd21ed))
* **email:** add plain-text part to monthly venue report ([15c5b1d](https://github.com/lapeninns/naba-table/commit/15c5b1dbf305ceed7563c95dcd4bc4329d165b6f))
* **email:** restore confirmation notifications ([b6f3551](https://github.com/lapeninns/naba-table/commit/b6f3551aa004c27a713eaff188c46e2e70958f92))
* enable node compatibility for sms summary worker ([502e358](https://github.com/lapeninns/naba-table/commit/502e3585227e84a8d3da16369261a099c9756625))
* expose harness restaurant switcher and queue validation path ([38dfb27](https://github.com/lapeninns/naba-table/commit/38dfb27325a8b87d5dce811f55ced01e66b4e139))
* expose harness restaurant switcher and queue validation path ([470807b](https://github.com/lapeninns/naba-table/commit/470807b7a9737eb745bc1f3f33d4479681d2b5a9))
* fetch email queue on tab activation ([e7c0700](https://github.com/lapeninns/naba-table/commit/e7c0700c5a120c7070756321c87f3f2d2d40c292))
* fetch email queue on tab activation ([0ef246f](https://github.com/lapeninns/naba-table/commit/0ef246fcd2cb319ab186a1096f9a479afba97e31))
* finalize email intent cutover and retry stale hold conflicts ([45ed6ee](https://github.com/lapeninns/naba-table/commit/45ed6ee98e374ff6f469d6d1b83ce3d46ce83428))
* finalize email intent cutover and retry stale hold conflicts ([b387ac9](https://github.com/lapeninns/naba-table/commit/b387ac989d12be2f422c1bb2492966ec58a04822))
* **floor-plan:** complete responsive service view ([c78b9be](https://github.com/lapeninns/naba-table/commit/c78b9bec753a128ad82109cc198865db7a08e040))
* **gbp:** reconcile tracked inventory surfaces ([8a914f3](https://github.com/lapeninns/naba-table/commit/8a914f3838b53dc318b5474a5b50786642665237))
* **gbp:** repair digest function search paths ([05be1e7](https://github.com/lapeninns/naba-table/commit/05be1e7412d841f58cba75c5f5a39b653db8a5fc))
* handle retry fixture fallbacks ([cf5eaef](https://github.com/lapeninns/naba-table/commit/cf5eaefc94858a80dcd4af9d9f22e80a5c5e0c22))
* handle retry fixture fallbacks ([d5411e5](https://github.com/lapeninns/naba-table/commit/d5411e5f88c6ae00bc1bc585f489b82b096ebaae))
* keep queue loading visible on fast fetches ([5708460](https://github.com/lapeninns/naba-table/commit/570846082329b29e8fbfe6a8deb2719a7254bda9))
* keep queue loading visible on fast fetches ([d96a1d4](https://github.com/lapeninns/naba-table/commit/d96a1d4c0501abe11627868d01695c53db04543a))
* **marketing:** remove personal contact details from public site ([#172](https://github.com/lapeninns/naba-table/issues/172)) ([5bc2bd9](https://github.com/lapeninns/naba-table/commit/5bc2bd9094c1337e25ad72a83dd68b2e2fbec037))
* **mutations:** address PR [#181](https://github.com/lapeninns/naba-table/issues/181) review findings ([#182](https://github.com/lapeninns/naba-table/issues/182)) ([cb736f3](https://github.com/lapeninns/naba-table/commit/cb736f3fadc3218afa0fddd573cb9a5ca22ade15))
* **notifications:** canonicalize mobile recipient phone to strict E.164 ([d112e77](https://github.com/lapeninns/naba-table/commit/d112e778712fe3d201c6f4368d61460f93378bdb))
* **observability:** stop demand_profiles.label + sms_delivery_log errors flooding Postgres logs ([317c71f](https://github.com/lapeninns/naba-table/commit/317c71fe8b04824ef07864c589bb59f8a6c801b2))
* polish email queue tab presentation ([9c1ad1f](https://github.com/lapeninns/naba-table/commit/9c1ad1ff46159b292c6b7f70d33baeb7be86efbc))
* polish email queue tab presentation ([1568432](https://github.com/lapeninns/naba-table/commit/1568432adcfa2d9828deb41238f6fafccc12cf18))
* precheck booking capacity before guest create ([2c7ffc1](https://github.com/lapeninns/naba-table/commit/2c7ffc138c2845a5f05c662942332c8e42872c8b))
* precheck booking capacity before guest create ([0ba2628](https://github.com/lapeninns/naba-table/commit/0ba262860526307d6bdbd6670124902af6a35a88))
* prefer forced email delivery errors over stale loading ([88a7780](https://github.com/lapeninns/naba-table/commit/88a7780ba7c002ec42c2bc4c656107cb461c6dda))
* prefer forced email delivery errors over stale loading ([06fe100](https://github.com/lapeninns/naba-table/commit/06fe1007ec1298b213de745bf30f4861670755a2))
* preserve delivery log settled states on refetch ([c9a5988](https://github.com/lapeninns/naba-table/commit/c9a5988f46a4cbf3a45a7eb310dede253da75c74))
* preserve delivery log settled states on refetch ([7a66dcd](https://github.com/lapeninns/naba-table/commit/7a66dcde487c6b3c3afaaa091a8daf01afd1d58c))
* prevent duplicate menu creates and preserve GBP callback hosts ([f17c7dc](https://github.com/lapeninns/naba-table/commit/f17c7dc9c8c3268f9fcd65c03a63f5a3be0078b8))
* qualify booking transition status read ([4f406c2](https://github.com/lapeninns/naba-table/commit/4f406c28be65f8fa2dfcb33d39fd0fd63ea2b177))
* **reserve:** wizard step-hook null-guards + testable interval normalization ([#84](https://github.com/lapeninns/naba-table/issues/84)) ([9411bcd](https://github.com/lapeninns/naba-table/commit/9411bcde00f8929b0ec8fbeb330a9299911b9e50))
* resolve email suppression lookups via profiles ([b5b7ca1](https://github.com/lapeninns/naba-table/commit/b5b7ca1c8ef8304ebde6ecc8b6aa5f5a905181a2))
* resolve email suppression lookups via profiles ([6c58ea1](https://github.com/lapeninns/naba-table/commit/6c58ea133b3fd4b15a4574d4a50ecfcb913792ee))
* **restaurants:** stop section saves from clearing other profile fields ([b682aeb](https://github.com/lapeninns/naba-table/commit/b682aeb8aca8024fc47f7ff3d47bd09655c1ea79))
* restore db-backed ops customers pagination ([787b72a](https://github.com/lapeninns/naba-table/commit/787b72a1922d79e3943d23af36a1f21adc1a6191))
* restore db-backed ops customers pagination ([a48ac9f](https://github.com/lapeninns/naba-table/commit/a48ac9f15612418be885d6bed777d3493af7b55d))
* restore email delivery cross-area navigation ([dec9810](https://github.com/lapeninns/naba-table/commit/dec98107558a481b3adb1c5305279cf7a9c8395c))
* restore email delivery cross-area navigation ([5fbebbb](https://github.com/lapeninns/naba-table/commit/5fbebbbd59ba746271772d6900c8e5d3de01cf86))
* restore email queue drain cron ([457b10f](https://github.com/lapeninns/naba-table/commit/457b10f1bb6cb2d21ae0c1a1a73d92b41df87818))
* restore email queue drain cron ([ca9687e](https://github.com/lapeninns/naba-table/commit/ca9687e29a69bb355e1facdf567f7f992c30ac1d))
* restore guest magic link delivery ([c16ff8d](https://github.com/lapeninns/naba-table/commit/c16ff8dcdf9833152a5fe942183ac568e7cc8ea7))
* restore guest time Select UX, block past slots, and repair unassign_tables_atomic ([2f73132](https://github.com/lapeninns/naba-table/commit/2f73132d799048f44f121541e1506540a133fdfb))
* return 503 for transient dashboard membership failures ([de28a5b](https://github.com/lapeninns/naba-table/commit/de28a5b33357913c3bcc631fb1281355e6f5a3b0))
* return 503 for transient dashboard membership failures ([e6e14be](https://github.com/lapeninns/naba-table/commit/e6e14beefcc118468bebb7598477de4f3010a797))
* reuse existing dev harness server for playwright spec ([78acf4d](https://github.com/lapeninns/naba-table/commit/78acf4d0cefb642b7e6a7f81d0a0746c3e3c464e))
* reuse existing dev harness server for playwright spec ([f3aee7c](https://github.com/lapeninns/naba-table/commit/f3aee7caba5808cc6baad75f5c1f142619e84793))
* **reviews:** accept disabled webhook token config ([279d4f7](https://github.com/lapeninns/naba-table/commit/279d4f744a28d7f4113fd13fd6e02902bcc31273))
* **runtime:** repair review scheduling and atomic booking operations [skip ci] ([09de157](https://github.com/lapeninns/naba-table/commit/09de15797fe2850d312f8d3530a89a79b2c18839))
* **security:** keep secret-shaped test fixtures out of the built-in secret scan ([6a10d23](https://github.com/lapeninns/naba-table/commit/6a10d23a4c0cfa6c842fb8656e1be4b4229fcb4a))
* **security:** recognise monitoring bearer guard in service-role route check ([d5302f8](https://github.com/lapeninns/naba-table/commit/d5302f873eb019246dd18796dd5854a669b725dd))
* **security:** recognize reviewed webhook guards ([7a03d88](https://github.com/lapeninns/naba-table/commit/7a03d8852d72b98ade738d87e3b6f4a5acef99a3))
* **security:** remediate Codex security findings (RPC hardening + disclosure/integrity fixes) ([#80](https://github.com/lapeninns/naba-table/issues/80)) ([da51d12](https://github.com/lapeninns/naba-table/commit/da51d1225348698dbef7d651de626229dc93ca64))
* **security:** remediate production dependency audit ([9db3836](https://github.com/lapeninns/naba-table/commit/9db3836fba9c99741be50d6f8cae84794baae91a))
* separate an unreadable main from an unprotected main ([4d5e040](https://github.com/lapeninns/naba-table/commit/4d5e040ffd1ff36c6a4050d29814975997e23708))
* **settings:** keep section jump links highlighted after a jump ([#179](https://github.com/lapeninns/naba-table/issues/179)) ([a8dd6a3](https://github.com/lapeninns/naba-table/commit/a8dd6a337883792f6311d3cb9733e7f3bbc78227))
* **settings:** keep section jumps from scrolling the settings frame ([#184](https://github.com/lapeninns/naba-table/issues/184)) ([acf53d8](https://github.com/lapeninns/naba-table/commit/acf53d8416a46321e749bd4e9a28ae638c4c7425))
* **settings:** offer Reconnect when Google refuses access, and show unchecked listings honestly ([#185](https://github.com/lapeninns/naba-table/issues/185)) ([a4f2539](https://github.com/lapeninns/naba-table/commit/a4f253928090396ee0bb1e38d0a9dde31d26d4f1))
* short-circuit retry fixture success ([acd04df](https://github.com/lapeninns/naba-table/commit/acd04dfa1d52ebeb49e54e0118d8b346e6410f11))
* short-circuit retry fixture success ([fdc4eda](https://github.com/lapeninns/naba-table/commit/fdc4edafb3b6041a91c2460d0048c1c965caca4c))
* show queue refresh indicator with stale rows ([2111c03](https://github.com/lapeninns/naba-table/commit/2111c03232f02ad66c6dd4d47378851f8563fae7))
* show queue refresh indicator with stale rows ([39ac476](https://github.com/lapeninns/naba-table/commit/39ac47626be258fa109b40335884749dc7af87a1))
* stabilize email delivery dev harness validation ([aac4514](https://github.com/lapeninns/naba-table/commit/aac45145a2172b5deabf53721a6a1ad9aee7b77e))
* stabilize email delivery dev harness validation ([e243889](https://github.com/lapeninns/naba-table/commit/e243889008f9295cbd2d87c67eb10960f2a8c6bd))
* stabilize queue and analytics validation flows ([f473519](https://github.com/lapeninns/naba-table/commit/f473519a36bcf6fbea8fcdaf29fe0678626f879c))
* stabilize queue and analytics validation flows ([3cf8b21](https://github.com/lapeninns/naba-table/commit/3cf8b21105515f74a59af9e57fcf6b9cd7ade7f8))
* stabilize retry fixture success and queue loading marker ([41a0e3a](https://github.com/lapeninns/naba-table/commit/41a0e3a1fda5718e6e443335f3e3ef44bf1443e2))
* stabilize retry fixture success and queue loading marker ([465e501](https://github.com/lapeninns/naba-table/commit/465e501741bf8735716d92a7defb536ffc8e16e8))
* support validator email delivery error trigger ([18107b3](https://github.com/lapeninns/naba-table/commit/18107b368db78dd9777fdbea4ff7501783bb317f))
* support validator email delivery error trigger ([09c4fa6](https://github.com/lapeninns/naba-table/commit/09c4fa69d417d2b0fa17fbbd9d6957504ea0af39))
* sync authenticated email delivery state from URL ([81949bd](https://github.com/lapeninns/naba-table/commit/81949bd1e25f760c85ab0a3f094d2e22322b9658))
* sync authenticated email delivery state from URL ([da55073](https://github.com/lapeninns/naba-table/commit/da55073ae4ad71dcd546d4b4eeb633a7b6698375))
* sync email delivery tab content with URL updates ([d2ac2a3](https://github.com/lapeninns/naba-table/commit/d2ac2a3e1b5a97641634a39202161d494fef71e4))
* **test:** make migration census and review-ledger proofs deterministic on CI ([06c8541](https://github.com/lapeninns/naba-table/commit/06c85411b029db9e2e22319d03c5c76a0f25f9ff))
* tolerate cron timestamp offsets in deployment observation ([e29625c](https://github.com/lapeninns/naba-table/commit/e29625c41b468d25c065aa50e3b0a3c543c25bab))
* use a distinct reason for an absent minted token ([b022c9c](https://github.com/lapeninns/naba-table/commit/b022c9c95d27f2461bb82a4e16469ff25f55b7ab))
* use a redirect mode the Workers runtime accepts ([f35e243](https://github.com/lapeninns/naba-table/commit/f35e243cc7847da2f06f2f4dd00d4f0e9c47aa3c))
* wire email delivery follow-up fixtures through authenticated routes ([0dd29d8](https://github.com/lapeninns/naba-table/commit/0dd29d86f3a9ab30a57d5e250fa75484c862a817))
* wire email delivery follow-up fixtures through authenticated routes ([8f44ce8](https://github.com/lapeninns/naba-table/commit/8f44ce8e347b573ccbb878a7275d6934c87fb4af))
* wire email delivery validation fixtures ([43b8553](https://github.com/lapeninns/naba-table/commit/43b85536eb05b775d2ed7ddb99a05388389d058b))
* wire email delivery validation fixtures ([6cd4ca9](https://github.com/lapeninns/naba-table/commit/6cd4ca91fdf4e59adf17b038588cb109592f2f49))

## 0.1.0

- Establish the Nabatable platform release baseline.

- Validate Worker-only releases independently of Vercel provisioning, retain environment storage isolation, and configure verified operational-control resource identities and endpoints.
