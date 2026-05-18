import { describe, expect, it } from 'vitest';

import {
  allowsBuiltInOnlySecretScan,
  redactSecretSnippet,
  scanSecretText,
} from '@/scripts/qa/secret-scan';

describe('secret scan fallback', () => {
  it('detects high-confidence secrets in text', () => {
    const findings = scanSecretText(
      "const key = 'sk-proj-' + 'abcdefghijklmnopqrstuvwxyz1234567890';".replace("' + '", ''),
      'config.ts',
    );

    expect(findings).toEqual([
      expect.objectContaining({
        file: 'config.ts',
        line: 1,
        rule: 'openai-api-key',
      }),
    ]);
  });

  it('ignores obvious placeholder examples', () => {
    expect(
      scanSecretText(
        'OPENAI_API_KEY=sk-proj-example-placeholder-abcdefghijklmnopqrstuvwxyz',
        '.env.example',
      ),
    ).toEqual([]);
  });

  it('@p1 @security does not ignore real-looking secrets because nearby prose says test', () => {
    const findings = scanSecretText(
      "OPENAI_API_KEY='sk-proj-abcdefghijklmnopqrstuvwxyz1234567890' # test credential",
      'config.ts',
    );

    expect(findings).toEqual([
      expect.objectContaining({
        file: 'config.ts',
        line: 1,
        rule: 'openai-api-key',
      }),
    ]);
  });

  it('redacts matched snippets before printing', () => {
    const value = 'OPENAI_API_KEY=sk-proj-' + 'abcdefghijklmnopqrstuvwxyz';
    expect(redactSecretSnippet(value, 'openai')).toBe('[redacted:openai]');
  });

  it('requires an explicit opt-in for built-in-only scanner runs', () => {
    expect(allowsBuiltInOnlySecretScan({})).toBe(false);
    expect(allowsBuiltInOnlySecretScan({ SECRET_SCAN_ALLOW_BUILT_IN_ONLY: 'false' })).toBe(false);
    expect(allowsBuiltInOnlySecretScan({ SECRET_SCAN_ALLOW_BUILT_IN_ONLY: 'true' })).toBe(true);
  });
});
