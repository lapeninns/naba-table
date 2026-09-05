import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { evaluateReleaseGate, parseGateRequest, type GateDecision } from './evaluate-core';
import { createGitHubApi } from './github-api';
import { DEFAULT_POLICY_PATH, loadPolicy, type GateMode } from './policy';
import { publishGateDecision, renderDecisionText } from './publish';

/**
 * Release gate bridge (`pnpm ci:gate`).
 *
 * Reads the request tuple from CLI flags (or GATE_REQUEST_JSON), evaluates it
 * against config/ci/policy.json from the checked-out protected branch, and
 * publishes check runs through the workflow-provided GITHUB_TOKEN. Exit code is
 * non-zero for every refusal, including infrastructure errors: this tool only
 * ever says "yes" when every verification succeeded.
 *
 * Flags:
 *   --repository-id --pr-number --head-sha --base-sha --tested-sha --attempt
 *   --profile pr|main --mode merge|main-deploy --requested-by
 *   --no-publish   evaluate only (used for deploy-time revalidation)
 *   --output FILE  write the decision JSON
 *   --policy FILE  alternate policy path (tests only)
 */

type CliArgs = {
  flags: Map<string, string>;
  switches: Set<string>;
};

function parseArgs(argv: string[]): CliArgs {
  const flags = new Map<string, string>();
  const switches = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const [name, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      flags.set(name, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(name, next);
      index += 1;
    } else {
      switches.add(name);
    }
  }
  return { flags, switches };
}

function readRequestSource(args: CliArgs): unknown {
  const fromEnv = process.env.GATE_REQUEST_JSON;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch {
      return null;
    }
  }
  const pick = (name: string): string | undefined => args.flags.get(name);
  return {
    repositoryId: pick('repository-id'),
    profile: pick('profile'),
    prNumber: pick('pr-number'),
    headSha: pick('head-sha'),
    baseSha: pick('base-sha'),
    testedSha: pick('tested-sha'),
    attempt: pick('attempt') ?? '1',
    requestedBy: pick('requested-by'),
  };
}

function resolveMode(args: CliArgs, hasPr: boolean): GateMode | null {
  const raw = args.flags.get('mode');
  if (raw === undefined) return hasPr ? 'merge' : 'main-deploy';
  return raw === 'merge' || raw === 'main-deploy' ? raw : null;
}

function writeOutputs(decision: GateDecision, outputPath: string | undefined): void {
  const json = JSON.stringify(decision, null, 2);
  if (outputPath) {
    mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    writeFileSync(outputPath, `${json}\n`, 'utf8');
  }
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(
      summaryPath,
      `## Release gate: ${decision.ok ? 'ALLOW' : 'REFUSE'}\n\n\`\`\`\n${renderDecisionText(decision)}\n\`\`\`\n`,
      'utf8',
    );
  }
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    appendFileSync(githubOutput, `decision=${decision.ok ? 'allow' : 'refuse'}\n`, 'utf8');
    appendFileSync(githubOutput, `evidence_source=${decision.evidenceSource ?? 'none'}\n`, 'utf8');
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const repositoryRoot = process.cwd();
  const policy = loadPolicy(repositoryRoot, args.flags.get('policy') ?? DEFAULT_POLICY_PATH);

  const parsedRequest = parseGateRequest(readRequestSource(args));
  if (!parsedRequest.ok) {
    console.error('Release gate refused: invalid request.');
    for (const error of parsedRequest.errors) console.error(`- ${error}`);
    return 2;
  }
  const mode = resolveMode(args, parsedRequest.request.prNumber !== undefined);
  if (mode === null) {
    console.error('Release gate refused: --mode must be merge or main-deploy.');
    return 2;
  }

  const token = process.env.GITHUB_TOKEN ?? '';
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  if (!token || !repository) {
    console.error('Release gate refused: GITHUB_TOKEN and GITHUB_REPOSITORY are required.');
    return 2;
  }
  const api = createGitHubApi({ token, repository, apiUrl: process.env.GITHUB_API_URL });

  const decision = await evaluateReleaseGate({ api, policy, request: parsedRequest.request, mode });

  if (!args.switches.has('no-publish')) {
    try {
      const published = await publishGateDecision(api, policy.policy, decision);
      console.log(`Published ${published.length} check run(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`Release gate could not publish checks: ${message}`);
      writeOutputs(decision, args.flags.get('output'));
      return 1;
    }
  }

  writeOutputs(decision, args.flags.get('output'));
  console.log(renderDecisionText(decision));
  if (!decision.ok) {
    console.error(`Release gate refused (${decision.refusals.length} reason(s)).`);
    return 1;
  }
  console.log('Release gate allowed.');
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`Release gate crashed: ${message}`);
    process.exitCode = 1;
  });
