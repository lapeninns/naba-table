---
name: nabatable-ui-proof
description: Use when verifying Nabatable UI changes, especially when Chrome DevTools or browser validation is required and you need the repo-specific fallback rules for stale dev harnesses, authenticated routes, and artifact capture.
allowed-tools:
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Bash(rg:*)
when_to_use: Use when a Nabatable change affects UI behavior and needs manual proof. Examples: "verify this ops dashboard change", "capture browser proof", "the dev harness is stale", "the route is auth-gated", "record the fallback verification path".
paths:
  - src/app/**
  - src/components/**
  - components/**
  - reserve/**
  - tests/**
  - docs/MANUAL_TESTING_GUIDE.md
  - AGENTS.md
---

# Nabatable UI Proof

This skill exists to prevent "browser verification happened in spirit" from counting as real proof.

## Goal

Produce credible UI verification for Nabatable changes, including a clear fallback path when the preferred local harness is unavailable.

## Verification Order

1. Use the documented dev harness when it actually exposes the changed behavior.
2. If the harness 404s, renders shell-only content, or is stale under the current environment, switch to the authenticated `app.localhost` route and document that fallback explicitly.
3. Verify the real interaction that matters, not just page load.
4. Capture the route, viewport/device, and the behavior you actually observed in `verification.md`.

## Nabatable-Specific Fallback Rules

- Do not stop at "the page opened" if the requested behavior involves restaurant switching, filters, pagination reset, tab transitions, or other stateful interactions.
- If the browser tool cannot perform the critical interaction, say so explicitly and add compensating evidence:
  - focused component or integration test on the production path
  - route-level or state-transition proof
  - exact blocker preventing interactive browser completion
- For test-only tasks, browser proof may be omitted, but the verification notes must say the change was test-only and why browser proof was not needed.

## Evidence Checklist

- verification surface used: dev harness or authenticated route
- why that surface was chosen
- exact interaction verified
- screenshots or equivalent artifacts when available
- any blocker, fallback, or residual risk

## Done Criteria

- The verification notes describe the actual surface and interaction tested.
- Fallbacks are explicit rather than implied.
- Critical interactive behavior is either proven or clearly marked as still blocked.
