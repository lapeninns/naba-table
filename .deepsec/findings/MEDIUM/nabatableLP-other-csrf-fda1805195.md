# [MEDIUM] Team invitation mutations do not enforce CSRF validation

**File:** [`src/app/app/(app)/settings/restaurant/team/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/team/page.tsx#L11>) (lines 11)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

This page renders the team management client, which creates and revokes invitations through cookie-authenticated API requests. The /api/ops/team/invitations POST handler and invitation DELETE handler authenticate the user and check admin membership, but they do not validate the CSRF header/cookie pair. A forged same-site request from an admin browser could create an invitation, including to an attacker-controlled email, or revoke a pending invite.

## Recommendation

Require validateCsrfToken on team invitation POST and DELETE handlers before parsing input or mutating invitation state.

## Revalidation

**Verdict:** fixed

The page itself only renders OpsRestaurantSettingsClient with view team, so the meaningful mutation enforcement lives in the ops invitation API routes used by that client. The current POST /api/ops/team/invitations handler wraps postTeamInvitation in withCsrfProtectedMutation before parsing or mutating state. The current DELETE /api/ops/team/invitations/[id] handler also wraps deleteTeamInvitation in withCsrfProtectedMutation. withCsrfProtectedMutation validates unsafe methods by comparing the x-csrf-token header to the sr-csrf-token cookie and returns 403 on failure. The browser service fetchJson automatically attaches the CSRF header from the non-HttpOnly CSRF cookie for these mutation calls. The forged same-site request described in the finding is therefore blocked in the current code.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-17)
