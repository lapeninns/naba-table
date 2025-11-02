# Playbook: Policy Change & Drift

## Symptoms

- Confirm fails with `POLICY_CHANGED` after hold; operators cannot proceed.
- Policy flags changed between hold and confirm (e.g., adjacency rules, zones).

## Immediate Actions

- Re-run Validate and Hold to capture new snapshot with current policy.
- Communicate active policy changes to the floor team.

## Technical Checks

- Inspect `policyVersion` and selection snapshot in hold metadata.
- Verify feature flags (`allocator.requireAdjacency`, adjacency undirected) match expectations.

## Remediation

- If unintended policy drift: restore prior configuration or schedule change window.
- If intended: educate operators and ensure UI messaging clarifies drift.

## Preventative

- Stage policy changes behind flags and ramp progressively.
- Add release notes for policy toggles and expected operator impact.
