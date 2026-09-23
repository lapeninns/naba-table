# Auth Pages Design System Quick Reference

> [!WARNING]
> **Historical reference — superseded by Radix Luma.** The raw `blue-*` / `slate-*` utilities,
> gradients and shadows below describe the pre-Luma auth pages and are **not** the current
> contract; the auth routes now render through the shared semantic tokens and primitives, and
> the `guard:luma` ratchet blocks new hardcoded palette utilities. For current values read
> [`docs/DESIGN_TOKENS.md`](DESIGN_TOKENS.md) and the brand spec
> [`GUEST_FACING_DESIGN_SYSTEM.md`](../GUEST_FACING_DESIGN_SYSTEM.md); for decisions read
> [`docs/design/luma-2.0-spec.md`](design/luma-2.0-spec.md). Kept only so older task notes
> that cite it still resolve.

## Color Tokens

### Primary Actions

```css
bg-blue-600       /* Primary button background */
hover:bg-blue-700 /* Primary button hover */
text-blue-600     /* Primary links */
hover:text-blue-700 /* Primary link hover */
```

### Focus States

```css
focus:border-blue-400
focus:ring-blue-400
focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2
```

### Borders & Surfaces

```css
border-slate-200  /* Default border */
bg-white          /* Card background */
bg-slate-50       /* Subtle background */
bg-slate-100      /* Tab inactive background */
```

### Text Hierarchy

```css
text-slate-900    /* Primary headings and important text */
text-slate-700    /* Labels and secondary headings */
text-slate-600    /* Body text and descriptions */
text-slate-500    /* Helper text and muted content */
```

### Gradients & Effects

```css
/* Background gradient */
bg-gradient-to-br from-slate-50 via-white to-blue-50/30

/* Ambient effects */
bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.06),transparent_50%)]

/* Button shadow */
shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30
```

## Typography Scale

### Headlines

```tsx
{
  /* Page hero headline */
}
<h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
  Welcome back to effortless dining
</h1>;

{
  /* Section heading */
}
<h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to your account</h2>;

{
  /* Card title */
}
<h3 className="font-semibold text-slate-900">Instant confirmation</h3>;
```

### Body Text

```tsx
{
  /* Subtitle/description */
}
<p className="text-lg text-slate-600">Sign in to manage your reservations...</p>;

{
  /* Standard body */
}
<p className="text-sm text-slate-600">Book and get confirmed in seconds</p>;

{
  /* Helper/muted */
}
<p className="text-xs text-slate-500">By signing in, you agree to our Terms</p>;
```

## Layout Components

### Two-Column Hero Layout

```tsx
<div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
  <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
    {/* Left column - Value prop */}
    <div className="flex flex-col justify-center space-y-8">{/* Content */}</div>

    {/* Right column - Form */}
    <div className="flex flex-col justify-center">{/* Form card */}</div>
  </div>
</div>
```

### Feature Card

```tsx
<div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
    <Zap className="h-5 w-5 text-blue-600" />
  </div>
  <div>
    <h3 className="font-semibold text-slate-900">Instant confirmation</h3>
    <p className="text-sm text-slate-600">Book and get confirmed in seconds</p>
  </div>
</div>
```

### Badge/Pill

```tsx
<div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
  <Sparkles className="h-4 w-4" />
  Seamless dining experiences
</div>
```

### Trust Indicator Box

```tsx
<div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-900">
    <Shield className="h-4 w-4" />
    Enterprise-grade security
  </div>
  <ul className="space-y-2 text-sm text-blue-800">
    <li className="flex items-center gap-2">
      <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
      SOC 2 Type II certified
    </li>
  </ul>
</div>
```

## Form Components

### Text Input with Icon

```tsx
<div className="relative">
  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
  <Input
    type="email"
    placeholder="you@example.com"
    className="h-12 pl-12 rounded-xl border-slate-200 bg-white text-base focus:border-blue-400 focus:ring-blue-400 transition-colors"
  />
</div>
```

### Primary Button

```tsx
<Button
  type="submit"
  size="lg"
  className="w-full rounded-xl bg-blue-600 text-base font-semibold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30"
>
  <span className="flex items-center justify-center gap-2">
    <Send className="h-5 w-5" />
    Send magic link
  </span>
</Button>
```

### Secondary Button/Link

```tsx
<Link
  href="/app/auth/signin"
  className="flex w-full items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-all hover:border-blue-400 hover:bg-blue-50"
>
  Sign in to operations console →
</Link>
```

### Tab Switcher

```tsx
<div role="tablist" className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5">
  <button
    type="button"
    role="tab"
    aria-selected={active}
    className={cn(
      'rounded-lg border px-4 py-3 text-left text-sm transition-all',
      active
        ? 'bg-white border-slate-200 shadow-sm'
        : 'bg-transparent border-transparent text-slate-600',
    )}
  >
    <span className="block font-semibold">Magic link</span>
    <span className="block text-xs text-slate-500">One-time secure link</span>
  </button>
</div>
```

## Icon Usage

### Icon Sizes

