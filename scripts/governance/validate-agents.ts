import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { validateAgentsDocument } from './agents-contract';

const PackageJsonSchema = z.object({
  scripts: z.record(z.string(), z.string()),
});

function main(): void {
  const repositoryRoot = process.cwd();
  const agentsPath = path.join(repositoryRoot, 'AGENTS.md');
  const packageJsonPath = path.join(repositoryRoot, 'package.json');

  if (!existsSync(agentsPath)) {
    throw new Error('AGENTS.md is missing from the repository root.');
  }

  const packageJson = PackageJsonSchema.parse(JSON.parse(readFileSync(packageJsonPath, 'utf8')));
  const issues = validateAgentsDocument({
    content: readFileSync(agentsPath, 'utf8'),
    now: new Date(),
    scripts: new Set(Object.keys(packageJson.scripts)),
    pathExists: (relativePath) => existsSync(path.resolve(repositoryRoot, relativePath)),
  });

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('AGENTS.md contract is current and resolvable.');
}

main();
