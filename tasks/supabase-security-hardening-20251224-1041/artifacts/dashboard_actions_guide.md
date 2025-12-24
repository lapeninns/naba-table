# Supabase Dashboard Actions Guide

This document provides step-by-step instructions for security actions that must be performed through the Supabase Dashboard (cannot be automated via SQL).

---

## 1. Enable Leaked Password Protection (HaveIBeenPwned)

### Why This Matters

Enabling leaked password protection prevents users from signing up or changing their password to one that has been exposed in known data breaches. This significantly reduces the risk of account compromise.

### Steps

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Navigate to Auth Settings**
   - Click **Authentication** in the left sidebar
   - Click **Settings** (or **Auth Settings** depending on Dashboard version)

3. **Find Password Security Section**
   - Scroll to the **Security** or **Password** section
   - Look for "Password Strength" or "Leaked Password Protection"

4. **Enable the Setting**
   - Toggle ON: **"Enable HaveIBeenPwned password checking"**
   - Or: **"Reject passwords found in data breaches"**

5. **Save Changes**
   - Click **Save** button
   - Wait for confirmation

### Verification

Test with a known compromised password:

- Try to sign up with password: `password123` or `qwerty123`
- The signup should FAIL with an error like "Password has been found in a data breach"

---

## 2. Upgrade PostgreSQL Version

### Why This Matters

Your current version `supabase-postgres-17.4.1.075` has outstanding security patches. Upgrading ensures you're protected against known vulnerabilities.

### Pre-Upgrade Checklist

- [ ] Review release notes for the new version
- [ ] Ensure recent backup exists (Supabase PITR is automatic)
- [ ] Schedule maintenance window (upgrade causes brief downtime)
- [ ] Notify team/users of planned maintenance

### Steps

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Navigate to Project Settings**
   - Click **Project Settings** (gear icon) in the left sidebar
   - Click **Infrastructure** or **Database**

3. **Find Postgres Version**
   - Look for the **PostgreSQL Version** section
   - You should see an **Upgrade Available** notice

4. **Review Upgrade Details**
   - Click on the upgrade notice or button
   - Review what changes are included
   - Note the expected downtime (usually 5-15 minutes)

5. **Initiate Upgrade**
   - Click **Upgrade** or **Start Upgrade**
   - Confirm the action
   - Wait for the upgrade to complete

6. **Monitor Progress**
   - The Dashboard will show upgrade status
   - Do NOT close the browser or navigate away
   - Wait for "Upgrade Complete" confirmation

### Post-Upgrade Verification

1. **Check New Version**
   - Refresh the Infrastructure page
   - Confirm new version is displayed

2. **Test Database Connectivity**
   - Run a simple query in SQL Editor:

   ```sql
   SELECT version();
   ```

3. **Run Application Smoke Tests**
   - Create a booking
   - View bookings list
   - Check dashboard functionality

4. **Re-run Database Linter**
   - Go to **Database** → **Linter**
   - Confirm the "vulnerable_postgres_version" warning is gone

### Rollback

If issues occur after upgrade:

- Supabase maintains PITR (Point-in-Time Recovery)
- Contact Supabase Support for rollback assistance
- Rollback may not be automatic - plan for forward fixes

---

## 3. Additional Security Recommendations

### Enable MFA for Admin Accounts

- Go to **Settings** → **Account**
- Enable Two-Factor Authentication
- Use an authenticator app (not SMS)

### Review API Keys

- Go to **Settings** → **API**
- Rotate `anon` and `service_role` keys if they may have been exposed
- Ensure `service_role` key is NEVER exposed to clients

### Enable Database Logging

- Go to **Database** → **Logs**
- Enable query logging for audit purposes (note: may impact performance)

### Check RLS Policies

- Go to **Database** → **Tables**
- Ensure all tables have appropriate Row Level Security policies

---

## Quick Reference

| Action                          | Location                  | Risk   | Downtime          |
| ------------------------------- | ------------------------- | ------ | ----------------- |
| Enable Password Leak Protection | Auth → Settings           | None   | None              |
| Upgrade Postgres                | Settings → Infrastructure | Low    | 5-15 min          |
| Rotate API Keys                 | Settings → API            | Medium | App update needed |
| Enable MFA                      | Account Settings          | None   | None              |
