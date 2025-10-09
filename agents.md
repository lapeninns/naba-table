# Context Engineering Framework

## Overview

This document defines a systematic approach to context engineering, ensuring consistency, quality, and maintainability across all development tasks.

---

## Task Structure

### Organization

- **Task-based approach**: Each feature/bug/enhancement is a discrete task
- **Storage**: All task artifacts live in `tasks/<task-id>/`
- **Naming**: Use semantic slugs (e.g., `user-authentication-flow`, `payment-gateway-integration`)

### Standard Task Files

```
tasks/<task-id>/
├── research.md      # Findings, patterns, and resources
├── plan.md          # Implementation strategy and requirements
├── todo.md          # Executable checklist
└── verification.md  # Test scenarios and validation criteria
```

---

## Workflow Phases

### Phase 0: Task Setup

**Goal**: Establish clear boundaries and context

- [ ] Create task directory with semantic ID
- [ ] Document initial requirements
- [ ] Identify stakeholders and success criteria

---

### Phase 1: Research

**Goal**: Build comprehensive understanding before writing code

#### Activities

1. **Codebase analysis**
   - Search for existing patterns, components, and utilities
   - Identify reusable code and established conventions
   - Note technical debt or anti-patterns to avoid

2. **External research** (if applicable)
   - Review relevant documentation, RFCs, or specifications
   - Search for best practices and common pitfalls
   - Evaluate third-party solutions or libraries

3. **Clarification**
   - Ask follow-up questions early
   - Resolve ambiguities before planning
   - Document assumptions

#### Output: `research.md`

Should contain:

- Existing patterns discovered
- Relevant external resources
- Technical constraints or dependencies
- Open questions and their answers
- Recommended approach with rationale

**Example structure:**

```markdown
# Research: <Feature Name>

## Existing Patterns

- Component X in `/src/components/` handles similar logic
- API pattern Y is used consistently for this type of request

## External Resources

- [Relevant documentation](url)
- Best practices from [source](url)

## Technical Constraints

- Must support React 18 concurrent features
- Performance budget: <200ms initial render

## Recommendations

Based on findings, recommend approach Z because...
```

---

### Phase 2: Planning

**Goal**: Create a comprehensive, implementable blueprint

#### Activities

1. **Review research**
   - Read `research.md` thoroughly
   - Validate assumptions with user if needed
   - Clarify scope boundaries

2. **Design solution**
   - Reuse existing patterns and components (SHADCN preferred)
   - Follow established architectural patterns
   - Plan for edge cases and error states

3. **Scope validation**
   - Confirm understanding with stakeholder
   - Identify dependencies and blockers
   - Estimate complexity and timeline

#### Output: `plan.md`

Should contain:

- **Objective**: Clear problem statement and success criteria
- **Architecture**: High-level design decisions
- **Component breakdown**: What needs to be built/modified
- **Data flow**: How information moves through the system
- **API contracts**: Request/response formats
- **UI/UX considerations**: User flows, states, and interactions
- **Testing strategy**: How to validate correctness
- **Rollout plan**: How to deploy safely
- **Open questions**: Anything still unclear (to be resolved before implementation)

**Example structure:**

```markdown
# Implementation Plan: <Feature Name>

## Objective

Enable users to [specific goal] by [approach]

## Success Criteria

- [ ] Users can complete [action] in <3 clicks
- [ ] Page loads in <1s on 3G
- [ ] Passes all accessibility checks

## Architecture

### Components

- `<FeatureContainer>`: Main orchestrator
- `<FeatureForm>`: User input handling
- `<FeatureResults>`: Display component

### State Management

- Use React Context for [reason]
- Local state for transient UI state

### API Integration

**Endpoint**: `POST /api/feature`
**Request**: `{ param: string, option: boolean }`
**Response**: `{ data: Object[], meta: { total: number } }`

## Implementation Steps

1. Create base component structure
2. Implement API integration with error handling
3. Add form validation and submission
4. Build results display with loading/empty/error states
5. Add keyboard navigation and ARIA labels
6. Write unit and integration tests

## Edge Cases

- Empty state: Show helpful onboarding
- Error state: Provide clear recovery options
- Loading state: Optimistic UI with skeleton

## Testing

- Unit: Component logic and validation
- Integration: API calls and data flow
- E2E: Complete user journeys
- Accessibility: Keyboard nav and screen reader

## Rollout

- Feature flag: `enable_new_feature`
- Gradual rollout: 10% → 50% → 100%
- Monitoring: Track [key metrics]
```

