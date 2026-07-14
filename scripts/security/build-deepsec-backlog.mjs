#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const FINDINGS_ROOT = path.join(ROOT, '.deepsec/findings');
const OUTPUT_BOARD = path.join(ROOT, 'docs/security/deepsec-remediation-board.md');
const OUTPUT_CSV = path.join(ROOT, 'docs/security/deepsec-backlog.csv');
const SECONDARY_OUTPUT_CSV = path.join(ROOT, 'test-results/security/deepsec-backlog.csv');

const ROOT_CAUSES = [
  {
    id: 'SEC-001',
    title: 'Account takeover and auth-token exposure',
    owner: 'Auth owner',
    labels: ['security-critical', 'account-takeover', 'secrets', 'needs-regression'],
    sprint: 'Sprint 1',
    matches: [
      /account-takeover/i,
      /auth-bypass/i,
      /recovery/i,
      /invite/i,
      /magic/i,
      /password reset/i,
    ],
  },
  {
    id: 'SEC-002',
    title: 'Service-role before tenant authorization',
    owner: 'Platform/API owner',
    labels: ['security-critical', 'tenant-isolation', 'service-role', 'needs-regression'],
    sprint: 'Sprint 1',
    matches: [/acl-check/i, /cross-tenant/i, /service-role/i, /tenant/i, /membership/i],
  },
  {
    id: 'SEC-003',
    title: 'Cron and job routes fail open',
    owner: 'Jobs/infra owner',
    labels: ['security-critical', 'cron-auth', 'service-role', 'needs-prod-config'],
    sprint: 'Sprint 1',
    matches: [/cron/i, /missing-auth/i, /job/i, /queue/i],
  },
  {
    id: 'SEC-004',
    title: 'Production data scripts lack target safety',
    owner: 'Data operations owner',
    labels: ['high-bug', 'service-role', 'data-integrity', 'needs-prod-config'],
    sprint: 'Sprint 1',
    matches: [/production/i, /remote-seed/i, /seed/i, /backfill/i, /staging/i, /unsafe.*write/i],
  },
  {
    id: 'SEC-005',
    title: 'Missing CSRF on session-cookie mutations',
    owner: 'Web/API owner',
    labels: ['csrf', 'needs-regression'],
    sprint: 'Sprint 2',
    matches: [/csrf/i, /session-cookie/i, /ambient-cookie/i],
  },
  {
    id: 'SEC-006',
    title: 'Generic URL validation and redirect policy gaps',
    owner: 'Web/API owner',
    labels: ['xss', 'data-integrity', 'needs-regression'],
    sprint: 'Sprint 2',
    matches: [/open-redirect/i, /url/i, /redirect/i, /callback/i],
  },
  {
    id: 'SEC-007',
    title: 'Stored/reflected XSS and output encoding',
    owner: 'Frontend/platform owner',
    labels: ['xss', 'needs-regression'],
    sprint: 'Sprint 2',
    matches: [/xss/i, /csv-formula/i, /html/i, /sanitize/i],
  },
  {
    id: 'SEC-008',
    title: 'Secrets in logs, generated artifacts, or config',
    owner: 'Infra/security owner',
    labels: ['secrets', 'needs-prod-config', 'needs-regression'],
    sprint: 'Sprint 2',
    matches: [/secret/i, /env-exposure/i, /insecure-tls/i, /tls/i],
  },
  {
    id: 'SEC-009',
    title: 'Rate limiting and abuse controls',
    owner: 'Platform/API owner',
    labels: ['rate-limit', 'needs-regression'],
    sprint: 'Sprint 2',
    matches: [/rate-limit/i, /expensive-api/i, /resource-exhaustion/i, /dos/i],
  },
  {
    id: 'SEC-010',
    title: 'Data integrity, races, and idempotency',
    owner: 'Domain workflow owner',
    labels: ['data-integrity', 'high-bug', 'needs-regression'],
    sprint: 'Sprint 3',
    matches: [/race/i, /idempot/i, /non-atomic/i, /data-integrity/i, /data-loss/i, /state/i],
  },
  {
    id: 'SEC-011',
    title: 'Schema, migration, and contract drift',
    owner: 'Data/platform owner',
    labels: ['data-integrity', 'needs-migration', 'needs-regression'],
    sprint: 'Sprint 3',
    matches: [/migration/i, /schema/i, /contract/i, /drift/i],
  },
  {
    id: 'SEC-012',
    title: 'Security-adjacent correctness backlog',
    owner: 'Feature owner',
    labels: ['high-bug', 'needs-regression'],
    sprint: 'Sprint 4',
    matches: [/.*/],
  },
];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function parseFinding(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const title = source.match(/^# \[[^\]]+\] (.+)$/m)?.[1]?.trim() ?? path.basename(filePath);
  const severity =
    source.match(/^# \[([^\]]+)\]/m)?.[1]?.trim() ?? path.basename(path.dirname(filePath));
  const slug =
    source.match(/\*\*Severity:\*\*.+?\*\*Slug:\*\* `([^`]+)`/)?.[1]?.trim() ??
    path
      .basename(filePath)
      .replace(/^nabatableLP-/, '')
      .replace(/-[a-f0-9]+\.md$/, '');
  const file =
    source.match(/\*\*File:\*\* \[`([^`]+)`\]/)?.[1]?.trim() ??
    source.match(/\*\*File:\*\* ([^\n]+)/)?.[1]?.trim() ??
    '';
  const body = `${title}\n${slug}\n${file}\n${source}`;
  const rootCause = ROOT_CAUSES.find((candidate) =>
    candidate.matches.some((pattern) => pattern.test(body)),
  );

  return {
    id: path.basename(filePath, '.md').replace(/^nabatableLP-/, ''),
    relativePath: path.relative(ROOT, filePath),
    severity,
    slug,
    title,
    sourceFile: file,
    rootCauseId: rootCause.id,
    rootCauseTitle: rootCause.title,
    owner: rootCause.owner,
    sprint: rootCause.sprint,
    labels: rootCause.labels.join(';'),
  };
}

function severityRank(severity) {
  return (
    {
      CRITICAL: 0,
      HIGH: 1,
      HIGH_BUG: 2,
      MEDIUM: 3,
      BUG: 4,
    }[severity] ?? 5
  );
}

if (!fs.existsSync(FINDINGS_ROOT)) {
  throw new Error('Expected .deepsec/findings to exist.');
}

const findings = walk(FINDINGS_ROOT)
  .map(parseFinding)
  .sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return a.id.localeCompare(b.id);
  });

