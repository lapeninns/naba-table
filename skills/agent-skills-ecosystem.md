---
skill: agent-skills-ecosystem
version: 1.0
category: meta
phases: []
updated: 2025-12-22
---

# Agent Skills Ecosystem

**Purpose**: Understand the Agent Skills format, ecosystem, and how to create and share reusable skill modules.

**When to Use**: Reference when:

- Learning about the AGENTS.md architecture
- Creating new skill files
- Evaluating skills for adoption
- Understanding modular documentation patterns

---

## What are Agent Skills?

Agent Skills are modular, reusable documentation modules that extend the capabilities of AI coding agents and human developers. They follow a standardized format that allows:

- **Portability** — Skills can be shared across projects and teams
- **Discoverability** — Frontmatter enables tooling and search
- **Composability** — Skills can be combined and referenced
- **Version Control** — Skills evolve independently

### Core Concept

The Agent Skills architecture separates **workflow orchestration** (AGENTS.md) from **capability specifications** (skills/\*.md):

```
AGENTS.md          → What to do and when (SDLC phases, gates, checklists)
skills/*.md        → How to do it (detailed instructions, examples, patterns)
```

This separation enables:

- Clean, scannable workflow documentation
- Deep-dive reference materials when needed
- Independent evolution of skills
- Sharing skills across multiple projects

---

## Why AGENTS.md?

### AGENTS.md vs. README.md

| Aspect          | AGENTS.md                      | README.md                              |
| --------------- | ------------------------------ | -------------------------------------- |
| **Audience**    | AI agents + engineers          | Humans (users, contributors)           |
| **Purpose**     | Authoritative workflow policy  | Introduction and getting started       |
| **Content**     | SDLC, gates, checklists, rules | Overview, installation, usage examples |
| **Format**      | Structured with frontmatter    | Freeform narrative                     |
| **Enforcement** | CI/CD integration              | Social/review process                  |

### Why the Name?

- **AGENTS** = The primary audience (AI coding agents)
- **.md** = Markdown for universal readability
- **Uppercase** = Signals importance (like LICENSE, README)
- **Root location** = Authoritative, discoverable

---

## File Structure

### Recommended Repository Layout

```
/repo/
├── AGENTS.md                           # Workflow orchestrator (root)
├── skills/
│   ├── continuity-ledger.md           # Session continuity
│   ├── frontend-aesthetics.md         # UI design principles
│   ├── mcp-integration.md             # MCP server catalog
│   ├── style-principles.md            # DRY/KISS/YAGNI
│   └── agent-skills-ecosystem.md      # This file (meta)
├── CONTINUITY.md                       # Runtime state (session-specific)
├── tasks/                              # Timestamped task folders
│   └── feature-name-20251222-1000/
├── apps/
│   └── web/
│       └── AGENTS.md                   # Subproject-specific rules
└── README.md                           # Human-facing introduction
```

### Skills Directory Organization

Skills can be organized by category:

```
skills/
├── session-management/
│   └── continuity-ledger.md
├── design/
│   ├── frontend-aesthetics.md
│   └── responsive-patterns.md
├── tooling/
│   └── mcp-integration.md
├── coding-standards/
│   ├── style-principles.md
│   └── testing-patterns.md
└── meta/
    └── agent-skills-ecosystem.md
```

Or kept flat for smaller projects:

```
skills/
├── continuity-ledger.md
├── frontend-aesthetics.md
├── mcp-integration.md
├── style-principles.md
└── agent-skills-ecosystem.md
```

---

## Skill File Format

### Required Structure

Every skill file must include:

1. **YAML Frontmatter** — Metadata for tooling and discovery
2. **Title and Purpose** — Clear statement of what the skill provides
3. **When to Use** — Guidance on appropriate application
4. **Content** — The actual skill documentation

### Frontmatter Specification

```yaml
---
skill: skill-name # Unique identifier (lowercase, hyphens)
version: 1.0 # Semantic version
category: design|tooling|coding-standards|session-management|meta
phases: [0, 1, 2, 3, 4, 5, 6, 7] # SDLC phases where skill applies
updated: YYYY-MM-DD # Last update date
author: github:@handle # Optional: skill author
---
```

### Content Structure Template

````markdown
---
skill: your-skill-name
version: 1.0
category: your-category
phases: [relevant, phases]
updated: 2025-12-22
---

# Skill Name

**Purpose**: One-line description of what this skill enables.

**When to Use**:

- Phase X (Name) — Specific scenario

---

## Overview

Brief introduction to the skill and its importance.

---

## Core Concepts

### Concept 1

Explanation with examples.

### Concept 2

