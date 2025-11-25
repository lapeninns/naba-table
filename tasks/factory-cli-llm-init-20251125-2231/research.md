---
task: factory-cli-llm-init
timestamp_utc: 2025-11-25T22:31:31Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Factory CLI VibeProxy LLM init failure

## Requirements

- Factory CLI (`droid`) should initialize and use custom models via VibeProxy without errors.
- Keep configuration local; no secrets committed.

## Non-functional

- No repo code changes needed unless documenting.
- Ensure reproducible config steps and sanity test.

## Existing Patterns & Reuse

- Using ~/.factory/config.json to register custom models.
- VibeProxy/CLIProxy already running on port 8317 (observed via lsof).

## Constraints & Risks

- Must not expose tokens; avoid reading token contents.
- CLI may require non-empty api_key even if unused by proxy.

## Open Questions

- Which provider string schema does current droid expect? (to be validated in plan/testing)

## Recommended Direction

- Verify VibeProxy is running and connected.
- Simplify config to known-good minimal entries (one Anthropic, one OpenAI) with dummy api_key values.
- Run `droid --debug --non-interactive --eval` to confirm no init error; then re-expand model list if needed.
