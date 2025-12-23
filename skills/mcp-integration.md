---
skill: mcp-integration
version: 1.0
category: tooling
phases: [1, 2, 3, 4, 6]
updated: 2025-12-22
---

# MCP Integration Skill

**Purpose**: Leverage Model Context Protocol (MCP) servers effectively for repeatability, safety, and scale throughout the development lifecycle.

**When to Use**: Throughout SDLC phases as needed for specific capabilities:

- **Phase 1 (Requirements)** — Context7, DeepWiki for research
- **Phase 2 (Design)** — Shadcn, Supabase, Next DevTools for planning
- **Phase 3 (Implementation)** — Shadcn, Supabase, Next DevTools for building
- **Phase 4 (Verification)** — Chrome DevTools for QA
- **Phase 6 (Release)** — Supabase for migrations

---

## Core Principle

> Use MCP when it provides **repeatability, safety, or scale**. Configure via env/secrets; **do not commit tokens**.

---

## MCP Server Catalog

### 1. Chrome DevTools MCP

**Purpose**: Manual QA, debugging, and performance profiling

**Phase**: 4 (Verification & Validation)

**Rule**: **Required** for any UI change; must attach artifacts

#### Capabilities

- Console log monitoring and error detection
- Network request inspection
- Device emulation (mobile, tablet, desktop)
- Performance profiling (CPU, memory)
- Lighthouse audits (performance, accessibility, SEO)
- DOM inspection and accessibility tree analysis
- Screenshot capture

#### Workflow

```markdown
## Chrome DevTools QA Workflow

### 1. Pre-flight

[ ] Browser launched
[ ] DevTools open
[ ] Network tab recording
[ ] Console cleared

### 2. Console & Network

[ ] Navigate to page under test
[ ] Log all console errors/warnings
[ ] Verify network requests match expected contracts
[ ] Check for failed requests (4xx, 5xx)

### 3. Device Emulation

[ ] Test mobile viewport (375px)
[ ] Test tablet viewport (768px)
[ ] Test desktop viewport (1280px+)
[ ] Verify responsive breakpoints

### 4. Accessibility

[ ] Run axe DevTools audit
[ ] Verify keyboard navigation
[ ] Check focus visibility
[ ] Validate ARIA attributes

### 5. Performance

[ ] Enable CPU throttling (4x slowdown)
[ ] Enable network throttling (Slow 4G)
[ ] Run Lighthouse audit
[ ] Capture metrics: FCP, LCP, CLS, TBT

### 6. Artifacts

[ ] Export Lighthouse JSON → artifacts/lighthouse-report.json
[ ] Export HAR file → artifacts/network.har
[ ] Capture screenshots → artifacts/
```

#### Example Usage

```typescript
// In verification.md, record Chrome DevTools findings:

## Manual QA — Chrome DevTools (MCP)

### Console & Network
- [x] No console errors
- [x] API calls return 200 for /api/bookings
- [x] No CORS issues

### Performance (mobile; 4× CPU; 4G)
- FCP: 1.8s ✅
- LCP: 2.3s ✅
- CLS: 0.05 ✅
- TBT: 180ms ✅

### Artifacts
- Lighthouse: artifacts/lighthouse-report.json
- Network: artifacts/network.har
- Screenshots: artifacts/booking-flow-*.png
```

---

### 2. Shadcn MCP

**Purpose**: Discover and scaffold UI components from the Shadcn library

**Phases**: 2 (Design), 3 (Implementation)

**Rule**: **Prefer Shadcn** before building custom components

#### Capabilities

- List available Shadcn components
- View component documentation and props
- Scaffold components into project
- Sync design tokens

#### Workflow

