import { parse } from 'yaml';

import { PLACEHOLDER_PATTERN, type PolicyResolution } from './policy';
import { fallbackEvidenceArtifactName } from './tuple';

/**
 * Trusted-CI contract validation over the parsed `.github/workflows/*.yml`
 * documents. Pure: callers load files and the policy, this module reports
 * violations (exit non-zero) and warnings (informational).
 */

export const REQUIRED_WORKFLOW_NAMES = [
  'Release gate',
  'Hosted profile fallback',
  'Fork profile',
  'Protected delivery',
  'Operational verification',
  'Database backup',
  'Recovery drill',
  'Security guards',
  'CodeQL security review',
] as const;

export const REQUIRED_JOB_NAMES = [
  'Full Vitest suite',
  'Fast static gates',
  'Coverage and performance evidence',
  'Browser smoke packs',
  'Primitive coverage',
  'Shuffle seed 20260715',
  'Shuffle seed 20260716',
  'Shuffle seed 20260717',
  'Service-role route authorization',
  'CodeQL JavaScript and TypeScript',
] as const;

export const KNOWN_ENVIRONMENTS = [
  'Staging',
  'Production',
  'CI fallback',
  'Monitoring',
  'Recovery',
  'Backup',
] as const;

/** Root package.json scripts the integration step registers; missing ones warn instead of fail. */
export const CONTRACT_SCRIPTS = [
  'ci:profile',
  'ci:controller',
  'ci:executor',
  'ci:gate',
  'ci:contracts:validate',
  'db:plan-remote',
  'db:link',
  'db:sql-regression',
  'db:check-migration-immutability',
  'db:backup',
  'db:restore-verify',
  'release:manifest',
  'release:sbom',
  'deploy:validate-separation',
  'deploy:staging-lock',
  'deploy:vercel:prebuilt',
  'deploy:vercel:promote',
  'deploy:workers',
  'e2e:staging',
  'ops:verify',
  'ops:slo-evidence',
  'recovery:drill',
  'recovery:evidence:check',
] as const;

const PNPM_BUILTINS = new Set([
  'add',
  'audit',
  'config',
  'dedupe',
  'dlx',
  'env',
  'exec',
  'fetch',
  'install',
  'licenses',
  'link',
  'list',
  'ls',
  'outdated',
  'patch',
  'prune',
  'rebuild',
  'remove',
  'run',
  'setup',
  'store',
  'update',
  'why',
]);

const ACTIVE_NODE_VERSION = '22';
const RELEASE_GATE_FILE = 'release-gate.yml';
const PROTECTED_DELIVERY_NAME = 'Protected delivery';
const HOSTED_FALLBACK_NAME = 'Hosted profile fallback';
/** Every marker must appear in the fallback job's tuple-binding step. */
const FALLBACK_BINDING_MARKERS = [
  'head.repo.id',
  'head.sha',
  'base.sha',
  'merge_commit_sha',
  '/compare/',
] as const;
const MAIN_REF_GUARD = "github.ref == 'refs/heads/main'";
/** Repository variable that arms the automatic `workflow_run` path of Protected delivery (Phase 5). */
export const AUTOMATION_GUARD = "vars.PROTECTED_DELIVERY_AUTOMATION == 'enabled'";
/** Step env that lets scripts/security/secret-scan.ts run without gitleaks/trufflehog. */
export const SECRET_SCAN_BUILT_IN_ONLY_ENV = 'SECRET_SCAN_ALLOW_BUILT_IN_ONLY';
/** Workflows where a `TODO-PIN` marker never downgrades an unpinned action to a warning. */
const PIN_STRICT_WORKFLOW_NAMES = new Set<string>(['Release gate', PROTECTED_DELIVERY_NAME]);
const RELEASE_GATE_TIMEOUT_MINUTES = 3;
const SHA_PIN_PATTERN = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/;
/** Matches `pnpm <script>` / `pnpm run <script>` as a whole token inside a `run:` block. */
const PNPM_SCRIPT = (script: string): RegExp =>
  new RegExp(`\\bpnpm\\s+(?:run\\s+)?${script}(?=\\s|$)`, 'm');
/** Environments whose jobs hold delivery credentials; nothing unpinned or OIDC-minting runs there. */
const PROTECTED_ENVIRONMENTS = new Set(['Production', 'Staging']);
/** Permissions that mint identity tokens; they belong in a job that holds no deploy secrets. */
const IDENTITY_PERMISSIONS = ['id-token', 'attestations'] as const;
/** `... | tee file` masks the producer's exit code unless the step runs under pipefail. */
const TEE_PIPE_PATTERN = /\|\s*(?:sudo\s+)?tee\b/;
/** The only secret a candidate-running job may name: the read-only installation token. */
const ALLOWED_CANDIDATE_SECRET = 'secrets.GITHUB_TOKEN';
const MAIN_DEPLOY_MARKER = 'main-deploy';

export type WorkflowFile = { fileName: string; content: string };

export type ContractReport = { violations: string[]; warnings: string[] };

/** Suite shape exported by scripts/ci/profiles, reduced to what the policy must agree with. */
export type ProfileInventorySuite = {
  id: string;
  displayName: string;
  conditional: boolean;
  satisfies: string[];
};

