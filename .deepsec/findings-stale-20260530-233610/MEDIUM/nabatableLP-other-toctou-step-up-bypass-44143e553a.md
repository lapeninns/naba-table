# [MEDIUM] Approved GBP workflow can publish live values that were not reviewed

**File:** [`server/google-business-profile/workflowPublishExecution.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/google-business-profile/workflowPublishExecution.ts#L117-L310) (lines 117, 124, 144, 157, 293, 302, 310)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-toctou-step-up-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The workflow validates a draft snapshot during preflight, but the actual publish path rebuilds payloads from live state. For Google-to-Nabatable imports, the code fetches current GBP connection/businessInfo and builds payloads from that live provider state instead of the approved draft item values. For Nabatable-to-Google pushes, pushDraftToGoogle uses the draft only to choose fields/sections, then calls syncRestaurantProfileWithGoogleBusinessProfile, syncRestaurantOperatingHoursWithGoogleBusinessProfile, and syncRestaurantServicePeriodsWithGoogleBusinessProfile, whose implementations refetch current restaurant data before calling Google. The exposed publish routes require password confirmation, while normal local edits to details/hours/service periods/business context require only an authenticated admin session. A compromised admin session, or a second admin, can race a local edit or provider refresh after preflight/password confirmation and before these live reads, causing unreviewed values to be imported or pushed under the approved job.

## Recommendation

Build publish payloads from the reviewed draft snapshot values, or revalidate the selected field hashes immediately before each write under a per-restaurant publish lock/transaction. For Google pushes, pass explicit approved values into the push routines instead of letting them refetch mutable current state.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
