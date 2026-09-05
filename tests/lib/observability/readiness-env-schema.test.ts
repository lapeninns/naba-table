import { describe, expect, it } from 'vitest';

import { envSchemas } from '@/config/env.schema';

const baseTestEnv = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
} as const;

function issuePaths(result: ReturnType<typeof envSchemas.test.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('env schema readiness variables', () => {
  it('accepts the optional monitoring and build identity variables', () => {
    for (const schema of [envSchemas.test, envSchemas.development]) {
      const result = schema.safeParse({
        ...baseTestEnv,
        MONITORING_TOKEN: 'm'.repeat(32),
        NABATABLE_SOURCE_REVISION: '0123456789abcdef0123456789abcdef01234567',
        NABATABLE_BUILD_ID: 'dpl_ABC123',
      });
      expect(issuePaths(result)).toEqual([]);
      expect(result.success).toBe(true);
    }
  });

  it('treats all three variables as optional', () => {
    const result = envSchemas.test.safeParse(baseTestEnv);
    expect(issuePaths(result)).toEqual([]);
    if (result.success) {
      expect(result.data.MONITORING_TOKEN).toBeUndefined();
      expect(result.data.NABATABLE_SOURCE_REVISION).toBeUndefined();
      expect(result.data.NABATABLE_BUILD_ID).toBeUndefined();
    }
  });

  it('rejects short monitoring tokens and non-hex source revisions', () => {
    expect(
      issuePaths(envSchemas.test.safeParse({ ...baseTestEnv, MONITORING_TOKEN: 'short' })),
    ).toContain('MONITORING_TOKEN');
    expect(
      issuePaths(
        envSchemas.test.safeParse({ ...baseTestEnv, NABATABLE_SOURCE_REVISION: 'not a sha' }),
      ),
    ).toContain('NABATABLE_SOURCE_REVISION');
    expect(
      issuePaths(envSchemas.test.safeParse({ ...baseTestEnv, NABATABLE_BUILD_ID: '' })),
    ).toContain('NABATABLE_BUILD_ID');
  });
});
