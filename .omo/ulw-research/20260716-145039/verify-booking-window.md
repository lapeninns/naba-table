# Verification: booking-window mismatch

Observed at: 2026-07-16  
Runtime: Node.js workspace under Vitest 4.1.0  
Command:

```text
pnpm exec vitest run tests/research/verify-booking-window.test.ts
```

The temporary included test imported
`.omo/ulw-research/20260716-145039/verify-booking-window.test.ts`; the temporary
`tests/research` wrapper was removed after execution.

## Results

```text
Test Files  1 passed (1)
Tests       2 passed (2)
Duration    459ms
```

## Verdicts

- CONFIRMED: a start can be present in the schedule and pass the start-only slot gate, yet unified validation rejects it before capacity because the resolved duration ends after close.
- CONFIRMED: an overnight schedule slot such as `23:00` for an `17:00`–`00:00` window is rejected at the current start-only bounds gate because `23:00 >= 00:00`; capacity is not consulted.
- CONFIRMED by the existing targeted pack: six relevant suites, fifteen tests passed, including the contradictory start-only and finish-by-close regression tests.

## Quality checks

```text
No violations in 2 file(s).
```

The research verification file contains 138 non-blank, non-comment lines.
