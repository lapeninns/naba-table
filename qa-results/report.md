## QA Report

| #   | Test Case                                                           | App     | Persona                 | Result                       | Notes                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------- | ------- | ----------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GBP dev-harness workflow shows one-way approval review              | web     | ops_owner (dev harness) | :white_check_mark: PASS      | `/dev/ops-settings-restaurant?view=google-business-profile` showed `Read-only approval review`, `Google to Nabatable`, `No Google write`, `Generate review draft`, and `Approve (2)`. Legacy `Sync now`, optional Google-sync copy, and retry-Google-only controls were absent.     |
| 2   | Profile settings hand off GBP changes to the review page            | web     | ops_owner (dev harness) | :white_check_mark: PASS      | `/dev/ops-settings-restaurant?view=profile` showed `Review GBP draft` and no inline `Sync now` CTA.                                                                                                                                                                                 |
| 3   | Availability/operating-hours GBP handoff                            | web     | ops_owner               | :grey_question: INCONCLUSIVE | The local consolidated availability harness did not expose the legacy `OperatingHoursSection` handoff, and the shipped ops route requires manual ops-owner auth before the real settings surface can be opened.                                                                     |
| 4   | Shipped ops GBP route enforces auth before workflow access          | web     | ops_owner               | :no_entry: BLOCKED           | `http://app.localhost:3000/settings/restaurant/google-business-profile` redirected to `/auth/signin?redirectedFrom=%2Fsettings%2Frestaurant%2Fgoogle-business-profile`. Manual ops-owner credentials were not provided, so authenticated workflow/publish checks could not proceed. |
| 5   | Workflow/preflight/publish API routes reject unauthenticated access | backend | unauthenticated         | :white_check_mark: PASS      | `GET /workflow`, `POST /publish/preflight`, and `POST /publish` each returned `401` with `{"error":"Authentication required","code":"UNAUTHENTICATED"}`.                                                                                                                            |
| 6   | Authenticated GBP draft + publish flow                              | backend | ops_owner               | :no_entry: BLOCKED           | Positive workflow-state checks (draft refresh, approval, preflight, publish, stale-draft handling, password confirmation) require a real ops-owner session plus linked GBP restaurant context; those prerequisites were not available in this run.                                  |

<details>
<summary>Screenshots & Evidence</summary>

- Browser artifacts in `qa-results/20260428-1145-gbp-workflow/`
  - `dev-gbp-workflow.png` / `dev-gbp-workflow.txt`
  - `dev-profile-link.png` / `dev-profile.txt`
  - `ops-route-auth-blocked.png` / `ops-route-auth-blocked.txt`
  - `browser-summary.json`
- HTTP evidence:
  - `qa-results/20260428-1145-gbp-workflow/backend-http.txt`
- Key excerpts:
  - Dev workflow summary recorded `hasReadOnly=true`, `hasNoGoogleWrite=true`, `hasGenerateDraft=true`, `hasApprove=true`, `hasPublish=false`, `hasLegacySyncNow=false`, `hasRetryGoogleOnly=false`, `reviewCoverage=2/3`.
  - Shipped ops route ended at `http://app.localhost:3000/auth/signin?redirectedFrom=%2Fsettings%2Frestaurant%2Fgoogle-business-profile`.
  - Backend guard responses were `401 Unauthorized` for workflow, preflight, and publish.

</details>
