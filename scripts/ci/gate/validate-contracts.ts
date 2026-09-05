import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { PROFILES } from '../profiles/registry';
import { loadPolicy } from './policy';
import {
  readLockfileTsxVersion,
  validateWorkflowContracts,
  type ProfileInventory,
  type WorkflowFile,
} from './workflow-contracts';

/**
 * `pnpm ci:contracts:validate` — trusted CI contract validation.
 * Runs inside "Security guards" on every PR so a workflow edit that weakens
 * the gate (path filters, unpinned actions, candidate checkout in the gate,
 * unknown environments, a policy that drifts from scripts/ci/profiles) fails
 * before it can merge.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadWorkflowFiles(workflowsDir: string): WorkflowFile[] {
  return readdirSync(workflowsDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort()
    .map((fileName) => ({
      fileName,
      content: readFileSync(path.join(workflowsDir, fileName), 'utf8'),
    }));
}

export function readPackageScripts(repositoryRoot: string): Set<string> {
  const raw: unknown = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
  const scripts = isRecord(raw) && isRecord(raw.scripts) ? raw.scripts : {};
  return new Set(Object.keys(scripts));
}

/** Projects the statically typed profile registry onto the inventory the validator compares. */
export function profileInventoryFromRegistry(): ProfileInventory {
  const inventory: ProfileInventory = {};
  for (const [name, profile] of Object.entries(PROFILES)) {
    inventory[name] = {
      policyVersion: profile.policyVersion,
      suites: profile.suites.map((suite) => ({
        id: suite.id,
        displayName: suite.displayName,
        conditional: suite.conditional,
        satisfies: [...suite.satisfies],
      })),
    };
  }
  return inventory;
}

export function validateRepositoryContracts(repositoryRoot: string) {
  const workflowsDir = path.join(repositoryRoot, '.github', 'workflows');
  const lockfilePath = path.join(repositoryRoot, 'pnpm-lock.yaml');
  return validateWorkflowContracts({
    workflows: loadWorkflowFiles(workflowsDir),
    policy: loadPolicy(repositoryRoot),
    packageScripts: readPackageScripts(repositoryRoot),
    lockfileTsxVersion: existsSync(lockfilePath)
      ? readLockfileTsxVersion(readFileSync(lockfilePath, 'utf8'))
      : null,
    profiles: profileInventoryFromRegistry(),
  });
}

function main(): number {
  const report = validateRepositoryContracts(process.cwd());
  for (const warning of report.warnings) console.warn(`warning: ${warning}`);
  if (report.violations.length > 0) {
    console.error(`CI contract validation failed with ${report.violations.length} violation(s):`);
    for (const violation of report.violations) console.error(`- ${violation}`);
    return 1;
  }
  console.log(`CI contracts valid (${report.warnings.length} warning(s)).`);
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  try {
    process.exitCode = main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
