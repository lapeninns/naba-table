# Wave 2: contract mapping

## Finding

The safest compatibility default under the user’s stated finish-by-close intent is the original hybrid contract:

```text
start + resolvedDuration <= operatingClose
start + lastSeatingBuffer <= operatingClose
```

This matches current Ops copy, hard-enabled unified create behavior, the October 2025 implementation, and external hard-finish systems. It supersedes the March 2026 start-slot policy deliberately and should be documented as such.

## EXPAND

- Internal “close” is sufficiently resolved for the requested scope as effective operating close, not service-period end.
- Overnight/business-day semantics remain a separate migration decision.
- No unchecked semantic lead remains for same-day booking eligibility.
