# AGENTS.md

> **Instructions for AI coding agents working on this project**

---

## Project Overview

This project follows a systematic **Context Engineering Framework** for all development work. Before writing any code, you must follow the structured workflow phases to ensure quality, consistency, and maintainability.

---

## Core Workflow: Task-Based Development

### Task Structure

Every feature, bug fix, or enhancement is treated as a discrete task with its own timestamped directory:

```
tasks/<task-id>-YYYYMMDD-HHMM/
├── research.md      # Findings, patterns, and resources
├── plan.md          # Implementation strategy and requirements
├── todo.md          # Executable checklist
└── verification.md  # Test scenarios and validation criteria
```

**Task ID naming**: Use semantic slug + timestamp (e.g., `user-authentication-flow-20250110-1430`, `payment-gateway-integration-20250110-0915`)

**Timestamp format**: `YYYYMMDD-HHMM` (Year Month Day - Hour Minute in 24-hour format)

---

## Mandatory Workflow Phases

You **MUST** follow these phases in order. Do not skip phases or write code prematurely.

### Phase 0: Task Setup

**Before anything else:**

1. Create task directory with timestamp: `tasks/<semantic-task-id>-YYYYMMDD-HHMM/`
   - Example: `tasks/user-auth-flow-20250110-1430/`
2. Document initial requirements
3. Identify success criteria

**Timestamp format**: Use `YYYYMMDD-HHMM` format (e.g., `20250110-1430` for January 10, 2025 at 2:30 PM)

### Phase 1: Research (`research.md`)

**Goal**: Build comprehensive understanding before planning or coding.

**Required activities:**

- Search codebase for existing patterns, components, and utilities
- Identify reusable code and established conventions
- Note technical debt or anti-patterns to avoid
- Review external documentation, RFCs, or specifications (if applicable)
- Document all findings, constraints, and recommendations

**Output**: `research.md` containing:

- Existing patterns discovered
- Relevant external resources
- Technical constraints or dependencies
- Open questions and answers
- Recommended approach with rationale

**Example structure**:

```markdown
# Research: <Feature Name>

## Existing Patterns

- Component X handles similar logic
- API pattern Y is used consistently

## External Resources

- [Documentation](url)
- Best practices from [source](url)

## Technical Constraints

- Must support React 18 concurrent features
- Performance budget: <200ms initial render

## Recommendations

Recommend approach Z because...
```

### Phase 2: Planning (`plan.md`)

**Goal**: Create comprehensive, implementable blueprint.

**Required activities:**

- Review `research.md` thoroughly
- Design solution using existing patterns
- Follow established architectural patterns
- Plan for edge cases and error states
- Validate scope with stakeholder if needed

**Output**: `plan.md` containing:

- **Objective**: Problem statement and success criteria
- **Architecture**: High-level design decisions
- **Component breakdown**: What needs to be built/modified
- **Data flow**: How information moves through system
- **API contracts**: Request/response formats
- **UI/UX considerations**: User flows, states, interactions
- **Testing strategy**: How to validate correctness
- **Edge cases**: Error states, empty states, loading states
- **Rollout plan**: Deployment strategy

**Example structure**:

```markdown
# Implementation Plan: <Feature Name>

## Objective

Enable users to [goal] by [approach]

## Success Criteria

- [ ] Users can complete [action] in <3 clicks
- [ ] Page loads in <1s on 3G
- [ ] Passes accessibility checks

## Architecture

### Components

- `<FeatureContainer>`: Main orchestrator
- `<FeatureForm>`: User input handling

### State Management

Use React Context for [reason]

### API Integration

**Endpoint**: `POST /api/feature`
**Request**: `{ param: string }`
**Response**: `{ data: Object[] }`

## Implementation Steps

1. Create base component structure
2. Implement API integration
3. Add form validation
4. Build results display
5. Add accessibility features
6. Write tests

## Edge Cases

- Empty state: Show onboarding
- Error state: Provide recovery options
- Loading state: Show skeleton

## Testing

- Unit: Component logic
- Integration: API calls
- E2E: User journeys
- Accessibility: Keyboard nav

## Rollout

- Feature flag: `enable_new_feature`
- Gradual: 10% → 50% → 100%
```

### Phase 3: Implementation (`todo.md`)

**Goal**: Execute plan systematically.

**Process:**

1. Create `todo.md` breaking plan into atomic tasks
2. Work through checklist sequentially
3. Check off completed items
4. Document deviations from plan
5. **Batch questions** until end of implementation
6. Make reasonable assumptions (document them)

