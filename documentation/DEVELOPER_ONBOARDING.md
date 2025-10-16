# SajiloReserveX - Developer Onboarding Guide

**Version:** 1.0  
**Date:** 2025-01-15  
**Estimated Onboarding Time:** 4-8 hours

---

## Welcome! 👋

This guide will help you get up and running with the SajiloReserveX codebase. By the end, you'll be able to run the application locally, understand the architecture, and make your first contribution.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Code Standards](#code-standards)
6. [Testing Guide](#testing-guide)
7. [Debugging Tips](#debugging-tips)
8. [Common Tasks](#common-tasks)
9. [Getting Help](#getting-help)

---

## Prerequisites

### Required Tools

✅ **Install these before starting:**

| Tool    | Version  | Purpose              | Installation                                           |
| ------- | -------- | -------------------- | ------------------------------------------------------ |
| Node.js | 20.11.0+ | Runtime              | [nodejs.org](https://nodejs.org)                       |
| pnpm    | 9.0.0+   | Package manager      | `npm install -g pnpm`                                  |
| Git     | 2.30+    | Version control      | [git-scm.com](https://git-scm.com)                     |
| VS Code | Latest   | Editor (recommended) | [code.visualstudio.com](https://code.visualstudio.com) |

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "firsttris.vscode-jest-runner",
    "ms-playwright.playwright",
    "bierner.markdown-mermaid"
  ]
}
```

### Account Setup

You'll need accounts for:

- **GitHub:** Access to repository
- **Supabase:** Database and auth (production/staging)
- **Vercel:** Deployment platform (optional for dev)

---

## Initial Setup

### Step 1: Clone the Repository

```bash
# Clone the repo
git clone https://github.com/your-org/SajiloReserveX.git
cd SajiloReserveX

# Create your feature branch
git checkout -b feature/your-name-initial-setup
```

### Step 2: Install Dependencies

```bash
# Install all dependencies (this may take 2-5 minutes)
pnpm install

# Verify installation
pnpm --version  # Should be 9.0.0+
node --version  # Should be v20.11.0+
```

### Step 3: Environment Configuration

```bash
# Copy the example environment file
cp .env.local.example .env.local

# Open .env.local in your editor
code .env.local
```

**Required Environment Variables:**

```bash
# Supabase (get from Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Email (Resend) - Optional for local dev
RESEND_API_KEY=your-resend-key

# Rate Limiting (Upstash Redis) - Optional for local dev
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Feature Flags
NEXT_PUBLIC_FEATURE_PAST_TIME_BLOCKING=true
NEXT_PUBLIC_FEATURE_PAST_TIME_GRACE_MINUTES=15
```

**Getting Supabase Credentials:**

1. Go to [supabase.com](https://supabase.com)
2. Create a new project or use existing
3. Go to Settings → API
4. Copy `URL` and `anon public` key
5. Copy `service_role` key (keep this secret!)

### Step 4: Database Setup

```bash
# Verify Supabase connection
pnpm db:status

# If using local Supabase (optional, not recommended):
# pnpm db:start
# pnpm db:reset

# Push migrations to remote database
pnpm db:push

# Seed development data (optional)
# pnpm db:seed
```

### Step 5: Validate Setup

```bash
# Run type check
pnpm typecheck

# Run linter
pnpm lint

# Run unit tests
pnpm test

# If all pass, you're ready! ✅
```

### Step 6: Start Development Server

```bash
# Start Next.js dev server
pnpm dev

# Server starts at http://localhost:3000
# Open browser and verify homepage loads
```

**Expected Output:**

```
✓ Ready in 2.5s
✓ Local: http://localhost:3000
```

**Verify Core Routes:**

- ✅ http://localhost:3000 - Homepage
- ✅ http://localhost:3000/browse - Restaurant list
- ✅ http://localhost:3000/signin - Sign in page
- ✅ http://localhost:3000/ops - Ops dashboard (requires auth)

---

## Project Structure

### High-Level Overview

```
SajiloReserveX/
├── src/                    # Main Next.js application
│   ├── app/               # App Router pages and API routes
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and helpers
│   └── types/            # TypeScript type definitions
├── server/                # Server-side business logic
│   ├── bookings/         # Booking services
│   ├── restaurants/      # Restaurant services
│   ├── auth/             # Authentication logic
│   └── security/         # Security utilities
├── reserve/               # Separate Vite app (booking widget)
├── tests/                 # End-to-end tests (Playwright)
├── supabase/             # Database migrations
├── public/               # Static assets
└── docs/                 # Documentation
```

### Key Directories

#### `/src/app` - Next.js App Router

```
src/app/
├── page.tsx                          # Homepage
├── (authed)/                         # Authenticated routes group
│   ├── my-bookings/page.tsx         # User's bookings
│   └── profile/manage/page.tsx      # Profile management
├── (ops)/ops/                        # Operations dashboard group
│   ├── (app)/                       # Authenticated ops routes
│   │   ├── page.tsx                 # Ops dashboard
│   │   ├── bookings/page.tsx        # Booking management
│   │   ├── team/page.tsx            # Team management
│   │   └── restaurant-settings/     # Settings
│   └── (public)/login/page.tsx      # Ops login
├── api/                              # API routes
│   ├── bookings/route.ts            # Booking CRUD
│   ├── restaurants/route.ts         # Restaurant list
│   ├── ops/                         # Operations API
│   ├── owner/                       # Owner API
│   └── v1/                          # Versioned API
├── reserve/r/[slug]/page.tsx        # Restaurant booking page
└── signin/page.tsx                   # Sign in page
```

#### `/src/components` - React Components

```
src/components/
├── features/              # Feature-specific components
│   ├── bookings/         # Booking management
│   ├── dashboard/        # Dashboard widgets
│   ├── team/             # Team management
│   └── customers/        # Customer components
├── marketing/            # Marketing/landing page components
├── auth/                 # Authentication components
├── profile/              # Profile components
├── reserve/              # Booking flow components
└── ui/                   # UI primitives (shadcn/ui)
    ├── button.tsx
    ├── input.tsx
    ├── dialog.tsx
    └── ...
```

#### `/server` - Business Logic

```
server/
├── bookings.ts                      # Core booking logic
├── bookings/
│   ├── confirmation-token.ts        # Token management
│   ├── pastTimeValidation.ts        # Past time checks
│   └── timeValidation.ts            # Operating hours
├── customers.ts                     # Customer management
├── restaurants/
│   ├── list.ts                      # List restaurants
│   ├── schedule.ts                  # Schedule resolution
│   ├── operatingHours.ts            # Hours management
│   └── servicePeriods.ts            # Period management
├── loyalty.ts                       # Loyalty program logic
├── team/
│   ├── access.ts                    # RBAC logic
│   └── invitations.ts               # Invitation management
└── security/
    ├── rate-limit.ts                # Rate limiting
    ├── guest-lookup.ts              # Guest hash lookup
    └── request.ts                   # Request utilities
```

### File Naming Conventions

| Type             | Convention                  | Example            |
| ---------------- | --------------------------- | ------------------ |
| React Components | PascalCase                  | `BookingForm.tsx`  |
| Utilities        | camelCase                   | `formatDate.ts`    |
| Hooks            | camelCase with `use` prefix | `useBookings.ts`   |
| API Routes       | lowercase                   | `route.ts`         |
| Test Files       | Same as source + `.test`    | `bookings.test.ts` |
| Types            | PascalCase                  | `BookingRecord`    |

---

## Development Workflow

### Branch Strategy

**Branch Naming:**

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation
- `test/description` - Test improvements

**Example:**

```bash
git checkout -b feature/add-booking-filters
```

### Making Changes

1. **Create a branch** from `main`
2. **Make your changes** with frequent commits
3. **Write tests** for new functionality
4. **Run checks** before committing
5. **Push and open PR** when ready

### Pre-Commit Checks

**Automated (Husky):**

```bash
# These run automatically on git commit:
- ESLint check
- Prettier format
- Type check (TypeScript)
```

**Manual Checks:**

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Unit tests
pnpm test

# E2E tests (critical flows only for local)
pnpm test:e2e:smoke
```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation
- `test:` Testing
- `chore:` Maintenance

**Examples:**

```bash
git commit -m "feat(bookings): add past time validation"
git commit -m "fix(ops): resolve dashboard loading state"
git commit -m "docs(api): update booking endpoint documentation"
```

### Pull Request Process

1. **Create PR** on GitHub
2. **Fill out template** (auto-populated)
3. **Request review** from 1-2 team members
4. **Address feedback** if any
5. **Merge** when approved and CI passes

**PR Checklist:**

- [ ] Tests pass locally
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Documentation updated (if applicable)
- [ ] Accessibility verified (if UI changes)

---

## Code Standards

### TypeScript Guidelines

**1. Use Strict Mode**

```typescript
// tsconfig.json has strict: true
// Always add explicit types for function parameters and returns

// ✅ Good
function createBooking(data: BookingPayload): Promise<BookingRecord> {
  // ...
}

// ❌ Bad
function createBooking(data: any) {
  // ...
}
```

**2. Use Type Inference Where Appropriate**

```typescript
// ✅ Good - Type inferred from return
const bookings = await fetchBookings();

// ❌ Bad - Redundant type annotation
const bookings: BookingRecord[] = await fetchBookings();
```

**3. Prefer Interfaces for Objects**

```typescript
// ✅ Good
interface BookingFormData {
  date: string;
  time: string;
  party: number;
}

// ❌ Bad (use interface instead)
type BookingFormData = {
  date: string;
  time: string;
  party: number;
};
```

---

### React Component Guidelines

**1. Use Server Components by Default**

```typescript
// ✅ Good - Server Component (default)
export default async function BookingsPage() {
  const bookings = await fetchBookings();
  return <BookingList bookings={bookings} />;
}
```

**2. Mark Client Components Explicitly**

```typescript
// ✅ Good - Explicit 'use client'
'use client';

export function BookingForm() {
  const [data, setData] = useState({});
  // ...
}
```

**3. Extract Complex Logic to Hooks**

```typescript
// ✅ Good - Custom hook
function useBookingForm() {
  const [data, setData] = useState({});
  const mutation = useMutation(/* ... */);
  return { data, setData, mutation };
}

function BookingForm() {
  const { data, setData, mutation } = useBookingForm();
  // ...
}
```

**4. Use Composition Over Props Drilling**

```typescript
// ✅ Good - Context for shared state
const BookingContext = createContext<BookingState | null>(null);

// ❌ Bad - Props drilling through 5 levels
<Parent data={data}>
  <Child data={data}>
    <GrandChild data={data}>
      {/* ... */}
    </GrandChild>
  </Child>
</Parent>
```

---

### Styling Guidelines

**1. Use Tailwind Utility Classes**

```tsx
// ✅ Good
<div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4">

// ❌ Bad - Inline styles
<div style={{ display: 'flex', gap: '16px' }}>
```

**2. Extract Repeated Patterns to Components**

```tsx
// ✅ Good
<Button variant="primary" size="lg">Save</Button>

// ❌ Bad - Repeated classes
<button className="rounded-lg bg-blue-600 px-6 py-3 text-white">Save</button>
<button className="rounded-lg bg-blue-600 px-6 py-3 text-white">Submit</button>
```

**3. Use cn() Helper for Conditional Classes**

```tsx
import { cn } from '@/lib/utils';

// ✅ Good
<div className={cn('base-class', isActive && 'active-class')} />

// ❌ Bad - String concatenation
<div className={`base-class ${isActive ? 'active-class' : ''}`} />
```

---

### API Route Guidelines

**1. Validate Input with Zod**

```typescript
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
  }
  // ...
}
```

**2. Use Consistent Error Responses**

```typescript
// ✅ Good - Consistent shape
return NextResponse.json(
  {
    error: 'User message',
    code: 'ERROR_CODE',
    details: {
      /* additional info */
    },
  },
  { status: 400 },
);
```

**3. Implement Rate Limiting**

```typescript
const rateResult = await consumeRateLimit({
  identifier: `endpoint:${clientIp}`,
  limit: 60,
  windowMs: 60_000,
});

if (!rateResult.ok) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

---

## Testing Guide

### Unit Testing (Vitest)

**Location:** `__tests__/` or `*.test.ts` files

**Run Tests:**

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test bookings.test.ts

# Run in watch mode
pnpm test:watch

# Run with coverage
pnpm test -- --coverage
```

**Example Test:**

```typescript
// server/__tests__/bookings.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDurationMinutes } from '../bookings';

describe('calculateDurationMinutes', () => {
  it('returns 120 minutes for dinner', () => {
    expect(calculateDurationMinutes('dinner')).toBe(120);
  });

  it('returns 90 minutes for lunch', () => {
    expect(calculateDurationMinutes('lunch')).toBe(90);
  });
});
```

---

### Integration Testing

**Testing API Routes:**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('POST /api/bookings', () => {
  beforeAll(async () => {
    // Setup test data
  });

  it('creates booking with valid data', async () => {
    const response = await fetch('http://localhost:3000/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2025-02-01',
        time: '19:00',
        party: 4,
        // ...
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.booking).toHaveProperty('reference');
  });
});
```

---

### E2E Testing (Playwright)

**Location:** `tests/` directory

**Run Tests:**

```bash
# Run all E2E tests
pnpm test:e2e

# Run in UI mode (recommended for debugging)
pnpm test:e2e:ui

# Run smoke tests only
pnpm test:e2e:smoke

# Update snapshots
pnpm test:e2e:update-snapshots
```

**Example Test:**

```typescript
// tests/booking-flow.spec.ts
import { test, expect } from '@playwright/test';

test('guest can create booking', async ({ page }) => {
  // Navigate to restaurant page
  await page.goto('/reserve/r/bella-vista');

  // Fill booking form
  await page.fill('[name="date"]', '2025-02-01');
  await page.fill('[name="time"]', '19:00');
  await page.selectOption('[name="party"]', '4');
  await page.fill('[name="name"]', 'John Smith');
  await page.fill('[name="email"]', 'john@example.com');
  await page.fill('[name="phone"]', '+44 7700 900123');

  // Submit
  await page.click('button[type="submit"]');

  // Verify confirmation
  await expect(page.locator('text=Booking Confirmed')).toBeVisible();
  await expect(page.locator('[data-testid="booking-reference"]')).toHaveText(/[A-Z0-9]{10}/);
});
```

---

## Debugging Tips

### Next.js Debugging

**1. Enable Debug Mode**

```bash
# Add to .env.local
DEBUG=*
NODE_OPTIONS='--inspect'

# Start dev server
pnpm dev
```

**2. VS Code Launch Configuration**

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    }
  ]
}
```

---

### React DevTools

**Install Extension:**

- Chrome: [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)

**Usage:**

1. Open DevTools (F12)
2. Go to "Components" or "Profiler" tab
3. Inspect component props/state
4. Profile render performance

---

### Database Debugging

**Check Query Performance:**

```sql
-- Enable query logging in Supabase
SELECT * FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

**Inspect RLS Policies:**

```sql
-- Check which policies are active
SELECT * FROM pg_policies
WHERE schemaname = 'public';
```

---

### Common Errors

**Error: "Cannot find module '@/...'"**

```bash
# Solution: Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

**Error: "Hydration failed"**

```typescript
// Cause: Server/client mismatch
// Solution: Ensure server and client render the same HTML

// ✅ Good - Use client component for random data
'use client';
export function RandomNumber() {
  const [num] = useState(Math.random());
  return <div>{num}</div>;
}
```

**Error: "supabase.auth.getUser() returns null"**

```typescript
// Cause: Middleware not refreshing token
// Solution: Ensure middleware.ts is configured correctly

// Check that middleware is running:
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Common Tasks

### Task 1: Add a New API Endpoint

**Steps:**

1. Create route file: `src/app/api/my-endpoint/route.ts`
2. Define validation schema with Zod
3. Implement GET/POST handler
4. Add service function in `server/`
5. Write tests
6. Update API documentation

**Example:**

```typescript
// src/app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Call service function
  const result = await myService(parsed.data);

  return NextResponse.json(result);
}
```

---

### Task 2: Add a New UI Component

**Steps:**

1. Create component file: `src/components/features/my-feature/MyComponent.tsx`
2. Use shadcn/ui primitives where possible
3. Add proper TypeScript types
4. Implement accessibility (ARIA labels, keyboard nav)
5. Write Storybook story (if using)
6. Test with keyboard-only navigation

**Template:**

```typescript
// src/components/features/my-feature/MyComponent.tsx
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <button
        onClick={onAction}
        className="mt-2 rounded bg-primary px-4 py-2 text-white"
        aria-label="Perform action"
      >
        Action
      </button>
    </div>
  );
}
```

---

### Task 3: Add Database Migration

**Steps:**

1. Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Write SQL (CREATE TABLE, ALTER TABLE, etc.)
3. Test locally (if using local Supabase)
4. Push to remote: `pnpm db:push`
5. Update TypeScript types: Supabase auto-generates

**Example:**

```sql
-- supabase/migrations/20250115120000_add_notes_to_bookings.sql

-- Add notes column
ALTER TABLE bookings
ADD COLUMN internal_notes TEXT;

-- Add index if needed
CREATE INDEX idx_bookings_internal_notes ON bookings(internal_notes)
WHERE internal_notes IS NOT NULL;
```

---

### Task 4: Update Environment Variables

**Steps:**

1. Add to `.env.local.example` (with placeholder)
2. Add to your `.env.local` (with real value)
3. Update `lib/env.ts` (if using env validation)
4. Update deployment (Vercel/similar)
5. Document in `DEVELOPER_ONBOARDING.md`

---

## Getting Help

### Internal Resources

📚 **Documentation:**

- `IMPLEMENTED_FEATURES.md` - Feature catalog
- `FEATURES_SUMMARY.md` - Quick reference
- `USER_JOURNEY_FLOWCHARTS.md` - User flows
- `SYSTEM_ARCHITECTURE.md` - System design
- `DATABASE_SCHEMA.md` - Database docs
- `API_INTEGRATION_GUIDE.md` - API docs

💬 **Communication:**

- Slack: `#engineering` channel
- GitHub Discussions: Ask questions
- Wiki: Team knowledge base

🐛 **Issue Tracking:**

- GitHub Issues: Bug reports and features
- Project Board: Sprint planning

---

### External Resources

**Next.js:**

- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)

**React:**

- [React Documentation](https://react.dev)
- [React Server Components](https://react.dev/reference/rsc/server-components)

**Supabase:**

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)

**TypeScript:**

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

**Tailwind CSS:**

- [Tailwind Documentation](https://tailwindcss.com/docs)
- [Tailwind UI Components](https://tailwindui.com)

---

## Checklist: First Week Goals

### Day 1-2: Environment Setup

- [ ] Clone repository
- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Run development server
- [ ] Verify all core routes load

### Day 3-4: Code Exploration

- [ ] Read architecture documentation
- [ ] Explore project structure
- [ ] Run test suite
- [ ] Debug a test failure (intentionally introduce one)
- [ ] Review 3-5 key components

### Day 5: First Contribution

- [ ] Pick a "good first issue" from GitHub
- [ ] Create feature branch
- [ ] Implement fix/feature
- [ ] Write tests
- [ ] Open pull request

---

## Next Steps

After completing onboarding:

1. **Join Standup:** Attend daily team sync
2. **Pick a Task:** Choose from sprint backlog
3. **Pair Program:** Shadow a senior developer
4. **Review PRs:** Learn by reviewing others' code
5. **Ask Questions:** Don't hesitate to reach out!

---

**Welcome to the team! 🎉**

If you have any questions or run into issues during onboarding, please reach out in the `#engineering` Slack channel or create a GitHub Discussion.

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Maintained By:** Engineering Team  
**Feedback:** engineering@sajiloreservex.com
