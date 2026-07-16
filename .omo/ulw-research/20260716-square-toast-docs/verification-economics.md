# Verification Economics

| claim | risk | error cost | verification cost/time | path | decision | outcome | residual risk |
|---|---|---|---|---|---|---|---|
| Official documentation behavior claims | normal | Medium: bad middleware architecture | Low-medium | Full official-page retrieval plus counter-search | Verify | Pending | Pending |
| Undocumented runtime ordering/timing behavior | high | High: lost or stale state | High, requires provider sandbox | Official-doc finding only; label inference | Defer execution | Not executable in this assignment | Explicitly unresolved |