Explanation with examples.

---

## Workflows

### Workflow Name

Step-by-step process for applying this skill.

---

## Examples

### Example 1: Basic Usage

```code
// Code example
```
````

### Example 2: Advanced Usage

```code
// Code example
```

---

## Anti-Patterns

### ❌ Don't Do This

Explanation and examples of what to avoid.

### ✅ Do This Instead

Correct approach with examples.

---

## Decision Framework

Questions or checklist to guide decisions.

---

## Verification Checklist

```text
[ ] Check 1
[ ] Check 2
[ ] Check 3
```

````

---

## Referencing Skills in AGENTS.md

### Inline Reference

```markdown
Apply **Style Principles** (skills/style-principles.md) when making architectural decisions.
````

### Phase Reference Block

```markdown
### Phase 2 — Design & Planning

**Apply Skills**:

- **Frontend Aesthetics** (skills/frontend-aesthetics.md) — UI design direction
- **MCP Integration** (skills/mcp-integration.md) — Shadcn, Supabase, Next DevTools
- **Style Principles** (skills/style-principles.md) — DRY/KISS/YAGNI

**Activities**:

- Define architecture and data flow
- ...
```

### SDLC Table with Skills Column

```markdown
| SDLC Phase | What happens          | Skills                                         |
| ---------- | --------------------- | ---------------------------------------------- |
| Phase 1    | Requirements analysis | Context7, DeepWiki (skills/mcp-integration.md) |
| Phase 2    | Design & planning     | Frontend Aesthetics, Style Principles          |
| Phase 3    | Implementation        | MCP Integration, Style Principles              |
| Phase 4    | Verification          | MCP Integration (Chrome DevTools)              |
```

---

## Creating Custom Skills

### Step 1: Identify the Need

- Is this a repeatable pattern?
- Would others benefit from this documentation?
- Does it warrant its own file vs. inline in AGENTS.md?

### Step 2: Define Scope

- What SDLC phases does it apply to?
- What category does it belong to?
- What are the boundaries? (What it is vs. isn't)

### Step 3: Write the Content

Follow the template above. Include:

- Clear purpose and when-to-use
- Practical examples (Do/Don't format)
- Decision frameworks
- Verification checklists

### Step 4: Add Frontmatter

Include all required metadata fields.

### Step 5: Reference from AGENTS.md

Add references in relevant SDLC phases.

### Step 6: Test the Skill

- Follow the skill's instructions on a real task
- Verify completeness and clarity
- Refine based on experience

---

## Skill Categories

| Category             | Description                        | Examples                                 |
| -------------------- | ---------------------------------- | ---------------------------------------- |
| `session-management` | Context and state persistence      | Continuity Ledger                        |
| `design`             | Visual and UX patterns             | Frontend Aesthetics, Responsive Patterns |
| `tooling`            | Development tools and integrations | MCP Integration                          |
| `coding-standards`   | Code quality and style             | Style Principles, Testing Patterns       |
| `security`           | Security practices                 | Auth Patterns, Input Validation          |
| `performance`        | Performance optimization           | Bundle Optimization, Caching             |
| `meta`               | About the skills system itself     | Agent Skills Ecosystem                   |

---

## Design Principles

### Separation of Concerns

- **AGENTS.md**: Orchestrates workflow, references skills
- **skills/\*.md**: Provides deep capability documentation
- **CONTINUITY.md**: Tracks runtime/session state

### Open Format

- Plain Markdown for universal readability
- YAML frontmatter for tooling
- No proprietary extensions

### Portability

- Skills can be copied between projects
- No project-specific assumptions in skill content
- Clear abstraction boundaries

### Versioning

- Skills track their own versions
- AGENTS.md can reference specific skill versions if needed
- Breaking changes require major version bump

---

## Resources

### External Resources

- [AgentSkills.io](https://agentskills.io) — Community skill directory (hypothetical)
- [AGENTS.md Specification](https://github.com/agentskills/spec) — Format specification (hypothetical)

### Related Concepts

- **Prompt Engineering** — Skills are structured prompts
- **Documentation-as-Code** — Skills are versioned documentation
- **Modular Monorepos** — Skills follow similar composition patterns

---

## Verification Checklist

```text
# For New Skills
[ ] Frontmatter includes all required fields
[ ] Purpose and when-to-use are clear
[ ] Examples follow Do/Don't format
[ ] Decision framework or checklist included
[ ] Referenced from relevant AGENTS.md phases

# For AGENTS.md Integration
[ ] Skills directory exists
[ ] References use (skills/file.md) notation
[ ] Each phase lists applicable skills
[ ] Skills cover all capability needs
```
