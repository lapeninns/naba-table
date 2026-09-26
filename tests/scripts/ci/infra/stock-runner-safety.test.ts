import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';

import { readInfraFile, repositoryRoot } from './helpers';

const templateSchema = z.object({
  provision: z.array(z.object({ mode: z.string(), script: z.string() })),
});
const workflowSchema = z.object({
  jobs: z.record(
    z.string(),
    z.object({ name: z.string(), if: z.string().optional(), 'runs-on': z.string() }),
  ),
});

describe('isolated stock runner safety', () => {
  it('creates the runner account before assigning the tool cache to it', () => {
    const template = templateSchema.parse(parse(readInfraFile('lima/nabatable-runner.yaml')));
    const script = template.provision.find((step) => step.mode === 'system')?.script ?? '';
    const createUser = script.indexOf('useradd --create-home');
    const cacheOwnership = script.indexOf('chown -R runner:runner');
    expect(createUser).toBeGreaterThanOrEqual(0);
    expect(cacheOwnership).toBeGreaterThan(createUser);
  });

  it.each(['test-suite', 'security-guards', 'quality-gates', 'shadcn-primitives', 'e2e-smoke'])(
    'routes fork pull requests (and every run when NABATABLE_CI_RUNNER=hosted) to hosted validation in %s',
    (name) => {
      const source = readFileSync(
        path.join(repositoryRoot, '.github/workflows', `${name}.yml`),
        'utf8',
      );
      const workflow = workflowSchema.parse(parse(source));
      for (const job of Object.values(workflow.jobs)) {
        if (job.name === 'UI visual routes') continue;
        expect(job.if).toBeUndefined();
        expect(job['runs-on']).toBe(
          `\${{ (vars.NABATABLE_CI_RUNNER == 'hosted' || (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository)) && 'ubuntu-latest' || fromJSON('["self-hosted","nabatable-release"]') }}`,
        );
      }
    },
  );
});
