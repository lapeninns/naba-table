import { describe, expect, it } from 'vitest';

import {
  buildVercelPreviewEnvRunInvocation,
  parseVercelPreviewEnvRunArgs,
} from '@/scripts/vercel-preview-env-run';

describe('Vercel Preview env runner', () => {
  it('parses the Preview branch and command separator', () => {
    expect(
      parseVercelPreviewEnvRunArgs([
        '--branch',
        'codex/Menu',
        '--',
        'pnpm',
        'exec',
        'tsx',
        'scripts/example.ts',
      ]),
    ).toEqual({
      environment: 'preview',
      gitBranch: 'codex/Menu',
      command: ['pnpm', 'exec', 'tsx', 'scripts/example.ts'],
    });
  });

  it('builds an invocation from an isolated Vercel project directory', () => {
    expect(
      buildVercelPreviewEnvRunInvocation({
        environment: 'preview',
        gitBranch: 'codex/Menu',
        projectRoot: '/repo',
        tempProjectDir: '/tmp/vercel-project',
        command: ['pnpm', 'exec', 'tsx', 'scripts/example.ts'],
      }),
    ).toEqual({
      command: 'npx',
      args: [
        'vercel',
        '--cwd',
        '/tmp/vercel-project',
        'env',
        'run',
        '--environment',
        'preview',
        '--git-branch',
        'codex/Menu',
        '--',
        'pnpm',
        '--dir',
        '/repo',
        'exec',
        'tsx',
        'scripts/example.ts',
      ],
    });
  });
});
