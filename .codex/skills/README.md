# Codex Skills Directory

This directory contains project-specific skill definitions for AI coding agents (Codex agents).

## What are Skills?

Skills are reusable, composable capabilities that agents can invoke to perform specialized tasks. They provide:

- **Structured workflows** with clear inputs/outputs
- **Domain expertise** (e.g., database migrations, UI testing, security scanning)
- **Consistency** across agent sessions and team members
- **Traceability** via skill versioning and metadata

## Directory Structure

```
.codex/skills/
├── README.md              # This file
├── <skill-name>/
│   ├── SKILL.md           # Skill definition (required)
│   ├── references/        # Supporting docs, examples (optional)
│   └── scripts/           # Automation scripts (optional)
└── ...
```

## Skill Definition Format

Each skill must include a `SKILL.md` file with:

```markdown
---
skill_id: <unique-id>
version: 1.0.0
owner: github:@<handle>
tags: [<tag1>, <tag2>]
---

# <Skill Name>

## Purpose

<What this skill does and when to use it>

## Inputs

- `<param1>`: <description>
- `<param2>`: <description>

## Outputs

- `<output1>`: <description>

## Workflow

1. <Step 1>
2. <Step 2>
3. ...

## Examples

\`\`\`bash

# Example usage

\`\`\`

## References

- [Doc](url)
```

## Global vs Project Skills

- **Global skills**: Located in `~/.codex/skills/` (user-wide, cross-project)
- **Project skills**: Located in `.codex/skills/` (repo-specific, versioned with code)

Project skills override global skills with the same `skill_id`.

## Creating a New Skill

1. Create directory: `.codex/skills/<skill-name>/`
2. Add `SKILL.md` with metadata and workflow
3. (Optional) Add `references/` and `scripts/`
4. Commit to repo for team use

## Using Skills

Agents can invoke skills via:

```
Use the <skill-name> skill to <task>
```

Or reference directly:

```
Follow the workflow in .codex/skills/<skill-name>/SKILL.md
```

## Best Practices

- **Keep skills focused**: One skill = one well-defined task
- **Document assumptions**: List prerequisites and constraints
- **Version carefully**: Increment version on breaking changes
- **Test workflows**: Verify steps with real examples
- **Link references**: Provide external docs/specs where relevant

## Example Skills (Global)

See `~/.codex/skills/` for global skills including:

- **Continuity Ledger** — Session continuity pattern
- **Multi-Agent Collaboration** — Multi-agent coordination
- **Frontend Aesthetics** — UI design principles
- **MCP Integration** — MCP server workflows
- **Style Principles** — DRY/KISS/YAGNI guidelines

## Contributing

To add a project skill:

1. Follow the structure above
2. Add to `.codex/skills/<skill-name>/SKILL.md`
3. Update this README with a brief description
4. Open a PR with the skill definition

## References

- [Agent Skills Ecosystem](~/.codex/skills/agent-skills-ecosystem/SKILL.md) — Meta-information about skills format
- [AGENTS.md](/AGENTS.md) — SDLC handbook referencing skills