export type ProfileInventory = Record<
  string,
  { policyVersion: string; suites: ProfileInventorySuite[] }
>;

export type ValidateContractsInput = {
  workflows: WorkflowFile[];
  policy: PolicyResolution;
  packageScripts: Set<string>;
  /** tsx version resolved in pnpm-lock.yaml; null when it cannot be determined. */
  lockfileTsxVersion: string | null;
  /** Suite inventory of scripts/ci/profiles; the policy must agree with it exactly. */
  profiles: ProfileInventory;
};

type ParsedWorkflow = {
  fileName: string;
  content: string;
  lines: string[];
  doc: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseWorkflow(file: WorkflowFile, report: ContractReport): ParsedWorkflow | null {
  let doc: unknown;
  try {
    doc = parse(file.content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'parse error';
    report.violations.push(`${file.fileName}: YAML does not parse (${message})`);
    return null;
  }
  if (!isRecord(doc)) {
    report.violations.push(`${file.fileName}: workflow must be a mapping`);
    return null;
  }
  return { fileName: file.fileName, content: file.content, lines: file.content.split('\n'), doc };
}

function workflowName(workflow: ParsedWorkflow): string {
  return typeof workflow.doc.name === 'string' ? workflow.doc.name : workflow.fileName;
}

function triggers(workflow: ParsedWorkflow): Record<string, unknown> {
  const on = workflow.doc.on;
  if (isRecord(on)) return on;
  if (typeof on === 'string') return { [on]: null };
  if (Array.isArray(on)) return Object.fromEntries(on.map((entry) => [String(entry), null]));
  return {};
}

function jobs(workflow: ParsedWorkflow): Array<[string, Record<string, unknown>]> {
  const raw = workflow.doc.jobs;
  if (!isRecord(raw)) return [];
  return Object.entries(raw).filter((entry): entry is [string, Record<string, unknown>] =>
    isRecord(entry[1]),
  );
}

function steps(job: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(job.steps) ? job.steps.filter(isRecord) : [];
}

function stepRun(step: Record<string, unknown>): string {
  return typeof step.run === 'string' ? step.run : '';
}

function stepUses(step: Record<string, unknown>): string {
  return typeof step.uses === 'string' ? step.uses : '';
}

function expandJobNames(job: Record<string, unknown>, jobId: string): string[] {
  const name = typeof job.name === 'string' ? job.name : jobId;
  const strategy = isRecord(job.strategy) ? job.strategy : {};
  const matrix = isRecord(strategy.matrix) ? strategy.matrix : {};
  const names = [name];
  for (const [key, values] of Object.entries(matrix)) {
    if (!Array.isArray(values)) continue;
    const token = `\${{ matrix.${key} }}`;
    if (!name.includes(token)) continue;
    return values.map((value) => name.replaceAll(token, String(value)));
  }
  return names;
}

function collectJobNames(workflows: ParsedWorkflow[]): Set<string> {
  const names = new Set<string>();
  for (const workflow of workflows) {
    for (const [jobId, job] of jobs(workflow)) {
      for (const name of expandJobNames(job, jobId)) names.add(name);
    }
  }
  return names;
}

function checkRequiredNames(workflows: ParsedWorkflow[], report: ContractReport): void {
  const workflowNames = new Set(workflows.map(workflowName));
  for (const required of REQUIRED_WORKFLOW_NAMES) {
    if (!workflowNames.has(required))
      report.violations.push(`missing workflow named "${required}"`);
  }
  const jobNames = collectJobNames(workflows);
  for (const required of REQUIRED_JOB_NAMES) {
    if (!jobNames.has(required)) report.violations.push(`missing job display name "${required}"`);
  }
}

function checkPathFilters(
  workflows: ParsedWorkflow[],
  policy: PolicyResolution,
  report: ContractReport,
): void {
  const mustRunOnEveryPr = new Set(
    policy.policy.requiredHostedWorkflows.map((entry) => entry.displayName),
  );
  for (const workflow of workflows) {
    const name = workflowName(workflow);
    if (!mustRunOnEveryPr.has(name)) continue;
    const on = triggers(workflow);
    if (!('pull_request' in on)) {
      report.violations.push(
        `${workflow.fileName}: required hosted lane "${name}" must trigger on pull_request`,
      );
      continue;
    }
    const pr = on.pull_request;
    if (isRecord(pr) && ('paths' in pr || 'paths-ignore' in pr)) {
      report.violations.push(
        `${workflow.fileName}: required hosted lane "${name}" must not use pull_request path filters`,
      );
    }
    if (isRecord(pr) && 'branches' in pr) {
      report.violations.push(
        `${workflow.fileName}: required hosted lane "${name}" must not restrict pull_request branches`,
      );
    }
    const push = on.push;
    if (!('push' in on) || (isRecord(push) && ('paths' in push || 'paths-ignore' in push))) {
      report.violations.push(
        `${workflow.fileName}: required hosted lane "${name}" must run on every push to main without path filters`,
      );
    }
  }
}

function checkPullRequestTarget(workflows: ParsedWorkflow[], report: ContractReport): void {
  for (const workflow of workflows) {
    const on = triggers(workflow);
    if (!('pull_request_target' in on)) continue;
    for (const [jobId, job] of jobs(workflow)) {
      for (const step of steps(job)) {
        const uses = typeof step.uses === 'string' ? step.uses : '';
        if (!uses.startsWith('actions/checkout')) continue;
        const withBlock = isRecord(step.with) ? step.with : {};
        const ref = typeof withBlock.ref === 'string' ? withBlock.ref : '';
        if (ref === '' || /pull_request|head\.(sha|ref)|merge/.test(ref)) {
          report.violations.push(
            `${workflow.fileName}: job "${jobId}" checks out untrusted code under pull_request_target`,
          );
        }
      }
    }
  }
}

function hasTodoPin(workflow: ParsedWorkflow, lineIndex: number): boolean {
  const current = workflow.lines[lineIndex] ?? '';
  const previous = workflow.lines[lineIndex - 1] ?? '';
  return current.includes('TODO-PIN') || previous.includes('TODO-PIN');
}

function jobEnvironmentName(job: Record<string, unknown>): string | undefined {
  const environment = job.environment;
  if (typeof environment === 'string') return environment;
  if (isRecord(environment) && typeof environment.name === 'string') return environment.name;
  return undefined;
}

function isProtectedJob(job: Record<string, unknown>): boolean {
  const name = jobEnvironmentName(job);
  return name !== undefined && PROTECTED_ENVIRONMENTS.has(name);
}

/** `uses:` references of steps that run inside Production or Staging jobs. */
function protectedActionUses(workflow: ParsedWorkflow): Set<string> {
  const uses = new Set<string>();
  for (const [, job] of jobs(workflow)) {
    if (!isProtectedJob(job)) continue;
    for (const step of steps(job)) {
      if (typeof step.uses === 'string') uses.add(step.uses);
    }
  }
  return uses;
}

function checkActionPins(workflows: ParsedWorkflow[], report: ContractReport): void {
  for (const workflow of workflows) {
    const protectedUses = protectedActionUses(workflow);
    const strictWorkflow = PIN_STRICT_WORKFLOW_NAMES.has(workflowName(workflow));
    workflow.lines.forEach((line, index) => {
      const match = /^\s*-?\s*uses:\s*['"]?([^'"#\s]+)['"]?/.exec(line);
      if (!match) return;
      const uses = match[1];
      if (uses.startsWith('./')) return;
      if (SHA_PIN_PATTERN.test(uses)) return;
      if (hasTodoPin(workflow, index)) {
        if (protectedUses.has(uses)) {
          report.violations.push(
            `${workflow.fileName}:${index + 1}: "${uses}" runs in a Production or Staging job and must be pinned to a 40-character commit SHA (TODO-PIN is not accepted there)`,
          );
          return;
        }
        if (strictWorkflow) {
          report.violations.push(
            `${workflow.fileName}:${index + 1}: "${uses}" runs in ${workflowName(workflow)} and must be pinned to a 40-character commit SHA (TODO-PIN is not accepted in this workflow)`,
          );
          return;
        }
        report.warnings.push(
          `${workflow.fileName}:${index + 1}: "${uses}" is tag-pinned with a TODO-PIN marker`,
        );
        return;
      }
      report.violations.push(
        `${workflow.fileName}:${index + 1}: "${uses}" is not pinned to a 40-character commit SHA`,
      );
    });
  }
}

function checkCheckoutHygiene(workflows: ParsedWorkflow[], report: ContractReport): void {
  for (const workflow of workflows) {
    for (const [jobId, job] of jobs(workflow)) {
      for (const step of steps(job)) {
        const uses = typeof step.uses === 'string' ? step.uses : '';
        if (uses.startsWith('actions/checkout')) {
          const withBlock = isRecord(step.with) ? step.with : {};
          if (withBlock['persist-credentials'] !== false) {
            report.violations.push(
              `${workflow.fileName}: job "${jobId}" checkout must set persist-credentials: false`,
            );
          }
        }
        if (uses.startsWith('actions/setup-node')) {
          const withBlock = isRecord(step.with) ? step.with : {};
          if (String(withBlock['node-version'] ?? '') !== ACTIVE_NODE_VERSION) {
            report.violations.push(
              `${workflow.fileName}: job "${jobId}" must pin node-version ${ACTIVE_NODE_VERSION}`,
            );
          }
        }
      }
    }
  }
}

function checkReleaseGate(
  workflows: ParsedWorkflow[],
  lockfileTsxVersion: string | null,
  report: ContractReport,
): void {
  const workflow = workflows.find((entry) => entry.fileName === RELEASE_GATE_FILE);
  if (!workflow) {
    report.violations.push(`${RELEASE_GATE_FILE} is missing`);
    return;
  }
  if (!isRecord(workflow.doc.concurrency)) {
    report.violations.push(`${RELEASE_GATE_FILE}: must declare a per-tuple concurrency group`);
  }
  const permissions = isRecord(workflow.doc.permissions) ? workflow.doc.permissions : {};
  const expectedPermissions: Record<string, string> = {
    checks: 'write',
    contents: 'read',
    actions: 'read',
    'pull-requests': 'read',
  };
  for (const [scope, level] of Object.entries(expectedPermissions)) {
    if (permissions[scope] !== level) {
      report.violations.push(`${RELEASE_GATE_FILE}: permissions.${scope} must be ${level}`);
    }
  }
  for (const scope of Object.keys(permissions)) {
    if (!(scope in expectedPermissions)) {
      report.violations.push(`${RELEASE_GATE_FILE}: unexpected permission "${scope}"`);
    }
  }
  const gateJobs = jobs(workflow);
  if (gateJobs.length === 0) report.violations.push(`${RELEASE_GATE_FILE}: has no jobs`);
  const runName = workflow.doc['run-name'];
  if (
    typeof runName !== 'string' ||
    !runName.includes(MAIN_DEPLOY_MARKER) ||
    !runName.includes('merge')
  ) {
    report.violations.push(
      `${RELEASE_GATE_FILE}: run-name must advertise the evaluation mode (merge | ${MAIN_DEPLOY_MARKER}) so Protected delivery can filter workflow_run events`,
    );
  }
  for (const [jobId, job] of gateJobs) {
    const timeout = job['timeout-minutes'];
    if (typeof timeout !== 'number' || timeout > RELEASE_GATE_TIMEOUT_MINUTES) {
      report.violations.push(
        `${RELEASE_GATE_FILE}: job "${jobId}" must set timeout-minutes <= ${RELEASE_GATE_TIMEOUT_MINUTES}`,
      );
    }
    if (isRecord(job.permissions)) {
      for (const [scope, level] of Object.entries(job.permissions)) {
        if (expectedPermissions[scope] !== level) {
          report.violations.push(
            `${RELEASE_GATE_FILE}: job "${jobId}" escalates permission ${scope}`,
          );
        }
      }
    }
    for (const step of steps(job)) {
      const uses = typeof step.uses === 'string' ? step.uses : '';
      if (uses.startsWith('actions/checkout')) {
        const withBlock = isRecord(step.with) ? step.with : {};
        const ref = withBlock.ref;
        if (ref !== 'main' && ref !== 'refs/heads/main') {
          report.violations.push(
            `${RELEASE_GATE_FILE}: job "${jobId}" must check out ref main only`,
          );
        }
        if (typeof withBlock.repository === 'string' && withBlock.repository.includes('${{')) {
          report.violations.push(
            `${RELEASE_GATE_FILE}: job "${jobId}" must not check out a dynamic repository`,
          );
        }
      }
      const run = typeof step.run === 'string' ? step.run : '';
      const dlx = /pnpm dlx tsx@([0-9][\w.-]*)/.exec(run);
      if (dlx) {
        if (lockfileTsxVersion === null) {
          report.warnings.push(
            `${RELEASE_GATE_FILE}: cannot verify tsx pin ${dlx[1]} against pnpm-lock.yaml`,
          );
        } else if (dlx[1] !== lockfileTsxVersion) {
          report.violations.push(
            `${RELEASE_GATE_FILE}: tsx pin ${dlx[1]} differs from lockfile tsx ${lockfileTsxVersion}`,
          );
        }
      }
    }
  }
}

function checkEnvironments(workflows: ParsedWorkflow[], report: ContractReport): void {
  const known = new Set<string>(KNOWN_ENVIRONMENTS);
  for (const workflow of workflows) {
    for (const [jobId, job] of jobs(workflow)) {
      const environment = job.environment;
      const name =
        typeof environment === 'string'
          ? environment
          : isRecord(environment)
            ? environment.name
            : undefined;
      if (name === undefined) continue;
      if (typeof name !== 'string' || !known.has(name)) {
        report.violations.push(
          `${workflow.fileName}: job "${jobId}" uses unknown environment "${String(name)}"`,
        );
      }
    }
  }
}

function checkForkProfile(workflows: ParsedWorkflow[], report: ContractReport): void {
  const workflow = workflows.find((entry) => workflowName(entry) === 'Fork profile');
  if (!workflow) return;
  if (/secrets\./.test(workflow.content)) {
    report.violations.push(`${workflow.fileName}: Fork profile must not reference secrets`);
  }
  if (
    !workflow.content.includes('github.event.pull_request.head.repo.id') ||
    !workflow.content.includes('github.repository_id')
  ) {
    report.violations.push(
      `${workflow.fileName}: Fork profile must compare head.repo.id with github.repository_id`,
    );
  }
  for (const [jobId, job] of jobs(workflow)) {
    for (const step of steps(job)) {
      const uses = typeof step.uses === 'string' ? step.uses : '';
      const withBlock = isRecord(step.with) ? step.with : {};
      if (uses.startsWith('actions/setup-node') && withBlock.cache !== undefined) {
        report.violations.push(
          `${workflow.fileName}: job "${jobId}" must not use a credential-bearing dependency cache`,
        );
      }
    }
  }
}

function extractScriptNames(run: string): string[] {
  const names: string[] = [];
  const pattern = /\bpnpm\s+(?:run\s+)?(?:--filter\s+\S+\s+(?:-r\s+)?)?([a-z][\w:-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(run)) !== null) {
    const candidate = match[1];
    if (PNPM_BUILTINS.has(candidate)) continue;
    if (candidate.startsWith('-')) continue;
    names.push(candidate);
  }
  return names;
}

function checkScriptReferences(
  workflows: ParsedWorkflow[],
  packageScripts: Set<string>,
  report: ContractReport,
): void {
  const contract = new Set<string>(CONTRACT_SCRIPTS);
  for (const workflow of workflows) {
    for (const [jobId, job] of jobs(workflow)) {
      for (const step of steps(job)) {
        const run = typeof step.run === 'string' ? step.run : '';
        if (run.includes('--filter')) continue; // workspace-scoped scripts live in the worker packages
        for (const script of extractScriptNames(run)) {
          if (packageScripts.has(script)) continue;
          if (contract.has(script)) {
            report.warnings.push(
              `${workflow.fileName}: job "${jobId}" calls contract script "${script}" not yet registered in package.json`,
            );
          } else {
            report.violations.push(
              `${workflow.fileName}: job "${jobId}" calls unknown pnpm script "${script}"`,
            );
          }
        }
      }
    }
  }
}

function checkPolicy(
  input: ValidateContractsInput,
  workflows: ParsedWorkflow[],
  report: ContractReport,
): void {
  const { policy, unconfigured, errors } = input.policy;
  for (const error of errors) report.violations.push(`policy: ${error}`);
  for (const placeholder of unconfigured) {
    report.warnings.push(
      `policy: ${placeholder} is still a REPLACE_ME placeholder (gate refuses until configured)`,
    );
  }
  const workflowNames = new Set(workflows.map(workflowName));
  for (const hosted of policy.requiredHostedWorkflows) {
    if (!workflowNames.has(hosted.displayName)) {
      report.violations.push(
        `policy: requiredHostedWorkflows["${hosted.displayName}"] has no workflow with that name`,
      );
    }
  }
  if (!workflowNames.has(policy.fallbackWorkflow.displayName)) {
    report.violations.push(
      `policy: fallbackWorkflow.displayName "${policy.fallbackWorkflow.displayName}" has no workflow`,
    );
  }
  const jobNames = collectJobNames(workflows);
  for (const hosted of policy.requiredHostedWorkflows) {
    for (const job of hosted.requiredJobs) {
      if (!jobNames.has(job))
        report.violations.push(`policy: required job "${job}" does not exist in any workflow`);
    }
  }
  for (const checkName of Object.keys(policy.compatibilityChecks)) {
    if (!jobNames.has(checkName)) {
      report.violations.push(
        `policy: compatibility check "${checkName}" has no hosted job of that name`,
      );
    }
  }
  if (policy.runtime.activeRuntime !== `node${ACTIVE_NODE_VERSION}`) {
    report.violations.push(`policy: runtime.activeRuntime must be node${ACTIVE_NODE_VERSION}`);
  }
  if (PLACEHOLDER_PATTERN.test(policy.policyVersion)) {
    report.violations.push('policy: policyVersion must be a real version');
  }
  checkProfileInventory(policy, input.profiles, report);
}

function checkProfileInventory(
  policy: PolicyResolution['policy'],
  profiles: ProfileInventory,
  report: ContractReport,
): void {
  for (const [profileName, entry] of Object.entries(policy.profiles)) {
    const provided = profiles[profileName];
    if (!provided) {
      report.violations.push(
        `policy: profile "${profileName}" is not defined by scripts/ci/profiles`,
      );
      continue;
    }
    if (provided.policyVersion !== policy.policyVersion) {
      report.violations.push(
        `policy: policyVersion ${policy.policyVersion} differs from scripts/ci/profiles "${profileName}" (${provided.policyVersion})`,
      );
    }
    const byId = new Map(provided.suites.map((suite) => [suite.id, suite]));
    for (const suiteId of entry.requiredSuites) {
      const suite = byId.get(suiteId);
      if (!suite) {
        report.violations.push(
          `policy: profile "${profileName}" requires suite "${suiteId}" that scripts/ci/profiles does not run`,
        );
      } else if (suite.conditional) {
        report.violations.push(
          `policy: profile "${profileName}" lists conditional suite "${suiteId}" as required`,
        );
      }
    }
    for (const suiteId of entry.conditionalSuites) {
      const suite = byId.get(suiteId);
      if (!suite) {
        report.violations.push(
          `policy: profile "${profileName}" lists conditional suite "${suiteId}" that scripts/ci/profiles does not define`,
        );
      } else if (!suite.conditional) {
        report.violations.push(
          `policy: profile "${profileName}" lists unconditional suite "${suiteId}" as conditional`,
        );
      }
    }
    const covered = new Set([...entry.requiredSuites, ...entry.conditionalSuites]);
    for (const suite of provided.suites) {
      if (!covered.has(suite.id)) {
        report.violations.push(
          `policy: profile "${profileName}" does not cover suite "${suite.id}" run by scripts/ci/profiles`,
        );
      }
      const inventoryName = policy.suiteInventory[suite.id];
      if (inventoryName === undefined) {
        report.violations.push(`policy: suiteInventory lacks suite "${suite.id}"`);
      } else if (inventoryName !== suite.displayName) {
        report.violations.push(
          `policy: suiteInventory["${suite.id}"] is "${inventoryName}", profile display name is "${suite.displayName}"`,
        );
      }
      for (const checkName of suite.satisfies) {
        if (policy.compatibilityChecks[checkName] !== suite.id) {
          report.violations.push(
            `policy: compatibilityChecks["${checkName}"] must map to suite "${suite.id}" (declared by scripts/ci/profiles)`,
          );
        }
      }
    }
  }
}

function jobCondition(job: Record<string, unknown>): string {
  return typeof job.if === 'string' ? job.if : '';
}

function checkProtectedDelivery(workflows: ParsedWorkflow[], report: ContractReport): void {
  const workflow = workflows.find((entry) => workflowName(entry) === PROTECTED_DELIVERY_NAME);
  if (!workflow) return;
  const on = triggers(workflow);
  for (const trigger of ['pull_request', 'pull_request_target']) {
    if (trigger in on) {
      report.violations.push(
        `${workflow.fileName}: ${PROTECTED_DELIVERY_NAME} must never trigger on ${trigger}`,
      );
    }
  }
  const workflowRun = isRecord(on.workflow_run) ? on.workflow_run : {};
  const upstream = Array.isArray(workflowRun.workflows) ? workflowRun.workflows.map(String) : [];
  if (upstream.includes('Release gate')) {
    const filtered = jobs(workflow).some(([, job]) => {
      const condition = jobCondition(job);
      return (
        condition.includes('workflow_run.display_title') && condition.includes(MAIN_DEPLOY_MARKER)
      );
    });
    if (!filtered) {
      report.violations.push(
        `${workflow.fileName}: ${PROTECTED_DELIVERY_NAME} must filter Release gate workflow_run events to ${MAIN_DEPLOY_MARKER} evaluations (workflow_run.display_title)`,
      );
    }
  }
  const automated = 'workflow_run' in on;
  for (const [jobId, job] of jobs(workflow)) {
    if (!jobCondition(job).includes(MAIN_REF_GUARD)) {
      report.violations.push(
        `${workflow.fileName}: job "${jobId}" must be guarded by ${MAIN_REF_GUARD}`,
      );
    }
    // Root jobs (no `needs`) are the entry points a workflow_run event can start; until Phase 5
    // they must be armed explicitly by the repository variable (docs/ci/governance.md).
    if (automated && job.needs === undefined && !jobCondition(job).includes(AUTOMATION_GUARD)) {
      report.violations.push(
        `${workflow.fileName}: job "${jobId}" starts from workflow_run and must be guarded by ${AUTOMATION_GUARD}`,
      );
    }
    const environmentName = jobEnvironmentName(job);
    if (environmentName === 'Production') {
      const concurrency = job.concurrency;
      if (!isRecord(concurrency) || concurrency['cancel-in-progress'] !== false) {
        report.violations.push(
          `${workflow.fileName}: job "${jobId}" deploys Production and must set concurrency.cancel-in-progress: false`,
        );
      }
    }
    if (environmentName !== undefined && PROTECTED_ENVIRONMENTS.has(environmentName)) {
      checkDeliveryOrder(workflow, jobId, job, environmentName.toLowerCase(), report);
    }
  }
}

/**
 * Inside a Staging/Production delivery job, separation evidence for that exact target must
 * exist before any deploy, and a remote dry-run must precede the migration apply. Both are
 * refused at runtime too (deploy:workers, db:plan-remote); this catches the ordering at review.
 */
function checkDeliveryOrder(
  workflow: ParsedWorkflow,
  jobId: string,
  job: Record<string, unknown>,
  target: string,
  report: ContractReport,
): void {
  const runs = steps(job).map((step) => (typeof step.run === 'string' ? step.run : ''));
  const separationIndex = runs.findIndex((run) =>
    run.includes(`deploy:validate-separation --env ${target}`),
  );
  const planIndex = runs.findIndex((run) => run.includes('db:plan-remote'));
  const linkIndex = runs.findIndex((run) => PNPM_SCRIPT('db:link').test(run));
  runs.forEach((run, index) => {
    // The checkout's committed link state names staging; a migration job must re-link to its
    // own target (and prove the link) before the plan and the apply address that project.
    if (
      /\bdb:(?:migrate|push)\b/.test(run) &&
      (linkIndex === -1 || linkIndex > index || (planIndex !== -1 && linkIndex > planIndex))
    ) {
      report.violations.push(
        `${workflow.fileName}: job "${jobId}" must run db:link before db:plan-remote and "${/\bdb:(?:migrate|push)\b/.exec(run)?.[0] ?? 'db:migrate'}"`,
      );
    }
    const deploys =
      /\b(?:db:migrate|db:push|deploy:workers|deploy:vercel:(?:prebuilt|promote))\b/.exec(run);
    if (deploys && (separationIndex === -1 || separationIndex > index)) {
      report.violations.push(
        `${workflow.fileName}: job "${jobId}" must run deploy:validate-separation --env ${target} before "${deploys[0]}"`,
      );
    }
    if (/\bdb:(?:migrate|push)\b/.test(run) && (planIndex === -1 || planIndex > index)) {
      report.violations.push(
        `${workflow.fileName}: job "${jobId}" must run db:plan-remote before "${/\bdb:(?:migrate|push)\b/.exec(run)?.[0] ?? 'db:migrate'}"`,
      );
    }
  });
}

/** Jobs that deliver to Production or Staging must not mint OIDC identity or attestations. */
function checkProtectedEnvironmentPermissions(
  workflows: ParsedWorkflow[],
  report: ContractReport,
): void {
  for (const workflow of workflows) {
    const workflowPermissions = isRecord(workflow.doc.permissions) ? workflow.doc.permissions : {};
    for (const [jobId, job] of jobs(workflow)) {
      if (!isProtectedJob(job)) continue;
      const permissions = isRecord(job.permissions) ? job.permissions : workflowPermissions;
      for (const scope of IDENTITY_PERMISSIONS) {
        if (permissions[scope] === 'write') {
          report.violations.push(
            `${workflow.fileName}: job "${jobId}" deploys ${jobEnvironmentName(job)} and must not hold ${scope}: write (attest from a separate job without deploy secrets)`,
          );
        }
      }
    }
  }
}

/** A `run` that pipes into tee reports tee's exit code unless the step runs with pipefail. */
function checkPipefail(workflows: ParsedWorkflow[], report: ContractReport): void {
  for (const workflow of workflows) {
    for (const [jobId, job] of jobs(workflow)) {
      for (const step of steps(job)) {
        const run = typeof step.run === 'string' ? step.run : '';
        if (!TEE_PIPE_PATTERN.test(run)) continue;
        if (step.shell === 'bash' || run.includes('pipefail')) continue;
        const label = typeof step.name === 'string' ? step.name : 'unnamed';
        report.violations.push(
          `${workflow.fileName}: job "${jobId}" step "${label}" pipes into tee without pipefail (set shell: bash or set -o pipefail)`,
        );
      }
    }
  }
}

/**
 * `pnpm secret:scan` exits 1 when gitleaks or trufflehog is absent unless the step opts into the
 * built-in scanner explicitly. Silently shipping that configuration would fail every required
 * hosted lane, so the workflow must either install both scanners first or declare the fallback.
 */
function checkSecretScanPrerequisites(workflows: ParsedWorkflow[], report: ContractReport): void {
  const scanPattern = PNPM_SCRIPT('secret:scan');
  for (const workflow of workflows) {
    for (const [jobId, job] of jobs(workflow)) {
      const jobSteps = steps(job);
      jobSteps.forEach((step, index) => {
        if (!scanPattern.test(stepRun(step))) return;
        const before = jobSteps
          .slice(0, index)
          .map((entry) => `${stepUses(entry)}\n${stepRun(entry)}`);
        const provides = (pattern: RegExp): boolean => before.some((text) => pattern.test(text));
        if (provides(/gitleaks/i) && provides(/trufflehog|trufflesecurity/i)) return;
        const env = isRecord(step.env) ? step.env : {};
        const declared = env[SECRET_SCAN_BUILT_IN_ONLY_ENV];
        const builtInOnly =
          declared === true ||
          String(declared ?? '')
            .trim()
            .toLowerCase() === 'true';
        if (builtInOnly) {
          report.warnings.push(
            `${workflow.fileName}: job "${jobId}" runs secret:scan with the built-in scanner only (${SECRET_SCAN_BUILT_IN_ONLY_ENV}); provision SHA-pinned gitleaks and trufflehog installs`,
          );
          return;
        }
        report.violations.push(
          `${workflow.fileName}: job "${jobId}" runs secret:scan without gitleaks and trufflehog install steps or ${SECRET_SCAN_BUILT_IN_ONLY_ENV}: 'true'`,
        );
      });
    }
  }
}

function checkHostedFallback(
  workflows: ParsedWorkflow[],
  policy: PolicyResolution,
  report: ContractReport,
): void {
  const workflow = workflows.find((entry) => workflowName(entry) === HOSTED_FALLBACK_NAME);
  if (!workflow) return;
  const on = triggers(workflow);
  const allowed = new Set(['workflow_dispatch']);
  for (const trigger of Object.keys(on)) {
    if (!allowed.has(trigger)) {
      report.violations.push(
        `${workflow.fileName}: ${HOSTED_FALLBACK_NAME} may only trigger on workflow_dispatch (found ${trigger})`,
      );
    }
  }
  const expectedEnvironment = policy.policy.fallbackWorkflow.environment;
  const guarded = jobs(workflow).some(([, job]) => {
    const environment = job.environment;
    const name =
      typeof environment === 'string'
        ? environment
        : isRecord(environment)
          ? environment.name
          : undefined;
    return name === expectedEnvironment;
  });
  if (!guarded) {
    report.violations.push(
      `${workflow.fileName}: ${HOSTED_FALLBACK_NAME} must run its profile under the "${expectedEnvironment}" environment`,
    );
  }
  const permissions = isRecord(workflow.doc.permissions) ? workflow.doc.permissions : {};
  if (permissions['pull-requests'] !== 'read') {
    report.violations.push(
      `${workflow.fileName}: ${HOSTED_FALLBACK_NAME} needs permissions.pull-requests: read to bind the tuple to the pull request`,
    );
  }
  const expectedArtifact = fallbackEvidenceArtifactName(
    '${{ inputs.head_sha }}',
    '${{ inputs.attempt }}',
  );
  for (const [jobId, job] of jobs(workflow)) {
    checkCandidateJobIsolation(workflow, jobId, job, permissions, report);
    let bindingIndex = -1;
    let candidateCheckoutIndex = -1;
    let uploadsEvidence = false;
    steps(job).forEach((step, index) => {
      const run = typeof step.run === 'string' ? step.run : '';
      const uses = typeof step.uses === 'string' ? step.uses : '';
      const withBlock = isRecord(step.with) ? step.with : {};
      if (bindingIndex === -1 && FALLBACK_BINDING_MARKERS.every((marker) => run.includes(marker))) {
        bindingIndex = index;
      }
      const ref = typeof withBlock.ref === 'string' ? withBlock.ref : '';
      if (
        candidateCheckoutIndex === -1 &&
        uses.startsWith('actions/checkout') &&
        ref.includes('inputs.tested_sha')
      ) {
        candidateCheckoutIndex = index;
      }
      if (uses.startsWith('actions/upload-artifact') && withBlock.name === expectedArtifact) {
        uploadsEvidence = true;
      }
    });
    if (candidateCheckoutIndex === -1) continue; // not the job that runs the candidate
    if (bindingIndex === -1) {
      report.violations.push(
        `${workflow.fileName}: job "${jobId}" must bind the tuple to the pull request (head.repo.id, head.sha, base.sha, merge_commit_sha) or to protected main (compare) before checking out inputs.tested_sha`,
      );
    } else if (bindingIndex > candidateCheckoutIndex) {
      report.violations.push(
        `${workflow.fileName}: job "${jobId}" checks out inputs.tested_sha before binding the tuple to the pull request`,
      );
    }
    if (!uploadsEvidence) {
      report.violations.push(
        `${workflow.fileName}: job "${jobId}" must upload the evidence artifact named exactly "${expectedArtifact}" (the release gate binds the run to the tuple by this name)`,
      );
    }
  }
}

/**
 * A fallback job that checks out anything other than protected `main` executes candidate
 * code (install scripts, tests). It must hold read-only permissions and name no secret other
 * than the installation token; publishing with `checks: write` happens in a separate job
 * that checks out `main` only and re-validates the evidence.
 */
function checkCandidateJobIsolation(
  workflow: ParsedWorkflow,
  jobId: string,
  job: Record<string, unknown>,
  workflowPermissions: Record<string, unknown>,
  report: ContractReport,
): void {
  const checksOutCandidate = steps(job).some((step) => {
    const uses = typeof step.uses === 'string' ? step.uses : '';
    if (!uses.startsWith('actions/checkout')) return false;
    const withBlock = isRecord(step.with) ? step.with : {};
    const ref = withBlock.ref;
    return ref !== 'main' && ref !== 'refs/heads/main';
  });
  const publishes = steps(job).some(
    (step) => typeof step.run === 'string' && step.run.includes('fallback-run.ts publish'),
  );
  if (!checksOutCandidate) return;
  const permissions = isRecord(job.permissions) ? job.permissions : workflowPermissions;
  for (const [scope, level] of Object.entries(permissions)) {
    if (level === 'write') {
      report.violations.push(
        `${workflow.fileName}: job "${jobId}" checks out the candidate and must not hold ${scope}: write`,
      );
    }
  }
  const secretReferences = JSON.stringify(job).match(/secrets\.[A-Za-z_][\w]*/g) ?? [];
  for (const reference of new Set(secretReferences)) {
    if (reference === ALLOWED_CANDIDATE_SECRET) continue;
    report.violations.push(
      `${workflow.fileName}: job "${jobId}" checks out the candidate and must not reference ${reference}`,
    );
  }
  if (publishes) {
    report.violations.push(
      `${workflow.fileName}: job "${jobId}" checks out the candidate and must not publish the check run (publish from a separate main-only job)`,
    );
  }
}

export function validateWorkflowContracts(input: ValidateContractsInput): ContractReport {
  const report: ContractReport = { violations: [], warnings: [] };
  const workflows = input.workflows
    .map((file) => parseWorkflow(file, report))
    .filter((entry): entry is ParsedWorkflow => entry !== null);

  checkRequiredNames(workflows, report);
  checkPathFilters(workflows, input.policy, report);
  checkPullRequestTarget(workflows, report);
  checkActionPins(workflows, report);
  checkProtectedEnvironmentPermissions(workflows, report);
  checkPipefail(workflows, report);
  checkCheckoutHygiene(workflows, report);
  checkReleaseGate(workflows, input.lockfileTsxVersion, report);
  checkEnvironments(workflows, report);
  checkForkProfile(workflows, report);
  checkScriptReferences(workflows, input.packageScripts, report);
  checkPolicy(input, workflows, report);
  checkProtectedDelivery(workflows, report);
  checkHostedFallback(workflows, input.policy, report);
  checkSecretScanPrerequisites(workflows, report);
  return report;
}

/** Reads the resolved tsx version from pnpm-lock.yaml without a full lockfile parser. */
export function readLockfileTsxVersion(lockfileContent: string): string | null {
  const match = /^\s{2,}tsx@([0-9][\w.-]*)(?:\([^)]*\))?:\s*$/m.exec(lockfileContent);
  return match ? match[1] : null;
}
