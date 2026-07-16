# Verification economics

| claim | risk | error cost | verification cost/time | chosen verification path | defer/verify decision | outcome | residual risk |
|---|---|---|---|---|---|---|---|
| Existing fields represent kitchen boundaries. | normal | Wrong schema recommendation. | Low. | Cross-check generated schema, UI, server reads, and migrations. | Verify. | Pending. | Remote schema drift. |
| Proposed workaround composes with create-time checks. | high | Guests still see slots that fail on confirmation. | Medium. | Trace slot and create paths; inspect tests and execute cutoff matrix. | Verify. | Composed `close - max(buffer, duration)` is the only tested formula that enforces both rules without duration rewriting. | Capacity/RPC behavior outside unit coverage. |
