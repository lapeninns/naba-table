#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const MAX_LINES = Number(process.env.MAX_FILE_LINES || 1200);
const ROOT = process.cwd();
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.storybook',
  'backups',
  'build',
  'dist',
  'node_modules',
  'public',
  'tasks',
  'test-results',
  'playwright-report',
  '.reserve-dist',
  'coverage',
  'docs',
]);

const TARGET_DIRS = ['src', 'server', 'lib', 'components', 'reserve', 'hooks', 'types', 'config', 'scripts'];
const ALLOWLIST = new Set([
  'types/supabase.ts',
  'src/app/api/bookings/[id]/route.ts',
  'src/app/api/bookings/[id]/route.test.ts',
  'src/app/api/bookings/route.ts',
  'src/app/api/ops/bookings/route.ts',
  'server/capacity/table-assignment/manual.ts',
  'src/components/features/tables/TableInventoryClient.tsx',
]);

function shouldSkipDir(dirName) {
  return SKIP_DIRS.has(dirName) || dirName.startsWith('.backup');
}

function countLines(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  if (!contents) return 0;
  return contents.split(/\r?\n/).length;
}

function walk(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      walk(fullPath, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!EXTENSIONS.has(ext)) continue;
      const relativePath = path.relative(ROOT, fullPath);
      if (ALLOWLIST.has(relativePath)) continue;
      const lineCount = countLines(fullPath);
      if (lineCount > MAX_LINES) {
        results.push({ filePath: relativePath, lineCount });
      }
    }
  }
}

function main() {
  const overLimit = [];
  for (const dir of TARGET_DIRS) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    walk(absDir, overLimit);
  }

  if (overLimit.length === 0) {
    console.log(`Large file check passed (max ${MAX_LINES} lines).`);
    return;
  }

  console.error(`Large file check failed (max ${MAX_LINES} lines).`);
  for (const file of overLimit.sort((a, b) => b.lineCount - a.lineCount)) {
    console.error(`${file.lineCount} lines: ${file.filePath}`);
  }
  process.exit(1);
}

main();
