# Verification: cutoff formulas

Executed with Node.js against a 22:00 close, candidate starts from 20:00 through 21:30, buffers 30/90, and canonical durations 60/90/120.

## Formula verdicts

- Buffer-only: `start <= close - buffer`. This still exposes starts that canonical duration cannot finish by close whenever `duration > buffer`.
- Duration-only: `start + duration <= close`. This guarantees finish-by-close but ignores the operator's independently configured final-seating cutoff whenever `buffer > duration`.
- Composed: `start <= close - max(buffer, duration)`. This is equivalent to enforcing both independent rules and produces no Plan/Create disagreement for those inputs.
- Shortening: `stored duration = close - start`. A 21:30 booking becomes 30 minutes regardless of its canonical 60/90/120-minute turn, changing the product sold and the capacity window.

## Representative output

For close 22:00, buffer 30, duration 90:

| Start | Buffer-only | Duration-only | Composed | Shortened duration |
|---|---:|---:|---:|---:|
| 20:00 | yes | yes | yes | 120 |
| 20:30 | yes | yes | yes | 90 |
| 21:00 | yes | no | no | 60 |
| 21:30 | yes | no | no | 30 |

For close 22:00, buffer 90, duration 60:

| Start | Buffer-only | Duration-only | Composed | Shortened duration |
|---|---:|---:|---:|---:|
| 20:00 | yes | yes | yes | 120 |
| 20:30 | yes | yes | yes | 90 |
| 21:00 | no | yes | no | 60 |
| 21:30 | no | no | no | 30 |

Verdict: the composed formula is the only option among these that honors both configured last seating and finish-by-close without rewriting canonical duration.