- **Small icons** (badges, inline): `h-4 w-4`
- **Medium icons** (form fields): `h-5 w-5`
- **Large icons** (feature cards): `h-6 w-6`
- **Icon containers**: `h-10 w-10` or `h-12 w-12`

### Icon Colors

```tsx
{
  /* In colored containers */
}
<div className="bg-blue-100">
  <Zap className="h-5 w-5 text-blue-600" />
</div>;

{
  /* In form fields */
}
<Mail className="text-slate-400" />;

{
  /* In buttons */
}
<Send className="h-5 w-5" aria-hidden />;
```

## Spacing System

### Container Spacing

```css
px-4 sm:px-6 lg:px-8  /* Responsive horizontal padding */
py-12                  /* Vertical section padding */
```

### Component Spacing

```css
space-y-8   /* Large vertical stack (sections) */
space-y-6   /* Medium vertical stack (form groups) */
space-y-4   /* Small vertical stack (list items) */
space-y-2   /* Tight vertical stack (multi-line text) */

gap-12 lg:gap-16  /* Grid gap (responsive) */
gap-4             /* Standard gap */
gap-2             /* Tight gap */
```

### Card Spacing

```css
p-6 sm:p-8    /* Card padding (responsive) */
p-4           /* Small card/feature box padding */
```

## Border Radius

```css
rounded-full  /* Pills, badges, status indicators */
rounded-xl    /* Cards, buttons, inputs */
rounded-lg    /* Small cards, feature boxes, tabs */
```

## Shadow System

```css
/* Card elevation */
shadow-xl

/* Button shadows */
shadow-lg shadow-blue-600/20
hover:shadow-xl hover:shadow-blue-600/30

/* Navbar/footer */
backdrop-blur-md
```

## Responsive Breakpoints

```css
/* Mobile first, then: */
sm:   /* 640px+ */
md:   /* 768px+ */
lg:   /* 1024px+ (major layout change) */
xl:   /* 1280px+ */
```

### Common Responsive Patterns

```css
/* Typography */
text-4xl sm:text-5xl

/* Grid */
grid lg:grid-cols-2

/* Spacing */
gap-12 lg:gap-16
p-6 sm:p-8

/* Display */
hidden sm:block
```

## Animation & Transitions

### Standard Transitions

```css
transition-all       /* For multi-property changes */
transition-colors    /* For color-only changes */
```

### Hover States

```css
hover:bg-blue-700
hover:text-blue-700
hover:border-blue-400
hover:shadow-xl
```

### Focus States

```css
focus:border-blue-400
focus:ring-blue-400
focus-visible:ring-2
focus-visible:ring-blue-400
focus-visible:ring-offset-2
focus:outline-none
```

## Accessibility Patterns

### Screen Reader Text

```tsx
<span className="sr-only">Skip to content</span>
```

### ARIA Labels

```tsx
<button aria-label="Send magic link">
<div role="status" aria-live="polite">
<div role="tablist" aria-label="Choose sign-in method">
```

### Icon Accessibility

```tsx
<Zap className="h-5 w-5" aria-hidden />
```

## Error States

### Error Alert

```tsx
<div
  role="alert"
  className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
>
  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" />
  <div className="text-sm">
    <p className="font-medium">Unable to sign in</p>
    <p className="mt-1 text-red-700">{errorMessage}</p>
  </div>
</div>
```

## Loading States

### Loading Button

```tsx
{
  isSubmitting ? (
    <span className="flex items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      Sending...
    </span>
  ) : (
    <span className="flex items-center justify-center gap-2">
      <Send className="h-5 w-5" aria-hidden />
      Send magic link
    </span>
  );
}
```

## Component Combinations

### Form Card with Divider and CTA

```tsx
<div className="rounded-2xl border border-slate-200 bg-white shadow-xl">
  {/* Form */}
  <div className="p-6 sm:p-8">
    <GuestSignInForm />
  </div>

  {/* Divider */}
  <div className="relative px-6">
    <div className="relative flex items-center">
      <div className="flex-grow border-t border-slate-200"></div>
      <span className="mx-4 flex-shrink text-sm text-slate-500">or</span>
      <div className="flex-grow border-t border-slate-200"></div>
    </div>
  </div>

  {/* CTA Section */}
  <div className="rounded-b-2xl bg-slate-50 p-6">
    <p className="mb-3 text-center text-sm text-slate-600">Are you a restaurant owner?</p>
    <Link href="/app/auth/signin" className="...">
      Sign in to operations console →
    </Link>
  </div>
</div>
```

---

## Usage Examples

### Creating a New Auth Page

1. Use `EnhancedAuthLayout` as the wrapper
2. Create a two-column grid for desktop
3. Left column: Value proposition with features
4. Right column: Form card with cross-link CTA
5. Add appropriate variant (`guest` or `restaurant`)

### Adding a New Feature Card

```tsx
<div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
    <YourIcon className="h-5 w-5 text-purple-600" />
  </div>
  <div>
    <h3 className="font-semibold text-slate-900">Feature Title</h3>
    <p className="text-sm text-slate-600">Feature description</p>
  </div>
</div>
```

### Adding a New Trust Badge

```tsx
<div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
  <Shield className="h-4 w-4" />
  Trusted by 500+ customers
</div>
```
