# Implementation Checklist

## Layout Fix

- [x] Create `src/app/(public)/auth/(role-selection)` directory.
- [x] Move `src/app/(public)/auth/layout.tsx` to `src/app/(public)/auth/(role-selection)/layout.tsx`.
- [x] Move `src/app/(public)/auth/page.tsx` to `src/app/(public)/auth/(role-selection)/page.tsx`.
- [x] Verify `/auth` still works (role selection).
- [x] Verify `/auth/signin` no longer has duplicate navbar/footer.

## Spacing & UI Polish

- [x] Refine `src/app/(public)/auth/signin/page.tsx`:
  - [x] Add more vertical padding to the sign-in card if needed.
  - [x] Check mobile margins.
- [x] Refine `src/app/app/auth/signin/page.tsx`:
  - [x] Ensure padding consistency with the guest page.

## Responsive Audit

- [x] Test 320px (iPhone SE).
- [x] Test 768px (iPad).
- [x] Test 1024px+ (Desktop).

## Verification

- [x] Run manual QA via Chrome DevTools MCP.
- [x] Check console for errors.