```markdown
## Shadcn Component Workflow

### 1. Discovery

[ ] Query available components matching need
[ ] Review component documentation
[ ] Check component dependencies

### 2. Evaluation

[ ] Verify component supports required a11y features
[ ] Check customization options
[ ] Confirm no styling conflicts

### 3. Installation

[ ] Add component via Shadcn CLI
[ ] Verify component renders correctly
[ ] Test with project's design tokens

### 4. Customization (if needed)

[ ] Extend component with variants
[ ] Add project-specific styles
[ ] Document deviations in plan.md
```

#### Example Usage

```typescript
// Query for form components
"Find Shadcn components for form inputs with validation"

// Add component to project
npx shadcn@latest add form input button

// Extend with custom variants
// components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex items-center...",
  {
    variants: {
      variant: {
        default: "bg-primary...",
        destructive: "bg-destructive...",
        // Custom variant for this project
        booking: "bg-booking-primary hover:bg-booking-primary-dark...",
      },
    },
  }
)
```

#### When NOT to Use Shadcn

Document in `plan.md` if you need custom components due to:

- No Shadcn equivalent exists
- Required a11y pattern not supported
- Design requires fundamentally different structure
- Performance constraints require different approach

---

### 3. Next DevTools MCP

**Purpose**: Inspect Next.js routing, data fetching, and bundle optimization

**Phases**: 2 (Design), 3 (Implementation)

#### Capabilities

- Inspect App Router structure
- Analyze server/client component boundaries
- View route handlers and middleware
- Identify bundle size issues
- Debug data fetching patterns

#### Workflow

```markdown
## Next DevTools Workflow

### 1. Route Analysis

[ ] List all routes in app directory
[ ] Identify dynamic routes and params
[ ] Check middleware coverage

### 2. Component Boundaries

[ ] Verify server vs client component split
[ ] Check for unnecessary client boundaries
[ ] Identify hydration issues

### 3. Bundle Analysis

[ ] Check route-level bundle sizes
[ ] Identify large dependencies
[ ] Find opportunities for code splitting

### 4. Data Fetching

[ ] Review fetch patterns in server components
[ ] Check caching strategies
[ ] Verify revalidation settings
```

---

### 4. Supabase MCP

**Purpose**: Manage remote database migrations, seeds, and schema inspection

**Phases**: 2 (Design), 3 (Implementation), 6 (Release)

**Rule**: **Remote only** — never run against local instance; connections via secrets

#### Capabilities

- List tables and schema
- Preview migrations (dry run)
- Apply migrations to remote
- Manage seeds
- Check schema drift
- Generate TypeScript types

#### Safety Requirements

```markdown
## Supabase Safety Checklist

### Before Any Migration

[ ] Target environment confirmed (staging vs production)
[ ] Backup/PITR verified
[ ] Rollback plan documented
[ ] On-call acknowledged (production only)

### Migration Strategy

[ ] Expansion phase (add new, don't remove)
[ ] Backfill phase (populate new columns)
[ ] Contraction phase (remove old after verification)

### Execution

[ ] Dry-run output attached to artifacts/db-diff.txt
[ ] Migration applied to staging first
[ ] Staging verified before production
[ ] Production window scheduled
```

#### Workflow

```markdown
## Supabase Migration Workflow

### 1. Pre-flight

[ ] Confirm target: staging or production
[ ] Check current migration status
[ ] Verify connection (via MCP)

### 2. Plan Migration

[ ] Generate migration SQL
[ ] Review for locking operations
[ ] Estimate execution time
[ ] Plan chunk size for large backfills

### 3. Dry Run

[ ] Execute dry run via MCP
[ ] Attach output to artifacts/db-diff.txt
[ ] Review for unexpected changes

### 4. Apply (Staging First)

[ ] Apply to staging
[ ] Verify application behavior
[ ] Run integration tests
[ ] Document migration ID

### 5. Apply (Production)

[ ] Schedule change window
[ ] Notify on-call
[ ] Apply migration
[ ] Monitor for errors
[ ] Document completion in verification.md

### 6. Rollback (if needed)

[ ] Execute rollback steps from plan
[ ] Apply compensating migration
[ ] Document incident in task folder
```

