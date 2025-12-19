---
task: fix-build-error
timestamp_utc: 2025-12-08T00:22:29Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Build Error in API Route

## Objective

Fix the `routes.d.ts` generation error by correcting the type definition for `context.params` in `src/app/api/reservations/[id]/confirmation/route.ts`.

## The Issue

In Next.js 15+ (and recent 14 versions), dynamic route parameters are asynchronous. The type `RouteParams` is defined as:

```typescript
type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};
```

And usage is:

```typescript
export async function GET(_req: NextRequest, context: RouteParams) {
  const { id } = await context.params;
  // ...
}
```

This looks syntactically correct for Next.js 15 (where `params` is a Promise). However, the build error suggests something about syntax parsing failure in the _generated_ type file, which resembles:

```typescript
{ id } = await context.params
```

appearing in a place where a declaration is expected.

It's possible that `NextRequest` or the function signature is causing issues with type inference.

However, typically the second argument to a route handler is `{ params }`.
The signature `async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> })` is the standard pattern.

The code currently uses `context: RouteParams` and then `await context.params`. This is also valid JavaScript, but maybe the type generator prefers the destructuring in the argument list or explicit type typing.

Wait, looking closely at the error:

```
.next/dev/types/routes.d.ts:207:8
> 207 | { id } = await context.params
```

This line appearing _verbatim_ in a `.d.ts` file suggests it was essentially copy-pasted there by the generator, likely because it thought it was a type declaration or part of a signature? Or maybe it's inside a comment block in the d.ts file that got messed up?

Actually, the error message: `This '=' follows a block of statements...` implies it's treating `{ id }` as a block? No, `{ id } = ...` is valid JS assignment. But in a `.d.ts` file, you can't have executable code.

It seems Next.js is mistakenly including the _implementation code_ in the _type definition file_. This usually happens when the return type is not explicit, and TypeScript tries to infer it, but somehow fails or includes the body? No, that's rare.

More likely: There is some issue with how `RouteParams` is defined or used.

I will attempt to refactor the request handler signature to the standard pattern:

```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string | string[] }> },
) {
  const { id } = await params;
  // ...
}
```

This tends to be more robust for Next.js analysis.

## Steps

1.  Modify `src/app/api/reservations/[id]/confirmation/route.ts` to use standard destructuring in the signature.
2.  Also check for any other weird characters or issues.