---

### Phase 3: Implementation

**Goal**: Execute the plan with discipline and quality

#### Process

1. **Create todo list**
   - Break plan into atomic, completable tasks
   - Order tasks logically (dependencies first)
   - Estimate each item

2. **Execute systematically**
   - Work through todo list sequentially
   - Check off completed items
   - Document deviations from plan

3. **Handle ambiguity**
   - Batch questions until end of implementation
   - Make reasonable assumptions (document them)
   - Group related questions together

4. **Maintain momentum**
   - Go as long as possible without interruption
   - Prioritize working code over perfect code
   - Refactor after core functionality works

#### Output: `todo.md`

```markdown
# Implementation Checklist

## Setup

- [x] Create component files
- [x] Set up API client
- [ ] Configure feature flag

## Core Functionality

- [x] Implement data fetching
- [ ] Add validation logic
- [ ] Handle error states

## UI/UX

- [ ] Build responsive layout
- [ ] Add loading states
- [ ] Implement keyboard navigation

## Testing

- [ ] Write unit tests
- [ ] Add integration tests
- [ ] Manual QA pass

## Documentation

- [ ] Update README
- [ ] Add JSDoc comments
- [ ] Create usage examples

## Questions/Blockers

- How should we handle [edge case]?
- Need clarification on [requirement]
```

---

### Phase 4: Verification

**Goal**: Ensure implementation meets requirements and quality standards

#### Activities

1. **Functional testing**
   - Test all user flows
   - Verify edge cases
   - Confirm error handling

2. **Non-functional testing**
   - Performance profiling
   - Accessibility audit
   - Cross-browser/device testing

3. **Code review**
   - Self-review against plan
   - Peer review for quality
   - Address feedback

4. **Feedback loops**
   - User testing (if applicable)
   - Stakeholder approval
   - Iterate based on findings

#### Output: `verification.md`

```markdown
# Verification Report

## Test Scenarios

- [x] Happy path: User completes flow successfully
- [x] Error handling: Invalid input shows helpful error
- [x] Edge case: Empty state displays correctly
- [ ] Performance: Loads in <1s (currently 1.3s - needs optimization)

## Accessibility Checklist

- [x] Keyboard navigation works
- [x] Screen reader announces correctly
- [x] Focus indicators visible
- [x] Color contrast passes WCAG AA

## Performance Metrics

- FCP: 0.8s ✓
- LCP: 1.2s ✓
- CLS: 0.05 ✓

## Known Issues

- [ ] Safari 15 has rendering glitch (ticket #123)

## Sign-off

- [ ] Engineering approved
- [ ] Design approved
- [ ] Product approved
```

---

## Development Principles

### Framework & Components

- **MUST** use SHADCN UI components when available
- **SHOULD** extend SHADCN rather than build from scratch
- **MUST** follow established component patterns in codebase

### Development Approach

- **Mobile First**: Design and build for mobile, then enhance for desktop
- **Test Driven**: Write tests alongside (or before) implementation
- **Progressive Enhancement**: Core functionality works everywhere, enhancements for modern browsers

### Code Quality

- **DRY**: Reuse existing code and patterns
- **KISS**: Simple solutions over clever ones
- **YAGNI**: Build what's needed, not what might be needed

---

## UI/UX Excellence Standards

### Interactions

#### Keyboard Support

- **MUST** support full keyboard navigation per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
- **MUST** show visible focus rings using `:focus-visible` (group with `:focus-within`)
- **MUST** manage focus correctly: trap in modals, move logically, return on close

#### Touch Targets & Input

- **MUST** have hit targets ≥24px (mobile ≥44px)
  - If visual element <24px, expand hit area with padding/pseudo-elements
- **MUST** use mobile `<input>` font-size ≥16px to prevent zoom, OR set:
  ```html
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
  />
  ```
