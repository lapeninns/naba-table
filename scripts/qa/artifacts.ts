import path from 'node:path';

import { ensureQaRunId, type QaRunIdDeps, type QaRunIdEnv } from './run-id';

export const QA_ARTIFACT_ROOT_ENV = 'QA_ARTIFACT_ROOT';
export const DEFAULT_QA_ARTIFACT_ROOT = 'test-results/qa';

export type QaArtifactDirs = {
  apiDir: string;
  browserDir: string;
  cleanupRegistryPath: string;
  logsDir: string;
  rootDir: string;
  runDir: string;
  runId: string;
};

export type QaArtifactOptions = {
  env?: QaRunIdEnv;
  projectRoot?: string;
  runIdDeps?: QaRunIdDeps;
};

function resolveArtifactRoot(projectRoot: string, env: QaRunIdEnv): string {
  const rawRoot = env[QA_ARTIFACT_ROOT_ENV]?.trim() || DEFAULT_QA_ARTIFACT_ROOT;
  const resolved = path.resolve(projectRoot, rawRoot);
  const relative = path.relative(projectRoot, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${QA_ARTIFACT_ROOT_ENV} must resolve inside the project root.`);
  }

  return resolved;
}

export function getQaArtifactDirs(options: QaArtifactOptions = {}): QaArtifactDirs {
  const env = options.env ?? process.env;
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const runId = ensureQaRunId(env, options.runIdDeps);
  const rootDir = resolveArtifactRoot(projectRoot, env);
  const runDir = path.join(rootDir, runId);

  return {
    apiDir: path.join(runDir, 'api'),
    browserDir: path.join(runDir, 'browser'),
    cleanupRegistryPath: path.join(runDir, 'cleanup-registry.json'),
    logsDir: path.join(runDir, 'logs'),
    rootDir,
    runDir,
    runId,
  };
}

export function getQaBrowserArtifactDir(options: QaArtifactOptions = {}): string {
  return getQaArtifactDirs(options).browserDir;
}
