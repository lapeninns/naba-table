#!/usr/bin/env node
/*
  Generates ROUTE_SUMMARY.md, COMPLETE_ROUTE_MAP.md (data-driven sections), and route-scan-warnings.md
  from route-map.json and existing route-map-mermaid.md.

  Usage:
    node scripts/generate-route-docs.js          # reads ./route-map.json
    node scripts/generate-route-docs.js path/to/route-map.json
*/

const fs = require('fs');
const path = require('path');

function loadJson(p) {
  const json = fs.readFileSync(p, 'utf8');
  return JSON.parse(json);
}

function computeMethodDistribution(apiRoutes) {
  const dist = {};
  for (const r of apiRoutes) {
    if (!r.methods || r.methods.length === 0) {
      dist.unknown = (dist.unknown || 0) + 1;
      continue;
    }
    for (const m of r.methods) {
      dist[m] = (dist[m] || 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(dist).sort((a, b) => a[0].localeCompare(b[0])));
}

function guardLevel(guards) {
  if (!guards || guards.length === 0) return 'public';
  if (guards.includes('admin')) return 'admin';
  if (guards.includes('owner')) return 'owner';
  if (guards.includes('auth')) return 'auth';
  return 'mixed';
}

function computeGuardDistribution(allRoutes) {
  const dist = { public: 0, auth: 0, admin: 0, owner: 0, mixed: 0 };
  for (const r of allRoutes) {
    const lvl = guardLevel(r.guards);
    dist[lvl] = (dist[lvl] || 0) + 1;
  }
  return dist;
}

function computeCategoryBreakdown(pages, api) {
  const apiV1 = api.filter(r => r.path.startsWith('/api/v1/'));
  const apiTest = api.filter(r => r.path.startsWith('/api/test'));
  const apiOps = api.filter(r => r.path.startsWith('/api/ops'));
  const apiOwner = api.filter(r => r.path.startsWith('/api/owner'));
  const apiCore = api.filter(r => r.path.startsWith('/api/') && !r.path.startsWith('/api/v1/') && !r.path.startsWith('/api/test') && !r.path.startsWith('/api/ops') && !r.path.startsWith('/api/owner'));

  return {
    pages: { total: pages.length, dynamic: pages.filter(r => r.dynamic).length },
    api: { total: api.length, dynamic: api.filter(r => r.dynamic).length },
    api_core: apiCore.length,
    api_v1: apiV1.length,
    api_test: apiTest.length,
    api_ops: apiOps.length,
    api_owner: apiOwner.length
  };
}

function generateSummaryTable(pages, api) {
  const total = pages.length + api.length;
  return [
    '| Artifact | Count |',
    '|---|---:|',
    `| Pages | ${pages.length} |`,
    `| API Routes | ${api.length} |`,
    `| Total | ${total} |`
  ].join('\n');
}

function renderWarningsReport(warnings) {
  const lines = ['# Route Scan Warnings', '', `Total warnings: ${warnings.length}`, ''];
  for (const w of warnings) {
    const bits = [
      `- type: ${w.type}`,
      w.route ? `  route: ${w.route}` : null,
      w.file ? `  file: ${w.file}` : null,
      w.groups ? `  groups: ${Array.isArray(w.groups) ? w.groups.join(', ') : w.groups}` : null,
      w.message ? `  message: ${w.message}` : null
    ].filter(Boolean);
    lines.push(bits.join('\n'));
  }
  lines.push('');
  return lines.join('\n');
}

function generateSummaryMd(data) {
  const { pages, api, meta } = data;
  const methodDist = computeMethodDistribution(api);
  const guardDist = computeGuardDistribution([...pages, ...api]);
  const categories = computeCategoryBreakdown(pages, api);
  const summaryTable = generateSummaryTable(pages, api);

  return `# Route Summary\n\nGenerated: ${meta.timestamp}\n\n${summaryTable}\n\n## API Methods\n\n` +
    Object.entries(methodDist).map(([k, v]) => `- ${k}: ${v}`).join('\n') +
    `\n\n## Guards (All Routes)\n\n` +
    Object.entries(guardDist).map(([k, v]) => `- ${k}: ${v}`).join('\n') +
    `\n\n## Categories\n\n` +
    Object.entries(categories).map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n') + '\n';
}

function generateCompleteMd(data, mermaidContent) {
  const { pages, api, meta } = data;
  const methodDist = computeMethodDistribution(api);
  const guardDist = computeGuardDistribution([...pages, ...api]);
  const categories = computeCategoryBreakdown(pages, api);

  return [
    '# Complete Route Map',
    '',
    `Generated: ${meta.timestamp}`,
    '',
    '## Diagram',
    '',
    '```mermaid',
    mermaidContent.trim(),
    '```',
    '',
    '---',
    '',
    '## Route Analysis',
    '',
    '### Method Distribution',
    ...Object.entries(methodDist).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '### Guard Distribution',
    ...Object.entries(guardDist).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '### Category Breakdown',
    ...Object.entries(categories).map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`),
    ''
  ].join('\n');
}

function main(inputPath) {
  const mapPath = inputPath || path.resolve(process.cwd(), 'route-map.json');
  const mermaidPath = path.resolve(process.cwd(), 'route-map-mermaid.md');
  const data = loadJson(mapPath);
  const mermaidRaw = fs.existsSync(mermaidPath) ? fs.readFileSync(mermaidPath, 'utf8') : 'flowchart TD';
  const mermaid = mermaidRaw.replace(/^```mermaid\n?|```$/g, '').trim();

  const summary = generateSummaryMd(data);
  fs.writeFileSync(path.resolve(process.cwd(), 'ROUTE_SUMMARY.md'), summary);

  const complete = generateCompleteMd(data, mermaid);
  fs.writeFileSync(path.resolve(process.cwd(), 'COMPLETE_ROUTE_MAP.md'), complete);

  const warnings = data.meta && Array.isArray(data.meta.warnings) ? data.meta.warnings : [];
  const warningDoc = renderWarningsReport(warnings);
  fs.writeFileSync(path.resolve(process.cwd(), 'route-scan-warnings.md'), warningDoc);
}

if (require.main === module) {
  const arg = process.argv[2];
  main(arg);
} else {
  module.exports = { main, computeMethodDistribution, computeGuardDistribution, computeCategoryBreakdown };
}

