# SajiloReserveX Refactoring & Modularization Analysis

## 1. Methodology & Context

- **Application scope**: Hybrid Next.js shell with a feature-sliced Reserve booking SPA mounted under `/reserve`. Booking wizard orchestrates restaurant reservations with Supabase-backed persistence.【F:README.md†L1-L36】
- **Process**: Reviewed domain hooks, UI steps, reducers, utilities, and server entry-points highlighted in the IDE context. Cross-compared wizard UI logic with shared utilities to detect duplication. Verified line counts via `nl` for precise hotspots and inspected runtime/env plumbing for coupling. Considered architectural map to align recommendations with existing feature slices.【F:README.md†L18-L36】
- **Verification layers**: (1) Static inspection of React components/hooks. (2) Cross-check against shared utility modules for overlap. (3) Evaluated config/runtime modules to spot hidden dependencies. (4) Compared server route with client wizard to assess layering. (5) Re-ran reasoning using alternate perspective: testability impact.

## 2. Key Code Smells & Refactoring Recommendations

### Issue A — Monolithic Wizard PlanStep Component

- **Category**: Structural (Long Method), Separation of Concerns, Duplication.
- **Location**: `reserve/features/reservations/wizard/ui/steps/PlanStep.tsx` lines 1-402.【F:reserve/features/reservations/wizard/ui/steps/PlanStep.tsx†L1-L402】
- **Severity**: High.
- **Current State**: Single React component exceeds 400 lines, blends UI rendering, form management, date/time computations, analytics, and tooltip logic. Reimplements helpers (`timeStringToMinutes`, `generateTimeSlots`) that overlap with booking utilities.【F:reserve/features/reservations/wizard/ui/steps/PlanStep.tsx†L66-L191】【F:reserve/shared/utils/booking.ts†L33-L152】
- **Impact**: Hurts readability, raises change risk when adjusting booking rules, duplicates logic leading to inconsistent behavior, and complicates testing (difficult to isolate form behaviour vs. scheduling logic).
- **Recommendation**:
  - Extract a `plan-time` domain service module (e.g., `@reserve/features/reservations/wizard/services/timeSlots.ts`) housing availability/time computations shared between UI and reducers.
  - Split component into smaller presentational units: `PlanStepForm`, `TimeSlotGrid`, `OccasionPicker`, etc., each below 120 lines.
  - Route analytics calls through injected callbacks to decouple from component for easier testing.
- **Effort Estimate**: Large (> 8 hours) due to cross-cutting state updates and re-testing of UI.
- **Code Example**:
  - _Before_ (inline helper & render logic):
    ```tsx
    function getServiceAvailability(date: string, time: string) { ... }
    const slots = useMemo(() => generateTimeSlots(state.details.date), [...]);
    <div className="grid">{slots.map((slot) => { ... })}</div>
    ```
  - _After_ (extracted services + child component):

    ```tsx
    import { useTimeSlots } from '../services/useTimeSlots';

    const slots = useTimeSlots({ date: state.details.date, time: state.details.time });
    return <TimeSlotGrid slots={slots} onSelect={handleSelectTime} />;
    ```

- **Dependencies**: Establish shared time-slot service first to avoid duplicate logic with booking helpers.
- **Risk Assessment**: Medium—UI refactor might regress layout or validation. Mitigate with storybook snapshots & existing tests.

### Issue B — Booking Helpers God Utility

- **Category**: Structural (God Object), Primitive Obsession, Cohesion.
- **Location**: `reserve/shared/utils/booking.ts` lines 1-171.【F:reserve/shared/utils/booking.ts†L1-L171】
- **Severity**: Medium.
- **Current State**: `bookingHelpers` aggregates formatting, validation, time math, and storage concerns. Exposes wide surface area causing consumers to rely on primitives (strings) rather than typed value objects.
- **Impact**: Encourages primitive obsession (dates/times as strings), increases coupling, and makes it hard to mock small portions in tests.
- **Recommendation**: Decompose into targeted modules:
  - `time` utilities (`normalizeTime`, `timeToMinutes`, `slotsForRange`).
  - `formatting` functions (`formatDate`, `formatSummaryDate`).
  - `validation` helpers (`isUKPhone`, `isEmail`).
  - Introduce value objects (e.g., `ReservationTime` class or branded types) to avoid string drift.