const grouped = new Map(ROOT_CAUSES.map((rootCause) => [rootCause.id, []]));
for (const finding of findings) {
  grouped.get(finding.rootCauseId).push(finding);
}

const countsBySeverity = findings.reduce((counts, finding) => {
  counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  return counts;
}, {});

const now = new Date().toISOString();
const board = [
  '# DeepSec Remediation Board',
  '',
  `Generated from .deepsec/findings on ${now}.`,
  '',
  '## Labels',
  '',
  '- security-critical',
  '- account-takeover',
  '- tenant-isolation',
  '- service-role',
  '- xss',
  '- csrf',
  '- cron-auth',
  '- secrets',
  '- rate-limit',
  '- data-integrity',
  '- high-bug',
  '- needs-regression',
  '- needs-migration',
  '- needs-prod-config',
  '',
  '## Freeze Rules',
  '',
  '- No new service-role route additions without a route-level authorization guard.',
  '- No new public/session-cookie mutation route without CSRF validation.',
  '- No new URL fields using only z.string().url() or new URL() without scheme/host policy.',
  '- No cron route may run if CRON_SECRET or equivalent job auth is absent.',
  '- No auth callback, invite, recovery, or token URL may log raw query strings.',
  '',
  '## Definition Of Fixed',
  '',
  '- The root-cause epic is fixed, not only one reported file.',
  '- Middleware/proxy auth is not sufficient for resource-level authorization.',
  '- Service-role work happens only after route-level auth and tenant/resource checks, or the exception is written and reviewed.',
  '- Session-cookie mutations validate CSRF before parsing or mutating state.',
  '- URL inputs have an explicit allowlist for scheme, host, path class, and redirect target semantics.',
  '- Cron/job entrypoints fail closed when their secret/signature config is absent.',
  '- Raw query strings, tokens, invites, recovery links, and callbacks are redacted in logs and artifacts.',
  '- A regression test covers the negative path that produced the finding.',
  '- Production config or migration requirements are recorded and verified before rollout.',
  '',
  '## Root-Cause Tracker',
  '',
  '| Epic | Owner | Sprint | Labels | Critical | High | High Bug | Medium | Bug | Total |',
  '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
];

for (const rootCause of ROOT_CAUSES) {
  const items = grouped.get(rootCause.id);
  const count = (severity) => items.filter((finding) => finding.severity === severity).length;
  board.push(
    `| ${rootCause.id} ${rootCause.title} | ${rootCause.owner} | ${rootCause.sprint} | ${rootCause.labels.join(', ')} | ${count('CRITICAL')} | ${count('HIGH')} | ${count('HIGH_BUG')} | ${count('MEDIUM')} | ${count('BUG')} | ${items.length} |`,
  );
}

