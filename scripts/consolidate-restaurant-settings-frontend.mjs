#!/usr/bin/env node
/**
 * Consolidates frontend source for /settings/restaurant/* routes into JSON artifacts.
 *
 * Usage:
 *   node scripts/consolidate-restaurant-settings-frontend.mjs each
 *   node scripts/consolidate-restaurant-settings-frontend.mjs <preset> [output-path]
 *
 * Presets: all, each, overview, profile, google-business-profile, availability,
 *          menu, tables, team, email-templates
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_HOST = 'https://app.nabatable.com';
const CONSOLIDATED_ROOT = path.join(REPO_ROOT, 'analysis/restaurant-settings-consolidated');
const ROUTES_DIR = path.join(CONSOLIDATED_ROOT, 'routes');

const FRONTEND_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mjs']);
const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  'test-results',
  'supabase',
  'analysis',
]);
const EXCLUDED_PATH_PREFIXES = [
  'server/',
  'src/app/api/',
  'tests/',
  'scripts/',
  'docs/',
  '.deepsec/',
];

const LAYOUT_ENTRY = 'src/app/app/(app)/settings/restaurant/layout.tsx';
const OVERVIEW_ENTRY = 'src/app/app/(app)/settings/restaurant/page.tsx';
const PROFILE_ENTRY = 'src/app/app/(app)/settings/restaurant/profile/page.tsx';
const GBP_ENTRY = 'src/app/app/(app)/settings/restaurant/google-business-profile/page.tsx';
const AVAILABILITY_ENTRY = 'src/app/app/(app)/settings/restaurant/availability/page.tsx';
const MENU_ENTRY = 'src/app/app/(app)/settings/restaurant/menu/page.tsx';
const TABLES_ENTRY = 'src/app/app/(app)/settings/restaurant/tables/page.tsx';
const TEAM_ENTRY = 'src/app/app/(app)/settings/restaurant/team/page.tsx';
const EMAIL_TEMPLATES_ENTRY = 'src/app/app/(app)/settings/restaurant/email-templates/page.tsx';

const AVAILABILITY_LEGACY_ENTRIES = [
  'src/app/app/(app)/settings/restaurant/service-periods/page.tsx',
  'src/app/app/(app)/settings/restaurant/operating-hours/page.tsx',
  'src/app/app/(app)/settings/restaurant/turn-durations/page.tsx',
  'src/app/app/(app)/settings/restaurant/occasions/page.tsx',
];

const BOUNDARY_SEEDS = ['src/proxy.ts', 'lib/url/opsHref.ts'];

const ALL_ROUTE_ENTRIES = [
  LAYOUT_ENTRY,
  OVERVIEW_ENTRY,
  PROFILE_ENTRY,
  GBP_ENTRY,
  AVAILABILITY_ENTRY,
  MENU_ENTRY,
  TABLES_ENTRY,
  TEAM_ENTRY,
  ...AVAILABILITY_LEGACY_ENTRIES,
  EMAIL_TEMPLATES_ENTRY,
];

const ROUTE_CATALOG = [
  { path: '/settings/restaurant', view: 'overview', entry: OVERVIEW_ENTRY },
  { path: '/settings/restaurant/profile', view: 'profile', entry: PROFILE_ENTRY },
  {
    path: '/settings/restaurant/google-business-profile',
    view: 'google-business-profile',
    entry: GBP_ENTRY,
  },
  { path: '/settings/restaurant/availability', view: 'availability', entry: AVAILABILITY_ENTRY },
  { path: '/settings/restaurant/menu', view: 'menu', entry: MENU_ENTRY },
  { path: '/settings/restaurant/tables', view: 'tables', entry: TABLES_ENTRY },
  { path: '/settings/restaurant/team', view: 'team', entry: TEAM_ENTRY },
  {
    path: '/settings/restaurant/service-periods',
    view: 'availability',
    legacy: true,
    entry: AVAILABILITY_LEGACY_ENTRIES[0],
  },
  {
    path: '/settings/restaurant/operating-hours',
    view: 'availability',
    legacy: true,
    entry: AVAILABILITY_LEGACY_ENTRIES[1],
  },
  {
    path: '/settings/restaurant/turn-durations',
    view: 'availability',
    legacy: true,
    entry: AVAILABILITY_LEGACY_ENTRIES[2],
  },
  {
    path: '/settings/restaurant/occasions',
    view: 'availability',
    legacy: true,
    entry: AVAILABILITY_LEGACY_ENTRIES[3],
  },
  {
    path: '/settings/restaurant/email-templates',
    redirect: '/email-templates',
    entry: EMAIL_TEMPLATES_ENTRY,
  },
];

const STATIC_IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

function opsClientAllows(specifier, allowed) {
  return allowed.includes(specifier);
}

function createSingleRoutePreset({
  id,
  outputFile,
  pathSegment,
  entry,
  view,
  routeEntryCoverage,
  routes,
  opsDynamicImports = [],
  extraSeedFiles = [],
  scopeIncluded,
  scopeExcludedSibling = 'Other /settings/restaurant/* view modules',
  redirect,
}) {
  const externalPath =
    pathSegment === '' ? '/settings/restaurant' : `/settings/restaurant/${pathSegment}`;
  const appHrefPath = `/app${externalPath}`;

  return {
    id,
    outputFile,
    requestedUrl: `${APP_HOST}${externalPath}`,
    artifactPurpose: `Consolidated frontend source for ${APP_HOST}${externalPath}, generated for analysis.`,
    route: {
      externalAppHostPath: externalPath,
      appHrefTransportPath: appHrefPath,
      entry,
      layout: LAYOUT_ENTRY,
      view: view ?? id,
      ...(redirect ? { redirect } : {}),
    },
    routes: routes ?? [
      { path: externalPath, view: view ?? id, entry, ...(redirect ? { redirect } : {}) },
    ],
    routeEntryCoverage,
    seedFiles: [
      LAYOUT_ENTRY,
      ...routeEntryCoverage.filter((p) => p !== LAYOUT_ENTRY),
      ...BOUNDARY_SEEDS,
      ...extraSeedFiles,
    ],
    seedDirs: [],
    includeAllRouteEntries: false,
    allowDynamicImport(fromRel, specifier) {
      if (fromRel.endsWith('OpsRestaurantSettingsClient.tsx')) {
        return opsClientAllows(specifier, opsDynamicImports);
      }
      return true;
    },
    scope: {
      included: [
        ...scopeIncluded,
        'Shared restaurant settings layout, shell, subnav, and reachable traced frontend dependencies',
        'Narrow route-boundary files for app-host URL rewriting and href normalization',
      ],
      excluded: [
        'server/** implementations',
        'src/app/api/** route handlers',
        scopeExcludedSibling,
        'tests, task folders, scripts, migrations, build output, node_modules, env files, and secrets',
        'External package source code',
      ],
      note: `${id} route bundle. Sibling routes omitted on purpose. Backend-only imports are listed in skippedLocalDependencies.`,
    },
  };
}

const ROUTE_PRESETS = {
  all: {
    id: 'all',
    outputFile: 'all-routes.json',
    requestedUrl: `${APP_HOST}/settings/restaurant/*`,
    artifactPurpose: `Consolidated frontend source for all ${APP_HOST}/settings/restaurant/* routes.`,
    route: null,
    routeEntryCoverage: ALL_ROUTE_ENTRIES,
    seedFiles: [
      ...BOUNDARY_SEEDS,
      'src/components/features/ops-shell/navigation.tsx',
      'src/components/features/ops-shell/useOpsRoutePrefetch.ts',
    ],
    seedDirs: [
      'src/components/features/restaurant-settings',
      'src/components/features/menu',
      'src/components/features/tables',
      'src/components/features/team',
    ],
    includeAllRouteEntries: true,
    allowDynamicImport: () => true,
    routes: ROUTE_CATALOG,
    scope: {
      included: [
        'All route entries under src/app/app/(app)/settings/restaurant/**',
        'Shared restaurant settings shell and all view modules',
        'Menu, tables, team feature clients and dual-sync',
        'Reachable local frontend imports',
      ],
      excluded: [
        'server/** implementations',
        'src/app/api/** route handlers',
        'tests, task folders, scripts, migrations, build output, node_modules, env files, and secrets',
        'External package source code',
      ],
      note: 'Full-tree artifact for cross-route analysis.',
    },
  },
  overview: createSingleRoutePreset({
    id: 'overview',
    outputFile: 'overview.json',
    pathSegment: '',
    entry: OVERVIEW_ENTRY,
    view: 'overview',
    routeEntryCoverage: [LAYOUT_ENTRY, OVERVIEW_ENTRY],
    opsDynamicImports: ['./RestaurantSetupOverview'],
    scopeIncluded: ['Overview route page and RestaurantSetupOverview setup checklist UI'],
  }),
  profile: createSingleRoutePreset({
    id: 'profile',
    outputFile: 'profile.json',
    pathSegment: 'profile',
    entry: PROFILE_ENTRY,
    view: 'profile',
    routeEntryCoverage: [LAYOUT_ENTRY, PROFILE_ENTRY],
    opsDynamicImports: ['./RestaurantProfileSection'],
    scopeIncluded: [
      'Profile route page, RestaurantProfileSection, profile/* panes, logo uploader, business context',
      'RestaurantDetailsForm and GBP field verification helpers used on profile',
    ],
  }),
  'google-business-profile': createSingleRoutePreset({
    id: 'google-business-profile',
    outputFile: 'google-business-profile.json',
    pathSegment: 'google-business-profile',
    entry: GBP_ENTRY,
    view: 'google-business-profile',
    routeEntryCoverage: [LAYOUT_ENTRY, GBP_ENTRY],
    opsDynamicImports: [
      './google-business-profile/GoogleBusinessProfileSection',
      './dual-sync/DualSyncShell',
    ],
    scopeIncluded: [
      'Google Business Profile settings route, connection UI, and dual-sync review shell rendered on this view',
    ],
  }),
  availability: {
    ...createSingleRoutePreset({
      id: 'availability',
      outputFile: 'availability.json',
      pathSegment: 'availability',
      entry: AVAILABILITY_ENTRY,
      view: 'availability',
      routeEntryCoverage: [LAYOUT_ENTRY, AVAILABILITY_ENTRY, ...AVAILABILITY_LEGACY_ENTRIES],
      opsDynamicImports: ['./AvailabilityOccasionsCommandCenter'],
      extraSeedFiles: AVAILABILITY_LEGACY_ENTRIES,
      scopeIncluded: [
        'Availability command center, operating hours, overrides, service periods, occasions, turn durations',
        'Legacy alias pages that render the same availability view',
      ],
    }),
    routes: [
      {
        path: '/settings/restaurant/availability',
        view: 'availability',
        entry: AVAILABILITY_ENTRY,
      },
      {
        path: '/settings/restaurant/service-periods',
        view: 'availability',
        legacy: true,
        entry: AVAILABILITY_LEGACY_ENTRIES[0],
      },
      {
        path: '/settings/restaurant/operating-hours',
        view: 'availability',
        legacy: true,
        entry: AVAILABILITY_LEGACY_ENTRIES[1],
      },
      {
        path: '/settings/restaurant/turn-durations',
        view: 'availability',
        legacy: true,
        entry: AVAILABILITY_LEGACY_ENTRIES[2],
      },
      {
        path: '/settings/restaurant/occasions',
        view: 'availability',
        legacy: true,
        entry: AVAILABILITY_LEGACY_ENTRIES[3],
      },
    ],
    seedFiles: [
      LAYOUT_ENTRY,
      AVAILABILITY_ENTRY,
      ...AVAILABILITY_LEGACY_ENTRIES,
      ...BOUNDARY_SEEDS,
    ],
  },
  menu: createSingleRoutePreset({
    id: 'menu',
    outputFile: 'menu.json',
    pathSegment: 'menu',
    entry: MENU_ENTRY,
    view: 'menu',
    routeEntryCoverage: [LAYOUT_ENTRY, MENU_ENTRY],
    opsDynamicImports: ['../menu'],
    scopeIncluded: ['Menu settings route and OpsMenuManagementClient feature module'],
  }),
  tables: createSingleRoutePreset({
    id: 'tables',
    outputFile: 'tables.json',
    pathSegment: 'tables',
    entry: TABLES_ENTRY,
    view: 'tables',
    routeEntryCoverage: [LAYOUT_ENTRY, TABLES_ENTRY],
    opsDynamicImports: ['../tables/TableInventoryClient'],
    scopeIncluded: ['Tables settings route and TableInventoryClient feature module'],
  }),
  team: createSingleRoutePreset({
    id: 'team',
    outputFile: 'team.json',
    pathSegment: 'team',
    entry: TEAM_ENTRY,
    view: 'team',
    routeEntryCoverage: [LAYOUT_ENTRY, TEAM_ENTRY],
    opsDynamicImports: ['../team'],
    scopeIncluded: ['Team settings route and OpsTeamManagementClient feature module'],
  }),
  'email-templates': createSingleRoutePreset({
    id: 'email-templates',
    outputFile: 'email-templates-redirect.json',
    pathSegment: 'email-templates',
    entry: EMAIL_TEMPLATES_ENTRY,
    view: null,
    routeEntryCoverage: [LAYOUT_ENTRY, EMAIL_TEMPLATES_ENTRY],
    opsDynamicImports: [],
    redirect: '/email-templates',
    scopeIncluded: [
      'Legacy restaurant email-templates route stub that redirects to /email-templates (no OpsRestaurantSettingsClient view)',
    ],
    scopeExcludedSibling:
      'Other settings views and the destination /email-templates implementation',
  }),
};

const EACH_PRESET_IDS = [
  'overview',
  'profile',
  'google-business-profile',
  'availability',
  'menu',
  'tables',
  'team',
  'email-templates',
  'all',
];

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function parseArgs(argv) {
  let presetId = 'all';
  let outputPath;

  for (const arg of argv) {
    if (arg.startsWith('--route=') || arg.startsWith('--preset=')) {
      presetId = arg.split('=')[1];
      continue;
    }
    if (arg.startsWith('-')) continue;
    if (!ROUTE_PRESETS[arg] && arg !== 'each') {
      outputPath = arg;
      continue;
    }
    presetId = arg;
  }

  if (presetId === 'each') {
    return { mode: 'each' };
  }

  const preset = ROUTE_PRESETS[presetId];
  if (!preset) {
    throw new Error(
      `Unknown preset "${presetId}". Use: ${Object.keys(ROUTE_PRESETS).join(', ')}, each`,
    );
  }

  if (!outputPath) {
    const fileName = preset.outputFile ?? `${preset.id}-${formatTimestamp(new Date())}.json`;
    outputPath =
      preset.id === 'all' && !preset.outputFile
        ? path.join(
            REPO_ROOT,
            `restaurant-settings-frontend-consolidated-${formatTimestamp(new Date())}.json`,
          )
        : path.join(preset.id === 'all' ? CONSOLIDATED_ROOT : ROUTES_DIR, fileName);
  }

  return { mode: 'single', preset, outputPath };
}

function isExcludedRepoPath(relPath) {
  if (!relPath) return true;
  if (EXCLUDED_PATH_PREFIXES.some((prefix) => relPath.startsWith(prefix))) return true;
  return relPath.split('/').some((segment) => EXCLUDED_DIR_NAMES.has(segment));
}

function categorize(relPath, preset) {
  if (preset.routeEntryCoverage?.includes(relPath)) {
    return relPath === LAYOUT_ENTRY ? 'route-layout' : 'route-entry';
  }
  if (relPath.startsWith('src/components/features/restaurant-settings/')) {
    if (relPath.includes('/dual-sync/')) return 'restaurant-settings-dual-sync';
    if (relPath.includes('/google-business-profile/')) return 'restaurant-settings-gbp';
    if (relPath.includes('/profile/')) return 'restaurant-settings-profile';
    if (relPath.includes('/shared/')) return 'restaurant-settings-shared';
    return 'restaurant-settings-feature';
  }
  if (relPath.startsWith('src/components/features/menu/')) return 'menu-feature';
  if (relPath.startsWith('src/components/features/tables/')) return 'tables-feature';
  if (relPath.startsWith('src/components/features/team/')) return 'team-feature';
  if (relPath.startsWith('components/ui/') || relPath.startsWith('src/components/ui/')) {
    return 'shadcn-ui-primitive';
  }
  if (relPath.startsWith('components/ops/')) return 'ops-shared-component';
  if (relPath.startsWith('src/components/features/ops-shell/')) return 'ops-shell-feature';
  if (relPath.startsWith('src/hooks/')) return 'frontend-hook';
  if (relPath.startsWith('src/services/')) return 'frontend-service';
  if (relPath.startsWith('src/contexts/')) return 'frontend-context';
  if (relPath.startsWith('lib/')) return 'frontend-lib';
  if (relPath.startsWith('reserve/')) return 'reserve-shared-frontend';
  if (relPath === 'src/proxy.ts') return 'route-boundary';
  return 'other-frontend';
}

async function listFilesRecursively(dirRel) {
  const absDir = path.join(REPO_ROOT, dirRel);
  const entries = await readdir(absDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = path.posix.join(dirRel, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      files.push(...(await listFilesRecursively(rel)));
      continue;
    }
    const ext = path.extname(entry.name);
    if (!FRONTEND_EXTENSIONS.has(ext)) continue;
    files.push(rel);
  }
  return files;
}

function extractImports(content, fromRel, preset) {
  const specs = new Set();
  let match;
  STATIC_IMPORT_RE.lastIndex = 0;
  while ((match = STATIC_IMPORT_RE.exec(content)) !== null) {
    specs.add(match[1]);
  }
  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((match = DYNAMIC_IMPORT_RE.exec(content)) !== null) {
    if (preset.allowDynamicImport(fromRel, match[1])) {
      specs.add(match[1]);
    }
  }
  return [...specs];
}

function resolveSpecifier(fromRel, specifier) {
  if (specifier.startsWith('@/')) {
    const withoutAlias = specifier.slice(2);
    return [
      path.posix.join('src', withoutAlias),
      withoutAlias,
      path.posix.join('components', withoutAlias),
    ].flatMap((base) => resolveModuleBase(base));
  }
  if (specifier.startsWith('.')) {
    return resolveModuleBase(
      path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), specifier)),
    );
  }
  if (specifier.startsWith('@reserve/')) {
    return resolveModuleBase(specifier.replace('@reserve/', 'reserve/'));
  }
  return [];
}

function resolveModuleBase(baseRel) {
  const ext = path.extname(baseRel);
  if (ext && FRONTEND_EXTENSIONS.has(ext)) {
    return isExcludedRepoPath(baseRel) ? [] : [baseRel];
  }
  return [
    `${baseRel}.ts`,
    `${baseRel}.tsx`,
    `${baseRel}.css`,
    `${baseRel}.mjs`,
    path.posix.join(baseRel, 'index.ts'),
    path.posix.join(baseRel, 'index.tsx'),
  ].filter((candidate) => !isExcludedRepoPath(candidate));
}

async function resolveExisting(relPath) {
  try {
    const info = await stat(path.join(REPO_ROOT, relPath));
    return info.isFile() ? relPath : null;
  } catch {
    return null;
  }
}

async function resolveModule(fromRel, specifier) {
  for (const candidate of resolveSpecifier(fromRel, specifier)) {
    const resolved = await resolveExisting(candidate);
    if (resolved) return resolved;
  }
  return null;
}

async function collectSeedFiles(preset) {
  const seeds = new Set(preset.seedFiles ?? []);
  if (preset.includeAllRouteEntries) {
    for (const entry of ALL_ROUTE_ENTRIES) seeds.add(entry);
  }
  for (const dir of preset.seedDirs ?? []) {
    for (const file of await listFilesRecursively(dir)) seeds.add(file);
  }
  return [...seeds].sort();
}

async function traceDependencies(seedFiles, preset) {
  const queue = [...seedFiles];
  const included = new Set(seedFiles);
  const skippedLocalDependencies = new Set();
  const dependencyEdges = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (isExcludedRepoPath(current)) continue;

    let content;
    try {
      content = await readFile(path.join(REPO_ROOT, current), 'utf8');
    } catch {
      continue;
    }

    for (const specifier of extractImports(content, current, preset)) {
      if (
        !specifier.startsWith('.') &&
        !specifier.startsWith('@/') &&
        !specifier.startsWith('@reserve/')
      ) {
        continue;
      }
      const resolved = await resolveModule(current, specifier);
      if (!resolved) {
        skippedLocalDependencies.add(`${current} -> ${specifier}`);
        continue;
      }
      if (isExcludedRepoPath(resolved)) {
        skippedLocalDependencies.add(`${current} -> ${resolved}`);
        continue;
      }
      dependencyEdges.push({ from: current, to: resolved, specifier });
      if (!included.has(resolved)) {
        included.add(resolved);
        queue.push(resolved);
      }
    }
  }

  return {
    files: [...included].sort(),
    dependencyEdges,
    skippedLocalDependencies: [...skippedLocalDependencies].sort(),
  };
}

async function buildArtifact(preset) {
  const seeds = await collectSeedFiles(preset);
  const { files, dependencyEdges, skippedLocalDependencies } = await traceDependencies(
    seeds,
    preset,
  );

  const fileRecords = [];
  let totalContentBytes = 0;
  const filesByCategory = {};

  for (const relPath of files) {
    const content = await readFile(path.join(REPO_ROOT, relPath), 'utf8');
    const record = {
      path: relPath,
      category: categorize(relPath, preset),
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: createHash('sha256').update(content).digest('hex'),
      content,
    };
    fileRecords.push(record);
    totalContentBytes += record.bytes;
    filesByCategory[record.category] = (filesByCategory[record.category] ?? 0) + 1;
  }

  const routeEntryCoverage = (preset.routeEntryCoverage ?? []).map((entryPath) => ({
    path: entryPath,
    included: files.includes(entryPath),
  }));

  return {
    generatedAt: new Date().toISOString(),
    repository: REPO_ROOT,
    preset: preset.id,
    artifactPurpose: preset.artifactPurpose,
    requestedUrl: preset.requestedUrl,
    routing: {
      appHost: APP_HOST,
      externalAppHostPrefix: '/settings/restaurant',
      internalRewritePrefix: '/app/settings/restaurant',
      layout: LAYOUT_ENTRY,
      proxy: 'src/proxy.ts',
      ...(preset.route ?? {}),
    },
    scope: preset.scope,
    routes: preset.routes ?? ROUTE_CATALOG.filter((route) => route.view === preset.id),
    routeEntryCoverage,
    summary: {
      filesIncluded: fileRecords.length,
      filesByCategory,
      dependencyEdges: dependencyEdges.length,
      skippedLocalDependencies: skippedLocalDependencies.length,
      totalContentBytes,
    },
    skippedLocalDependencies,
    files: fileRecords,
  };
}

async function writeArtifact(artifact, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
}

async function runSingle(preset, outputPath) {
  const artifact = await buildArtifact(preset);
  await writeArtifact(artifact, outputPath);
  console.log(`Wrote ${outputPath}`);
  console.log(
    `  preset=${preset.id} files=${artifact.summary.filesIncluded} bytes=${artifact.summary.totalContentBytes}`,
  );
  return { preset: preset.id, outputPath, artifact };
}

async function runEach() {
  await mkdir(ROUTES_DIR, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    appHost: APP_HOST,
    basePath: '/settings/restaurant',
    outputDirectory: path.relative(REPO_ROOT, CONSOLIDATED_ROOT),
    routesDirectory: path.relative(REPO_ROOT, ROUTES_DIR),
    description:
      'Per-route frontend consolidation bundles for app-host restaurant settings. Each file is self-contained for analysis; shared shell code is duplicated across bundles.',
    routeBundles: [],
    primaryNavRoutes: [],
    legacyAliasRoutes: [],
    redirectRoutes: [],
  };

  for (const presetId of EACH_PRESET_IDS) {
    const preset = ROUTE_PRESETS[presetId];
    const outputPath =
      presetId === 'all'
        ? path.join(CONSOLIDATED_ROOT, preset.outputFile)
        : path.join(ROUTES_DIR, preset.outputFile);
    const { artifact } = await runSingle(preset, outputPath);

    const primary = artifact.routes.filter((r) => !r.legacy && !r.redirect);
    const legacy = artifact.routes.filter((r) => r.legacy);
    const redirects = artifact.routes.filter((r) => r.redirect);

    const bundleMeta = {
      preset: presetId,
      outputFile: path.relative(REPO_ROOT, outputPath),
      requestedUrl: artifact.requestedUrl,
      filesIncluded: artifact.summary.filesIncluded,
      totalContentBytes: artifact.summary.totalContentBytes,
      routes: artifact.routes.map((r) => r.path),
    };

    manifest.routeBundles.push(bundleMeta);
    if (presetId !== 'all') {
      for (const r of primary) manifest.primaryNavRoutes.push({ ...r, bundle: preset.outputFile });
      for (const r of legacy) manifest.legacyAliasRoutes.push({ ...r, bundle: preset.outputFile });
      for (const r of redirects) manifest.redirectRoutes.push({ ...r, bundle: preset.outputFile });
    }
  }

  const manifestPath = path.join(CONSOLIDATED_ROOT, 'manifest.json');
  await writeArtifact(manifest, manifestPath);
  console.log(`\nWrote ${manifestPath}`);
  console.log(
    `Organized ${manifest.routeBundles.length} bundles under ${path.relative(REPO_ROOT, CONSOLIDATED_ROOT)}/`,
  );
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.mode === 'each') {
    await runEach();
    return;
  }
  await runSingle(parsed.preset, parsed.outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