**Guidelines:**

- ✅ Work as long as possible without interruption
- ✅ Prioritize working code over perfect code
- ✅ Refactor after core functionality works
- ❌ Don't stop for every small question
- ❌ Don't interrupt momentum for clarifications

**Output**: `todo.md` with checklist:

```markdown
# Implementation Checklist

## Setup

- [x] Create component files
- [ ] Configure feature flag

## Core Functionality

- [x] Implement data fetching
- [ ] Add validation logic

## UI/UX

- [ ] Build responsive layout
- [ ] Add loading states

## Testing

- [ ] Write unit tests
- [ ] Manual QA pass

## Questions/Blockers

- How should we handle [edge case]?
```

### Phase 4: Verification (`verification.md`)

**Goal**: Ensure implementation meets requirements and quality standards.

**Required activities:**

- Test all user flows
- Verify edge cases
- Confirm error handling
- Performance profiling
- Accessibility audit
- Cross-browser/device testing

**Output**: `verification.md` containing:

```markdown
# Verification Report

## Test Scenarios

- [x] Happy path works
- [x] Error handling correct
- [ ] Performance needs optimization

## Accessibility Checklist

- [x] Keyboard navigation works
- [x] Screen reader support
- [x] Focus indicators visible

## Performance Metrics

- FCP: 0.8s ✓
- LCP: 1.2s ✓

## Known Issues

- [ ] Safari 15 rendering glitch

## Sign-off

- [ ] Engineering approved
- [ ] Design approved
```

---

## Framework & Component Requirements

### UI Components

- **MUST** use SHADCN UI components when available
- **MUST** extend SHADCN rather than build from scratch
- **MUST** follow established component patterns in codebase
- Search codebase first before creating new components

### Development Approach

- **Mobile First**: Design and build for mobile, then enhance for desktop
- **Test Driven**: Write tests alongside (or before) implementation
- **Progressive Enhancement**: Core functionality works everywhere

### Code Quality Principles

- **DRY**: Reuse existing code and patterns
- **KISS**: Simple solutions over clever ones
- **YAGNI**: Build what's needed, not what might be needed

---

## UI/UX Excellence Standards

### Keyboard & Focus

- **MUST** support full keyboard navigation per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
- **MUST** show visible focus rings using `:focus-visible`
- **MUST** manage focus correctly: trap in modals, move logically, return on close

### Touch Targets

- **MUST** have hit targets ≥24px (mobile ≥44px)
- If visual element <24px, expand hit area with padding/pseudo-elements
- **MUST** use `touch-action: manipulation` to prevent double-tap zoom

### Forms & Input

- **MUST** use mobile `<input>` font-size ≥16px to prevent zoom, OR set proper viewport meta
- **NEVER** disable browser zoom
- **NEVER** block paste in inputs
- **MUST** make inputs hydration-safe (no lost focus/values)
- **MUST** show spinner on loading buttons while keeping label visible
- **MUST** make Enter submit focused text input
  - In `<textarea>`, ⌘/Ctrl+Enter submits; Enter adds newline
- **MUST** keep submit button enabled until request starts
- **MUST** allow submitting incomplete forms to surface validation errors
- **MUST** show errors inline next to fields (focus first error on submit)
- **MUST** use proper `autocomplete` attributes and meaningful `name` values
- **MUST** use correct `type` and `inputmode` for each field
- **MUST** warn users before navigating away with unsaved changes
- **MUST** trim input values

### State & Navigation

- **MUST** reflect state in URL (deep-link filters, tabs, pagination)
- **MUST** restore scroll position on back/forward navigation
- **MUST** use `<a>` or `<Link>` for navigation (support Cmd/Ctrl/middle-click)

### Feedback

- **SHOULD** use optimistic UI updates (reconcile on response)
- **MUST** confirm destructive actions OR provide Undo window
- **MUST** use polite `aria-live` regions for toasts and validation

### Animation

- **MUST** honor `prefers-reduced-motion`
- **MUST** animate only compositor-friendly properties (`transform`, `opacity`)
- **MUST** make animations interruptible and input-driven

### Layout

- **MUST** verify rendering on mobile, laptop, and ultra-wide screens
- **MUST** respect safe areas using `env(safe-area-inset-*)`
- **MUST** avoid unwanted scrollbars

### Content & Accessibility

