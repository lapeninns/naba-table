import { describe, expect, it } from 'vitest';

import { validateAgentsDocument } from '@/scripts/governance/agents-contract';

const validDocument = `---
agents_version: 1.0.0
last_reviewed: 2026-07-15
scope: repository
---

# Agent guide

## Core commands

- Full validation: \`pnpm verify\`
- Worker validation: \`pnpm --filter @nabatable/example verify\`

## Applications

See [README](README.md).

## Non-negotiables

Keep secrets out of logs.

## Architecture and data flow

Use server boundaries.
`;

describe('AGENTS.md contract validation', () => {
  it('accepts current instructions with resolvable scripts and links', () => {
    const issues = validateAgentsDocument({
      content: validDocument,
      now: new Date('2026-07-15T12:00:00.000Z'),
      scripts: new Set(['verify']),
      pathExists: (path) => path === 'README.md',
    });

    expect(issues).toEqual([]);
  });

  it('reports stale metadata, missing sections, scripts, and links together', () => {
    const issues = validateAgentsDocument({
      content: `---\nagents_version: 1.0.0\nlast_reviewed: 2025-01-01\nscope: repository\n---\n# Agent guide\nRun \`pnpm missing\`. See [gone](docs/gone.md).`,
      now: new Date('2026-07-15T12:00:00.000Z'),
      scripts: new Set(['verify']),
      pathExists: () => false,
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('last_reviewed'),
        expect.stringContaining('Core commands'),
        expect.stringContaining('pnpm missing'),
        expect.stringContaining('docs/gone.md'),
      ]),
    );
  });
});
