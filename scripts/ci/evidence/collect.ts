import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildDockerSimpleArgs,
  CONTAINER_WORKDIR,
  type DockerContextSpec,
} from '../executor/docker/command';
import type { CommandRunner } from '../executor/runner';
import type { EvidenceFile, EvidenceRejection } from '../executor/types';
import { isSafeEvidencePath } from './path';
import { redactText } from './redact';

/**
 * Evidence collector.
 *
 * Artefacts are first staged out of the container with `docker cp` (which copies
 * symlinks as links and never follows them), then harvested into the job's
 * evidence directory by `harvestStagedArtefacts`, which is the only code that
 * reads the untrusted tree. It rejects traversal, symlinks, special files,
 * oversized files, unknown extensions and PNGs without a PNG header; it writes
 * everything with mode 0600 and never executes or evaluates anything.
 */

export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.json',
  '.xml',
  '.txt',
  '.log',
  '.html',
  '.png',
]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface CollectPolicy {
  readonly perFileBytes: number;
  readonly totalBytes: number;
}

export const DEFAULT_COLLECT_POLICY: CollectPolicy = Object.freeze({
  perFileBytes: 64 * 1024 * 1024,
  totalBytes: 512 * 1024 * 1024,
});

export interface HarvestInput {
  readonly stagingDir: string;
  readonly evidenceDir: string;
  /** Workspace-relative roots the profile allows (e.g. `coverage`). */
  readonly allowedRoots: readonly string[];
  readonly policy?: CollectPolicy;
}

export interface HarvestResult {
  readonly files: readonly EvidenceFile[];
  readonly rejected: readonly EvidenceRejection[];
  readonly totalBytes: number;
}

const ROOT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/u;

