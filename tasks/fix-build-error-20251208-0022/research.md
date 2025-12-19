---
task: fix-build-error
timestamp_utc: 2025-12-08T00:22:29Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Fix Build Error in routes.d.ts

## Requirements

The user cannot build the project due to a TypeScript error in the generated `.next/dev/types/routes.d.ts` file.
The error is: `Type error: Declaration or statement expected.`
Code snippet causing issues: `{ id } = await context.params`

## Investigation

The error usually occurs when Next.js tries to generate types for valid route handlers but encounters something unexpected in the source code, often in JSDoc comments or weird syntax in `route.ts` files.

I need to find files containing `{ id } = await context.params`.

## Plan

1.  Search for `{ id } = await context.params` in `src/app` or `src/pages`.
2.  If found, inspect the file. It might be a malformed JSDoc or incorrectly pasted code.
3.  Fix the source code.
4.  Run `pnpm build` to verify.
