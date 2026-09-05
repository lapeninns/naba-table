import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

import { validateOpenApiDocument } from './openapi-contract';

const DOCUMENTS = [
  'openapi.yaml',
  'cloudflare/booking-short-links/openapi.yaml',
  'cloudflare/email-queue-gateway/openapi.yaml',
  'cloudflare/sms-summary-gateway/openapi.yaml',
  'cloudflare/operational-control/openapi.yaml',
] as const;

function main(): void {
  const repositoryRoot = process.cwd();
  const issues = DOCUMENTS.flatMap((documentPath) =>
    validateOpenApiDocument(
      parse(readFileSync(path.join(repositoryRoot, documentPath), 'utf8')),
    ).map((issue) => `${documentPath}: ${issue}`),
  );

  if (issues.length > 0) {
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${DOCUMENTS.length} OpenAPI documents.`);
}

main();
