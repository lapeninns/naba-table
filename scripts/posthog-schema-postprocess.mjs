import fs from 'node:fs';
import path from 'node:path';

const generatedPath = path.join(process.cwd(), 'lib', 'posthog', 'generated-events.ts');
const eslintDisable = '/* eslint-disable */';

if (!fs.existsSync(generatedPath)) {
  process.exit(0);
}

const source = fs.readFileSync(generatedPath, 'utf8');
if (source.startsWith(eslintDisable)) {
  process.exit(0);
}

fs.writeFileSync(generatedPath, `${eslintDisable}\n${source}`);
