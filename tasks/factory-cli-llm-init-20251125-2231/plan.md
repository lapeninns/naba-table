---
task: factory-cli-llm-init
timestamp_utc: 2025-11-25T22:31:31Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Factory CLI LLM init

## Objective

Get Factory CLI (`droid`) to initialize successfully with VibeProxy custom models so prompts run without errors.

## Success Criteria

- `droid --config ~/.factory/config.json --debug --non-interactive --eval "ping"` returns a model response (no init error).
- VibeProxy keeps listening on port 8317.

## Steps

- Validate VibeProxy service listening on 8317 and note status.
- Trim ~/.factory/config.json to a minimal, valid schema (ensure api_key placeholders, correct base_url/provider per vendor).
- Run a non-interactive test prompt with a selected custom model (one Anthropic, one OpenAI) to confirm initialization.
- If success, restore full model list with corrected api_key placeholders.
- Record verification evidence in task folder.

## Testing Strategy

- Non-interactive CLI call with `--eval` for both providers.
- Inspect exit codes/log output for initialization errors.

## Rollout

- Local config only; no code deploy. No feature flags.