- **NEVER** disable browser zoom
- **MUST** use `touch-action: manipulation` to prevent double-tap zoom
- **SHOULD** set `-webkit-tap-highlight-color` to match design system

#### Forms & Input Behavior

- **MUST** make inputs hydration-safe (no lost focus or values on hydration)
- **NEVER** block paste in `<input>` or `<textarea>`
- **MUST** show spinner on loading buttons while keeping original label visible
- **MUST** make Enter submit focused text input
  - In `<textarea>`, ⌘/Ctrl+Enter submits; Enter adds newline
- **MUST** keep submit button enabled until request starts
  - Then: disable, show spinner, use idempotency key
- **MUST** don't block typing—accept free text, validate afterward
- **MUST** allow submitting incomplete forms to surface validation errors
- **MUST** show errors inline next to fields
  - On submit, focus first error field
- **MUST** use proper `autocomplete` attributes and meaningful `name` values
- **MUST** use correct `type` and `inputmode` for each field
- **SHOULD** disable spellcheck for emails, codes, and usernames
- **SHOULD** use placeholder text ending with ellipsis showing example patterns
  - Example: `+1 (123) 456-7890`, `sk-012345…`
- **MUST** warn users before navigating away with unsaved changes
- **MUST** be compatible with password managers and 2FA
  - Allow pasting one-time codes
- **MUST** trim input values to handle text expansion and trailing spaces
- **MUST** eliminate dead zones on checkboxes/radios
  - Label and control share one generous hit target

#### State & Navigation

