import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('grant restaurant access role safety', () => {
  it('uses the canonical restaurant role model instead of obsolete script-local roles', () => {
    const source = read('scripts/grant-restaurant-access.ts');

    expect(source).toContain('RESTAURANT_ROLE_OPTIONS');
    expect(source).toContain('isRestaurantRole');
    expect(source).not.toContain('"admin", "staff", "viewer"');
    expect(source).toContain('const role = normalizeRole(process.env.ROLE);');
  });

  it('fails when an existing membership already has a non-canonical role', () => {
    const source = read('scripts/grant-restaurant-access.ts');
    const grantBody = source.slice(source.indexOf('async function grantAccess()'));

    expect(grantBody).toContain('if (!isRestaurantRole(existing.role))');
    expect(grantBody.indexOf('if (!isRestaurantRole(existing.role))')).toBeLessThan(
      grantBody.indexOf('if (existing.role === role)'),
    );
  });
});