#### Example

```sql
-- Migration: Add cancelled_at column
-- Phase: Expansion (safe to rollback)

ALTER TABLE bookings
ADD COLUMN cancelled_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX CONCURRENTLY idx_bookings_cancelled_at
ON bookings(cancelled_at)
WHERE cancelled_at IS NOT NULL;

-- Rollback:
-- DROP INDEX IF EXISTS idx_bookings_cancelled_at;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS cancelled_at;
```

---

### 5. Context7 MCP

**Purpose**: Semantic search over internal codebase and documentation

**Phase**: 1 (Requirements & Analysis)

#### Capabilities

- Search codebase by natural language query
- Find similar implementations
- Identify reusable patterns
- Locate configuration and constants

#### Workflow

```markdown
## Context7 Research Workflow

### 1. Pattern Discovery

[ ] Search for similar features in codebase
[ ] Identify existing abstractions
[ ] Find related tests

### 2. Anti-pattern Detection

[ ] Look for deprecated patterns
[ ] Check for known issues
[ ] Review previous refactors

### 3. Documentation

[ ] Record findings in research.md
[ ] Link to reusable code
[ ] Note anti-patterns to avoid
```

#### Example Queries

```
"How is booking validation implemented?"
"Find authentication middleware patterns"
"Where is the email notification logic?"
"Show me error handling in API routes"
```

---

### 6. DeepWiki MCP

**Purpose**: External and domain research summaries

**Phase**: 1 (Requirements & Analysis)

#### Capabilities

- Summarize external documentation
- Research domain concepts
- Find best practices
- Compare implementation approaches

#### Workflow

```markdown
## DeepWiki Research Workflow

### 1. External Research

[ ] Query for relevant specs/standards
[ ] Research domain terminology
[ ] Find industry best practices

### 2. Synthesis

[ ] Summarize key findings
[ ] Extract actionable insights
[ ] Note relevant constraints

### 3. Documentation

[ ] Add findings to research.md
[ ] Link to authoritative sources
[ ] Explain relevance to task
```

---

## MCP Pre-Flight Checklist

Copy this into `verification.md` when using any MCP:

```text
## MCP Pre-Flight

[ ] Server reachable (version printed)
[ ] Session token valid (if required)
[ ] Secrets sourced via env (not logged)
[ ] Target environment confirmed (staging/prod)
```

---

## Configuration

### Environment Variables

```bash
# .env.local (never commit!)

# Supabase (example)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Chrome DevTools MCP (if applicable)
CDP_ENDPOINT=ws://localhost:9222

# Other MCP configurations...
```

### Security Requirements

- All tokens via environment variables
- Never log secrets (even in debug mode)
- Rotate tokens regularly
- Use least-privilege access
- Audit MCP actions in artifacts

---

## Fallback: When MCP is Unavailable

If MCP is temporarily unavailable:

1. Run equivalent **CLI/manual steps**
2. **Attach artifacts** (screenshots, logs, HAR files)
3. **Document the workaround** in verification.md
4. **Plan to re-verify** via MCP when available

> MCP usage is still **required** long-term. Manual workarounds are temporary.

---

## Verification Checklist

```text
# General
[ ] MCP server reachable
[ ] Correct environment targeted
[ ] Secrets not logged/committed

# Chrome DevTools
[ ] All viewports tested
[ ] Performance metrics captured
[ ] Accessibility audit run
[ ] Artifacts exported

# Shadcn
[ ] Component fits need
[ ] A11y features verified
[ ] Customizations documented

# Supabase
[ ] Backup confirmed
[ ] Dry-run completed
[ ] Staging applied first
[ ] Production window scheduled
[ ] Rollback plan documented

# Context7 / DeepWiki
[ ] Findings documented in research.md
[ ] Reuse opportunities identified
[ ] Anti-patterns noted
```
