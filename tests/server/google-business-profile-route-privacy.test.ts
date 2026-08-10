import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routeRoot = join(process.cwd(), 'src/app/api/ops/restaurants/[id]/google-business-profile');

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === 'route.ts' ? [path] : [];
  });
}

describe('GBP route privacy boundary', () => {
  it('routes all GBP responses and exceptions through the privacy helpers', () => {
    const files = [
      ...routeFiles(routeRoot),
      join(process.cwd(), 'src/app/api/ops/google-business-profile/callback/route.ts'),
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('NextResponse.json');
      expect(source, file).not.toContain('captureServerException');
      expect(source, file).not.toMatch(/console\.(?:log|error|warn|info)/);
      expect(source, file).not.toContain('return access;');
      expect(source, file).not.toContain('return rateLimit;');
      expect(source, file).toMatch(/gbpNoStore(?:Json|Response)/);
    }
  });
});
