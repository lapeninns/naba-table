# [MEDIUM] GitHub Actions are referenced by mutable major tags

**File:** [`.github/workflows/shadcn-primitives.yml`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/.github/workflows/shadcn-primitives.yml#L13-L19) (lines 13, 19)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-ci-supply-chain`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The pull_request workflow executes actions/checkout@v4 and actions/setup-node@v4 by major tag. Those refs are mutable, so a moved tag or compromised upstream action would execute code in this workflow context. The workflow also has no explicit minimal permissions block, so GITHUB_TOKEN exposure depends on repository or organization defaults.

## Recommendation

Pin third-party actions to full commit SHAs, manage updates with Dependabot or Renovate, and add explicit minimal permissions such as contents: read. Consider persist-credentials: false for checkout unless later steps need the token.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
