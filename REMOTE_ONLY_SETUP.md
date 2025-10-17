# 🌐 Remote Supabase - Quick Start

## ✅ Your Setup is Remote-Only

No Docker needed! All commands connect directly to your **remote Supabase instance**.

---

## 🚀 Commands (Updated for Remote)

### Reset Everything

```bash
pnpm run db:reset
```

- ✅ Applies all 22 migrations
- ✅ Seeds all data (8 restaurants, 480 customers, 260 bookings)
- ✅ Takes ~60 seconds

### Just Migrations

```bash
pnpm run db:migrate
```

- ✅ Only applies schema changes

### Just Seeds

```bash
pnpm run db:seed-only
```

- ✅ Only populates data

### Full Reset (with logging)

```bash
pnpm run db:full-reset
```

### Wipe Everything ⚠️

```bash
pnpm run db:wipe
```

- Drops public schema completely
- **Use with caution!**

### Verify Seeds

```bash
pnpm run db:verify
```

### Push to Supabase CLI

```bash
pnpm run db:push
```

- Pushes migrations via Supabase CLI

### Pull from Supabase

```bash
pnpm run db:pull
```

- Pulls latest schema from remote

---

## 🔑 Requirements

You need `DATABASE_URL` environment variable set:

```bash
# Check if it's set:
echo $DATABASE_URL

# Should output something like:
# postgresql://user:password@host.supabase.co:5432/postgres
```

---

## ✨ No Docker Needed!

All commands work directly with your remote Supabase instance via:

- ✅ `psql` (PostgreSQL client)
- ✅ `supabase` CLI (optional, for `db:push`)

---

## 📋 Usage Example

```bash
# 1. Reset remote database
pnpm run db:reset

# 2. Verify it worked
pnpm run db:verify

# 3. Done! Ready to develop
```

---

**Everything is now remote-only and Docker-free!** 🎉
