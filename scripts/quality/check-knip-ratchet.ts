import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { z } from 'zod';

import {
  evaluateKnipRatchet,
  KNIP_ISSUE_CATEGORIES,
  type KnipIssueCategory,
  type KnipRatchetCounts,
} from './knip-ratchet-contract';

const CountSchema = z.number().int().nonnegative();
const BaselineSchema = z.object({
  reviewedAt: z.iso.date(),
  owner: z.string().min(1),
  counts: z.object({
    files: CountSchema,
    dependencies: CountSchema,
    devDependencies: CountSchema,
    unlisted: CountSchema,
    binaries: CountSchema,
    cycles: CountSchema,
  }),
});

const IssueSchema = z.object({
  files: z.array(z.unknown()).optional(),
  dependencies: z.array(z.unknown()).optional(),
  devDependencies: z.array(z.unknown()).optional(),
  unlisted: z.array(z.unknown()).optional(),
  binaries: z.array(z.unknown()).optional(),
  cycles: z.array(z.unknown()).optional(),
});
const ReportSchema = z.object({ issues: z.array(IssueSchema) });

function runKnip(): z.infer<typeof ReportSchema> {
  const result = spawnSync(
    'corepack',
    [
      'pnpm',
      'exec',
      'knip',
      '--include',
      KNIP_ISSUE_CATEGORIES.join(','),
      '--reporter',
      'json',
      '--no-exit-code',
    ],
    { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `Knip exited with status ${result.status}.`);
  }
  return ReportSchema.parse(JSON.parse(result.stdout));
}

function countIssues(report: z.infer<typeof ReportSchema>): KnipRatchetCounts {
  const counts = Object.fromEntries(
    KNIP_ISSUE_CATEGORIES.map((category) => [category, 0]),
  ) as Record<KnipIssueCategory, number>;

  for (const issue of report.issues) {
    for (const category of KNIP_ISSUE_CATEGORIES) {
      counts[category] += issue[category]?.length ?? 0;
    }
  }

  return counts;
}

function main(): void {
  const baselinePath = path.join(process.cwd(), 'config/quality/knip-baseline.json');
  const baseline = BaselineSchema.parse(JSON.parse(readFileSync(baselinePath, 'utf8')));
  const current = countIssues(runKnip());
  const regressions = evaluateKnipRatchet(current, baseline.counts);

  if (regressions.length > 0) {
    for (const regression of regressions) {
      console.error(`- ${regression}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Knip ratchet passed: ${JSON.stringify(current)}.`);
}

main();
