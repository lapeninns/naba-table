## QA Report

| #   | Test Case                                           | App         | Persona   | Result                  | Notes                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------- | ----------- | --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Shipped ops GBP route loads linked profile workflow | web         | ops_owner | :white_check_mark: PASS | `http://app.localhost:3000/settings/restaurant/google-business-profile` loaded authenticated for Old Crown Girton.                                                                                                                                |
| 2   | Google -> Nabatable profile diff apply              | web/backend | ops_owner | :no_entry: BLOCKED      | Initial workflow evidence showed no real profile diff for `profile.name` or `profile.contactPhone`; Browser Use became unavailable before a safe one-field real GBP diff could be created and verified through the UI. No mutation was performed. |
| 3   | Nabatable -> Google profile publish                 | web/backend | ops_owner | :no_entry: BLOCKED      | Not attempted because the required prior safe profile setup and UI assertions were blocked. No preflight or password-confirmed publish was run.                                                                                                   |
| 4   | Non-pushable profile boundaries                     | backend     | ops_owner | :white_check_mark: PASS | Workflow profile matrix shows `profile.address`, `profile.googleMapUrl`, and `profile.googleReviewUrl` with `canPushToGoogle=false`; `profile.name` and `profile.contactPhone` remain push-capable.                                               |

<details>
<summary>Screenshots & Evidence</summary>

- Target: development local server, app host `http://app.localhost:3000`, `APP_ENV=staging`, `DB_TARGET_ENV=staging`.
- Route screenshot: `qa-results/20260428-1827-gbp-profile/01-authenticated-route.png`
  - Evidence: shipped ops GBP route loaded for Old Crown Girton.
- Authenticated workflow API screenshot: `qa-results/20260428-1827-gbp-profile/02-api-workflow-initial.png`
  - Evidence: browser-rendered workflow JSON for restaurant `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`.
- API artifact: `qa-results/20260428-1827-gbp-profile/api-workflow-service-initial.json`
  - Connection excerpt: `status=linked`, `pushEnabled=true`, `externalLocationTitle="Old Crown Girton"`.
  - Draft excerpt: `id=9bae68f8-db06-410e-b165-f643016ad153`, `status=review_ready`, `fetchedAt=2026-04-28T17:15:14.71+00:00`.
  - Profile excerpt: `status=unchanged`, `summary="No Google changes need review in this section."`
  - Field matrix: `profile.name` and `profile.contactPhone` had matching current/provider values and `canPushToGoogle=true`; `profile.address`, `profile.googleMapUrl`, and `profile.googleReviewUrl` had `canPushToGoogle=false`.
- Blocker: the in-app Browser Use pane became unavailable during the reload step after the initial route/API evidence. Because UI assertions and screenshots are required after each meaningful assertion, I did not create or publish a real profile diff without browser control.
- Not run: hours, service periods, attributes, categories, dev harnesses, unrelated QA flows, preflight, publish, or password confirmation.

</details>