- **Effort Estimate**: Medium (2-8 hours).
- **Code Example**:
  ```ts
  // After split
  import { TimeMath } from '@reserve/shared/time';
  const minutes = TimeMath.toMinutes(time);
  ```
- **Dependencies**: Align with Issue A extraction to prevent new duplication.
- **Risk Assessment**: Low—pure functions; ensure all re-export paths updated.

### Issue C — Overloaded `useReservationWizard` Hook

- **Category**: Structural (Large Function), Coupling, Testability.
- **Location**: `reserve/features/reservations/wizard/hooks/useReservationWizard.ts` lines 1-167.【F:reserve/features/reservations/wizard/hooks/useReservationWizard.ts†L1-L167】
- **Severity**: High.
- **Current State**: Hook orchestrates navigation, analytics, haptics, store wiring, network mutations, and UI sticky state. Contains multiple side effects and deep dependencies.
- **Impact**: Difficult to unit test (requires mocking router, analytics, haptics, mutation), raises coupling to runtime environment, and centralises too many responsibilities, hindering future feature toggles.
- **Recommendation**:
  - Split into composable hooks: `useWizardProgress`, `useWizardSubmission`, `useWizardActions`. Inject dependencies (analytics tracker, navigation) via parameters for easier mocking.
  - Apply Strategy pattern for submission behaviour to support future booking flows (e.g., waitlist vs standard) without branching inside hook.
- **Effort Estimate**: Large (> 8 hours) due to ref wiring.
- **Code Example**:
  ```ts
  const submission = useWizardSubmission({
    actions,
    details: state.details,
    submit: mutation.mutateAsync,
  });
  const progress = useWizardProgress({ state });
  return { ...progress, ...submission };
  ```
- **Dependencies**: Issue A (component) & Issue H (DI) to avoid rework.
- **Risk Assessment**: Medium-high—changes touch central booking flow; require regression tests.

### Issue D — Reducer Handling UI & Domain State Together

- **Category**: Low Cohesion, Data Clump.
- **Location**: `reserve/features/reservations/wizard/model/reducer.ts` lines 1-209.【F:reserve/features/reservations/wizard/model/reducer.ts†L1-L209】
- **Severity**: Medium.
- **Current State**: Reducer stores UI flags (`loading`, `submitting`, `error`) alongside normalized booking data and confirmation payload. Action union handles both UI updates and domain transitions.
- **Impact**: Makes domain transitions harder to reason about, increases risk of conflicting updates, and complicates adding new UI states (requires touching domain state everywhere).
- **Recommendation**: Introduce separate slices: `uiState` vs `bookingState`. Consider XState/Statechart or splitting reducer into smaller reducers combined via `useReducer` composition.
- **Effort Estimate**: Medium (2-8 hours).
- **Code Example**:
  ```ts
  const [uiState, dispatchUi] = useReducer(uiReducer, initialUiState);
  const [bookingState, dispatchBooking] = useReducer(bookingReducer, initialBookingState);
  ```
- **Dependencies**: Coordinate with Issue C to adapt store hooks.
- **Risk Assessment**: Medium—requires migration of actions/tests.

### Issue E — ConfirmationStep Side-Effect Heavy Component

- **Category**: Structural (Long Method), Side Effects, Strategy Opportunity.
- **Location**: `reserve/features/reservations/wizard/ui/steps/ConfirmationStep.tsx` lines 1-210.【F:reserve/features/reservations/wizard/ui/steps/ConfirmationStep.tsx†L1-L210】
- **Severity**: Medium.
- **Current State**: Component mixes ICS generation, navigator share API, UI rendering, and step action orchestration. Contains multiple `useCallback`/`useEffect` blocks with side effects and DOM manipulation.
- **Impact**: Hard to test (needs DOM environment), risky to modify share/calendar flows, duplicates ICS building logic (should be service).
- **Recommendation**: Extract `useReservationShare` hook providing `downloadCalendar`, `shareReservation`, and feedback state. Move ICS string builder into pure utility (e.g., `@reserve/shared/ical`).
- **Effort Estimate**: Medium (2-8 hours).
- **Code Example**:
  ```ts
  const { feedback, downloadCalendar, shareReservation } = useReservationShare({
    details,
    booking,
  });
  ```
- **Dependencies**: Requires ICS utility module (new). Align with Issue G caching.
- **Risk Assessment**: Medium—DOM APIs tricky; ensure fallbacks remain.

