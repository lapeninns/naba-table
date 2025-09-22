Multi-step approach to Context Engineering
0. Tasks
• Operating on a task basis. Store all intermediate context in markdown files in tasks/<task-id>/ folders.
• Use semantic task id slugs
1. Research
• Find existing patterns in this codebase
• Search internet if relevant
• Start by asking follow up questions to set the direction of research
• Report findings in research.md file
2. Planning
• Read the research.md in tasks for <task-id>.
• Based on the research come up with a plan for implementing the user request. We should reuse existing patterns, components and code where possible.
• If needed, ask clarifying questions to user to understand the scope of the task
• Write the comprehensive plan to plan.md. The plan should include all context required for an engineer to implement the feature.
3. Implementation
a. Read. plan.md and create a todo-list with all items, then execute on the plan.
b. Go for as long as possible. If ambiguous, leave all questions to the end and group them.
4. Verification - Create feedback loops to test that the plan was implemented correctly (models still occasionally fail on execution)


# AGENTS.md

> A practical playbook for humans and coding agents working on this repo.

## TL;DR

Stack: **Next.js (App Router)** • **Tailwind CSS** • **shadcn/ui** • **Supabase (Postgres + Auth magic links)** • **Stripe** • **Resend (email)**.

* **Auth**: Magic-link sign‑in via **Supabase Auth**. Emails delivered by **Resend** (configure Resend SMTP in Supabase) or send via Resend API for other transactional emails.
* **DB**: Supabase Postgres with **Row Level Security (RLS)**.
* **Payments**: Stripe Checkout + Webhooks.
* **UI/UX**: Tailwind + shadcn/ui components; accessible-by-default patterns.

---

## How to use AGENTS.md

1. **Add `AGENTS.md`**
   Create an `AGENTS.md` file at the repo root. Most coding agents can scaffold one for you.

2. **Cover what matters**
   Include sections that help an agent work effectively: **Project overview**, **build/test commands**, **code style**, **testing instructions**, **security considerations**.

3. **Add extra instructions**
   Commit/PR guidelines, deployment steps, large datasets, and any “tribal knowledge” you’d tell a new teammate.

4. **Large monorepo? Use nested `AGENTS.md` files**
   Put another `AGENTS.md` in each package. Agents read the *nearest* one in the tree so subprojects can ship tailored instructions. (E.g., the OpenAI repo uses many `AGENTS.md` files.)

> This root file also ships a **template** for subprojects—see **Appendix A**.

---

## Project Overview

**Goal:** Ship a modern web app with email-based auth, subscription payments, fast UI, and a clean developer experience.

**High-level architecture**

```
Next.js (App Router)
  ├─ UI: Tailwind + shadcn/ui (components in src/components/ui/*)
  ├─ Pages: src/app/* (server components by default)
  ├─ API routes: src/app/api/* (Route Handlers)
  ├─ Auth: Supabase magic links via email (Resend for delivery)
  ├─ Data: Supabase Postgres (RLS) with customers + loyalty programs
  ├─ Analytics: versioned events stored in public.analytics_events
  └─ Payments: Stripe Checkout + Webhooks
```

### Directory conventions

```
src/
  app/                     # App Router entry
    (marketing)/           # Public pages
    (app)/dashboard/       # Authed area
    api/
      stripe/
        create-checkout-session/route.ts
        webhook/route.ts
      emails/route.ts      # Optional transactional emails via Resend API
  components/
    ui/                    # shadcn/ui components
    core/                  # App-specific components
  lib/                     # Framework-agnostic helpers (fetchers, formatters)
  server/                  # Server-only utilities (Supabase admin, Stripe helpers)
  styles/
    globals.css            # Tailwind layers
```

---

## Setup & Environment

### Prereqs

* Node 18+ (LTS)
* Package manager: `pnpm` (preferred) or `npm`
* Accounts: **Supabase**, **Stripe**, **Resend**

### Environment variables (`.env.local`)

```
# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...            # from Supabase settings
NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # public anon key
SUPABASE_SERVICE_ROLE_KEY=...           # server-only (never expose to client)

# Resend
RESEND_API_KEY=...                      # for API sending
RESEND_FROM="App Name <noreply@yourdomain.com>"  # verified domain @ Resend

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...   # default subscription price
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...

# Feature flags
LOYALTY_PILOT_RESTAURANT_IDS=uuid-1,uuid-2
```

> Keep `SERVICE_ROLE_KEY` and Stripe secrets server-only (e.g., in Vercel **Encrypted** env vars). Never expose to the browser.

### First run

```bash
pnpm i      # or npm i
pnpm dev    # http://localhost:3000
```

---

## Build, Test, Quality

* **Dev**: `pnpm dev`
* **Type check**: `pnpm typecheck`
* **Lint**: `pnpm lint`
* **Build**: `pnpm build`
* **Start**: `pnpm start`
* **Stripe Webhooks (local)**: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

> Tests may use Vitest/Jest if present. Prefer co-locating tests next to source (`*.test.ts`).

---

## Design & Code Principles (React, Modularization, Clean Code)

