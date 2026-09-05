import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * CodeQL findings policy. Reads SARIF produced by `github/codeql-action/analyze`
 * and fails when an error-level result is not listed in the accepted baseline
 * (config/ci/codeql-policy.json). Warnings are reported but never block.
 */

export type CodeqlPolicy = {
  policyVersion: string;
  failOnLevels: string[];
  warnOnLevels: string[];
  baselineFingerprints: string[];
  ignoredRuleIds: string[];
};

export type CodeqlFinding = {
  ruleId: string;
  level: string;
  fingerprint: string;
  location: string;
  message: string;
};

export type CodeqlPolicyReport = {
  ok: boolean;
  failing: CodeqlFinding[];
  baselined: CodeqlFinding[];
  warnings: CodeqlFinding[];
  totalResults: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function parseCodeqlPolicy(raw: unknown): CodeqlPolicy {
  if (!isRecord(raw)) throw new Error('codeql policy must be an object');
  const failOnLevels = isStringArray(raw.failOnLevels) ? raw.failOnLevels : null;
  if (!failOnLevels || failOnLevels.length === 0)
    throw new Error('failOnLevels must be a non-empty array');
  if (!failOnLevels.includes('error')) throw new Error('failOnLevels must include "error"');
  return {
    policyVersion: typeof raw.policyVersion === 'string' ? raw.policyVersion : 'unversioned',
    failOnLevels,
    warnOnLevels: isStringArray(raw.warnOnLevels) ? raw.warnOnLevels : ['warning'],
    baselineFingerprints: isStringArray(raw.baselineFingerprints) ? raw.baselineFingerprints : [],
    ignoredRuleIds: isStringArray(raw.ignoredRuleIds) ? raw.ignoredRuleIds : [],
  };
}

type RuleIndex = Map<string, string>;

function indexRuleLevels(run: Record<string, unknown>): RuleIndex {
  const index: RuleIndex = new Map();
  const tool = isRecord(run.tool) ? run.tool : {};
  const components: unknown[] = [];
  if (isRecord(tool.driver)) components.push(tool.driver);
  if (Array.isArray(tool.extensions)) components.push(...tool.extensions);
  for (const component of components) {
    if (!isRecord(component) || !Array.isArray(component.rules)) continue;
    for (const rule of component.rules) {
      if (!isRecord(rule) || typeof rule.id !== 'string') continue;
      const config = isRecord(rule.defaultConfiguration) ? rule.defaultConfiguration : {};
      index.set(rule.id, typeof config.level === 'string' ? config.level : 'warning');
    }
  }
  return index;
}

function describeLocation(result: Record<string, unknown>): string {
  const locations = Array.isArray(result.locations) ? result.locations : [];
  const first = locations.find(isRecord);
  const physical = first && isRecord(first.physicalLocation) ? first.physicalLocation : {};
  const artifact = isRecord(physical.artifactLocation) ? physical.artifactLocation : {};
  const region = isRecord(physical.region) ? physical.region : {};
  const uri = typeof artifact.uri === 'string' ? artifact.uri : 'unknown';
  const line = typeof region.startLine === 'number' ? region.startLine : 0;
  return `${uri}:${line}`;
}

function fingerprintOf(result: Record<string, unknown>, ruleId: string, location: string): string {
  const partial = isRecord(result.partialFingerprints) ? result.partialFingerprints : {};
  const primary = partial.primaryLocationLineHash;
  if (typeof primary === 'string' && primary.length > 0) return `${ruleId}|${primary}`;
  return `${ruleId}|${location}`;
}

export function extractCodeqlFindings(sarif: unknown): CodeqlFinding[] {
  if (!isRecord(sarif) || !Array.isArray(sarif.runs))
    throw new Error('SARIF document must contain runs');
  const findings: CodeqlFinding[] = [];
  for (const run of sarif.runs) {
    if (!isRecord(run)) continue;
    const ruleLevels = indexRuleLevels(run);
    const results = Array.isArray(run.results) ? run.results : [];
    for (const result of results) {
      if (!isRecord(result)) continue;
      const ruleId = typeof result.ruleId === 'string' ? result.ruleId : 'unknown-rule';
      const level =
        typeof result.level === 'string' ? result.level : (ruleLevels.get(ruleId) ?? 'warning');
      const location = describeLocation(result);
      const messageRecord = isRecord(result.message) ? result.message : {};
      const message =
        typeof messageRecord.text === 'string' ? messageRecord.text.slice(0, 200) : '';
      findings.push({
        ruleId,
        level,
        fingerprint: fingerprintOf(result, ruleId, location),
        location,
        message,
      });
    }
  }
  return findings;
}

export function evaluateCodeqlPolicy(
  findings: CodeqlFinding[],
  policy: CodeqlPolicy,
): CodeqlPolicyReport {
  const baseline = new Set(policy.baselineFingerprints);
  const ignored = new Set(policy.ignoredRuleIds);
  const failing: CodeqlFinding[] = [];
  const baselined: CodeqlFinding[] = [];
  const warnings: CodeqlFinding[] = [];
  for (const finding of findings) {
    if (ignored.has(finding.ruleId)) continue;
    if (policy.failOnLevels.includes(finding.level)) {
      if (baseline.has(finding.fingerprint)) baselined.push(finding);
      else failing.push(finding);
    } else if (policy.warnOnLevels.includes(finding.level)) {
      warnings.push(finding);
    }
  }
  return { ok: failing.length === 0, failing, baselined, warnings, totalResults: findings.length };
}

export function findSarifFiles(target: string): string[] {
  const stats = statSync(target);
  if (stats.isFile()) return [target];
  const files: string[] = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...findSarifFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith('.sarif')) files.push(entryPath);
  }
  return files.sort();
}

function parseArgs(argv: string[]): { sarif: string; policy: string } {
  let sarif = 'codeql-results';
  let policy = 'config/ci/codeql-policy.json';
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--sarif' && argv[index + 1]) sarif = argv[index + 1];
    if (argv[index] === '--policy' && argv[index + 1]) policy = argv[index + 1];
  }
  return { sarif, policy };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const policy = parseCodeqlPolicy(JSON.parse(readFileSync(path.resolve(args.policy), 'utf8')));
  const files = findSarifFiles(path.resolve(args.sarif));
  if (files.length === 0) {
    console.error(`No SARIF files found under ${args.sarif}; refusing to pass without evidence.`);
    return 1;
  }
  const findings = files.flatMap((file) =>
    extractCodeqlFindings(JSON.parse(readFileSync(file, 'utf8'))),
  );
  const report = evaluateCodeqlPolicy(findings, policy);
  console.log(
    `CodeQL policy ${policy.policyVersion}: ${report.totalResults} result(s), ${report.failing.length} new error(s), ${report.baselined.length} baselined, ${report.warnings.length} warning(s).`,
  );
  for (const warning of report.warnings)
    console.warn(`warning: ${warning.ruleId} at ${warning.location}`);
  if (!report.ok) {
    for (const finding of report.failing) {
      console.error(
        `error: ${finding.ruleId} at ${finding.location} (fingerprint ${finding.fingerprint})`,
      );
    }
    return 1;
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && /codeql-policy\.(ts|js|mjs)$/.test(process.argv[1]);
if (invokedDirectly) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
