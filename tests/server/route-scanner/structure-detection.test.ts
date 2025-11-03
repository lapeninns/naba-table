import fs from 'node:fs';
import path from 'node:path';

import RouteScanner from '../../../route-scanner.js';

function withTempDir(cb: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-routes-'));
  try { cb(dir); } finally {
    // naive cleanup
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function ensureFile(p: string, content: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

describe('Structure detection and path building', () => {
  it('ignores @parallel folders in path', () => withTempDir((base) => {
    // base simulates src/app
    const page = path.join(base, '@parallel', 'dashboard', 'page.tsx');
    ensureFile(page, 'export default function Page(){return null}');
    const scanner = new RouteScanner(base);
    scanner.scan();
    const hit = scanner.routes.pages.find((r: { path: string }) => r.path === '/dashboard');
    expect(hit).toBeTruthy();
  }));

  it('ignores intercepting prefix folders like (.)slot', () => withTempDir((base) => {
    const page = path.join(base, '(.)slot', 'login', 'page.tsx');
    ensureFile(page, 'export default function Page(){return null}');
    const scanner = new RouteScanner(base);
    scanner.scan();
    const hit = scanner.routes.pages.find((r: { path: string }) => r.path === '/login');
    expect(hit).toBeTruthy();
  }));

  it('supports optional catch-all [[...slug]]', () => withTempDir((base) => {
    const page = path.join(base, 'blog', '[[...slug]]', 'page.tsx');
    ensureFile(page, 'export default function Page(){return null}');
    const scanner = new RouteScanner(base);
    scanner.scan();
    const hit = scanner.routes.pages.find((r: { path: string }) => r.path === '/blog/:slug*');
    expect(hit).toBeTruthy();
  }));
});

