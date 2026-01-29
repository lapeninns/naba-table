# Local Development Setup

Last updated: 2026-01-29

## Prerequisites

- Node.js 20+ (LTS recommended)
- pnpm 9+ (`npm install -g pnpm`)
- Git 2.40+
- VS Code (recommended) or compatible editor

## Quick Start

```bash
# Clone and setup (single command)
./scripts/setup.sh

# Or manually:
pnpm install
cp .env.example .env.local
# Edit .env.local with your credentials
pnpm dev
```

## Environment Configuration

### Required Environment Variables

| Variable                    | Description               | Where to Get                        |
| --------------------------- | ------------------------- | ----------------------------------- |
| `SUPABASE_URL`              | Supabase project URL      | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY`         | Supabase anonymous key    | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard → Settings → API |

### Optional Variables

| Variable                  | Description                                   | Default |
| ------------------------- | --------------------------------------------- | ------- |
| `RESEND_API_KEY`          | Email service (dev emails skipped if missing) | -       |
| `SENTRY_DSN`              | Error tracking (disabled if missing)          | -       |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics (disabled if missing)               | -       |

## Database Access

### Remote-Only Architecture

**Important**: This project uses **Supabase remote-only** architecture. There is no local database setup.

- **Development**: Uses shared staging database (`nabatable-pre-staging`)
- **Production**: Uses production database (`nabatable`)

### Why No Local Database?

1. **Consistency**: All developers work against the same schema
2. **Real-time**: Supabase Realtime features require hosted instance
3. **RLS Policies**: Row-Level Security tested against actual policies
4. **Simplicity**: No local PostgreSQL/Docker required for basic development

### Database Operations

```bash
# Check schema drift against production
pnpm db:check-drift

# View current migrations
supabase migration list --linked

# Create new migration (staging first!)
supabase migration new <name>
```

### Connecting to Databases

```bash
# Link to staging
supabase link --project-ref <staging-ref>

# Link to production (requires approval)
supabase link --project-ref vrdiqfudmwydclqpydee
```

## Development Server

```bash
# Start development server
pnpm dev

# Start with Turbopack (faster HMR)
pnpm dev --turbo
```

The app will be available at `http://localhost:3000`

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run specific test file
pnpm test path/to/test.ts
```

## Code Quality

```bash
# Lint code
pnpm lint

# Type check
pnpm typecheck

# Find dead code
pnpm lint:knip

# Find duplicate code
pnpm lint:jscpd

# Check large files
pnpm lint:large-files
```

## Common Tasks

### Adding a Component

1. Check Shadcn UI first: `pnpm dlx shadcn@latest add <component>`
2. If custom needed, place in `src/components/features/<feature>/`
3. Export from feature index

### Creating an API Route

1. Create file in `src/app/api/<path>/route.ts`
2. Use Zod for request validation
3. Add tests in `*.test.ts`

### Database Changes

1. Create migration: `supabase migration new <name>`
2. Test on staging first
3. Document in `docs/DATABASE_MIGRATIONS.md`
4. Apply to production in change window

## Troubleshooting

### "Module not found" errors

```bash
pnpm install
rm -rf .next
pnpm dev
```

### Type errors after pull

```bash
pnpm typecheck
# If new types needed:
supabase gen types typescript --linked > types/database.types.ts
```

### Supabase connection issues

1. Check `.env.local` has correct credentials
2. Verify project is active in Supabase Dashboard
3. Check VPN/firewall isn't blocking connections

## Editor Setup

### VS Code Extensions (Recommended)

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

### VS Code Settings

The `.vscode/settings.json` configures:

- Format on save with Prettier
- ESLint auto-fix
- Tailwind CSS class sorting

## DevContainer

For consistent development environments, use the DevContainer:

```bash
# Open in VS Code with DevContainers extension
code .
# Command Palette → "Reopen in Container"
```

The DevContainer includes:

- Node.js 20
- pnpm
- Docker-in-Docker
- All VS Code extensions pre-installed

## Related Documentation

- [Architecture Overview](./architecture.md)
- [Testing Guide](./testing.md)
- [Routing Overview](./routing-overview.md)
