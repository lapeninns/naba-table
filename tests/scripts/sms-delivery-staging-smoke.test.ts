import { afterEach, describe, expect, it } from 'vitest';

import {
  buildStagingSmokeCallbackUrl,
  isConcreteHttpUrl,
  parseStagingSmokeArgs,
  resolveStagingSmokeUrlTemplate,
  shouldRunPreviewAuditBeforeSmokeSend,
} from '@/scripts/sms-delivery-staging-smoke';

const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
}

describe('staging SMS smoke helpers', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('defaults to staging dry-run without a recipient', () => {
    expect(parseStagingSmokeArgs([])).toEqual({
      target: 'staging',
      send: false,
      to: null,
      body: 'Nabatable staging SMS delivery smoke test.',
      callbackBaseUrl: null,
      skipPulledEnvFiles: false,
      skipLocalEnvFiles: false,
      requirePreviewAudit: false,
    });
  });

  it('rejects non-staging targets', () => {
    expect(() => parseStagingSmokeArgs(['--target', 'production'])).toThrow(
      'Only --target staging is supported for SMS delivery smoke tests.',
    );
  });

  it('parses explicit send inputs', () => {
    expect(
      parseStagingSmokeArgs([
        '--target=staging',
        '--send',
        '--to',
        '+447700900000',
        '--body',
        'Smoke',
        '--callback-base-url=https://preview.example.com',
        '--skip-pulled-env-files',
        '--skip-local-env-files',
        '--require-preview-audit',
      ]),
    ).toEqual({
      target: 'staging',
      send: true,
      to: '+447700900000',
      body: 'Smoke',
      callbackBaseUrl: 'https://preview.example.com',
      skipPulledEnvFiles: true,
      skipLocalEnvFiles: true,
      requirePreviewAudit: true,
    });
  });

  it('resolves Vercel URL templates only when VERCEL_URL is concrete', () => {
    process.env.VERCEL_URL = 'preview.example.com';
    expect(resolveStagingSmokeUrlTemplate('https://${VERCEL_URL}')).toBe(
      'https://preview.example.com',
    );

    process.env.VERCEL_URL = '${VERCEL_URL}';
    expect(resolveStagingSmokeUrlTemplate('https://${VERCEL_URL}')).toBe('https://${VERCEL_URL}');
  });

  it('requires concrete HTTP URLs before building callback URLs', () => {
    expect(isConcreteHttpUrl('https://preview.example.com')).toBe(true);
    expect(isConcreteHttpUrl('https://${VERCEL_URL}')).toBe(false);
    expect(buildStagingSmokeCallbackUrl('https://preview.example.com')).toBe(
      'https://preview.example.com/api/webhook/twilio/sms-status',
    );
  });

  it('requires the Preview audit only for unblocked live sends', () => {
    expect(
      shouldRunPreviewAuditBeforeSmokeSend({
        send: false,
        requirePreviewAudit: true,
        blockers: [],
      }),
    ).toBe(false);
    expect(
      shouldRunPreviewAuditBeforeSmokeSend({
        send: true,
        requirePreviewAudit: false,
        blockers: [],
      }),
    ).toBe(false);
    expect(
      shouldRunPreviewAuditBeforeSmokeSend({
        send: true,
        requirePreviewAudit: true,
        blockers: ['staging env missing: TWILIO_AUTH_TOKEN'],
      }),
    ).toBe(false);
    expect(
      shouldRunPreviewAuditBeforeSmokeSend({
        send: true,
        requirePreviewAudit: true,
        blockers: [],
      }),
    ).toBe(true);
  });
});