board.push(
  '',
  '## Severity Override Policy',
  '',
  '- Escalate to security-critical when exploitability crosses tenant boundaries, account ownership, service-role writes, cron/job mutations, or secrets.',
  '- Do not downgrade critical/high findings because a proxy or middleware requires a logged-in session; resource-level authorization must be proven in the handler or service boundary.',
  '- Downgrade only when the root-cause owner provides code evidence, a negative regression test, and rollout/config proof when applicable.',
  '- Duplicate findings inherit the highest severity of the root cause until the shared fix and regression matrix pass.',
  '- Bugs that can mutate production data, grant privileges, corrupt availability, or trigger customer communication are treated as high-bug even when not directly exploitable over HTTP.',
  '',
  '## Regression-Test Matrix',
  '',
  '| Epic | Required regression coverage |',
  '| --- | --- |',
  '| SEC-001 | Auth callback/invite/recovery tests prove tokens are redacted, replay is blocked, and account binding cannot be switched. |',
  '| SEC-002 | API negative tests prove same-session cross-tenant IDs are rejected before service-role reads or writes. |',
  '| SEC-003 | Cron route tests prove missing secret returns 401/503 and no job runner is called. |',
  '| SEC-004 | Script tests or dry-run harnesses prove production targets require explicit env/project confirmation before service-role writes. |',
  '| SEC-005 | Mutation route tests prove missing/invalid CSRF fails before request body parsing and before writes. |',
  '| SEC-006 | URL schema tests prove disallowed schemes, hosts, encoded redirects, and relative target escapes are rejected. |',
  '| SEC-007 | Rendering/export tests prove stored text is encoded and CSV formula payloads are neutralized. |',
  '| SEC-008 | Log snapshot tests prove secrets, query strings, callback params, and tokens are redacted. |',
  '| SEC-009 | Abuse tests prove unauthenticated or tenant-authenticated callers hit stable rate limits before expensive service-role or external API work. |',
  '| SEC-010 | Concurrency/idempotency tests prove repeat requests and races do not duplicate side effects or lose state. |',
  '| SEC-011 | Migration/contract tests prove schema drift is detected and backfills are idempotent. |',
  '| SEC-012 | Feature-level regression tests cover the correctness failure and its adjacent edge case. |',
  '',
  '## Backlog Mapping',
  '',
  `- Full versioned CSV mapping: docs/security/deepsec-backlog.csv`,
  `- Generated CSV copy: test-results/security/deepsec-backlog.csv`,
  `- Finding counts: ${Object.entries(countsBySeverity)
    .map(([severity, count]) => `${severity}=${count}`)
    .join(', ')}`,
  '- Every CRITICAL, HIGH, and HIGH_BUG finding is mapped to exactly one sprint and one root-cause epic in the CSV.',
  '',
);

fs.mkdirSync(path.dirname(OUTPUT_BOARD), { recursive: true });
fs.writeFileSync(OUTPUT_BOARD, `${board.join('\n')}\n`);

fs.mkdirSync(path.dirname(OUTPUT_CSV), { recursive: true });
const headers = [
  'finding_id',
  'severity',
  'slug',
  'title',
  'source_file',
  'finding_path',
  'root_cause_epic',
  'root_cause_title',
  'owner',
  'sprint',
  'labels',
];
const rows = [headers.map(csvEscape).join(',')];
for (const finding of findings) {
  rows.push(
    [
      finding.id,
      finding.severity,
      finding.slug,
      finding.title,
      finding.sourceFile,
      finding.relativePath,
      finding.rootCauseId,
      finding.rootCauseTitle,
      finding.owner,
      finding.sprint,
      finding.labels,
    ]
      .map(csvEscape)
      .join(','),
  );
}
fs.writeFileSync(OUTPUT_CSV, `${rows.join('\n')}\n`);
fs.mkdirSync(path.dirname(SECONDARY_OUTPUT_CSV), { recursive: true });
fs.writeFileSync(SECONDARY_OUTPUT_CSV, `${rows.join('\n')}\n`);

console.log(`Wrote ${OUTPUT_BOARD}`);
console.log(`Wrote ${OUTPUT_CSV}`);
console.log(`Wrote ${SECONDARY_OUTPUT_CSV}`);
console.log(`Mapped ${findings.length} finding(s).`);
