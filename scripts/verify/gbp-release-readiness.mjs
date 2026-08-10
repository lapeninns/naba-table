#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REQUIRED_ARTIFACT_IDS = Object.freeze([
  'deployment-readback',
  'migration-readback',
  'environment-presence-readback',
  'cron-scheduler-readback',
  'canonical-route-smoke',
  'legacy-route-traffic-baseline',
  'write-grant-readback',
  'canary-set-readback',
  'canary-readback',
  'canary-restore-readback',
  'pubsub-topic-readback',
  'pubsub-subscription-readback',
  'pubsub-dlq-readback',
  'pubsub-iam-readback',
  'key-rotation-dry-run',
  'retention-census',
  'backup-pitr-census',
  'legacy-retirement-traffic-evidence',
]);

const REQUIRED_ARTIFACT_SET = new Set(REQUIRED_ARTIFACT_IDS);
const SHA256 = /^[a-f0-9]{64}$/iu;
const GIT_SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/iu;
const SAFE_METADATA = /^[\u0020-\u007e]{1,512}$/u;
const ARTIFACT_KEYS = new Set(['id', 'status', 'recordedAt', 'source', 'reference', 'sha256']);
const RELEASE_KEYS = new Set(['environment', 'deploySha', 'recordedAt']);

class ReadinessInputError extends Error {}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function hasOnlyKeys(record, allowed) {
  return Object.keys(record).every((key) => allowed.has(key));
}

function isRelease(value) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, RELEASE_KEYS) &&
    (value.environment === 'staging' || value.environment === 'production') &&
    typeof value.deploySha === 'string' &&
    GIT_SHA.test(value.deploySha) &&
    isIsoTimestamp(value.recordedAt)
  );
}

function isArtifact(value) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ARTIFACT_KEYS) &&
    typeof value.id === 'string' &&
    REQUIRED_ARTIFACT_SET.has(value.id) &&
    value.status === 'verified' &&
    isIsoTimestamp(value.recordedAt) &&
    typeof value.source === 'string' &&
    SAFE_METADATA.test(value.source) &&
    typeof value.reference === 'string' &&
    SAFE_METADATA.test(value.reference) &&
    typeof value.sha256 === 'string' &&
    SHA256.test(value.sha256)
  );
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--input' || !argv[1]) {
    throw new ReadinessInputError('usage: gbp-release-readiness.mjs --input PATH');
  }
  return { input: argv[1] };
}

function readManifest(raw) {
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new ReadinessInputError('manifest is not valid JSON');
  }
  if (!isRecord(manifest) || manifest.version !== 1 || !Array.isArray(manifest.artifacts)) {
    throw new ReadinessInputError('manifest must contain version 1 and an artifacts array');
  }
  return manifest;
}

export function checkReadiness(manifest) {
  const invalid = [];
  if (!isRelease(manifest.release)) invalid.push('release');

  const artifactsById = new Map();
  for (const artifact of manifest.artifacts) {
    if (!isRecord(artifact) || typeof artifact.id !== 'string') {
      invalid.push('unknown-artifact');
      continue;
    }
    if (!REQUIRED_ARTIFACT_SET.has(artifact.id)) {
      invalid.push('unknown-artifact');
      continue;
    }
    if (artifactsById.has(artifact.id) || !isArtifact(artifact)) {
      invalid.push(artifact.id);
      continue;
    }
    artifactsById.set(artifact.id, artifact);
  }

  const missing = REQUIRED_ARTIFACT_IDS.filter((id) => !artifactsById.has(id));
  const uniqueInvalid = [...new Set(invalid)].sort();
  const verified =
    REQUIRED_ARTIFACT_IDS.length -
    missing.length -
    uniqueInvalid.filter((id) => id !== 'release' && id !== 'unknown-artifact').length;
  const result = {
    ok: missing.length === 0 && uniqueInvalid.length === 0,
    counts: { required: REQUIRED_ARTIFACT_IDS.length, verified: Math.max(verified, 0) },
    missing,
    invalid: uniqueInvalid,
  };
  return result;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const manifest = readManifest(await readFile(path.resolve(args.input), 'utf8'));
    const result = checkReadiness(manifest);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    const code = error instanceof ReadinessInputError ? 'invalid_input' : 'read_failed';
    process.stdout.write(`${JSON.stringify({ ok: false, error: code })}\n`);
    process.exitCode = 2;
  }
}

await main();