- **MUST** reflect state in URL (deep-link filters, tabs, pagination, expanded panels)
  - Prefer libraries like [nuqs](https://nuqs.47ng.com)
- **MUST** restore scroll position on back/forward navigation
- **MUST** use `<a>` or `<Link>` components for navigation
  - Support Cmd/Ctrl/middle-click for opening in new tab

#### Feedback & Confirmation

- **SHOULD** use optimistic UI updates
  - Reconcile on response
  - On failure: show error, rollback, or offer Undo
- **MUST** confirm destructive actions OR provide Undo window
- **MUST** use polite `aria-live` regions for toasts and inline validation
- **SHOULD** use ellipsis (`…`) for actions that open follow-ups (e.g., "Rename…")

#### Touch, Drag & Scroll

- **MUST** design forgiving interactions
  - Generous targets, clear affordances, avoid finicky interactions
- **MUST** delay first tooltip in a group; subsequent tooltips show immediately
- **MUST** use intentional `overscroll-behavior: contain` in modals and drawers
- **MUST** during drag: disable text selection, set `inert` on dragged element/containers
- **MUST** ensure interactive zones look interactive ("if it looks clickable, it is")

#### Autofocus

- **SHOULD** autofocus on desktop when there's a single primary input
- **SHOULD** rarely autofocus on mobile (avoid layout shift and unwanted keyboard)

---

### Animation

- **MUST** honor `prefers-reduced-motion` (provide reduced-motion variant)
- **SHOULD** prefer CSS > Web Animations API > JS animation libraries
- **MUST** animate compositor-friendly properties only (`transform`, `opacity`)
  - Avoid layout/repaint properties (`top`, `left`, `width`, `height`)
- **SHOULD** animate only to clarify cause/effect or add deliberate delight
- **SHOULD** choose easing that matches the change (size, distance, trigger type)
- **MUST** make animations interruptible and input-driven (avoid autoplay)
- **MUST** use correct `transform-origin` (motion starts where it "physically" should)

---

### Layout

- **SHOULD** use optical alignment—adjust by ±1px when perception beats geometry
- **MUST** align deliberately to grid/baseline/edges/optical centers
  - No accidental placement
- **SHOULD** balance icon/text lockups (stroke, weight, size, spacing, color)
- **MUST** verify rendering on mobile, laptop, and ultra-wide screens
  - Simulate ultra-wide at 50% zoom
- **MUST** respect safe areas using `env(safe-area-inset-*)`
- **MUST** avoid unwanted scrollbars—fix all overflows

---

### Content & Accessibility

- **SHOULD** provide inline help first; use tooltips as last resort
- **MUST** make skeleton loaders mirror final content to prevent layout shift
- **MUST** set `<title>` to match current context/page
- **MUST** avoid dead ends—always offer next step or recovery action
- **MUST** design all states: empty, sparse, dense, error, loading
- **SHOULD** use curly quotes (" "), avoid widows and orphans
- **MUST** use tabular numbers for comparisons
  - `font-variant-numeric: tabular-nums` or monospace font like Geist Mono
- **MUST** provide redundant status cues (not color-only)
- **MUST** ensure icons have text labels or `aria-label`
- **MUST** don't ship the schema—visuals may omit labels but accessible names must exist
- **MUST** use the ellipsis character `…` (not three periods `...`)
- **MUST** add `scroll-margin-top` on headings for anchored links
- **MUST** include "Skip to content" link for keyboard users
- **MUST** use hierarchical heading structure (`<h1>` through `<h6>`)
- **MUST** be resilient to user-generated content (short, average, very long)
- **MUST** format dates, times, numbers, and currency with locale awareness
- **MUST** provide accurate accessible names via `aria-label` or visible labels
- **MUST** set decorative elements to `aria-hidden="true"`
- **MUST** verify accessibility in browser's Accessibility Tree
- **MUST** give icon-only buttons descriptive `aria-label` attributes
- **MUST** prefer native semantic HTML (`button`, `a`, `label`, `table`) before ARIA
- **SHOULD** enable right-clicking nav logo to surface brand assets
- **MUST** use non-breaking spaces to glue related terms:
  - `10&nbsp;MB`, `⌘&nbsp;+&nbsp;K`, `Vercel&nbsp;SDK`

---

### Performance

- **SHOULD** test in iOS Low Power Mode and macOS Safari
- **MUST** measure reliably (disable browser extensions that skew measurements)
- **MUST** track and minimize re-renders using React DevTools or React Scan
- **MUST** profile with CPU and network throttling enabled
- **MUST** batch layout reads/writes to avoid unnecessary reflows/repaints
- **MUST** target <500ms for mutations (`POST`, `PATCH`, `DELETE`)
- **SHOULD** prefer uncontrolled inputs when possible
  - Make controlled input loops cheap (minimize keystroke cost)
- **MUST** virtualize large lists (e.g., using `virtua` or similar)
- **MUST** preload only above-the-fold images; lazy-load the rest
- **MUST** prevent Cumulative Layout Shift (CLS) from images
  - Use explicit dimensions or reserved space

---

### Design

- **SHOULD** use layered shadows (ambient + directional)
- **SHOULD** create crisp edges with semi-transparent borders + shadows
- **SHOULD** use nested border radii: child ≤ parent radius for concentric look
- **SHOULD** maintain hue consistency: tint borders, shadows, and text toward background hue
- **MUST** use accessible, color-blind-friendly chart palettes
- **MUST** meet contrast requirements—prefer [APCA](https://apcacontrast.com/) over WCAG 2.x
- **MUST** increase contrast on `:hover`, `:active`, and `:focus` states
- **SHOULD** style browser chrome (theme-color, etc.) to match background
- **SHOULD** prevent gradient banding using dithering or masks

---

## Quick Reference

### Task Checklist

```
[ ] Create task directory
[ ] Complete research phase → research.md
[ ] Write implementation plan → plan.md
[ ] Create and execute todo list → todo.md
[ ] Verify and document → verification.md
[ ] Get stakeholder approval
[ ] Deploy with monitoring
```

### Key Questions Before Starting

1. What problem are we solving, and for whom?
2. What existing code can we reuse?
3. What are the edge cases and error scenarios?
4. How will we know this is successful?
5. What could go wrong, and how do we mitigate it?

### Red Flags

- ⚠️ No existing pattern found → May need architecture discussion
- ⚠️ Unclear requirements → Stop and clarify
- ⚠️ Large scope → Consider breaking into smaller tasks
- ⚠️ Many assumptions → Document and validate
- ⚠️ No verification plan → Define success criteria first

---

## Maintenance

This document should be:

- **Reviewed** quarterly for relevance
- **Updated** when patterns change
- **Referenced** during task kickoffs
- **Followed** consistently across team

Last updated: [Date]
Version: 2.0
