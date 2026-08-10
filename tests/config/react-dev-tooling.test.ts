import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const packageManifestSchema = z.object({
  devDependencies: z.record(z.string(), z.string()),
});

function readWorkspaceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('React development tooling', () => {
  it('keeps all three React diagnostics in development dependencies', () => {
    const manifest = packageManifestSchema.parse(JSON.parse(readWorkspaceFile('package.json')));

    expect(manifest.devDependencies).toMatchObject({
      'react-doctor': expect.any(String),
      'react-grab': expect.any(String),
      'react-scan': expect.any(String),
    });
  });

  it('gates runtime diagnostics behind development mode and the public opt-out', () => {
    const rootLayout = readWorkspaceFile('src/app/layout.tsx');

    expect(rootLayout).toContain("process.env.NODE_ENV === 'development'");
    expect(rootLayout).toContain("process.env.NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS !== '1'");
  });
});
