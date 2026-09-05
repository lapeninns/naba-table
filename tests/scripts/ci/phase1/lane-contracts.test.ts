import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
  CI_PROFILES,
  DEFAULT_REQUIRED_HOSTED_WORKFLOWS,
  GATE_CHECK_NAME,
  LOCAL_CHECK_NAME_PREFIX as WORKER_LOCAL_CHECK_NAME_PREFIX,
  REQUIRED_PROTECTED_REF,
  TUPLE_KEY_PREFIX as WORKER_TUPLE_KEY_PREFIX,
} from '@/cloudflare/operational-control/src/contracts';
import { gateDispatchInputs } from '@/cloudflare/operational-control/src/gate';
import {
  ciRequestTupleKey as workerTupleKey,
  parseCiRequestTuple as workerParseTupleKey,
} from '@/cloudflare/operational-control/src/webhook';
import {
  COMPATIBILITY_CHECK_NAMES,
  GITHUB_ENVIRONMENTS,
  HOSTED_FALLBACK_WORKFLOW_NAME,
  LOCAL_CHECK_NAME_PREFIX,
  RELEASE_GATE_CHECK_NAME,
  localCheckName,
} from '@/scripts/ci/contracts/names';
import { PROFILE_NAMES } from '@/scripts/ci/contracts/primitives';
import {
  TUPLE_KEY_PREFIX as CONTROLLER_TUPLE_KEY_PREFIX,
  tupleKey as controllerTupleKey,
} from '@/scripts/ci/controller/github/evidence-document';
import { compatibilityChecksForProfile, loadPolicy } from '@/scripts/ci/gate/policy';
import {
  TUPLE_KEY_PREFIX as GATE_TUPLE_KEY_PREFIX,
  parseCiRequestTuple as gateParseTuple,
  tupleKey as gateTupleKey,
} from '@/scripts/ci/gate/tuple';
import { REQUIRED_JOB_NAMES, REQUIRED_WORKFLOW_NAMES } from '@/scripts/ci/gate/workflow-contracts';
import { compatibilityCheckSuiteMap, profiles } from '@/scripts/ci/profiles/policy-suites';
import { PROFILES } from '@/scripts/ci/profiles/registry';

import { mainRequest, prRequest } from '../contracts/fixtures';

/**
 * Phase 1: complete hosted/local lane dependency contracts.
 *
 * The local controller, the release gate, the operational Worker and the hosted
 * workflows each carry their own copy of the lane vocabulary (check names,
 * workflow display names, job names, environments, required hosted workflows).
 * This sweep loads every real module and every real workflow file and proves
 * that the copies agree, so a rename in one place fails here instead of leaving
 * a candidate pending forever or a gate refusing valid evidence.
 */

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const workflowsDir = path.join(repositoryRoot, '.github/workflows');

