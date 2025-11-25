---
task: factory-cli-llm-init
timestamp_utc: 2025-11-25T22:31:31Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — CLI

- OpenAI path: `droid --config ~/.factory/config.json --model gpt-5.1 --non-interactive --eval "what day is it?"` returned "Today is Tuesday, November 25, 2025" (no init errors).
- Anthropic path: still returning upstream 400 ("credential only authorized for Claude Code") — requires fresh Claude Code authentication or compatible token.

## Test Outcomes

- [ ] Anthropic model test passes (blocked by upstream credential)
- [x] OpenAI model test passes

## Artifacts

- Proxy curl sanity: `curl http://localhost:8317/v1/chat/completions ...` returns 200 with gpt-5.1.

## Known Issues

- None logged yet
