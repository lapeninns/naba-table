import { promises as fs } from 'node:fs';
import { join, dirname, extname, resolve as resolvePath } from 'node:path';
import crypto from 'node:crypto';

async function fileExists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function readText(p) { return fs.readFile(p, 'utf-8'); }
async function readBuf(p) { return fs.readFile(p); }
async function stat(p) { return fs.stat(p); }

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await walk(p));
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function languageFor(path) {
  const ext = extname(path).toLowerCase();
  return ext === '.ts' || ext === '.mts' || ext === '.cts' ? 'typescript'
    : ext === '.tsx' ? 'tsx'
    : ext === '.js' || ext === '.mjs' || ext === '.cjs' ? 'javascript'
    : ext === '.json' ? 'json'
    : ext === '.md' ? 'markdown'
    : ext.replace(/^\./, '') || 'text';
}

function findExports(source) {
  const exports = [];
  const reLine = /^export (?:async )?(function|class|const|type|\*)\s*([\w*]*)/gm;
  const reBlock = /^export \{([^}]+)\}/gm;
  let m;
  while ((m = reLine.exec(source))) {
    const [, kind, name] = m;
    exports.push({ kind: kind === '*' ? 'star' : kind, name: (name || '').trim(), raw: m[0] });
  }
  while ((m = reBlock.exec(source))) {
    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const n of names) exports.push({ kind: 'named', name: n, raw: m[0] });
  }
  return exports;
}

function extractImportSpecs(source) {
  const specs = [];
  const re = /import[^'"\n]*from\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(source))) specs.push(m[1]);
  return specs;
}

async function resolveImport(importerPath, spec) {
  // alias '@/...' -> project root
  if (spec.startsWith('@/')) {
    const rel = spec.replace(/^@\//, '');
    const abs = resolvePath(rel);
    if (await fileExists(abs)) return rel;
    for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
      if (await fileExists(abs + ext)) return rel + ext;
    }
    // index.ts fallback
    for (const idx of ['/index.ts','/index.tsx','/index.js','/index.mjs']) {
      if (await fileExists(abs + idx)) return rel + idx;
    }
    return rel; // best-effort
  }
  // relative within capacity tree
  if (spec.startsWith('./') || spec.startsWith('../')) {
    const base = resolvePath(dirname(importerPath), spec);
    const projRel = base.replace(resolvePath('.'),'').replace(/^\//,'');
    if (await fileExists(base)) return projRel;
    for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
      if (await fileExists(base + ext)) return projRel + ext;
    }
    for (const idx of ['/index.ts','/index.tsx','/index.js','/index.mjs']) {
      if (await fileExists(base + idx)) return projRel + idx;
    }
  }
  return null;
}

async function collectModulesWithCode(coreRoots, includeAlso = []) {
  const codeFiles = new Set();
  for (const root of coreRoots) {
    if (!(await fileExists(root))) continue;
    const all = await walk(root);
    for (const f of all) if (/\.(ts|tsx|js|mjs|cjs)$/.test(f)) codeFiles.add(f);
  }
  for (const f of includeAlso) if (await fileExists(f)) codeFiles.add(f);
  const files = [...codeFiles].sort();

  const modules = [];
  for (const path of files) {
    const buf = await readBuf(path);
    const text = buf.toString('utf-8');
    const specs = extractImportSpecs(text);
    const resolvedDeps = [];
    for (const s of specs) {
      const dep = await resolveImport(path, s);
      if (dep) resolvedDeps.push(dep);
    }
    const st = await stat(path);
    modules.push({
      path,
      size: st.size,
      sha256: sha256(buf),
      language: languageFor(path),
      exports: findExports(text),
      dependsOn: [...new Set(resolvedDeps)].sort(),
      content: text,
    });
  }
  return modules;
}

async function collectRoutes(root = 'src/app') {
  const results = [];
  async function walkDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) { await walkDir(p); continue; }
      if (ent.isFile() && ent.name === 'route.ts') {
        const text = await readText(p);
        if (text.includes("@/server/capacity")) {
          const imports = new Set();
          const re = /import\s*\{([^}]+)\}\s*from\s*["']@\/server\/capacity[^"']*["']/g;
          let m; while ((m = re.exec(text))) {
            for (const n of m[1].split(',').map(s => s.trim()).filter(Boolean)) imports.add(n);
          }
          results.push({ path: p, imports: [...imports].sort() });
        }
      }
    }
  }
  if (await fileExists(root)) await walkDir(root);
  return results;
}

