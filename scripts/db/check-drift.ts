import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync('supabase', ['db', 'diff', '--linked', '--schema', 'public'], {
  encoding: 'utf8',
  env: process.env,
});
const commandExit = result.status ?? 1;
const standardOutput = result.stdout ?? '';
const standardError = result.stderr ?? '';

if (standardError) {
  process.stderr.write(standardError);
}

if (commandExit !== 0) {
  if (standardOutput) {
    process.stdout.write(standardOutput);
  }
  process.exitCode = commandExit;
} else if (standardOutput.trim()) {
  process.stdout.write(standardOutput);
  process.stderr.write('Schema drift detected.\n');
  process.exitCode = 1;
} else {
  process.stdout.write('No schema drift detected.\n');
}
