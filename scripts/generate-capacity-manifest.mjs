import { promises as fs } from 'node:fs';
import { join } from 'node:path';

async function fileExists(path) {
  try { await fs.access(path); return true; } catch { return false; }
}

async function readText(path) {
  return fs.readFile(path, 'utf-8');
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

function findCapacityDeps(source) {
  const deps = new Set();
  const re = /import[^"']+["']@\/server\/capacity([^"']*)["']/g;
  let m;
  while ((m = re.exec(source))) {
    const mod = `server/capacity${m[1] || ''}`;
    deps.add(mod);
  }
  return [...deps].sort();
}

async function collectModules(files) {
  const modules = [];
  for (const f of files) {
    if (!(await fileExists(f))) continue;
    const text = await readText(f);
    const stats = await fs.stat(f);
    modules.push({
      path: f,
      size: stats.size,
      exports: findExports(text),
      dependsOn: findCapacityDeps(text),
    });
  }
  return modules;
}

async function collectRoutes(root = 'src/app') {
  const results = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) { await walk(p); continue; }
      if (ent.isFile() && ent.name === 'route.ts') {
        const text = await readText(p);
        if (text.includes("@/server/capacity")) {
          const imports = new Set();
          const re = /import\s*\{([^}]+)\}\s*from\s*["']@\/server\/capacity[^"']*["']/g;
          let m;
          while ((m = re.exec(text))) {
            for (const name of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
              imports.add(name);
            }
          }
          results.push({ path: p, imports: [...imports].sort() });
        }
      }
    }
  }
  if (await fileExists(root)) await walk(root);
  return results;
}

async function collectFeatureFlags(path = 'server/feature-flags.ts') {
  if (!(await fileExists(path))) return [];
  const text = await readText(path);
  const re = /export function (\w+)\(/g;
  const out = [];
  let m; while ((m = re.exec(text))) out.push(m[1]);
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
  const coreFiles = [
    'server/capacity/service.ts',
    'server/capacity/selector.ts',
    'server/capacity/planner/bitset.ts',
    'server/capacity/holds.ts',
    'server/capacity/transaction.ts',
    'server/capacity/policy.ts',
    'server/capacity/rotations.ts',
    'server/capacity/scarcity.ts',
    'server/capacity/strategic-config.ts',
    'server/capacity/tables.ts',
    'server/capacity/index.ts',
    'server/capacity/v2/index.ts',
    'server/capacity/v2/orchestrator.ts',
    'server/capacity/v2/planner.ts',
    'server/capacity/v2/supabase-repository.ts',
    'server/feature-flags.ts',
  ];

  const modules = await collectModules(coreFiles);
  const apiRoutes = await collectRoutes();
  const featureFlags = await collectFeatureFlags();
  const rpcFunctions = await collectRpcs(coreFiles);

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

  const manifest = {
    name: 'capacity_engine_manifest',
    generatedAt: new Date().toISOString(),
    modules, api_routes: apiRoutes, feature_flags: featureFlags, rpc_functions: rpcFunctions, flows,
  };

  await fs.mkdir('reports', { recursive: true });
  await fs.writeFile('reports/capacity_engine_manifest.json', JSON.stringify(manifest, null, 2));
  console.log('WROTE reports/capacity_engine_manifest.json');
}

main().catch((err) => {
  console.error('[generate-capacity-manifest] failed', err);
  process.exit(1);
});

