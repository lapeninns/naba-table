import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadWindowAssignedObjectLiteral } from '@/scripts/menu/source-literal';

describe('menu source literal parser', () => {
  it('parses window-assigned object literals without executing JavaScript', () => {
    const filePath = path.join(os.tmpdir(), `nabatable-menu-${Date.now()}.js`);
    fs.writeFileSync(
      filePath,
      'window.DRINKS_MENU_DATA = { venue: { name: "Venue" }, pages: [{ id: "main", columns: [] }] };\n',
      'utf8',
    );

    expect(loadWindowAssignedObjectLiteral(filePath, 'DRINKS_MENU_DATA')).toEqual({
      venue: { name: 'Venue' },
      pages: [{ id: 'main', columns: [] }],
    });
  });

  it('rejects executable source expressions', () => {
    const filePath = path.join(os.tmpdir(), `nabatable-menu-exec-${Date.now()}.js`);
    fs.writeFileSync(
      filePath,
      'window.DRINKS_MENU_DATA = { venue: { name: process.env.SUPABASE_SERVICE_ROLE_KEY }, pages: [] };\n',
      'utf8',
    );

    expect(() => loadWindowAssignedObjectLiteral(filePath, 'DRINKS_MENU_DATA')).toThrow(
      /Unsupported object source value/,
    );
  });
});