async function collectFeatureFlags(path = 'server/feature-flags.ts') {
  if (!(await fileExists(path))) return [];
  const text = await readText(path);
  const re = /export function (\w+)\(/g;
  const out = []; let m; while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

async function collectRpcs(files) {
  const set = new Set();
  for (const f of files) {
    if (!(await fileExists(f))) continue;
    const text = await readText(f);
    const re = /rpc\(\s*\"([a-zA-Z0-9_]+)\"/g;
    let m; while ((m = re.exec(text))) set.add(m[1]);
  }
  return [...set].sort();
}

async function main() {
  const coreRoots = ['server/capacity'];
  const includeAlso = ['server/feature-flags.ts','server/supabase.ts'];
  const modules = await collectModulesWithCode(coreRoots, includeAlso);

  const apiRoutes = await collectRoutes();
  const featureFlags = await collectFeatureFlags();
  const rpcFunctions = await collectRpcs(modules.map(m => m.path));

  const flows = [
    {
      name: 'auto_quote_to_hold',
      entry_route: 'src/app/api/staff/auto/quote/route.ts',
      steps: [
        'auth check',
        'load booking + membership',
        'call capacity/tables.quoteTablesForBooking',
        'create hold if candidate passes conflicts',
        'return selected candidate + alternates + diagnostics'
      ],
      core_functions: ['quoteTablesForBooking','buildScoredTablePlans','createTableHold','findHoldConflicts']
    },
    {
      name: 'auto_confirm_hold',
      entry_route: 'src/app/api/staff/auto/confirm/route.ts',
      steps: [
        'auth check',
        'validate membership for hold.restaurant',
        'call capacity/tables.confirmHoldAssignment (orchestrator + repository)',
        'return assignments'
      ],
      core_functions: ['confirmHoldAssignment','AssignmentOrchestrator','SupabaseAssignmentRepository']
    },
    {
      name: 'manual_validate_hold_confirm',
      entry_route: 'src/app/api/staff/manual/*',
      steps: [
        'getManualAssignmentContext','evaluateManualSelection','createManualHold','confirmHoldAssignment'
      ],
      core_functions: ['evaluateManualSelection','createManualHold','getManualAssignmentContext','confirmHoldAssignment']
    },
    {
      name: 'booking_capacity_transaction',
      entry_service: 'server/capacity/transaction.ts',
      steps: [
        'createBookingWithCapacityCheck -> supabase.rpc("create_booking_with_capacity_check")',
        'normalize result + telemetry',
        'fallback path (if missing RPC and not failHard): direct insert',
        'updateBookingWithCapacityCheck for changes'
      ],
      core_functions: ['createBookingWithCapacityCheck','updateBookingWithCapacityCheck','retryWithBackoff']
    }
  ];

  const bundle = {
    name: 'capacity_engine_all_in_one',
    generatedAt: new Date().toISOString(),
    summary: {
      fileCount: modules.length,
      totalBytes: modules.reduce((a, e) => a + (e.size || 0), 0),
    },
    modules,
    api_routes: apiRoutes,
    feature_flags: featureFlags,
    rpc_functions: rpcFunctions,
    flows,
  };

  await fs.mkdir('reports', { recursive: true });
  await fs.writeFile('reports/capacity_engine_all_in_one.json', JSON.stringify(bundle, null, 2));
  console.log('WROTE reports/capacity_engine_all_in_one.json');
}

main().catch((err) => { console.error('[generate-capacity-all-in-one] failed', err); process.exit(1); });

