---
task: factory-cli-llm-init
timestamp_utc: 2025-11-25T22:31:31Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm VibeProxy listening on port 8317.
- [x] Validate/adjust ~/.factory/config.json schema (api_key placeholders, provider/base_url).

## Core

- [ ] Run `droid --config ~/.factory/config.json --debug --non-interactive --eval "what day is it?"` with Anthropic model.
- [x] Run same with OpenAI model.

## Verification

- [ ] Capture successful output and note in verification.md.

## Notes

- Assumptions: tokens already connected in VibeProxy.
- Deviations: none yet.
