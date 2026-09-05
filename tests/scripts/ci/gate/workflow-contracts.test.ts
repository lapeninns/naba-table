import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { GITHUB_ENVIRONMENTS } from '@/scripts/ci/contracts/names';
import {
  loadWorkflowFiles,
  profileInventoryFromRegistry,
  readPackageScripts,
  validateRepositoryContracts,
} from '@/scripts/ci/gate/validate-contracts';
import {
  AUTOMATION_GUARD,
  CONTRACT_SCRIPTS,
  KNOWN_ENVIRONMENTS,
  REQUIRED_JOB_NAMES,
  REQUIRED_WORKFLOW_NAMES,
  SECRET_SCAN_BUILT_IN_ONLY_ENV,
  readLockfileTsxVersion,
  validateWorkflowContracts,
  type ProfileInventory,
  type ValidateContractsInput,
  type WorkflowFile,
} from '@/scripts/ci/gate/workflow-contracts';

import { configuredPolicy, repositoryRoot } from './helpers';

const workflowsDir = path.join(repositoryRoot, '.github/workflows');

function realInput(): ValidateContractsInput {
  return {
    workflows: loadWorkflowFiles(workflowsDir),
    policy: configuredPolicy(),
    packageScripts: new Set([...readPackageScripts(repositoryRoot), ...CONTRACT_SCRIPTS]),
    lockfileTsxVersion: readLockfileTsxVersion(
      readFileSync(path.join(repositoryRoot, 'pnpm-lock.yaml'), 'utf8'),
    ),
    profiles: profileInventoryFromRegistry(),
  };
}

function replaceWorkflow(
  workflows: WorkflowFile[],
  fileName: string,
  mutate: (content: string) => string,
): WorkflowFile[] {
  return workflows.map((file) =>
    file.fileName === fileName ? { ...file, content: mutate(file.content) } : file,
  );
}

