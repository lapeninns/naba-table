import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

describe('Option A post-deployment observation workflow', () => {
  it('isolates monitoring credentials from PR execution and observes production only', () => {
    const source = readFileSync('.github/workflows/post-deployment-verification.yml', 'utf8');
    const workflow = parse(source);
    expect(Object.keys(workflow.on).sort()).toEqual(['push', 'schedule', 'workflow_dispatch']);
    expect(workflow.permissions).toEqual({ contents: 'read' });
    const job = workflow.jobs.verify;
    expect(job['runs-on']).toBe('ubuntu-latest');
    expect(job.environment).toBe('Monitoring');
    expect(job['timeout-minutes']).toBeLessThanOrEqual(10);
    expect(job.if).toContain("github.repository_id == '1105219228'");
    expect(workflow.on.push).toEqual({ branches: ['main'] });
    expect(job.if).toContain("github.event_name == 'push'");
    expect(job.if).toContain("github.ref == 'refs/heads/main'");
    expect(workflow.concurrency['cancel-in-progress']).toBe(false);
    const checkout = job.steps.find((step: { uses?: string }) =>
      step.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout.with).toEqual({ ref: 'main', 'persist-credentials': false });
    const node = job.steps.find((step: { uses?: string }) =>
      step.uses?.startsWith('actions/setup-node@'),
    );
    expect(node.with['node-version']).toBe(22);
    const verify = job.steps.find((step: { run?: string }) =>
      step.run?.includes('scripts/monitoring/post-deploy.ts'),
    );
    expect(verify.shell).toBe('bash');
    expect(verify.run).toContain('| tee test-results/post-deploy/verify.json');
    expect(verify.run).toContain('for attempt in 1 2 3 4 5 6');
    expect(verify.run).toContain('exit 1');
    expect(verify.run).toContain('main_changed');
    expect(verify.env.MONITORING_TOKEN).toBe('${{ secrets.MONITORING_TOKEN }}');
    expect(verify.env.MONITORING_GITHUB_TOKEN).toBe('${{ github.token }}');
    expect(source).not.toMatch(/heartbeat|secrets\.(?:VERCEL|SUPABASE|CLOUDFLARE)/i);
    expect(source).not.toContain('pnpm install');
    expect(source).not.toContain('github.event.deployment_status.environment_url');
    expect(source).not.toContain('github.event.deployment_status.target_url');
    const upload = job.steps.find((step: { uses?: string }) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    );
    expect(upload.if).toBe('always()');
    expect(upload.with.path).toBe('test-results/post-deploy/');
  });
});
