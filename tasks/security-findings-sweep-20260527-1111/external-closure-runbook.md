# External Closure Runbook

This runbook is for the findings that cannot be closed from source code alone. Do not paste secrets, passwords, access tokens, or raw scanner output containing secrets into this task packet.

## Supabase DB Credential Rotation

Purpose: close historical Supabase DB credential exposure findings after code has removed or redacted tracked plaintext credentials.

Required evidence:

- Target environment: staging or production.
- Target project ref.
- Rotation timestamp.
- Operator or change-ticket reference.
- Confirmation that application runtime env stores were updated.
- Confirmation that old DB credentials no longer authenticate.
- Smoke-test evidence after redeploy or service restart.

Recommended sequence:

1. Confirm target project ref and environment before any write.
2. Schedule production rotation in a change window; staging can be rotated first.
3. Generate or set the new database password in Supabase.
4. Update all runtime env stores that hold DB connection strings or database passwords, including Vercel project envs, local deployment secrets, and any job runner secrets.
5. Redeploy or restart services that use persistent DB connections.
6. Verify application health and a privileged read path using the new credential.
7. Verify the old credential fails authentication.
8. Attach redacted evidence to this task or the deployment ticket.

## Seeded/Test/Staff Account Rotation

Purpose: close historical seeded account and staff import credential exposure findings.

Required evidence:

- Affected script or seed source.
- Target environment.
- User/account count reviewed.
- Rotation, disablement, or deletion action taken.
- Session invalidation or forced reset evidence where applicable.
- Auth audit log or admin-console reference.

Recommended sequence:

1. Identify accounts created or modified by historical staff import or seed scripts.
2. Separate production users from staging/test users.
3. For real staff accounts, force password reset or magic-link-only re-enrollment and revoke active sessions if supported.
4. For obsolete seeded/test accounts, disable or delete accounts after confirming they are not used by automation.
5. Remove or rotate any shared seed passwords in external secret stores.
6. Attach redacted evidence.

## Scanner Rerun Or Accepted Gap

Purpose: scanner findings must not be marked closed from local tests alone.

Acceptable closure evidence:

- Rerun the same Codex Security/deepsec scanner profile that produced the local `.deepsec/findings/**` paths and attach the new result summary.
- Or attach an explicit accepted not-rerun risk record that names the scanner profile, reason not rerun, and owner accepting that local tests are not scanner closure.

Do not mark any matrix row as scanner-closed until one of those evidence records exists.
