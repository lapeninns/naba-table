import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();

function readJson(relativePath: string): { scripts?: Record<string, string> } {
  return JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), 'utf8')) as {
    scripts?: Record<string, string>;
  };
}

describe('residual readiness contracts', () => {
  it('provides a profiling command for every deployable application @contract', () => {
    const manifests = [
      'package.json',
      'cloudflare/booking-short-links/package.json',
      'cloudflare/email-queue-gateway/package.json',
      'cloudflare/sms-summary-gateway/package.json',
    ];

    for (const manifest of manifests) {
      expect(readJson(manifest).scripts?.profile, manifest).toMatch(/cpu-prof|inspector-port/u);
    }
  });

  it('turns provider error dispatches into deduplicated GitHub issues @contract', () => {
    const workflowPath = path.join(repositoryRoot, '.github/workflows/error-to-insight.yml');
    const workflow = parse(readFileSync(workflowPath, 'utf8')) as Record<string, unknown>;
    const source = readFileSync(workflowPath, 'utf8');

    expect(workflow).toHaveProperty('on.repository_dispatch.types');
    expect(source).toContain('issues.create');
    expect(source).toContain('issues.createComment');
    expect(source).toContain('trace_id');
  });
});
