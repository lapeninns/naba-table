import fs from 'node:fs';
import path from 'node:path';

type Pkg = {
  name: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function listWorkspacePackageJsonPaths(repoRoot: string): string[] {
  const result: string[] = [];
  const candidates = [
    path.join(repoRoot, 'package.json'),
    path.join(repoRoot, 'reserve/package.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      result.push(p);
    }
  }
  return result;
}

function collectVersions(
  pkgs: Array<{ path: string; pkg: Pkg }>,
  depName: string,
): Map<string, string[]> {
  const versions = new Map<string, string[]>();
  for (const { path: pkgPath, pkg } of pkgs) {
    const fields: Array<'dependencies' | 'devDependencies' | 'peerDependencies'> = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
    ];
    for (const field of fields) {
      const rec = pkg[field];
      if (!rec) continue;
      const version = rec[depName];
      if (!version) continue;
      const entries = versions.get(version) ?? [];
      entries.push(`${pkg.name} (${path.relative(process.cwd(), pkgPath)}:${String(field)})`);
      versions.set(version, entries);
    }
  }
  return versions;
}

function main(): void {
  const repoRoot = path.resolve(__dirname, '..');
  const pkgPaths = listWorkspacePackageJsonPaths(repoRoot);
  const pkgs = pkgPaths.map((pkgPath) => ({ path: pkgPath, pkg: readJson<Pkg>(pkgPath) }));

  const tracked = ['next', 'react', 'react-dom', 'typescript', 'eslint', 'vitest'];
  let hasDrift = false;

  for (const depName of tracked) {
    const versions = collectVersions(pkgs, depName);
    if (versions.size <= 1) continue;

    hasDrift = true;
    console.error(`Version drift detected for '${depName}':`);
    for (const [version, owners] of versions.entries()) {
      console.error(`- ${version}`);
      for (const owner of owners) {
        console.error(`  - ${owner}`);
      }
    }
  }

  if (hasDrift) {
    process.exitCode = 1;
    return;
  }

  console.log('OK: No version drift detected for tracked dependencies.');
}

main();