describe('validateRepositoryContracts against the real .github/workflows', () => {
  it('passes with only registration and pin warnings', () => {
    const report = validateRepositoryContracts(repositoryRoot);
    expect(report.violations).toEqual([]);
    for (const warning of report.warnings) {
      expect(warning).toMatch(
        /not yet registered in package\.json|TODO-PIN|REPLACE_ME placeholder|cannot verify tsx pin|built-in scanner only/,
      );
    }
  });

  it('passes cleanly once the policy is configured and contract scripts are registered', () => {
    const report = validateWorkflowContracts(realInput());
    expect(report.violations).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('keeps the validator environment list identical to the shared contract names', () => {
    expect([...KNOWN_ENVIRONMENTS].sort()).toEqual([...GITHUB_ENVIRONMENTS].sort());
  });

  it('pins the provenance attestation action to a commit SHA in Protected delivery', () => {
    const deploy = readFileSync(path.join(workflowsDir, 'deploy.yml'), 'utf8');
    expect(deploy).toMatch(/uses: actions\/attest-build-provenance@[0-9a-f]{40}/);
    expect(deploy).not.toContain('TODO-PIN');
  });

  it('finds every required workflow and job display name in the tree', () => {
    const content = loadWorkflowFiles(workflowsDir)
      .map((file) => file.content)
      .join('\n');
    for (const name of REQUIRED_WORKFLOW_NAMES) expect(content).toContain(`name: ${name}`);
    for (const name of REQUIRED_JOB_NAMES) {
      if (name.startsWith('Shuffle seed')) continue;
      expect(content).toContain(`name: ${name}`);
    }
    expect(KNOWN_ENVIRONMENTS).toContain('Backup');
  });

  it('reads the tsx version pinned in pnpm-lock.yaml', () => {
    const version = readLockfileTsxVersion(
      readFileSync(path.join(repositoryRoot, 'pnpm-lock.yaml'), 'utf8'),
    );
    expect(version).toMatch(/^4\.\d+\.\d+$/);
    for (const file of ['release-gate.yml', 'operational-verification.yml', 'codeql.yml']) {
      const content = readFileSync(path.join(workflowsDir, file), 'utf8');
      expect(content).toContain(`pnpm dlx tsx@${version}`);
    }
  });
});

describe('trust boundaries of the real workflows', () => {
  const workflows = loadWorkflowFiles(workflowsDir);
  const read = (fileName: string): string => {
    const file = workflows.find((entry) => entry.fileName === fileName);
    if (!file) throw new Error(`${fileName} missing`);
    return file.content;
  };

  it('publishes the hosted fallback check from a main-only job with read-only candidate execution', () => {
    const content = read('hosted-profile-fallback.yml');
    const [, profileJob = '', publishJob = ''] = content.split(/\n {2}(?=profile:|publish:)/);
    expect(profileJob.startsWith('profile:')).toBe(true);
    expect(publishJob.startsWith('publish:')).toBe(true);
    expect(profileJob).not.toContain('checks: write');
    expect(profileJob).not.toContain('fallback-run.ts publish');
    expect(profileJob).not.toMatch(/secrets\.(?!GITHUB_TOKEN\b)/);
    expect(publishJob).toContain('checks: write');
    expect(publishJob).toContain('ref: main');
    expect(publishJob).not.toContain('inputs.tested_sha }}\n          path: candidate');
    expect(publishJob).toContain('--tuple-json fallback/expected-tuple.json');
    expect(publishJob).toContain('--profile-job-result "$PROFILE_JOB_RESULT"');
    expect(publishJob).toContain('--run-id "$GITHUB_RUN_ID"');
  });

  it('keeps OIDC attestation out of the production delivery job', () => {
    const content = read('deploy.yml');
    const production = content.slice(
      content.indexOf('\n  production:'),
      content.indexOf('\n  attest:'),
    );
    expect(production).not.toContain('id-token: write');
    expect(production).not.toContain('attestations: write');
    expect(production).not.toContain('attest-build-provenance');
    const attest = content.slice(content.indexOf('\n  attest:'));
    expect(attest).toContain('id-token: write');
    expect(attest).not.toContain('secrets.');
    expect(attest).not.toContain('environment:');
    expect(attest).toMatch(/actions\/attest-build-provenance@[0-9a-f]{40}/);
  });

  it('filters delivery triggers to main-deploy gate runs and dedupes completed revisions', () => {
    const deploy = read('deploy.yml');
    expect(deploy).toContain("contains(github.event.workflow_run.display_title, 'main-deploy')");
    expect(deploy).toContain('name=production-delivered-$HEAD_SHA');
    expect(deploy).toContain(
      'name: production-delivered-${{ needs.resolve-candidate.outputs.head_sha }}',
    );
    expect(read('release-gate.yml')).toContain(
      "run-name: Release gate ${{ inputs.pr_number && 'merge' || 'main-deploy' }}",
    );
  });

  it('runs the hourly verifier under pipefail so its exit code is not masked by tee', () => {
    expect(read('operational-verification.yml')).toMatch(
      /shell: bash\n\s+run: \|\n[^\n]*\n\s+pnpm dlx tsx@[\d.]+ scripts\/monitoring\/verify\.ts \| tee/,
    );
  });
});

describe('validateWorkflowContracts violations', () => {
  it('rejects a path filter on a required hosted lane', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'security-guards.yml', (content) =>
      content.replace('  pull_request:\n', "  pull_request:\n    paths: ['server/**']\n"),
    );
    expect(validateWorkflowContracts(input).violations).toContain(
      'security-guards.yml: required hosted lane "Security guards" must not use pull_request path filters',
    );
  });

  it('rejects unpinned actions unless marked TODO-PIN', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'test-suite.yml', (content) =>
      content.replace(
        'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
        'actions/setup-node@v4',
      ),
    );
    const report = validateWorkflowContracts(input);
    expect(report.violations.some((violation) => violation.includes('actions/setup-node@v4'))).toBe(
      true,
    );
  });

  it('rejects pull_request_target workflows that check out the PR head', () => {
    const input = realInput();
    input.workflows.push({
      fileName: 'danger.yml',
      content: [
        'name: Danger',
        'on:',
        '  pull_request_target:',
        'jobs:',
        '  build:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10',
        '        with:',
        '          ref: ${{ github.event.pull_request.head.sha }}',
        '          persist-credentials: false',
        '',
      ].join('\n'),
    });
    expect(validateWorkflowContracts(input).violations).toContain(
      'danger.yml: job "build" checks out untrusted code under pull_request_target',
    );
  });

  it('rejects a release gate that checks out the candidate or exceeds the timeout', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'release-gate.yml', (content) =>
      content
        .replace('          ref: main\n', '          ref: ${{ inputs.head_sha }}\n')
        .replace('timeout-minutes: 3', 'timeout-minutes: 10'),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toContain('release-gate.yml: job "gate" must check out ref main only');
    expect(violations).toContain('release-gate.yml: job "gate" must set timeout-minutes <= 3');
  });

  it('rejects a release gate with escalated permissions or a drifted tsx pin', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'release-gate.yml', (content) =>
      content
        .replace('  contents: read\n', '  contents: write\n')
        .replace('pnpm dlx tsx@4.21.0', 'pnpm dlx tsx@4.0.0'),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toContain('release-gate.yml: permissions.contents must be read');
    expect(violations.some((violation) => violation.includes('tsx pin 4.0.0'))).toBe(true);
  });

  it('rejects persist-credentials, wrong node versions and unknown environments', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'backup.yml', (content) =>
      content
        .replace('persist-credentials: false', 'persist-credentials: true')
        .replace('node-version: 22', 'node-version: 24')
        .replace('environment: Backup', 'environment: Prod'),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toEqual(
      expect.arrayContaining([
        'backup.yml: job "backup" checkout must set persist-credentials: false',
        'backup.yml: job "backup" must pin node-version 22',
        'backup.yml: job "backup" uses unknown environment "Prod"',
      ]),
    );
  });

  it('rejects a fork profile that references secrets or caches dependencies', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'fork-profile.yml', (content) =>
      content
        .replace(
          '          node-version: 22\n',
          '          node-version: 22\n          cache: pnpm\n',
        )
        .replace('run: pnpm install --frozen-lockfile', 'run: echo ${{ secrets.X }}'),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toContain('fork-profile.yml: Fork profile must not reference secrets');
    expect(violations).toContain(
      'fork-profile.yml: job "profile" must not use a credential-bearing dependency cache',
    );
  });

  it('rejects protected delivery jobs without the main guard or cancellable production', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) =>
      content
        .replace(
          "    needs: [resolve-candidate, staging, production-approval]\n    if: github.ref == 'refs/heads/main' && needs.resolve-candidate.outputs.deliver == 'true'\n",
          '    needs: [resolve-candidate, staging, production-approval]\n',
        )
        .replace(
          '      group: production-delivery\n      cancel-in-progress: false',
          '      group: production-delivery\n      cancel-in-progress: true',
        ),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toContain(
      'deploy.yml: job "production" must be guarded by github.ref == \'refs/heads/main\'',
    );
    expect(violations).toContain(
      'deploy.yml: job "production" deploys Production and must set concurrency.cancel-in-progress: false',
    );
  });

  it('rejects a hosted fallback that runs on pull_request or without the CI fallback environment', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'hosted-profile-fallback.yml', (content) =>
      content
        .replace('on:\n  workflow_dispatch:', 'on:\n  pull_request:\n  workflow_dispatch:')
        .replace('    environment: CI fallback\n', ''),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toContain(
      'hosted-profile-fallback.yml: Hosted profile fallback may only trigger on workflow_dispatch (found pull_request)',
    );
    expect(violations).toContain(
      'hosted-profile-fallback.yml: Hosted profile fallback must run its profile under the "CI fallback" environment',
    );
  });

  it('rejects a hosted fallback that checks out tested_sha without binding it to the PR', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'hosted-profile-fallback.yml', (content) => {
      const start = content.indexOf(
        '      - name: Bind request tuple to the pull request or to protected main',
      );
      const end = content.indexOf('      - name: Enable Corepack');
      if (start === -1 || end === -1) throw new Error('fixture: binding step not found');
      return (
        content.slice(0, start) +
        content.slice(end) +
        // A late binding step (after the candidate checkout) must not count.
        ''
      ).replace('  pull-requests: read\n', '');
    });
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toContain(
      'hosted-profile-fallback.yml: job "profile" must bind the tuple to the pull request (head.repo.id, head.sha, base.sha, merge_commit_sha) or to protected main (compare) before checking out inputs.tested_sha',
    );
    expect(violations).toContain(
      'hosted-profile-fallback.yml: Hosted profile fallback needs permissions.pull-requests: read to bind the tuple to the pull request',
    );
  });

  it('rejects a hosted fallback that binds the tuple only after the candidate checkout', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'hosted-profile-fallback.yml', (content) => {
      const start = content.indexOf(
        '      - name: Bind request tuple to the pull request or to protected main',
      );
      const end = content.indexOf('      - name: Enable Corepack');
      const binding = content.slice(start, end);
      const withoutBinding = content.slice(0, start) + content.slice(end);
      const anchor = '      - name: Verify candidate checkout';
      const at = withoutBinding.indexOf(anchor);
      if (start === -1 || end === -1 || at === -1) throw new Error('fixture: anchors not found');
      return withoutBinding.slice(0, at) + binding + withoutBinding.slice(at);
    });
    expect(validateWorkflowContracts(input).violations).toContain(
      'hosted-profile-fallback.yml: job "profile" checks out inputs.tested_sha before binding the tuple to the pull request',
    );
  });

  it('rejects a hosted fallback whose evidence artifact name is not the tuple-bound name', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'hosted-profile-fallback.yml', (content) =>
      content.replace(
        'name: hosted-fallback-evidence-${{ inputs.head_sha }}-${{ inputs.attempt }}',
        'name: hosted-fallback-evidence',
      ),
    );
    expect(validateWorkflowContracts(input).violations).toContain(
      'hosted-profile-fallback.yml: job "profile" must upload the evidence artifact named exactly "hosted-fallback-evidence-${{ inputs.head_sha }}-${{ inputs.attempt }}" (the release gate binds the run to the tuple by this name)',
    );
  });

  it('rejects a fallback job that checks out the candidate while holding write permissions, secrets or the publisher', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'hosted-profile-fallback.yml', (content) =>
      content
        // Escalate the candidate-running job to the publisher's permissions and a real secret.
        .replace(
          '    environment: CI fallback\n    env:\n',
          '    environment: CI fallback\n    permissions:\n      checks: write\n      contents: read\n    env:\n      EVIDENCE_TOKEN: ${{ secrets.R2_EVIDENCE_TOKEN }}\n',
        )
        // Publish from the same job that ran the candidate.
        .replace(
          "      - name: Fail when the profile failed\n        if: steps.run.outcome != 'success'\n",
          "      - name: Publish inline\n        run: pnpm exec tsx scripts/ci/gate/fallback-run.ts publish --out fallback/evidence\n\n      - name: Fail when the profile failed\n        if: steps.run.outcome != 'success'\n",
        ),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toEqual(
      expect.arrayContaining([
        'hosted-profile-fallback.yml: job "profile" checks out the candidate and must not hold checks: write',
        'hosted-profile-fallback.yml: job "profile" checks out the candidate and must not reference secrets.R2_EVIDENCE_TOKEN',
        'hosted-profile-fallback.yml: job "profile" checks out the candidate and must not publish the check run (publish from a separate main-only job)',
      ]),
    );
    // The installation token alone is acceptable for the read-only binding step.
    expect(violations.some((violation) => violation.includes('secrets.GITHUB_TOKEN'))).toBe(false);
  });

  it('rejects a fallback whose workflow-level permissions grant checks: write to the candidate job', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'hosted-profile-fallback.yml', (content) =>
      content.replace(
        'permissions:\n  contents: read\n  # Read-only',
        'permissions:\n  contents: read\n  checks: write\n  # Read-only',
      ),
    );
    expect(validateWorkflowContracts(input).violations).toContain(
      'hosted-profile-fallback.yml: job "profile" checks out the candidate and must not hold checks: write',
    );
  });

  it('rejects TODO-PIN tag pins inside Production or Staging jobs', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) =>
      content.replace(
        '      - name: Promote verified deployment to production domains\n',
        '      - name: Attest inline\n        # TODO-PIN: replace with the commit SHA\n        uses: actions/attest-build-provenance@v2\n\n      - name: Promote verified deployment to production domains\n',
      ),
    );
    const report = validateWorkflowContracts(input);
    expect(
      report.violations.some((violation) =>
        violation.includes(
          '"actions/attest-build-provenance@v2" runs in a Production or Staging job and must be pinned to a 40-character commit SHA (TODO-PIN is not accepted there)',
        ),
      ),
    ).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('attest-build-provenance@v2'))).toBe(
      false,
    );
  });

  it('rejects identity permissions inside a delivery job', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) =>
      content.replace(
        '    permissions:\n      contents: read\n      actions: read\n      checks: read\n      pull-requests: read\n    env:\n      DB_TARGET_ENV: production',
        '    permissions:\n      contents: read\n      actions: read\n      checks: read\n      pull-requests: read\n      id-token: write\n      attestations: write\n    env:\n      DB_TARGET_ENV: production',
      ),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toEqual(
      expect.arrayContaining([
        'deploy.yml: job "production" deploys Production and must not hold id-token: write (attest from a separate job without deploy secrets)',
        'deploy.yml: job "production" deploys Production and must not hold attestations: write (attest from a separate job without deploy secrets)',
      ]),
    );
  });

  it('rejects a delivery job that deploys before separation evidence or migrates before the remote plan', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) =>
      content
        .replace(
          '      - name: Validate staging/production separation\n        run: pnpm deploy:validate-separation --env production\n',
          '',
        )
        .replace(
          '      - name: Plan remote migrations (dry-run)\n        env:\n          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}\n          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}\n        run: pnpm db:plan-remote\n\n      - name: Apply migrations to production',
          '      - name: Apply migrations to production',
        ),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toEqual(
      expect.arrayContaining([
        'deploy.yml: job "production" must run deploy:validate-separation --env production before "db:migrate"',
        'deploy.yml: job "production" must run deploy:validate-separation --env production before "deploy:workers"',
        'deploy.yml: job "production" must run db:plan-remote before "db:migrate"',
      ]),
    );
    // The staging job still orders its steps correctly.
    expect(violations.some((violation) => violation.includes('job "staging" must run'))).toBe(
      false,
    );
  });

  it('rejects a Protected delivery that reacts to every Release gate run and a gate without a mode in its run-name', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) =>
      content.replace(" && contains(github.event.workflow_run.display_title, 'main-deploy')", ''),
    );
    input.workflows = replaceWorkflow(input.workflows, 'release-gate.yml', (content) =>
      content.replace(/^run-name: .*\n/m, ''),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toContain(
      'deploy.yml: Protected delivery must filter Release gate workflow_run events to main-deploy evaluations (workflow_run.display_title)',
    );
    expect(violations).toContain(
      'release-gate.yml: run-name must advertise the evaluation mode (merge | main-deploy) so Protected delivery can filter workflow_run events',
    );
  });

  it('rejects a run step that pipes into tee without pipefail', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'operational-verification.yml', (content) =>
      content.replace('        shell: bash\n', ''),
    );
    expect(validateWorkflowContracts(input).violations).toContain(
      'operational-verification.yml: job "verify" step "Verify operational sources" pipes into tee without pipefail (set shell: bash or set -o pipefail)',
    );
  });

  it('rejects unknown pnpm scripts and warns for unregistered contract scripts', () => {
    const input = realInput();
    // Every contract script is registered in package.json now; drop one to keep the warning path covered.
    input.packageScripts = new Set(
      [...readPackageScripts(repositoryRoot)].filter((script) => script !== 'ci:gate'),
    );
    input.workflows = replaceWorkflow(input.workflows, 'test-suite.yml', (content) =>
      content.replace('run: pnpm test\n', 'run: pnpm test:everything\n'),
    );
    const report = validateWorkflowContracts(input);
    expect(report.violations).toContain(
      'test-suite.yml: job "vitest" calls unknown pnpm script "test:everything"',
    );
    expect(report.warnings).toContain(
      'deploy.yml: job "resolve-candidate" calls contract script "ci:gate" not yet registered in package.json',
    );
  });

  it('rejects a policy that drifts from scripts/ci/profiles', () => {
    const input = realInput();
    const profiles: ProfileInventory = structuredClone(input.profiles);
    profiles.pr.policyVersion = '2000-01-01.1';
    profiles.pr.suites = profiles.pr.suites.map((suite) =>
      suite.id === 'full-vitest-suite' ? { ...suite, conditional: true } : suite,
    );
    profiles.pr.suites.push({
      id: 'brand-new-suite',
      displayName: 'Brand new',
      conditional: false,
      satisfies: ['Full Vitest suite'],
    });
    input.profiles = profiles;
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toEqual(
      expect.arrayContaining([
        'policy: policyVersion 2026-09-04.1 differs from scripts/ci/profiles "pr" (2000-01-01.1)',
        'policy: profile "pr" lists conditional suite "full-vitest-suite" as required',
        'policy: profile "pr" does not cover suite "brand-new-suite" run by scripts/ci/profiles',
        'policy: suiteInventory lacks suite "brand-new-suite"',
        'policy: compatibilityChecks["Full Vitest suite"] must map to suite "brand-new-suite" (declared by scripts/ci/profiles)',
      ]),
    );
  });

  it('rejects a secret scan that has neither scanner installs nor the explicit built-in fallback', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'security-guards.yml', (content) =>
      content.replace(/ {6}- name: Install secret scanners[\s\S]*?(?= {6}- name: Secret scan)/, ''),
    );
    const report = validateWorkflowContracts(input);
    expect(report.violations).toContain(
      `security-guards.yml: job "service-role-routes" runs secret:scan without gitleaks and trufflehog install steps or ${SECRET_SCAN_BUILT_IN_ONLY_ENV}: 'true'`,
    );
    expect(report.warnings.some((warning) => warning.includes('built-in scanner only'))).toBe(
      false,
    );
  });

  it('warns when scanner installs are replaced with the explicit local fallback', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'security-guards.yml', (content) =>
      content
        .replace(/ {6}- name: Install secret scanners[\s\S]*?(?= {6}- name: Secret scan)/, '')
        .replace(
          '      - name: Secret scan\n',
          `      - name: Secret scan\n        env:\n          ${SECRET_SCAN_BUILT_IN_ONLY_ENV}: 'true'\n`,
        ),
    );
    const report = validateWorkflowContracts(input);
    expect(report.violations).toEqual([]);
    expect(report.warnings).toContain(
      `security-guards.yml: job "service-role-routes" runs secret:scan with the built-in scanner only (${SECRET_SCAN_BUILT_IN_ONLY_ENV}); provision SHA-pinned gitleaks and trufflehog installs`,
    );
  });

  it('installs checksum-pinned scanner binaries before running the hosted scan', () => {
    const content = readFileSync(path.join(workflowsDir, 'security-guards.yml'), 'utf8');
    const installStart = content.indexOf('      - name: Install secret scanners');
    const scanStart = content.indexOf('      - name: Secret scan');
    expect(installStart).toBeGreaterThan(0);
    expect(scanStart).toBeGreaterThan(installStart);
    const install = content.slice(installStart, scanStart);
    expect(install).toContain('set -euo pipefail');
    expect(install).toMatch(/[0-9a-f]{64} {2}gitleaks\.tar\.gz/);
    expect(install).toMatch(/[0-9a-f]{64} {2}trufflehog\.tar\.gz/);
    expect(install).toContain('sha256sum --check --strict');
    expect(install.indexOf('sha256sum --check --strict')).toBeLessThan(install.indexOf('tar -xzf'));
    expect(install).toContain('bin/gitleaks" --version');
    expect(install).toContain('bin/trufflehog" --version');
    expect(content).not.toContain(SECRET_SCAN_BUILT_IN_ONLY_ENV);
    expect(validateWorkflowContracts(realInput()).violations).toEqual([]);
  });

  it('rejects an automated delivery entry point without the PROTECTED_DELIVERY_AUTOMATION guard', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) => {
      if (!content.includes(`${AUTOMATION_GUARD} && `)) throw new Error('fixture: guard not found');
      return content.replace(`${AUTOMATION_GUARD} && `, '');
    });
    expect(validateWorkflowContracts(input).violations).toContain(
      `deploy.yml: job "resolve-candidate" starts from workflow_run and must be guarded by ${AUTOMATION_GUARD}`,
    );
  });

  it('does not demand the automation guard when Protected delivery is dispatch-only', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) =>
      content
        .replace(
          "  workflow_run:\n    workflows: ['Release gate']\n    types: [completed]\n    branches: [main]\n",
          '',
        )
        .replace(`${AUTOMATION_GUARD} && `, ''),
    );
    const { violations } = validateWorkflowContracts(input);
    expect(violations.some((violation) => violation.includes(AUTOMATION_GUARD))).toBe(false);
  });

  it('rejects a production migration that is not preceded by db:link and db:plan-remote', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) => {
      const start = content.indexOf('      - name: Link production Supabase project');
      const end = content.indexOf('      - name: Apply migrations to production');
      if (start === -1 || end === -1)
        throw new Error('fixture: production link/plan steps not found');
      return content.slice(0, start) + content.slice(end);
    });
    const { violations } = validateWorkflowContracts(input);
    expect(violations).toContain(
      'deploy.yml: job "production" must run db:link before db:plan-remote and "db:migrate"',
    );
    expect(
      violations.some((violation) => violation.includes('db:plan-remote before "db:migrate"')),
    ).toBe(true);
  });

  it('rejects a production migration without production separation evidence first', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) => {
      const step =
        '      - name: Validate staging/production separation\n        run: pnpm deploy:validate-separation --env production\n\n';
      if (!content.includes(step)) throw new Error('fixture: production separation step not found');
      return content.replace(step, '');
    });
    expect(validateWorkflowContracts(input).violations).toContain(
      'deploy.yml: job "production" must run deploy:validate-separation --env production before "db:migrate"',
    );
  });

  it('never downgrades a TODO-PIN tag pin to a warning inside Protected delivery', () => {
    const input = realInput();
    input.workflows = replaceWorkflow(input.workflows, 'deploy.yml', (content) =>
      content.replace(
        '      - name: Checkout protected main (gate policy and scripts)\n        uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10',
        '      - name: Checkout protected main (gate policy and scripts)\n        # TODO-PIN\n        uses: actions/checkout@v4',
      ),
    );
    const report = validateWorkflowContracts(input);
    expect(
      report.violations.some((violation) =>
        violation.includes('"actions/checkout@v4" runs in Protected delivery and must be pinned'),
      ),
    ).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('actions/checkout@v4'))).toBe(false);
  });

  it('rejects unparseable YAML and missing required names', () => {
    const report = validateWorkflowContracts({
      ...realInput(),
      workflows: [{ fileName: 'broken.yml', content: 'name: [unclosed' }],
    });
    expect(report.violations[0]).toContain('broken.yml: YAML does not parse');
    expect(report.violations).toContain('missing workflow named "Release gate"');
    expect(report.violations).toContain('missing job display name "Full Vitest suite"');
  });
});
