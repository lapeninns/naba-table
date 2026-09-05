import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { nonCommentLines, readInfraFile, repositoryRoot } from './helpers';

type PackageJson = {
  readonly packageManager: string;
  readonly devDependencies: Record<string, string>;
};

type OperatingConfig = {
  readonly job: {
    readonly image: { readonly user: string; readonly uid: number; readonly gid: number };
  };
};

const dockerfile = readInfraFile('images/ci-job/Dockerfile');
const lines = nonCommentLines(dockerfile);
const packageJson = JSON.parse(
  readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
) as PackageJson;
const operating = JSON.parse(readInfraFile('operating.json')) as OperatingConfig;
const executorConfigSource = readFileSync(
  path.join(repositoryRoot, 'scripts/ci/executor/config.ts'),
  'utf8',
);

function argValue(name: string): string | undefined {
  const match = dockerfile.match(new RegExp(`^ARG ${name}=(.+)$`, 'm'));
  return match?.[1];
}

describe('infra/local-ci/images/ci-job/Dockerfile', () => {
  it('pins the Playwright and pnpm versions to the repository manifest', () => {
    expect(argValue('PLAYWRIGHT_VERSION')).toBe(packageJson.devDependencies['@playwright/test']);
    expect(argValue('PNPM_VERSION')).toBe(packageJson.packageManager.replace(/^pnpm@/, ''));
    expect(packageJson.packageManager.startsWith('pnpm@')).toBe(true);
  });

  it('uses Node 22 as the active runtime with a digest-pinned base', () => {
    expect(argValue('NODE_IMAGE_REF')).toBe('node:22-bookworm-slim');
    expect(argValue('NODE_IMAGE_DIGEST')).toMatch(/^sha256:REPLACE_ME_/);
    expect(dockerfile).toMatch(/^FROM \$\{NODE_IMAGE_REF\}@\$\{NODE_IMAGE_DIGEST\}$/m);
    // Candidate runtime is documented, not active.
    expect(dockerfile).toContain('node:24-bookworm-slim');
    expect(dockerfile).toContain('activeRuntime=node22');
    expect(dockerfile).toContain('UV_USE_IO_URING=0');
  });

  it('never uses ADD or remote URLs in file instructions', () => {
    const addLines = lines.filter((line) => /^ADD\b/.test(line));
    expect(addLines).toEqual([]);
    const copyRemote = lines.filter((line) => /^COPY\b/.test(line) && /https?:\/\//.test(line));
    expect(copyRemote).toEqual([]);
  });

  it('drops to the non-root user before the final stage ends', () => {
    const userLines = lines.filter((line) => /^USER\b/.test(line));
    expect(userLines.length).toBeGreaterThan(0);
    expect(userLines[userLines.length - 1]).toBe('USER ci');
    // No instruction after USER ci may switch back to root.
    const lastUserIndex = lines.lastIndexOf('USER ci');
    expect(lines.slice(lastUserIndex + 1).some((line) => /^USER\b/.test(line))).toBe(false);
    expect(dockerfile).toContain('useradd --uid "${CI_UID}"');
  });

  it('owns uid/gid 1000, the pair the executor passes as --user, and matches operating.json', () => {
    expect(argValue('CI_UID')).toBe(String(operating.job.image.uid));
    expect(argValue('CI_GID')).toBe(String(operating.job.image.gid));
    expect(operating.job.image).toMatchObject({ user: 'ci', uid: 1000, gid: 1000 });
    // The node base image already holds 1000:1000 as `node`; it must be removed first.
    expect(dockerfile).toContain('userdel --remove node');
    // The executor derives `--user uid:uid` from operating.json job.image.uid.
    expect(executorConfigSource).toContain("digNumber(raw, 'job.image.uid', problems)");
    expect(executorConfigSource).toContain('`${facts.jobUid}:${facts.jobUid}`');
    expect(operating.job.image.uid).toBe(operating.job.image.gid);
  });

  it('contains no secrets, tokens, or registry auth', () => {
    const forbidden = [
      /_authToken/i,
      /NPM_TOKEN/,
      /GITHUB_TOKEN/,
      /AWS_SECRET/,
      /PRIVATE_KEY/,
      /-----BEGIN/,
      /\.npmrc/,
      /--mount=type=secret/,
    ];
    for (const pattern of forbidden) {
      expect(dockerfile).not.toMatch(pattern);
    }
  });

  it('installs Chromium dependencies for the pinned Playwright release only', () => {
    expect(dockerfile).toContain('"playwright@${PLAYWRIGHT_VERSION}" install-deps chromium');
    expect(dockerfile).toContain('"playwright@${PLAYWRIGHT_VERSION}" install chromium');
    expect(dockerfile).not.toMatch(/install(-deps)? (firefox|webkit)/);
    expect(dockerfile).not.toMatch(/playwright@latest/);
  });

  it('writes the image marker the executor can verify', () => {
    expect(dockerfile).toContain('/home/ci/.nabatable-ci-image');
  });
});