### Issue F — Server Route Mixing Data Access & Control Flow

- **Category**: Separation of Concerns, Dependency Organization.
- **Location**: `app/reserve/[reservationId]/page.tsx` lines 1-87.【F:app/reserve/[reservationId]/page.tsx†L1-L87】
- **Severity**: Medium.
- **Current State**: Next.js route directly queries Supabase, handles auth, transforms records, and hydrates React Query—all inline.
- **Impact**: Difficult to reuse fetching logic, complicates testing route behaviour, and risks inconsistent error handling.
- **Recommendation**: Move Supabase data access into `@server/reservations/getReservation.ts`, returning domain object & metadata. Page becomes thin orchestrator.
- **Effort Estimate**: Medium (2-8 hours).
- **Code Example**:
  ```ts
  const reservation = await getReservation(reservationId);
  if (!reservation) notFound();
  ```
- **Dependencies**: Ensure server utils have DI for Supabase client.
- **Risk Assessment**: Low-medium—Primarily reorganization.

### Issue G — Hard-Coded Configuration Values

- **Category**: Configuration vs Implementation.
- **Location**: `PlanStep.tsx` lines 33-37; Confirmation step durations lines 13-24.【F:reserve/features/reservations/wizard/ui/steps/PlanStep.tsx†L33-L190】【F:reserve/features/reservations/wizard/ui/steps/ConfirmationStep.tsx†L11-L72】
- **Severity**: Medium.
- **Current State**: Reservation window (`open`, `close`, `intervalMinutes`), event duration, and messaging strings hard-coded in components.
- **Impact**: Changing business rules requires component edits; risk of environment-specific overrides being missed.
- **Recommendation**: Externalize into configuration module (e.g., `@reserve/shared/config/reservations.ts`) and load via env/resolver. Enables feature toggles & A/B tests.
- **Effort Estimate**: Small (< 2 hours) once modules exist.
- **Code Example**:
  ```ts
  import { reservationConfig } from '@reserve/shared/config/reservations';
  const slots = generateTimeSlots(date, reservationConfig.timeSlots);
  ```
- **Dependencies**: Works with Issue A restructure.
- **Risk Assessment**: Low.

### Issue H — Tight Coupling to Global Utilities

- **Category**: Dependency Injection, Testability.
- **Location**: `useReservationWizard.ts` analytics/haptics/navigation lines 6-149.【F:reserve/features/reservations/wizard/hooks/useReservationWizard.ts†L6-L149】
- **Severity**: High.
- **Current State**: Hook imports global analytics (`track`), haptics, and direct router. No interfaces for mocking.
- **Impact**: Unit tests must mock entire modules; prevents dependency injection (DI) for future analytics providers; haptic triggers fire in tests.
- **Recommendation**: Accept dependencies via parameters/context; define interfaces (`AnalyticsTracker`, `HapticsClient`). Use Provider pattern or React context.
- **Effort Estimate**: Medium (2-8 hours).
- **Code Example**:
  ```ts
  export function useReservationWizard(deps: WizardDeps = defaultDeps) {
    const { analytics, haptics, navigate } = deps;
  }
  ```
- **Dependencies**: Align with Issue C restructure.
- **Risk Assessment**: Medium—requires updating hook consumers.

### Issue I — Lack of Error Handling Consistency

- **Category**: Error Handling, Hidden Dependencies.
- **Location**: `useReservationWizard.ts` error branches lines 95-140; `page.tsx` console logging lines 45-63.【F:reserve/features/reservations/wizard/hooks/useReservationWizard.ts†L95-L140】【F:app/reserve/[reservationId]/page.tsx†L39-L64】
- **Severity**: Medium.
- **Current State**: Mix of `console.error`, `actions.setError`, and silent fallbacks; inconsistent user feedback for auth vs booking failures.
- **Impact**: Hard to centralize logging/monitoring; inconsistent UX.
- **Recommendation**: Introduce centralized error boundary/logger service. Use Command pattern to report errors and update UI consistently.
- **Effort Estimate**: Medium.
- **Code Example**:
  ```ts
  errorReporter.capture(error);
  actions.failSubmission(mapErrorToMessage(error));
  ```
- **Dependencies**: DI improvements (Issue H).
- **Risk Assessment**: Medium.

### Issue J — Missing Domain Interfaces & DTO Normalizers

