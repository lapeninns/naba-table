# [MEDIUM] Workflow actions are pinned only to mutable major tags

**File:** [`.github/workflows/shadcn-primitives.yml`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/.github/workflows/shadcn-primitives.yml#L13-L19) (lines 13, 19)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `github-workflow-security`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The workflow runs on pull_request and executes actions/checkout@v4 and actions/setup-node@v4. Major-version tags are mutable refs, so if an action publisher account/repository/tag is compromised or retagged, arbitrary code would run in this repository's CI context. This workflow also does not declare restrictive permissions, so the impact depends on the repository default GITHUB_TOKEN permissions and whether the run is from an internal or forked PR.

## Recommendation

Pin third-party and GitHub actions to full commit SHAs and add explicit least-privilege workflow permissions such as contents: read.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
