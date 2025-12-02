---
task: frontend-modularization-refactor
timestamp_utc: 2025-12-02T08:29:00Z
owner: github:@maintainers
reviewers: [github:@design-systems, github:@web-core]
risk: medium
flags: []
related_tickets: []
---

# Research: Frontend Component Modularization & Refactor

## Executive Summary

The codebase has **three distinct component ecosystems** that have evolved organically, leading to duplication, inconsistent patterns, and unclear ownership. This document catalogs the current state and identifies opportunities for consolidation.

---

## 1. Current Component Landscape

### 1.1 Component Locations (3 separate roots)

| Location           | Purpose                                            | Count      | Framework           |
| ------------------ | -------------------------------------------------- | ---------- | ------------------- |
| `/components/`     | Legacy/marketing components + Shadcn UI primitives | ~60+ files | Next.js App Router  |
| `/src/components/` | Modern feature components (ops/dashboard/booking)  | ~50+ files | Next.js App Router  |
| `/reserve/`        | Standalone React SPA (guest booking wizard)        | ~30+ files | Vite + React Router |

### 1.2 UI Primitive Layers (Shadcn-based)

| Location                     | Files         | Notes                             |
| ---------------------------- | ------------- | --------------------------------- |
| `/components/ui/`            | 38 primitives | Primary Shadcn source             |
| `/reserve/shared/ui/`        | 18 primitives | Re-exports from `/components/ui/` |
| `/components/atoms/index.ts` | Barrel export | Re-exports from `/components/ui/` |

**Finding**: `reserve/shared/ui/` components are thin wrappers that just re-export from `/components/ui/`. This is good (no duplication), but the naming is confusing.

---

## 2. Duplication & Inconsistencies

### 2.1 Duplicated Components

| Component            | Locations                                                                | Issue                                |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| `SignInForm`         | `/components/auth/SignInForm.tsx`, `/src/components/auth/SignInForm.tsx` | Different implementations            |
| `GuestSignInForm`    | `/components/auth/GuestSignInForm.tsx`                                   | Separate guest-specific form         |
| `OpsSignInForm`      | `/components/auth/OpsSignInForm.tsx`                                     | Separate ops-specific form           |
| `Header`             | `/components/Header.tsx`                                                 | 400+ lines, multiple variants inline |
| `Footer`             | `/components/Footer.tsx`                                                 | Marketing footer                     |
| `Hero`, `CTA`, `FAQ` | `/components/` root                                                      | Marketing components at root level   |

### 2.2 Pattern Inconsistencies

| Pattern              | Location A                                    | Location B                                   |
| -------------------- | --------------------------------------------- | -------------------------------------------- |
| Form handling        | Manual state (`useState`)                     | `react-hook-form` + `zod`                    |
| Barrel exports       | Partial (`/src/components/features/index.ts`) | Missing in many folders                      |
| Component colocation | Flat (`/components/ui/`)                      | Nested (`/src/components/features/booking/`) |
| Hook organization    | `/hooks/` (root)                              | `/src/hooks/` (src)                          |

### 2.3 Orphaned/Empty Directories

- `/components/features/` - Empty folder
- `/components/wizard/` - Empty folder
- `/src/components/marketing/` - Empty folder
- `/src/components/landing/` - Empty folder
- `/src/components/common/index.ts` - Just a TODO comment

---

## 3. Architecture Analysis

### 3.1 Current Layer Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    App Entry Points                         │
│  /src/app/          (Next.js App Router)                    │
│  /reserve/          (Vite SPA)                              │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  /components/   │  │ /src/components │  │ /reserve/       │
│  (legacy/mixed) │  │ (features)      │  │ features/shared │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
          ┌─────────────────────────────────────────┐
          │         /components/ui/ (Shadcn)        │
          │         (single source of truth)        │
          └─────────────────────────────────────────┘