type Workflow = {
  readonly fileName: string;
  readonly name: string | null;
  readonly on: unknown;
  readonly jobs: Record<string, Record<string, unknown>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readWorkflow(fileName: string): Workflow {
  const content = readFileSync(path.join(workflowsDir, fileName), 'utf8');
  const parsed: unknown = parseYaml(content);
  if (!isRecord(parsed)) throw new Error(`${fileName} is not a mapping`);
  const jobs: Record<string, Record<string, unknown>> = {};
  if (isRecord(parsed.jobs)) {
    for (const [jobId, job] of Object.entries(parsed.jobs)) {
      if (isRecord(job)) jobs[jobId] = job;
    }
  }
  return {
    fileName,
    name: typeof parsed.name === 'string' ? parsed.name : null,
    // YAML parses the `on` key as a plain string key here (no boolean coercion for keys in yaml@2).
    on: parsed.on ?? parsed[String(true)],
    jobs,
  };
}

const workflows: readonly Workflow[] = readdirSync(workflowsDir)
  .filter((fileName) => fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
  .sort()
  .map(readWorkflow);

function workflowNamed(displayName: string): Workflow {
  const matches = workflows.filter((workflow) => workflow.name === displayName);
  expect(matches, `exactly one workflow must be named "${displayName}"`).toHaveLength(1);
  return matches[0] as Workflow;
}

/** Trigger names of a workflow regardless of the `on:` spelling GitHub accepts. */
function triggers(workflow: Workflow): readonly string[] {
  if (typeof workflow.on === 'string') return [workflow.on];
  if (Array.isArray(workflow.on))
    return workflow.on.filter((e): e is string => typeof e === 'string');
  if (isRecord(workflow.on)) return Object.keys(workflow.on);
  return [];
}

function triggerConfig(workflow: Workflow, trigger: string): Record<string, unknown> | null {
  if (!isRecord(workflow.on)) return null;
  const config = workflow.on[trigger];
  return isRecord(config) ? config : null;
}

function jobNames(workflow: Workflow): readonly string[] {
  return Object.values(workflow.jobs)
    .map((job) => job.name)
    .filter((name): name is string => typeof name === 'string');
}

function jobEnvironments(workflow: Workflow): readonly string[] {
  return Object.values(workflow.jobs).flatMap((job) => {
    const environment = job.environment;
    if (typeof environment === 'string') return [environment];
    if (isRecord(environment) && typeof environment.name === 'string') return [environment.name];
    return [];
  });
}

/** A hosted lane whose runs must appear for every PR head and every main push. */
function expectRunsForPullRequestsAndMain(workflow: Workflow): void {
  const on = triggers(workflow);
  expect(on, `${workflow.fileName} must run on pull_request`).toContain('pull_request');
  expect(on, `${workflow.fileName} must run on push`).toContain('push');
  const push = triggerConfig(workflow, 'push');
  expect(push?.branches, `${workflow.fileName} push trigger must name main`).toContain('main');
  for (const trigger of ['pull_request', 'push']) {
    const config = triggerConfig(workflow, trigger);
    expect(
      config?.paths,
      `${workflow.fileName} ${trigger} must not be path-filtered (a skipped run never completes)`,
    ).toBeUndefined();
    expect(
      config?.['paths-ignore'],
      `${workflow.fileName} ${trigger} must not ignore paths`,
    ).toBeUndefined();
  }
}

const resolution = loadPolicy(repositoryRoot);
const policy = resolution.policy;

describe('lane vocabulary shared by controller, gate, Worker and profiles', () => {
  it('names the same three profiles everywhere', () => {
    expect([...CI_PROFILES]).toEqual([...PROFILE_NAMES]);
    expect(Object.keys(policy.profiles).sort()).toEqual([...PROFILE_NAMES].sort());
    expect(Object.keys(profiles).sort()).toEqual([...PROFILE_NAMES].sort());
    expect(
      Object.values(PROFILES)
        .map((profile) => profile.name)
        .sort(),
    ).toEqual([...PROFILE_NAMES].sort());
  });

  it('publishes and consumes the same local check name and gate check name', () => {
    expect(WORKER_LOCAL_CHECK_NAME_PREFIX).toBe(LOCAL_CHECK_NAME_PREFIX);
    expect(policy.localCi.checkNamePrefix).toBe(LOCAL_CHECK_NAME_PREFIX);
    expect(GATE_CHECK_NAME).toBe(RELEASE_GATE_CHECK_NAME);
    expect(policy.gateCheckName).toBe(RELEASE_GATE_CHECK_NAME);
    for (const profile of PROFILE_NAMES) {
      expect(localCheckName(profile)).toBe(`${WORKER_LOCAL_CHECK_NAME_PREFIX}${profile}`);
    }
  });

  it('agrees on the protected branch', () => {
    expect(REQUIRED_PROTECTED_REF).toBe(`refs/heads/${policy.protectedBranch}`);
  });
});

describe('compatibility checks map to exactly one local suite per profile', () => {
  it('covers every compatibility check name in every profile without ambiguity', () => {
    for (const profile of Object.values(PROFILES)) {
      const map = compatibilityCheckSuiteMap(profile);
      expect(Object.keys(map).sort()).toEqual([...COMPATIBILITY_CHECK_NAMES].sort());
      for (const suiteId of Object.values(map)) {
        expect(profile.suites.map((suite) => suite.id)).toContain(suiteId);
      }
    }
  });

  it('keeps the gate policy mapping identical to the profile mapping', () => {
    expect(Object.keys(policy.compatibilityChecks).sort()).toEqual(
      [...COMPATIBILITY_CHECK_NAMES].sort(),
    );
    for (const profile of Object.values(PROFILES)) {
      const map = compatibilityCheckSuiteMap(profile);
      for (const checkName of COMPATIBILITY_CHECK_NAMES) {
        expect(policy.compatibilityChecks[checkName]).toBe(map[checkName]);
        expect(policy.suiteInventory).toHaveProperty(map[checkName]);
      }
      // The gate mirrors every compatibility check for pr and main; conditional
      // suites are the only ones a changed-path rule may skip.
      const mirrored = compatibilityChecksForProfile(policy, profile.name);
      expect(mirrored.map((entry) => entry.checkName).sort()).toEqual(
        [...COMPATIBILITY_CHECK_NAMES].sort(),
      );
      const conditional = new Set(policy.profiles[profile.name].conditionalSuites);
      for (const entry of mirrored) {
        expect(entry.conditional).toBe(conditional.has(entry.suiteId));
      }
    }
  });
});

describe('hosted lanes the release gate depends on', () => {
  it('lists real workflows that run for PR heads and main pushes with the required job names', () => {
    expect(policy.requiredHostedWorkflows.length).toBeGreaterThan(0);
    for (const requirement of policy.requiredHostedWorkflows) {
      const workflow = workflowNamed(requirement.displayName);
      expectRunsForPullRequestsAndMain(workflow);
      expect(requirement.requiredJobs.length).toBeGreaterThan(0);
      for (const jobName of requirement.requiredJobs) {
        expect(jobNames(workflow), `${workflow.fileName} must define job "${jobName}"`).toContain(
          jobName,
        );
      }
    }
  });

  it('keeps the contract validator vocabulary present in the tree', () => {
    const names = new Set(workflows.map((workflow) => workflow.name));
    for (const required of REQUIRED_WORKFLOW_NAMES) expect(names).toContain(required);
    const allJobNames = new Set(workflows.flatMap(jobNames));
    for (const required of REQUIRED_JOB_NAMES) {
      // Job display names may be templated ("Shuffle seed ${{ matrix.seed }}"); a
      // template counts when the required name starts with its literal prefix.
      const present = [...allJobNames].some((name) => {
        const templateStart = name.indexOf('${{');
        if (templateStart === -1) return name === required;
        const prefix = name.slice(0, templateStart);
        return prefix.length > 0 && required.startsWith(prefix);
      });
      expect(present, `job "${required}" must exist in some workflow`).toBe(true);
    }
  });
});

describe('hosted lanes the operational Worker waits for', () => {
  it('only waits for workflows that exist and complete for every PR head and main push', () => {
    expect(DEFAULT_REQUIRED_HOSTED_WORKFLOWS.length).toBeGreaterThan(0);
    for (const workflowPath of DEFAULT_REQUIRED_HOSTED_WORKFLOWS) {
      expect(workflowPath.startsWith('.github/workflows/')).toBe(true);
      const absolute = path.join(repositoryRoot, workflowPath);
      expect(existsSync(absolute), `${workflowPath} must exist`).toBe(true);
      const workflow = readWorkflow(path.basename(workflowPath));
      expectRunsForPullRequestsAndMain(workflow);
    }
  });

  it('never waits for the gate, the fallback or itself', () => {
    const waited = new Set(DEFAULT_REQUIRED_HOSTED_WORKFLOWS.map((entry) => path.basename(entry)));
    expect(waited.has('release-gate.yml')).toBe(false);
    expect(waited.has('hosted-profile-fallback.yml')).toBe(false);
    expect(waited.has('fork-profile.yml')).toBe(false);
    expect(waited.has('deploy.yml')).toBe(false);
  });
});

describe('gate, fallback and fork workflows carry the contract names', () => {
  it('names the release gate workflow and job after the gate check', () => {
    const gate = workflowNamed(RELEASE_GATE_CHECK_NAME);
    expect(gate.fileName).toBe('release-gate.yml');
    expect(jobNames(gate)).toContain(RELEASE_GATE_CHECK_NAME);
  });

  it('names the fallback workflow after the contract and binds it to the CI fallback environment', () => {
    expect(policy.fallbackWorkflow.displayName).toBe(HOSTED_FALLBACK_WORKFLOW_NAME);
    const fallback = workflowNamed(HOSTED_FALLBACK_WORKFLOW_NAME);
    expect(fallback.fileName).toBe('hosted-profile-fallback.yml');
    expect(triggers(fallback)).toEqual(['workflow_dispatch']);
    expect(GITHUB_ENVIRONMENTS).toContain(policy.fallbackWorkflow.environment);
    expect(jobEnvironments(fallback)).toContain(policy.fallbackWorkflow.environment);
    expect(policy.fallbackWorkflow.checkNamePrefix).toBe(`${HOSTED_FALLBACK_WORKFLOW_NAME} / `);
    const inputs = triggerConfig(fallback, 'workflow_dispatch')?.inputs;
    expect(isRecord(inputs) ? Object.keys(inputs) : []).toEqual(
      expect.arrayContaining(['repository_id', 'profile', 'head_sha']),
    );
  });

  it('keeps the fork lane secret-less and separate from every trusted lane', () => {
    const fork = workflowNamed('Fork profile');
    expect(fork.fileName).toBe('fork-profile.yml');
    expect(jobEnvironments(fork)).toEqual([]);
    const content = readFileSync(path.join(workflowsDir, fork.fileName), 'utf8');
    expect(content).not.toMatch(/secrets\.(?!GITHUB_TOKEN\b)[A-Z_]+/u);
    expect(triggers(fork)).not.toContain('pull_request_target');
  });

  it('uses only the contract GitHub environments', () => {
    const used = new Set(workflows.flatMap(jobEnvironments));
    expect(used.size).toBeGreaterThan(0);
    for (const environment of used) {
      expect(
        GITHUB_ENVIRONMENTS,
        `environment "${environment}" is not a contract environment`,
      ).toContain(environment);
    }
  });
});

describe('monitoring evidence names only workflow files that exist', () => {
  const monitoring: unknown = parseYaml(
    readFileSync(path.join(repositoryRoot, 'config/observability/monitoring.yaml'), 'utf8'),
  );

  it('lists existing required workflow files, including the backup and drill workflows', () => {
    expect(isRecord(monitoring)).toBe(true);
    const evidence =
      isRecord(monitoring) && isRecord(monitoring.evidence) ? monitoring.evidence : null;
    expect(evidence).not.toBeNull();
    const required = evidence?.requiredWorkflowFiles;
    expect(Array.isArray(required) && required.length > 0).toBe(true);
    const files = new Set(workflows.map((workflow) => workflow.fileName));
    for (const fileName of Array.isArray(required) ? required : []) {
      expect(files, `${String(fileName)} is listed but missing`).toContain(fileName);
    }
    for (const kind of ['backup', 'drill']) {
      const section = evidence?.[kind];
      const workflowFile = isRecord(section) ? section.workflowFile : null;
      expect(typeof workflowFile).toBe('string');
      expect(files).toContain(workflowFile);
      expect(required).toContain(workflowFile);
    }
    expect(required).toContain('release-gate.yml');
  });
});

describe('tuple key and gate dispatch inputs agree between controller, gate and Worker', () => {
  const requests = [prRequest(), mainRequest(), mainRequest({ profile: 'nightly' })] as const;

  it('shares one tuple key prefix', () => {
    expect(WORKER_TUPLE_KEY_PREFIX).toBe(GATE_TUPLE_KEY_PREFIX);
    expect(CONTROLLER_TUPLE_KEY_PREFIX).toBe(GATE_TUPLE_KEY_PREFIX);
  });

  it('parses the controller-published external_id with the Worker parser and re-serializes it', () => {
    for (const request of requests) {
      const externalId = controllerTupleKey(request);
      expect(externalId).toBe(gateTupleKey(request));
      const parsed = workerParseTupleKey(externalId, {
        repositoryId: String(request.repositoryId),
      });
      expect(parsed, externalId).not.toBeNull();
      if (!parsed) continue;
      expect(parsed).toEqual({ ...request, repositoryId: String(request.repositoryId) });
      expect(workerTupleKey(parsed)).toBe(externalId);
      // The Worker tuple round-trips through the gate's own parser (numeric strings accepted).
      const gateParsed = gateParseTuple(parsed);
      expect(gateParsed.ok).toBe(true);
      if (gateParsed.ok) expect(gateTupleKey(gateParsed.tuple)).toBe(externalId);
    }
  });

  it('refuses a controller key for another repository id', () => {
    const externalId = controllerTupleKey(prRequest());
    expect(workerParseTupleKey(externalId, { repositoryId: '1' })).toBeNull();
  });

  it('dispatches the gate with exactly the workflow_dispatch inputs release-gate.yml declares', () => {
    const gate = workflowNamed(RELEASE_GATE_CHECK_NAME);
    const declared = triggerConfig(gate, 'workflow_dispatch')?.inputs;
    expect(isRecord(declared)).toBe(true);
    if (!isRecord(declared)) return;
    for (const request of requests) {
      const tuple = workerParseTupleKey(controllerTupleKey(request), {
        repositoryId: String(request.repositoryId),
      });
      expect(tuple).not.toBeNull();
      if (!tuple) continue;
      const inputs = gateDispatchInputs(tuple);
      expect(Object.keys(inputs).sort()).toEqual(Object.keys(declared).sort());
      for (const [name, spec] of Object.entries(declared)) {
        const value = inputs[name];
        expect(typeof value, `input ${name} must be a string`).toBe('string');
        if (isRecord(spec) && spec.required === true) {
          expect(value, `required input ${name} must be non-empty`).not.toBe('');
        }
      }
      expect(inputs.repository_id).toBe(String(request.repositoryId));
      expect(inputs.pr_number).toBe(request.prNumber === undefined ? '' : String(request.prNumber));
      expect(inputs.head_sha).toBe(request.headSha);
      expect(inputs.base_sha).toBe(request.baseSha);
      expect(inputs.tested_sha).toBe(request.testedSha);
      expect(inputs.attempt).toBe(String(request.attempt));
    }
  });
});
