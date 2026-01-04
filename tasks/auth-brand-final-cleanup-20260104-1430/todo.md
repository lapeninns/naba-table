# Implementation Checklist

## Fix Nesting Errors

- [ ] Update `src/app/app/(app)/settings/error.tsx` to use `asChild` on Button.
- [ ] Update `src/app/guest/error.tsx` to use `asChild` on Button.
- [ ] Check `src/components/landing/FactoryHomeClient.tsx` for similar nesting issues and fix if found.

## Brand Standardization

- [ ] Ensure `src/components/shared/BrandIcon.tsx` has the correct path.
- [ ] Update `src/app/icon.svg` to match `BrandIcon.tsx`.
- [ ] Final grep for hardcoded logo paths (`M256 32C150...`).

## Auth Hub Verification

- [ ] Verify `components/auth/ImplicitAuthHandler.tsx` logic.
- [ ] Test unauthenticated redirect flow.
