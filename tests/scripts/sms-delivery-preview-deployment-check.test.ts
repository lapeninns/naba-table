import { describe, expect, it } from 'vitest';

import {
  buildPreviewDeploymentCheckReport,
  parsePreviewDeploymentCheckArgs,
} from '@/scripts/sms-delivery-preview-deployment-check';

describe('Preview deployment freshness check', () => {
  it('parses branch, remote, project, and alias args', () => {
    expect(
      parsePreviewDeploymentCheckArgs([
        '--branch',
        'codex/Menu',
        '--remote',
        'origin',
        '--project',
        'nabatable',
        '--alias',
        'https://preview.example.com',
      ]),
    ).toEqual({
      branch: 'codex/Menu',
      remote: 'origin',
      project: 'nabatable',
      alias: 'https://preview.example.com',
    });
  });

  it('fails when the current branch commit has only failed deployments', () => {
    const report = buildPreviewDeploymentCheckReport({
      branch: 'codex/Menu',
      remote: 'origin',
      remoteRef: 'origin/codex/Menu',
      expectedCommitSha: 'abc123',
      alias: 'https://nabatable-git-codex-menu-lapen-inns-projects.vercel.app',
      deployments: [
        {
          url: 'nabatable-error-lapen-inns-projects.vercel.app',
          state: 'ERROR',
          createdAt: 1778346970471,
          meta: {
            branchAlias: 'nabatable-git-codex-menu-lapen-inns-projects.vercel.app',
          },
        },
      ],
    });

    expect(report.ok).toBe(false);
    expect(report.blockers).toEqual([
      'No READY Vercel Preview deployment found for origin/codex/Menu at abc123.',
    ]);
  });

  it('passes when a ready deployment for the current commit owns the branch alias', () => {
    const report = buildPreviewDeploymentCheckReport({
      branch: 'codex/Menu',
      remote: 'origin',
      remoteRef: 'origin/codex/Menu',
      expectedCommitSha: 'abc123',
      alias: 'https://nabatable-git-codex-menu-lapen-inns-projects.vercel.app',
      deployments: [
        {
          url: 'nabatable-ready-lapen-inns-projects.vercel.app',
          state: 'READY',
          createdAt: 1778346970471,
          meta: {
            branchAlias: 'nabatable-git-codex-menu-lapen-inns-projects.vercel.app',
          },
        },
      ],
    });

    expect(report.ok).toBe(true);
    expect(report.readyDeploymentsForCommit).toHaveLength(1);
    expect(report.blockers).toEqual([]);
  });
});
