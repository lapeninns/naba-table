import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { validateFeatureFlagRegistry } from './feature-flag-contract';

const RegistrySchema = z.object({
  version: z.literal(1),
  flags: z.array(
    z.object({
      key: z.string().min(1),
      owner: z.string().min(1),
      expiresAt: z.iso.date(),
      removalIssue: z.url(),
    }),
  ),
});

const SOURCE_DIRECTORIES = [
  'app',
  'components',
  'hooks',
  'lib',
  'reserve',
  'server',
  'src',
  'cloudflare',
];
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/u;
const FLAG_REFERENCE =
  /(?:featureFlag|getFeatureFlag|isFeatureEnabled)\(\s*['"]([^'"]+)['"]|posthog\.isFeatureEnabled\(\s*['"]([^'"]+)['"]/gu;

function collectFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ['coverage', 'dist', 'node_modules', 'test-results'].includes(entry.name)
        ? []
        : collectFiles(entryPath);
    }
    return SOURCE_EXTENSION.test(entry.name) ? [entryPath] : [];
  });
}

function readReferencedKeys(repositoryRoot: string): Set<string> {
  const keys = new Set<string>();
  const files = SOURCE_DIRECTORIES.flatMap((directory) =>
    collectFiles(path.join(repositoryRoot, directory)),
  );

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(FLAG_REFERENCE)) {
      const key = match[1] ?? match[2];
      if (key) {
        keys.add(key);
      }
    }
  }

  return keys;
}

function main(): void {
  const repositoryRoot = process.cwd();
  const registryPath = path.join(repositoryRoot, 'config/feature-flags.json');
  const registry = RegistrySchema.parse(JSON.parse(readFileSync(registryPath, 'utf8')));
  const issues = validateFeatureFlagRegistry({
    flags: registry.flags,
    now: new Date(),
    referencedKeys: readReferencedKeys(repositoryRoot),
  });

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Feature-flag lifecycle contract passed for ${registry.flags.length} flags.`);
}

main();