```

### 3.2 Import Path Complexity

Current `tsconfig.json` aliases:

- `@/components` → `/components`
- `@/lib` → `/lib`
- `@/hooks` → `/hooks`

**Issue**: Both `/components` and `/src/components` are accessed via `@/components`, leading to confusion about which is the canonical source.

---

## 4. Component Categories

### 4.1 Marketing Components (root `/components/`)

| Component                             | Lines      | Purpose               | Recommendation                   |
| ------------------------------------- | ---------- | --------------------- | -------------------------------- |
| `Hero.tsx`                            | 45         | Landing hero          | Move to `/components/marketing/` |
| `CTA.tsx`                             | ~50        | Call-to-action        | Move to `/components/marketing/` |
| `FAQ.tsx`                             | ~100       | FAQ section           | Move to `/components/marketing/` |
| `Footer.tsx`                          | ~150       | Site footer           | Move to `/components/layout/`    |
| `Header.tsx`                          | 400+       | Site header (complex) | **Refactor + move**              |
| `Problem.tsx`                         | ~50        | Marketing section     | Move to `/components/marketing/` |
| `Testimonials*.tsx`                   | ~200 total | Testimonial variants  | Consolidate to 1 component       |
| `WithWithout.tsx`                     | ~50        | Comparison section    | Move to `/components/marketing/` |
| `FeaturesAccordion/Grid/Listicle.tsx` | ~250 total | Feature showcases     | Consolidate pattern              |

### 4.2 Feature Components (`/src/components/features/`)

Well-organized, follows good patterns:

| Feature                  | Components            | Quality                          |
| ------------------------ | --------------------- | -------------------------------- |
| `booking-state-machine/` | 11 components + tests | ✅ Good isolation, barrel export |
| `bookings/`              | 5 components + hooks  | ✅ Good structure                |
| `dashboard/`             | 17 components         | ⚠️ Large, could split            |
| `ops-shell/`             | 6 components          | ✅ Good isolation                |
| `tables/`                | 2 components          | ✅ Focused                       |
| `onboarding/`            | 2 components + steps  | ✅ Good structure                |

### 4.3 Layout Components

| Location                       | Component             | Status             |
| ------------------------------ | --------------------- | ------------------ |
| `/src/components/layouts/`     | `AuthLayout.tsx`      | ✅ Good            |
| `/src/components/layouts/`     | `GuestLayout.tsx`     | ✅ Good            |
| `/src/components/layouts/`     | `MarketingLayout.tsx` | ✅ Good            |
| `/components/LayoutClient.tsx` | Client wrapper        | ⚠️ Unclear purpose |

### 4.4 Mobile Components (`/components/mobile/`)

| Component            | Purpose           | Recommendation                  |
| -------------------- | ----------------- | ------------------------------- |
| `BottomTabs.tsx`     | Mobile navigation | Move to feature folder          |
| `CategoryTab.tsx`    | Tab component     | Consolidate with tabs           |
| `ExperienceCard.tsx` | Card variant      | Use `/components/ui/card`       |
| `PrimaryButton.tsx`  | Button variant    | **Delete** - use Button from ui |
| `SearchBar.tsx`      | Search input      | Move to shared or feature       |

---

## 5. Hook Analysis

### 5.1 Hook Locations

| Location                 | Count                     | Purpose               |
| ------------------------ | ------------------------- | --------------------- |
| `/hooks/`                | 17 hooks                  | Legacy + guest-facing |
| `/src/hooks/`            | 4 generic + `ops/` folder | Modern ops hooks      |
| `/src/hooks/ops/`        | 20 hooks                  | Ops-specific hooks    |
| `/reserve/shared/hooks/` | Unknown                   | Reserve SPA hooks     |

### 5.2 Hook Issues

- **Circular re-export**: `/hooks/index.ts` re-exports from `/src/hooks/`
- **Naming inconsistency**: `useOpsBookings` vs `useBookings` (different implementations)
- **Split ownership**: Guest hooks in `/hooks/`, ops hooks in `/src/hooks/ops/`

---

## 6. Reserve SPA Analysis

The `/reserve/` folder is a **separate Vite-based React SPA** for the guest booking wizard.

### 6.1 Structure

```
/reserve/
├── .storybook/       # Storybook config
├── features/         # Feature-sliced design
│   └── reservations/
│       └── wizard/
├── shared/           # Shared utilities
│   ├── api/
│   ├── booking/
│   ├── config/
│   ├── hooks/
│   ├── lib/
│   ├── ui/           # Re-exports /components/ui/
│   └── utils/
├── pages/            # Route pages
└── entities/         # Domain entities
```

### 6.2 Observations

- Uses **Feature-Sliced Design** (FSD) architecture
- UI primitives correctly re-export from `/components/ui/`
- Has its own Vite + Vitest config
- Storybook is configured for this folder

---

## 7. Risks & Constraints

### 7.1 Risks

| Risk                     | Impact | Mitigation                      |
| ------------------------ | ------ | ------------------------------- |
| Breaking imports         | High   | Use codemod + LSP rename        |
| Regression in auth flows | High   | Add E2E tests before refactor   |
| Bundle size increase     | Medium | Tree-shaking via barrel exports |
| Reserve SPA breakage     | Medium | Test build after changes        |

### 7.2 Constraints

- **Do not** modify `/components/ui/` (Shadcn source of truth)
- **Must** maintain `/reserve/` as separate Vite SPA
- **Must** preserve existing Next.js App Router patterns
- **Cannot** break existing import paths without migration

---

## 8. Reuse Opportunities

### 8.1 Components to Consolidate

1. **Sign-in forms**: Extract shared form logic, keep variant-specific styling
2. **Testimonials**: Create one component with `variant` prop
3. **Feature sections**: Create `FeatureSection` with layout variants
4. **Mobile-specific**: Delete `PrimaryButton`, use `Button` with mobile styles

### 8.2 Patterns to Standardize

1. **Form handling**: Standardize on `react-hook-form` + `zod`
2. **Barrel exports**: Add `index.ts` to all feature folders
3. **Component testing**: Colocate `__tests__/` folders

---

## 9. Open Questions

| Question                                                                                   | Owner           | Due                   |
| ------------------------------------------------------------------------------------------ | --------------- | --------------------- |
| Should `/components/` become `/components/legacy/` or fully migrate to `/src/components/`? | @maintainers    | Before plan           |
| Keep `/reserve/` as separate SPA or integrate into Next.js?                                | @web-core       | Before plan           |
| Standard for mobile-specific components?                                                   | @design-systems | Before implementation |

---

## 10. Recommended Direction

### Phase 1: Organization & Cleanup (Low Risk)

- Move marketing components to `/components/marketing/`
- Delete empty folders and unused components
- Add barrel exports to all feature folders
- Document component ownership in CODEOWNERS

### Phase 2: Consolidation (Medium Risk)

- Consolidate sign-in form variants
- Refactor Header.tsx (400+ lines → composable pieces)
- Standardize form patterns on `react-hook-form`
- Consolidate testimonial components

### Phase 3: Architecture Alignment (Higher Risk)

- Migrate from `/hooks/` + `/src/hooks/` to unified location
- Establish clear boundary between Next.js and Reserve SPA
- Add Storybook coverage for shared components

---

## Definition of Ready Checklist

- [x] Scope & success criteria clear
- [x] Reuse opportunities identified
- [x] Risks & constraints documented
- [x] Open questions listed with owners
- [x] Recommended direction provided
