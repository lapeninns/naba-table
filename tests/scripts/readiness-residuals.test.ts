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

  it('uploads source maps for every Cloudflare Worker @contract', () => {
    const wranglerConfigs = [
      'cloudflare/booking-short-links/wrangler.jsonc',
      'cloudflare/email-queue-gateway/wrangler.jsonc',
      'cloudflare/sms-summary-gateway/wrangler.jsonc',
    ];

    for (const config of wranglerConfigs) {
      expect(readFileSync(path.join(repositoryRoot, config), 'utf8'), config).toContain(
        '"upload_source_maps": true',
      );
    }
  });

  it('provides an authenticated receiver for repository insight dispatches @contract', () => {
    const source = readFileSync(
      path.join(repositoryRoot, 'src/app/api/webhook/error-insight/route.ts'),
      'utf8',
    );

    expect(source).toContain('buildGitHubDispatchRequest');
    expect(source).toContain('ERROR_INSIGHT_RECEIVER_TOKEN');
    expect(source).toContain('ERROR_INSIGHT_GITHUB_TOKEN');
  });

  it('covers real Worker and web sources in the insight and pre-commit contracts @contract', () => {
    const insightSource = readFileSync(
      path.join(repositoryRoot, 'lib/observability/error-insight.ts'),
      'utf8',
    );
    const clientErrorSource = readFileSync(
      path.join(repositoryRoot, 'src/app/api/client-error/route.ts'),
      'utf8',
    );
    const packageSource = readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8');

    expect(insightSource).toContain("'booking-short-links'");
    expect(insightSource).toContain("'email-queue-gateway'");
    expect(insightSource).toContain("'sms-summary-gateway'");
    expect(clientErrorSource).toContain("service: 'nabatable-web'");
    expect(clientErrorSource).toContain('buildGitHubDispatchRequest');
    expect(packageSource).toContain('cloudflare/**/*.{ts,tsx,js,jsx}');
  });
});
