import fs from 'node:fs';
import path from 'node:path';

type AuditResult = {
  definedAccessors: string[];
  unusedAccessors: string[];
};

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function listExportedAccessorNames(source: string): string[] {
  // Convention: feature flag accessors are exported functions named like isXEnabled.
  // Keep this intentionally simple and fast.
  const matches = source.matchAll(/export\s+function\s+(is[A-Za-z0-9_]+Enabled)\s*\(/g);
  const names = new Set<string>();
  for (const match of matches) {
    const name = match[1];
    if (name) {
      names.add(name);
    }
  }
  return [...names].sort();
}

function walkFiles(rootDir: string, relative: string, out: string[]): void {
  const abs = path.join(rootDir, relative);
  const entries = fs.readdirSync(abs, { withFileTypes: true });

  for (const entry of entries) {
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === 'dist' ||
        entry.name === 'coverage'
      ) {
        continue;
      }
      if (entry.name === 'tasks') {
        continue;
      }
      walkFiles(rootDir, rel, out);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      continue;
    }
    out.push(rel);
  }
}

function fileContainsAny(haystack: string, needles: string[]): Set<string> {
  const found = new Set<string>();
  for (const needle of needles) {
    if (haystack.includes(needle)) {
      found.add(needle);
    }
  }
  return found;
}

function runAudit(): AuditResult {
  const repoRoot = path.resolve(__dirname, '../..');
  const featureFlagsPath = path.join(repoRoot, 'server/feature-flags.ts');
  const featureFlagsSource = readUtf8(featureFlagsPath);
  const accessors = listExportedAccessorNames(featureFlagsSource);

  const files: string[] = [];
  walkFiles(repoRoot, '.', files);

  const used = new Set<string>();
  for (const relPath of files) {
    // Skip the definitions file.
    if (relPath === 'server/feature-flags.ts') {
      continue;
    }
    const content = readUtf8(path.join(repoRoot, relPath));
    for (const hit of fileContainsAny(content, accessors)) {
      used.add(hit);
    }
  }

  const unused = accessors.filter((name) => !used.has(name));
  return { definedAccessors: accessors, unusedAccessors: unused };
}

function main(): void {
  const result = runAudit();

  if (result.definedAccessors.length === 0) {
    console.log('OK: No feature-flag accessors found (nothing to audit).');
    return;
  }

  if (result.unusedAccessors.length === 0) {
    console.log(`OK: All ${result.definedAccessors.length} feature-flag accessors are referenced.`);
    return;
  }

  console.error('FAILED: Unused feature-flag accessors detected:');
  for (const name of result.unusedAccessors) {
    console.error(`- ${name}`);
  }
  console.error(
    'If this is intentional, remove the accessor or add a reference (or update this audit logic).',
  );
  process.exitCode = 1;
}

main();
