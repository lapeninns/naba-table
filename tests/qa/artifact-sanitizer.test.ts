import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { sanitizeQaArtifactFile, sanitizeQaArtifactTree } from '@/scripts/qa';

function tempProjectRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qa-artifact-sanitizer-'));
}

describe('QA artifact sanitizer', () => {
  it('@p0 @observability @security redacts text, JSON, HAR, and JSONL artifact files on disk', () => {
    const projectRoot = tempProjectRoot();
    const runDir = path.join(projectRoot, 'test-results/qa/qa-sanitize');
    fs.mkdirSync(path.join(runDir, 'api'), { recursive: true });

    const logPath = path.join(runDir, 'api/request.log');
    const jsonPath = path.join(runDir, 'api/payload.json');
    const harPath = path.join(runDir, 'api/network.har');
    const jsonlPath = path.join(runDir, 'api/events.jsonl');

    fs.writeFileSync(
      logPath,
      'Authorization: Bearer token-secret\nContact guest@example.test +447700900123\n',
      'utf8',
    );
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        email: 'guest@example.test',
        headers: [{ name: 'cookie', value: 'sb-access-token=session-secret' }],
        url: 'https://preview.test/manage?token=query-secret&safe=ok',
      }),
      'utf8',
    );
    fs.writeFileSync(
      harPath,
      JSON.stringify({
        log: {
          entries: [
            {
              request: {
                headers: [{ name: 'authorization', value: 'Bearer bearer-secret' }],
                postData: { text: 'phone=+447700900456' },
              },
            },
          ],
        },
      }),
      'utf8',
    );
    fs.writeFileSync(
      jsonlPath,
      `${JSON.stringify({ access_token: 'line-secret', email: 'line@example.test' })}\nnot-json token=loose-secret\n`,
      'utf8',
    );

    const summary = sanitizeQaArtifactTree(runDir, { projectRoot });
    const sanitizedOutput = [
      fs.readFileSync(logPath, 'utf8'),
      fs.readFileSync(jsonPath, 'utf8'),
      fs.readFileSync(harPath, 'utf8'),
      fs.readFileSync(jsonlPath, 'utf8'),
    ].join('\n');

    expect(summary.redacted).toBe(4);
    expect(sanitizedOutput).not.toContain('token-secret');
    expect(sanitizedOutput).not.toContain('guest@example.test');
    expect(sanitizedOutput).not.toContain('+447700900123');
    expect(sanitizedOutput).not.toContain('session-secret');
    expect(sanitizedOutput).not.toContain('query-secret');
    expect(sanitizedOutput).not.toContain('bearer-secret');
    expect(sanitizedOutput).not.toContain('+447700900456');
    expect(sanitizedOutput).not.toContain('line-secret');
    expect(sanitizedOutput).not.toContain('line@example.test');
    expect(sanitizedOutput).not.toContain('loose-secret');
    expect(sanitizedOutput).toContain('safe=ok');
  });

  it('@p0 @observability @security removes retained Playwright trace archives and leaves a redacted placeholder', () => {
    const projectRoot = tempProjectRoot();
    const traceDir = path.join(projectRoot, 'test-results/qa/qa-sanitize/browser/test-case');
    const tracePath = path.join(traceDir, 'trace.zip');
    fs.mkdirSync(traceDir, { recursive: true });
    fs.writeFileSync(tracePath, 'raw-cookie-token-email-phone');

    const summary = sanitizeQaArtifactTree(path.join(projectRoot, 'test-results'), {
      projectRoot,
    });

    expect(summary.removed).toBe(1);
    expect(fs.existsSync(tracePath)).toBe(false);
    expect(fs.readFileSync(`${tracePath}.redacted.txt`, 'utf8')).toContain(
      'Playwright trace archive removed',
    );
  });

  it('@p0 @observability @security refuses artifact paths outside the project root', () => {
    const projectRoot = tempProjectRoot();
    const outsidePath = path.join(os.tmpdir(), `outside-${Date.now()}.log`);
    fs.writeFileSync(outsidePath, 'token=secret', 'utf8');

    expect(() => sanitizeQaArtifactFile(outsidePath, { projectRoot })).toThrow(
      /inside the project root/,
    );
  });
});
