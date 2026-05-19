#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertQaEnvironment } from './environment';

type GuardedCommandOptions = {
  command: string[];
  destructive: boolean;
  externalMutation: boolean;
  requiredEnv: string[];
};

function parseArgs(argv: readonly string[]): GuardedCommandOptions {
  const requiredEnv: string[] = [];
  let destructive = false;
  let externalMutation = false;
  let commandStartIndex = -1;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      commandStartIndex = index + 1;
      break;
    }
    if (arg === '--destructive') {
      destructive = true;
      continue;
    }
    if (arg === '--external-mutation') {
      externalMutation = true;
      continue;
    }
    if (arg === '--require-env') {
      const value = argv[index + 1];
      if (!value) throw new Error('--require-env requires an env var name.');
      requiredEnv.push(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--require-env=')) {
      requiredEnv.push(arg.slice('--require-env='.length));
      continue;
    }
    throw new Error(`Unknown guarded QA command option "${arg}".`);
  }

  const command = commandStartIndex >= 0 ? Array.from(argv.slice(commandStartIndex)) : [];
  if (command.length === 0) {
    throw new Error('Guarded QA command requires -- followed by the command to run.');
  }

  return {
    command,
    destructive,
    externalMutation,
    requiredEnv,
  };
}

export function runGuardedQaCommand(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): number {
  const options = parseArgs(argv);
  const guard = assertQaEnvironment({
    destructive: options.destructive,
    env,
    externalMutation: options.externalMutation,
    requiredEnv: options.requiredEnv,
  });
  const [command, ...args] = options.command;

  console.log(
    `[qa:guard] target=${guard.targetClass} destructive=${options.destructive} externalMutation=${options.externalMutation}`,
  );
  console.log(`[qa:guard] ${options.command.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  return result.status ?? 1;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runGuardedQaCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