- **Category**: Interface Abstraction, Dependency Organization.
- **Location**: `reducer.ts` ApiBooking type lines 13-76, `transformers.ts` lines 52-74.【F:reserve/features/reservations/wizard/model/reducer.ts†L13-L76】【F:reserve/features/reservations/wizard/model/transformers.ts†L22-L74】
- **Severity**: Medium.
- **Current State**: ApiBooking replicates backend schema; transformations use inline mapping each time.
- **Impact**: Divergence risk if backend changes; duplicates mapping logic.
- **Recommendation**: Define adapter interface (`ReservationApiAdapter`) and reuse across store/hook/server modules. Consider Abstract Factory to instantiate bookings from different sources.
- **Effort Estimate**: Medium.
- **Risk Assessment**: Low-medium—requires shared types update.

## 3. Dependency & Architecture Insights

- **Runtime Env Coupling**: `reserve/shared/config/env.ts` throws errors directly on validation and logs warnings. Consider returning typed result with validation summary for better testability.【F:reserve/shared/config/env.ts†L1-L52】
- **Layering**: Client wizard directly depends on analytics/haptics/resolver modules in shared libs. Introduce service layer or DI container to invert dependencies.
- **Transitive Dependencies**: UI components import config constants that should flow via domain store to maintain single source of truth.
- **Potential Circular Risks**: No direct circular found, but splitting helpers must ensure no UI→domain→UI loops.

## 4. Testability & Performance Considerations

- **Testability Pain Points**: Hard-to-mock dependencies (Issue H), global navigator usage (Issue E), and stateful reducers mixing UI/domain (Issue D).
- **Recommended Fixes**: Provide dependency injection, isolate pure services, add factory functions returning deterministic data for tests.
- **Performance**: No clear O(n²) hotspots observed; but repeated `new Date()` computations in `generateTimeSlots` per render can be memoized via extracted hooks/services to reduce recomputation.

## 5. Prioritized Action Plan

| Priority | Recommendation                                                             | Business Value | Debt Reduction | Effort | Risk        | Rationale                                          |
| -------- | -------------------------------------------------------------------------- | -------------- | -------------- | ------ | ----------- | -------------------------------------------------- |
| P1       | Refactor `PlanStep` (Issue A) with extracted time-slot service             | High           | High           | Large  | Medium      | Central UX step; unlocks reuse and reduces bugs    |
| P2       | Split `useReservationWizard` responsibilities & inject deps (Issues C & H) | High           | High           | Large  | Medium-High | Improves stability of entire flow                  |
| P3       | Introduce booking domain services (Issue B & J)                            | Medium         | High           | Medium | Low-Med     | Consolidates logic, prepares for multi-venue rules |
| P4       | Separate UI/domain reducers (Issue D)                                      | Medium         | Medium         | Medium | Medium      | Simplifies state transitions & testing             |
| P5       | Extract confirmation sharing utilities (Issue E)                           | Medium         | Medium         | Medium | Medium      | Reduces side-effects in UI                         |
| P6       | Externalize reservation configuration (Issue G)                            | Medium         | Medium         | Small  | Low         | Quick win for feature toggles                      |
| P7       | Modularize server data access for reservation page (Issue F)               | Medium         | Medium         | Medium | Low-Med     | Clarifies layering                                 |
| P8       | Standardize error handling/reporting (Issue I)                             | Medium         | Medium         | Medium | Medium      | Improves observability                             |

## 6. Additional Observations & Next Steps

- **Upcoming Features**: If expansion to multi-restaurant support is planned, extracted services (Issues A, B, J) will ease parameterization.
- **Team Familiarity**: Existing feature-sliced structure supports modular refactors; ensure contributors align on new service modules.
- **Coverage Gaps**: Consider snapshot/unit tests for new hooks/services once decoupled.

## 7. Final Reflection

After compiling recommendations, re-evaluated the reasoning by:

1. Re-reading highlighted files to confirm cited line ranges and ensuring no alternative simpler fix was missed.
2. Challenged assumptions by asking whether smaller incremental tweaks (e.g., minor cleanup) would suffice—concluded structural changes are necessary due to intertwined concerns.
3. Double-checked for overlooked counterexamples (e.g., other steps already modular). Confirmed other step components are shorter, reinforcing that PlanStep is the outlier requiring prioritised action.
