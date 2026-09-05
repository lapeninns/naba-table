import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const commitSchema = z.string().regex(/^[0-9a-f]{40}$/u);
const fileSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (file) =>
      !file.startsWith('/') &&
      !file.startsWith('-') &&
      !file.includes('\\') &&
      !file.includes(':') &&
      Array.from(file).every(
        (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
      ) &&
      file.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
  );
const ruleSchema = z.string().regex(/^[a-zA-Z0-9_.-]{1,200}$/u);
const lineSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const reviewSchema = z
  .object({
    ruleId: ruleSchema,
    file: fileSchema,
    startLine: lineSchema,
    endLine: lineSchema,
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/u),
    sourceCommit: commitSchema,
    reviewedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .refine((value) => {
        const date = new Date(value);
        return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
      }),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict()
  .refine((review) => review.endLine >= review.startLine);
const baselineSchema = z
  .object({ schemaVersion: z.literal(1), baselineReview: z.array(reviewSchema).max(10000) })
  .strict();
const findingSchema = z
  .object({
    RuleID: ruleSchema,
    File: fileSchema,
    StartLine: lineSchema,
    EndLine: lineSchema,
    Commit: commitSchema,
  })
  .refine((finding) => finding.EndLine >= finding.StartLine);

export type GitleaksBaseline = z.infer<typeof baselineSchema>;
export type GitleaksFinding = z.infer<typeof findingSchema>;
export type ReadGitBlob = (commit: string, file: string) => Uint8Array;

export function parseGitleaksBaseline(value: unknown): GitleaksBaseline {
  const parsed = baselineSchema.safeParse(value);
  if (!parsed.success) throw new Error('Invalid Gitleaks baseline');
  const keys = parsed.data.baselineReview.map((entry) =>
    JSON.stringify([entry.ruleId, entry.file, entry.startLine, entry.endLine, entry.sourceSha256]),
  );
  if (new Set(keys).size !== keys.length) throw new Error('Invalid Gitleaks baseline');
  return parsed.data;
}

/** Intentionally drops Match, Secret, commit messages, and other raw scanner payloads. */
export function parseGitleaksReport(value: unknown): GitleaksFinding[] {
  const parsed = z.array(findingSchema).max(100000).safeParse(value);
  if (!parsed.success) throw new Error('Invalid Gitleaks report');
  return parsed.data;
}

export function readGitBlob(commit: string, file: string): Uint8Array {
  if (!commitSchema.safeParse(commit).success || !fileSchema.safeParse(file).success) {
    throw new Error('Invalid Gitleaks source reference');
  }
  const result = spawnSync('git', ['show', '--no-ext-diff', '--no-textconv', `${commit}:${file}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('Gitleaks source blob unavailable');
  return result.stdout;
}

export function filterGitleaksFindings(
  findings: readonly GitleaksFinding[],
  baseline: GitleaksBaseline,
  readBlob: ReadGitBlob = readGitBlob,
): { baselined: number; unmatched: GitleaksFinding[] } {
  let baselined = 0;
  const unmatched: GitleaksFinding[] = [];
  const digests = new Map<string, string>();
  for (const finding of findings) {
    const reviews = baseline.baselineReview.filter(
      (review) =>
        review.ruleId === finding.RuleID &&
        review.file === finding.File &&
        review.startLine === finding.StartLine &&
        review.endLine === finding.EndLine,
    );
    if (reviews.length === 0) {
      unmatched.push(finding);
      continue;
    }
    const key = `${finding.Commit}:${finding.File}`;
    let digest = digests.get(key);
    if (!digest) {
      try {
        digest = createHash('sha256').update(readBlob(finding.Commit, finding.File)).digest('hex');
      } catch {
        throw new Error('Gitleaks source blob unavailable');
      }
      digests.set(key, digest);
    }
    if (reviews.some((review) => review.sourceSha256 === digest)) baselined += 1;
    else unmatched.push(finding);
  }
  return { baselined, unmatched };
}
