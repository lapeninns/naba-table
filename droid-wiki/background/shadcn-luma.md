# Shadcn and Luma

The repo uses one shadcn/Radix primitive layer at `components/ui/**` and one Radix Luma shadcn theme across ops and guest/public surfaces.

## Guardrails

- Reuse existing primitives before creating new UI building blocks.
- `components/ui/**` is shared primitive territory and high-risk by default.
- App code must not introduce native HTML primitive substitutes or parallel UI systems where shadcn primitives exist.
- The current gates are `pnpm run guard:no-shadcn:strict` and `pnpm run guard:luma:strict`.
- UI changes require browser verification on a real shipped route; harness routes are supplemental.

Related: [Patterns and conventions](../how-to-contribute/patterns-and-conventions.md).
