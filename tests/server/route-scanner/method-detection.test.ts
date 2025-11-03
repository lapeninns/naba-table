import fs from 'node:fs';
import path from 'node:path';

import RouteScanner from '../../../route-scanner.js';

const fixturesDir = path.resolve(__dirname, '../../fixtures/route-scanner/methods');

function writeFixture(name: string, content: string) {
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
  const p = path.join(fixturesDir, name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

describe('AST-based HTTP method detection', () => {
  it('detects export const GET = ...', () => {
    const file = writeFixture(
      'export-const-get.ts',
      `export const GET = async () => new Response('ok');`
    );
    const scanner = new RouteScanner();
    const methods = scanner.extractHttpMethods(file);
    expect(methods).toContain('GET');
  });

  it('detects export async function POST() {}', () => {
    const file = writeFixture(
      'export-function-post.ts',
      `export async function POST() { return new Response('ok'); }`
    );
    const scanner = new RouteScanner();
    const methods = scanner.extractHttpMethods(file);
    expect(methods).toContain('POST');
  });

  it('detects re-export: export { PUT } from', () => {
    const file = writeFixture(
      'reexport-put.ts',
      `export { PUT } from './handler';`
    );
    const scanner = new RouteScanner();
    const methods = scanner.extractHttpMethods(file);
    expect(methods).toContain('PUT');
  });

  it('counts aliased re-export: export { GET as handler }', () => {
    const file = writeFixture(
      'reexport-aliased-get.ts',
      `export { GET as handler } from './handler';`
    );
    const scanner = new RouteScanner();
    const methods = scanner.extractHttpMethods(file);
    expect(methods).toContain('GET');
    expect(scanner.meta.warnings.some((w: { type: string }) => w.type === 'method_reexport_aliased')).toBe(true);
  });

  it('handles multiple methods exported in one file', () => {
    const file = writeFixture(
      'multiple-methods.ts',
      `export const GET = async () => new Response('ok');
       export const POST = async () => new Response('ok');`
    );
    const scanner = new RouteScanner();
    const methods = scanner.extractHttpMethods(file);
    expect(methods.sort()).toEqual(['GET', 'POST']);
  });

  it('returns [] and warns when no methods exported', () => {
    const file = writeFixture('no-methods.ts', `const x = 1;`);
    const scanner = new RouteScanner();
    const methods = scanner.extractHttpMethods(file);
    expect(methods).toEqual([]);
    expect(scanner.meta.warnings.some((w: { type: string }) => w.type === 'method_detection_failed')).toBe(true);
  });
});