- **MUST** set `<title>` to match current context
- **MUST** design all states: empty, sparse, dense, error, loading
- **MUST** provide redundant status cues (not color-only)
- **MUST** ensure icons have text labels or `aria-label`
- **MUST** use hierarchical heading structure
- **MUST** provide accurate accessible names
- **MUST** prefer native semantic HTML before ARIA
- **MUST** use non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;+&nbsp;K`
- **MUST** use ellipsis character `…` (not three periods)

### Performance

- **MUST** track and minimize re-renders
- **MUST** profile with CPU and network throttling
- **MUST** target <500ms for mutations
- **MUST** virtualize large lists
- **MUST** prevent Cumulative Layout Shift from images

---

## Nested AGENTS.md Files

### When to Create Nested Files

For **large monorepos** or projects with distinct subprojects/packages, create nested `AGENTS.md` files inside each subproject directory.

### Nested File Rules

1. **Automatic precedence**: Agents automatically read the nearest `AGENTS.md` in the directory tree
2. **Closest wins**: The closest file takes precedence for that subproject
3. **Tailored instructions**: Each subproject can ship specific guidelines

### Creating Nested Files

**Main AGENTS.md creates nested files when:**

- A subproject has unique build/test commands
- Different code style or testing requirements exist
- Subproject uses different frameworks or patterns
- Security or deployment differs from main project

**Nested AGENTS.md structure:**

```
/
├── AGENTS.md (main, you are reading this)
├── packages/
│   ├── web-app/
│   │   ├── AGENTS.md (web-specific instructions)
│   │   └── src/
│   ├── api-server/
│   │   ├── AGENTS.md (API-specific instructions)
│   │   └── src/
│   └── shared-ui/
│       ├── AGENTS.md (UI component library instructions)
│       └── components/
```

**Nested AGENTS.md template:**

```markdown
# AGENTS.md - [Subproject Name]

> Inherits from main AGENTS.md with these additions/overrides

## Subproject Overview

[Brief description]

## Build Commands

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run test` - Run tests

## Subproject-Specific Guidelines

[Any unique patterns, conventions, or requirements]

## Additional Context

[Links to relevant documentation]
```

### Example: Large Monorepo

```
my-monorepo/
├── AGENTS.md                          # Main project guidelines
├── apps/
│   ├── web/
│   │   └── AGENTS.md                  # Next.js web app specifics
│   ├── mobile/
│   │   └── AGENTS.md                  # React Native specifics
│   └── admin/
│       └── AGENTS.md                  # Admin dashboard specifics
├── packages/
│   ├── ui/
│   │   └── AGENTS.md                  # Design system guidelines
│   ├── api-client/
│   │   └── AGENTS.md                  # API client patterns
│   └── database/
│       └── AGENTS.md                  # Database migrations & schema
└── infrastructure/
    └── AGENTS.md                      # Deployment & infrastructure
```

---

## MCP Server Integration

**MUST** always utilize MCP (Model Context Protocol) server whenever possible for:

- Enhanced context retrieval
- Codebase navigation
- Pattern discovery
- Documentation access

---

## Red Flags & Warnings

Stop and address these immediately:

- ⚠️ **No existing pattern found** → May need architecture discussion
- ⚠️ **Unclear requirements** → Stop and clarify before proceeding
- ⚠️ **Large scope** → Consider breaking into smaller tasks
- ⚠️ **Many assumptions** → Document and validate with stakeholder
- ⚠️ **No verification plan** → Define success criteria first

---

## Quick Reference Checklist

```
[ ] Create task directory with semantic ID + timestamp (YYYYMMDD-HHMM)
[ ] Complete research phase → research.md
[ ] Write implementation plan → plan.md
[ ] Create and execute todo list → todo.md
[ ] Verify and document → verification.md
[ ] Get stakeholder approval
[ ] Deploy with monitoring
```

---

## Key Questions Before Starting Any Task

1. What problem are we solving, and for whom?
2. What existing code can we reuse?
3. What are the edge cases and error scenarios?
4. How will we know this is successful?
5. What could go wrong, and how do we mitigate it?

---

## Notes for AI Agents

- **Follow phases sequentially** - do not skip research or planning
- **Batch questions** during implementation to maintain momentum
- **Document assumptions** when making reasonable judgments
- **Search codebase first** before creating new patterns
- **Prioritize SHADCN** components over custom builds
- **Mobile-first** approach for all UI work
- **Accessibility is not optional** - follow all MUST requirements
- **Create nested AGENTS.md** for subprojects in monorepos

---

**Last Updated**: 2025-01-10  
**Version**: 3.0
