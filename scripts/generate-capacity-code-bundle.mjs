import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';
import crypto from 'node:crypto';

async function fileExists(p) { try { await fs.access(p); return true; } catch { return false; } }

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

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function languageFor(path) {
  const ext = extname(path).toLowerCase();
  return ext === '.ts' || ext === '.mts' || ext === '.cts' ? 'typescript'
    : ext === '.tsx' ? 'tsx'
    : ext === '.js' || ext === '.mjs' || ext === '.cjs' ? 'javascript'
    : ext === '.json' ? 'json'
    : ext === '.md' ? 'markdown'
    : ext.replace(/^\./, '') || 'text';
}

async function main() {
  const roots = [
    'server/capacity',
  ];
  const includeAlso = [
    'server/feature-flags.ts',
    'server/supabase.ts',
  ];

  const files = [];
  for (const root of roots) {
    if (!(await fileExists(root))) continue;
    const all = await walk(root);
    for (const f of all) {
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(f)) continue; // code files only
      files.push(f);
    }
  }
  for (const f of includeAlso) if (await fileExists(f)) files.push(f);

  // de-dup and sort
  const unique = [...new Set(files)].sort();

  const entries = [];
  for (const path of unique) {
    const content = await fs.readFile(path);
    const text = content.toString('utf-8');
    const stat = await fs.stat(path);
    entries.push({
      path,
      size: stat.size,
      sha256: sha256(content),
      language: languageFor(path),
      content: text,
    });
  }

  const bundle = {
    name: 'capacity_engine_code_bundle',
    generatedAt: new Date().toISOString(),
    fileCount: entries.length,
    totalBytes: entries.reduce((a, e) => a + (e.size || 0), 0),
    files: entries,
  };

  await fs.mkdir('reports', { recursive: true });
  await fs.writeFile('reports/capacity_engine_code_bundle.json', JSON.stringify(bundle, null, 2));
  console.log('WROTE reports/capacity_engine_code_bundle.json');
}

main().catch((err) => { console.error('[generate-capacity-code-bundle] failed', err); process.exit(1); });

