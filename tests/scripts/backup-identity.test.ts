import { describe, expect, it } from 'vitest';

import { assertBackupIdentity, BackupIdentityError } from '../../scripts/db/backup/identity';

const PROD_REF = 'vrdiqfudmwydclqpydee';
const GOOD_URL = `postgresql://nabatable_backup:s3cret-backup@db.${PROD_REF}.supabase.co:5432/postgres`;

describe('assertBackupIdentity', () => {
  it('accepts a dedicated backup role on the expected project', () => {
    const identity = assertBackupIdentity(
      { DB_BACKUP_ROLE_URL: GOOD_URL },
      { expectedProjectRef: PROD_REF },
    );
    expect(identity).toEqual({
      user: 'nabatable_backup',
      host: `db.${PROD_REF}.supabase.co`,
      database: 'postgres',
      projectRef: PROD_REF,
    });
  });

  it('refuses when the identity env is missing', () => {
    expect(() => assertBackupIdentity({})).toThrow(BackupIdentityError);
    expect(() => assertBackupIdentity({})).toThrow(/DB_BACKUP_ROLE_URL is not set/);
  });

  it.each([
    ['postgres', `postgresql://postgres:pw@db.${PROD_REF}.supabase.co/postgres`],
    [
      'pooler postgres',
      `postgresql://postgres.${PROD_REF}:pw@aws-0-eu.pooler.supabase.com/postgres`,
    ],
    ['service_role', `postgresql://service_role:pw@db.${PROD_REF}.supabase.co/postgres`],
    ['supabase_admin', `postgresql://supabase_admin:pw@db.${PROD_REF}.supabase.co/postgres`],
    ['anything admin-like', `postgresql://backup_admin:pw@db.${PROD_REF}.supabase.co/postgres`],
    ['service-like', `postgresql://backup_service:pw@db.${PROD_REF}.supabase.co/postgres`],
    ['non-backup role', `postgresql://reporting_ro:pw@db.${PROD_REF}.supabase.co/postgres`],
  ])('refuses %s identities', (_label, url) => {
    expect(() => assertBackupIdentity({ DB_BACKUP_ROLE_URL: url })).toThrow(BackupIdentityError);
  });

  it('refuses a URL without a password (no ambient auth)', () => {
    expect(() =>
      assertBackupIdentity({
        DB_BACKUP_ROLE_URL: `postgresql://nabatable_backup@db.${PROD_REF}.supabase.co/postgres`,
      }),
    ).toThrow(/no password/);
  });

  it('refuses when the URL equals or shares a secret with deploy credentials', () => {
    expect(() =>
      assertBackupIdentity({ DB_BACKUP_ROLE_URL: GOOD_URL, DATABASE_URL: GOOD_URL }),
    ).toThrow(/matches deployment credential DATABASE_URL/);
    expect(() =>
      assertBackupIdentity({ DB_BACKUP_ROLE_URL: GOOD_URL, SUPABASE_DB_PASSWORD: 's3cret-backup' }),
    ).toThrow(/shares a secret/);
    expect(() =>
      assertBackupIdentity({
        DB_BACKUP_ROLE_URL: GOOD_URL,
        SUPABASE_DB_URL: `postgresql://nabatable_backup:other@db.${PROD_REF}.supabase.co/postgres`,
      }),
    ).toThrow(/reuses the user/);
  });

  it('refuses a URL that targets a different project than expected', () => {
    expect(() =>
      assertBackupIdentity(
        { DB_BACKUP_ROLE_URL: GOOD_URL },
        { expectedProjectRef: 'ndxmivcrehsacuerwxtm' },
      ),
    ).toThrow(/expected Supabase project ref/);
  });

  it('never leaks the URL or password in error messages', () => {
    try {
      assertBackupIdentity({ DB_BACKUP_ROLE_URL: GOOD_URL, DATABASE_URL: GOOD_URL });
      throw new Error('expected refusal');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('s3cret-backup');
      expect(message).not.toContain('postgresql://');
    }
  });
});
