import type { CiCommand, CiProfile, CiSuite, ConditionalRule } from '../contracts/profile';
import { isImageConfigured } from '../contracts/profile';

/**
 * Converts a GitHub Actions `paths` glob into an anchored RegExp:
 * `**` spans directories (a leading `**\/` also matches the repository root),
 * `*` and `?` stay inside one path segment. Everything else is literal.
 */
export function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        const followedBySlash = pattern[index + 2] === '/';
        source += followedBySlash ? '(?:.*/)?' : '.*';
        index += followedBySlash ? 2 : 1;
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += (char ?? '').replace(/[.+^${}()|[\]\\]/gu, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, 'u');
}

export function normaliseChangedPath(changedPath: string): string {
  return changedPath.trim().replace(/\\/gu, '/').replace(/^\.\//u, '');
}

export function matchesAnyPattern(changedPath: string, patterns: readonly string[]): boolean {
  const normalised = normaliseChangedPath(changedPath);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalised));
}

export type RuleOutcome =
  | { readonly ruleId: string; readonly decision: 'run'; readonly reason: 'changed-paths-unknown' }
  | {
      readonly ruleId: string;
      readonly decision: 'run';
      readonly reason: 'matched';
      readonly matchedPath: string;
    }
  | { readonly ruleId: string; readonly decision: 'skip'; readonly reason: 'no-match' };

/** `changedPaths === null` means "unknown", which always resolves to `run`. */
export function evaluateRule(
  rule: ConditionalRule,
  changedPaths: readonly string[] | null,
): RuleOutcome {
  if (changedPaths === null) {
    return { ruleId: rule.id, decision: rule.whenUnknown, reason: 'changed-paths-unknown' };
  }
  const matchedPath = changedPaths.find((changedPath) =>
    matchesAnyPattern(changedPath, rule.predicate.patterns),
  );
  if (matchedPath !== undefined) {
    return { ruleId: rule.id, decision: rule.whenMatch, reason: 'matched', matchedPath };
  }
  return { ruleId: rule.id, decision: rule.whenNoMatch, reason: 'no-match' };
}

export interface SuiteResolution {
  readonly suiteId: string;
  readonly displayName: string;
  readonly included: boolean;
  readonly reason: string;
  readonly ruleId: string | null;
}

export interface ResolvedCommand extends CiCommand {
  readonly suiteId: string;
  /** Profile env merged with the command overlay; the executor uses this verbatim. */
  readonly effectiveEnv: Readonly<Record<string, string>>;
}

export interface ResolvedProfile {
  readonly name: CiProfile['name'];
  readonly version: CiProfile['version'];
  readonly policyVersion: string;
  readonly runtime: CiProfile['runtime'];
  readonly image: CiProfile['image'] & { readonly configured: boolean };
  readonly limits: CiProfile['limits'];
  readonly env: CiProfile['env'];
  readonly changedPathsProvided: boolean;
  readonly ruleOutcomes: readonly RuleOutcome[];
  readonly suites: readonly SuiteResolution[];
  readonly commands: readonly ResolvedCommand[];
}

function describeOutcome(outcome: RuleOutcome): string {
  switch (outcome.reason) {
    case 'changed-paths-unknown':
      return `rule ${outcome.ruleId}: changed paths unknown, running (fail closed)`;
    case 'matched':
      return `rule ${outcome.ruleId}: matched ${outcome.matchedPath}`;
    case 'no-match':
      return `rule ${outcome.ruleId}: no changed path matched`;
  }
}

function resolveSuite(
  suite: CiSuite,
  outcomesBySuite: ReadonlyMap<string, RuleOutcome>,
): SuiteResolution {
  if (!suite.conditional) {
    return {
      suiteId: suite.id,
      displayName: suite.displayName,
      included: true,
      reason: 'unconditional',
      ruleId: null,
    };
  }
  const outcome = outcomesBySuite.get(suite.id);
  if (!outcome) {
    // Unreachable for a schema-valid profile; keep the fail-closed default anyway.
    return {
      suiteId: suite.id,
      displayName: suite.displayName,
      included: true,
      reason: 'conditional suite without a governing rule, running (fail closed)',
      ruleId: null,
    };
  }
  return {
    suiteId: suite.id,
    displayName: suite.displayName,
    included: outcome.decision === 'run',
    reason: describeOutcome(outcome),
    ruleId: outcome.ruleId,
  };
}

export function resolveProfile(
  profile: CiProfile,
  changedPaths: readonly string[] | null,
): ResolvedProfile {
  const ruleOutcomes = profile.conditionalRules.map((rule) => evaluateRule(rule, changedPaths));
  const outcomesBySuite = new Map<string, RuleOutcome>();
  profile.conditionalRules.forEach((rule, index) => {
    const outcome = ruleOutcomes[index];
    if (!outcome) {
      return;
    }
    for (const suiteId of rule.suiteIds) {
      // A suite governed by several rules runs if any rule says run.
      const existing = outcomesBySuite.get(suiteId);
      if (!existing || (existing.decision === 'skip' && outcome.decision === 'run')) {
        outcomesBySuite.set(suiteId, outcome);
      }
    }
  });
  const suites = profile.suites.map((suite) => resolveSuite(suite, outcomesBySuite));
  const commandsById = new Map(profile.commands.map((command) => [command.id, command]));
  const commands: ResolvedCommand[] = [];
  profile.suites.forEach((suite, index) => {
    if (!suites[index]?.included) {
      return;
    }
    for (const commandId of suite.commandIds) {
      const command = commandsById.get(commandId);
      if (!command) {
        throw new Error(`profile ${profile.name} references unknown command ${commandId}`);
      }
      commands.push({
        ...command,
        suiteId: suite.id,
        effectiveEnv: { ...profile.env, ...(command.env ?? {}) },
      });
    }
  });
  return {
    name: profile.name,
    version: profile.version,
    policyVersion: profile.policyVersion,
    runtime: profile.runtime,
    image: { ...profile.image, configured: isImageConfigured(profile.image) },
    limits: profile.limits,
    env: profile.env,
    changedPathsProvided: changedPaths !== null,
    ruleOutcomes,
    suites,
    commands,
  };
}
