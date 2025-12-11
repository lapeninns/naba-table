---
task: export-homepage-code
timestamp_utc: 2025-12-10T21:47:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Homepage code export

## Requirements

- Functional: deliver a single consolidated JSON file containing the homepage-related source files and their contents.
- Non-functional: obey AGENTS policies (no secrets, no local Supabase), keep code unchanged, maintain formatting.

## Existing Patterns & Reuse

- Homepage implemented in Next.js App Router under `src/app/(public)/page.tsx` and related marketing/landing components under `src/components`.
- Reuse existing file contents verbatim; no new UI or backend logic needed.

## External Resources

- None required; all info within repo.

## Constraints & Risks

- Must not modify application behavior; output is read-only export.
- Large file contents could bloat JSON if too many assets are included; scope to homepage files only.

## Open Questions (owner, due)

- None at this time.

## Recommended Direction (with rationale)

- Identify homepage entry point and directly referenced local components.
- Export those files into a consolidated JSON structure `{ files: [{ path, content }] }` to satisfy request while leaving code untouched.