export function assertAllowedRoot(root: string): void {
  if (
    !ROOT_PATTERN.test(root) ||
    root.split('/').some((part) => part === '..' || part === '' || part === '.')
  ) {
    throw new Error(`artefact root "${root}" is not a safe workspace-relative path`);
  }
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function kindFor(extension: string): EvidenceFile['kind'] {
  switch (extension) {
    case '.json':
      return 'json';
    case '.xml':
      return 'xml';
    case '.txt':
      return 'txt';
    case '.log':
      return 'log';
    case '.html':
      return 'html-inert';
    default:
      return 'png';
  }
}

interface Candidate {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly bytes: number;
}

function walk(stagingDir: string, root: string, rejected: EvidenceRejection[]): Candidate[] {
  const candidates: Candidate[] = [];
  const rootPath = path.join(stagingDir, root);
  try {
    lstatSync(rootPath);
  } catch {
    return candidates;
  }
  const stack: Array<{ relativePath: string; absolutePath: string }> = [
    { relativePath: root, absolutePath: rootPath },
  ];
  while (stack.length > 0) {
    const current = stack.pop() as { relativePath: string; absolutePath: string };
    const stats = lstatSync(current.absolutePath);
    if (stats.isSymbolicLink()) {
      rejected.push({ path: current.relativePath, reason: 'symlink' });
      continue;
    }
    if (
      !isInside(stagingDir, current.absolutePath) ||
      current.relativePath.split('/').includes('..')
    ) {
      rejected.push({ path: current.relativePath, reason: 'path-traversal' });
      continue;
    }
    if (stats.isDirectory()) {
      for (const entry of readdirSync(current.absolutePath).sort()) {
        if (entry === '.' || entry === '..' || entry.includes('/') || entry.includes('\0')) {
          rejected.push({ path: `${current.relativePath}/${entry}`, reason: 'path-traversal' });
          continue;
        }
        stack.push({
          relativePath: `${current.relativePath}/${entry}`,
          absolutePath: path.join(current.absolutePath, entry),
        });
      }
      continue;
    }
    if (!stats.isFile()) {
      rejected.push({ path: current.relativePath, reason: 'special-file' });
      continue;
    }
    candidates.push({
      relativePath: current.relativePath,
      absolutePath: current.absolutePath,
      bytes: stats.size,
    });
  }
  return candidates;
}

export function harvestStagedArtefacts(input: HarvestInput): HarvestResult {
  const policy = input.policy ?? DEFAULT_COLLECT_POLICY;
  const stagingDir = path.resolve(input.stagingDir);
  const evidenceDir = path.resolve(input.evidenceDir);
  const rejected: EvidenceRejection[] = [];
  const files: EvidenceFile[] = [];
  mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });

  const candidates: Candidate[] = [];
  for (const root of input.allowedRoots) {
    assertAllowedRoot(root);
    candidates.push(...walk(stagingDir, root, rejected));
  }
  // Anything staged outside the allowed roots is ignored, and recorded.
  for (const entry of readdirSync(stagingDir).sort()) {
    if (!input.allowedRoots.some((root) => root === entry || root.startsWith(`${entry}/`))) {
      rejected.push({ path: entry, reason: 'not-allowed-root' });
    }
  }
  candidates.sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  );

  let total = 0;
  for (const candidate of candidates) {
    if (!isSafeEvidencePath(candidate.relativePath)) {
      rejected.push({ path: candidate.relativePath, reason: 'object-key' });
      continue;
    }
    const extension = path.extname(candidate.relativePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      rejected.push({ path: candidate.relativePath, reason: 'extension' });
      continue;
    }
    if (candidate.bytes > policy.perFileBytes) {
      rejected.push({ path: candidate.relativePath, reason: 'per-file-size' });
      continue;
    }
    if (total + candidate.bytes > policy.totalBytes) {
      rejected.push({ path: candidate.relativePath, reason: 'total-size' });
      continue;
    }
    const raw = readFileSync(candidate.absolutePath);
    if (raw.length > policy.perFileBytes) {
      rejected.push({ path: candidate.relativePath, reason: 'per-file-size' });
      continue;
    }
    const kind = kindFor(extension);
    if (kind === 'png' && !raw.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
      rejected.push({ path: candidate.relativePath, reason: 'extension' });
      continue;
    }

    let content = raw;
    let redacted = false;
    if (kind === 'txt' || kind === 'log' || kind === 'html-inert' || kind === 'xml') {
      const result = redactText(raw.toString('utf8'));
      content = Buffer.from(result.text, 'utf8');
      redacted = result.redactions > 0;
    }
    const outputRelative =
      kind === 'html-inert' ? `${candidate.relativePath}.txt` : candidate.relativePath;
    const outputPath = path.join(evidenceDir, outputRelative);
    if (!isInside(evidenceDir, outputPath)) {
      rejected.push({ path: candidate.relativePath, reason: 'path-traversal' });
      continue;
    }
    mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 });
    rmSync(outputPath, { force: true });
    writeFileSync(outputPath, content, { mode: 0o600 });
    total += content.length;
    files.push({
      path: outputRelative,
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
      kind,
      redacted,
    });
  }

  return { files, rejected, totalBytes: total };
}

export interface StageInput {
  readonly docker: DockerContextSpec;
  /** Environment for the docker CLI on the host (PATH, HOME, job-private DOCKER_CONFIG). */
  readonly env: Readonly<Record<string, string>>;
  readonly container: string;
  readonly allowedRoots: readonly string[];
  readonly stagingDir: string;
}

/** Copy allowed roots out of the (stopped or running) container into the staging dir. */
export async function stageArtefactsFromContainer(
  input: StageInput,
  runner: CommandRunner,
): Promise<readonly string[]> {
  mkdirSync(input.stagingDir, { recursive: true, mode: 0o700 });
  const staged: string[] = [];
  for (const root of input.allowedRoots) {
    assertAllowedRoot(root);
    const target = path.join(input.stagingDir, root);
    mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    const result = await runner.run({
      command: 'docker',
      args: buildDockerSimpleArgs(
        input.docker,
        'cp',
        `${input.container}:${CONTAINER_WORKDIR}/${root}`,
        target,
      ),
      env: input.env,
      timeoutMs: 10 * 60_000,
      purpose: `stage ${root}`,
    });
    if (result.exitCode === 0) staged.push(root);
  }
  return staged;
}