**React design principles**

* **Server-first**: Default to *Server Components* for data fetching; use Client Components only when you need interactivity or browser APIs.
* **Colocation**: Keep component, styles, and tests together.
* **Composition > inheritance**: Build small, focused primitives and compose them.
* **Single source of truth**: Avoid duplicating state; derive when possible.
* **Stable keys**: Use stable `key` props for lists; avoid index keys when ordering can change.
* **Accessible by default**: Use semantic HTML, labels, and focus management.

**Modularization**

* Group by **feature** not by type (prefer `src/app/(app)/billing/*` with its own components).
* Shared code lives in `src/lib` (framework-agnostic) and `src/components/ui`.
* Avoid deep prop drilling; lift state only as far as needed.

**Clean code**

* Keep functions under \~50 LOC. Extract helpers to `src/lib`.
* Use clear names; avoid abbreviations.
* Return early for error cases; keep happy path left-aligned.
* Document public utilities with a one-line JSDoc.
* Prefer pure functions and deterministic helpers for easier testing.

**Styling**

* Tailwind utility-first with **design tokens** (colors, spacing) defined in `tailwind.config.ts`.
* Keep component classNames short via patterns (e.g., small `cn()` helper for conditional classes).
* Use shadcn/ui components as accessible, themeable primitives.

---

## UI/UX – Tailwind + shadcn/ui

### Install & initialize

```bash
# Tailwind (if not already present)
npx tailwindcss init -p

# shadcn/ui
npx shadcn@latest init
# Add components as needed
npx shadcn@latest add button input label form card dropdown-menu sheet dialog toast
```

**Tailwind config** (ensure content covers `app` and `components`):

```ts
// tailwind.config.ts
export default {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [require("tailwindcss-animate")],
};
```

**Global styles**

```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Component guidance**

* Prefer shadcn/ui primitives (Button, Input, Dialog, Sheet, Toast) and compose them.
* Keep interactive components as **Client Components** (`"use client"`).
* Make forms keyboard-friendly; use `autoFocus`, `aria-invalid`, and inline error text.

---

## Auth – Supabase Magic Links (emails via Resend)

### Configure Supabase

1. In Supabase **Authentication → Providers → Email**, enable **Magic Links**.
2. In **SMTP settings**, set **Resend SMTP** (recommended for deliverability):

   * Host: `smtp.resend.com`, Port: `587`, TLS: `on`
   * Username: `resend`, Password: your `RESEND_API_KEY`
   * From: address on a verified Resend domain (see **Resend** section).
3. In **Email Templates**, customize the magic-link email subject/body as needed.

### Client-side sign-in form (shadcn/ui)

```tsx
// src/app/(marketing)/sign-in/page.tsx
"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button, Input, Label } from "@/components/ui"; // adjust imports per your setup

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (!error) setSent(true);
    else alert(error.message);
  }

  if (sent) return <p>Check your inbox for a sign-in link.</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-sm">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full">Send magic link</Button>
    </form>
  );
}
```

### Server-side session access

Use Supabase session JWT from cookies when needed in Route Handlers. Keep server-only logic in `src/server/*`.

```ts
// src/server/supabase.ts
import { createClient } from "@supabase/supabase-js";
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

> For SSR helpers and cookie management you may optionally adopt `@supabase/auth-helpers-nextjs`. If you add it, document usage here.

---

## Email – Resend (transactional)

### Domain & deliverability checklist

* Verify domain in Resend and add **SPF** and **DKIM** DNS records.
* Use a branded `From:` like `App <noreply@yourdomain.com>`.
* Include **List-Unsubscribe** headers in non-auth emails.
* Avoid URL shorteners and image-only content.

### Minimal sender helper

```ts
// src/server/email.ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(to: string) {
  await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: "Welcome 👋",
    html: `<p>Thanks for joining! Visit your <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard">dashboard</a>.</p>`,
    headers: { "List-Unsubscribe": `<${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe>` },
  });
}
```

---

## Database – Supabase (Postgres + RLS)

### Starter schema (run in Supabase SQL editor)

```sql
-- profiles mirror auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  stripe_customer_id text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can insert their row" on public.profiles
  for insert with check (auth.uid() = id);

-- subscriptions
create table if not exists public.subscriptions (
  id bigint generated by default as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('active','trialing','past_due','canceled','incomplete')),
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

alter table public.subscriptions enable row level security;
create policy "Owner can view subscription" on public.subscriptions
  for select using (auth.uid() = user_id);
```

### Create or sync profile on signup

```ts
// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const email = url.searchParams.get("email");
  if (!token_hash || !email) return NextResponse.redirect(new URL("/sign-in?error=invalid", req.url));

  // On success, ensure profile exists
  const admin = createSupabaseAdmin();
  await admin.from("profiles").upsert({ id: (await admin.auth.getUser()).data.user?.id, email });
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
```

> Adjust callback logic to your flow. Ensure profiles are created server-side to avoid TOCTOU issues.

---

## Payments – Stripe

### Create checkout session (server)

```ts
// src/app/api/stripe/create-checkout-session/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  // Find or create customer based on the authed user
  const admin = createSupabaseAdmin();
  const { data: { user } } = await admin.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Upsert Stripe customer
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email });
    customerId = customer.id;
    await admin.from("profiles").upsert({ id: user.id, stripe_customer_id: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
```

### Webhook to sync subscription state

```ts
// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase";

export const runtime = "nodejs"; // ensure Node runtime for raw body access

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      // find user by customer id
      const { data: profile } = await admin.from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();
      if (profile?.id) {
        await admin.from("subscriptions").upsert({
          user_id: profile.id,
          status: sub.status,
          price_id: sub.items.data[0]?.price.id ?? null,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });
      }
      break;
    }
    default:
      // no-op
  }

  return NextResponse.json({ received: true });
}
```

**Local testing**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Security Considerations

* **Secrets**: Keep Stripe and Supabase service keys on the server only. Never log them.
* **Secret scanning**: Run `pnpm secret:scan` (gitleaks + trufflehog) locally before pushing; CI enforces the same.
* **RLS**: Every table must have Row Level Security. Write explicit policies.
* **Authz**: Protect server routes that mutate data; always derive `user_id` from the verified session/JWT, never from client input.
* **Email test endpoint**: `/api/test-email` locked behind `TEST_EMAIL_ACCESS_TOKEN`, origin allowlist, and prod rate limits (10/min/IP).
* **Email**: Use verified sender with SPF/DKIM to avoid spam. Include `List-Unsubscribe` for bulk-like sends.
* **Webhooks**: Verify Stripe signatures with the raw request body (don’t JSON.parse first).
* **Input**: Validate and sanitize user input (length, type, allowed chars) before hitting the DB.

---

## Developer Workflow

### Git & commits

* Use **Conventional Commits**:

  * `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`
* Keep PRs small and focused (≤300 lines diff when possible) with a clear, testable goal.

### Code review checklist

* [ ] Server code never uses client-provided `user_id`.
* [ ] RLS policies exist for any new table.
* [ ] UI is reachable and usable with keyboard only.
* [ ] Strings and constants extracted for reuse.
* [ ] Error states and empty states handled.

---

## Deployment

1. **Vercel** → Import Git repo.
2. Add env vars from **Setup** section (including Stripe keys & webhook secret).
3. **Supabase**: apply SQL schema, enable RLS, configure SMTP (Resend). Add site URL to **Auth → URL Config** for redirects.
4. **Stripe**: create Product & Price; set `NEXT_PUBLIC_STRIPE_PRICE_ID`. Configure webhook endpoint to `/api/stripe/webhook` (events: `customer.subscription.*`).
5. **Resend**: verify domain (SPF/DKIM), set `RESEND_API_KEY` & `RESEND_FROM`.

---

## Troubleshooting

* **Webhook 400**: Ensure raw body is used; check `STRIPE_WEBHOOK_SECRET` matches the environment.
* **Emails not delivered**: Confirm DNS (SPF/DKIM) and Resend domain verification. Check Supabase SMTP settings and From address.
* **401 on checkout**: Ensure a user session exists and `profiles` row is created.
* **RLS errors**: Add/select policies for the current table; use the service role key only in server code.

---

## API Notes (for agents)

* Use **Route Handlers** in `src/app/api/*`.
* Server-only helpers live in `src/server/*` and must not be imported by Client Components.
* Prefer `fetch` with relative URLs inside server components for internal APIs.

---

## Appendix A — Subproject `AGENTS.md` template

Copy this into `packages/<name>/AGENTS.md` for monorepos.

```md
# AGENTS.md (subproject)

## Scope
Describe what this package does and how it’s consumed by the rest of the repo.

## Quickstart
- Dev: `pnpm dev` (or relevant command)
- Build: `pnpm build`
- Test: `pnpm test`

## Tech constraints
- UI primitives: Tailwind + shadcn/ui only (if applicable)
- Data & Auth: Use Supabase APIs from `@/server/...` helpers

## Public API
List exported functions/components and the intended usage, with short examples.

## Code style
- React server-first, small composable components
- Clean code: early returns, no deep nesting, avoid magic numbers

## Security
- No secrets in client code; consume server helpers instead
- Validate input to any public function

## Gotchas
Any non-obvious behaviors, edge cases, or limits.
```

---

## Appendix B — Minimal component patterns (shadcn/ui)

```tsx
// Example: Button + Dialog
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export function ConfirmDelete({ onConfirm }: { onConfirm: () => Promise<void> }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </DialogTrigger>
      <DialogContent>
        <p>Are you sure?</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary">Cancel</Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Appendix C — Useful snippets

**Classname utility**

```ts
// src/lib/cn.ts
export function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}
```

**Protected server action (example)**

```ts
// src/server/actions/update-profile.ts
import { createSupabaseAdmin } from "@/server/supabase";

export async function updateProfile(userId: string, patch: { email?: string }) {
  const db = createSupabaseAdmin();
  await db.from("profiles").update(patch).eq("id", userId);
}
```

---

*End of file.*
