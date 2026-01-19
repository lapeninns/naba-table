---
skill: style-principles
version: 1.0
category: coding-standards
phases: [2, 3]
updated: 2025-12-22
---

# Style Principles Skill

**Purpose**: Write maintainable, simple, focused code by applying time-tested software engineering principles.

**When to Use**: Throughout all implementation phases, especially:

- **Phase 2 (Design & Planning)** — Making architectural decisions
- **Phase 3 (Implementation)** — Writing and reviewing code

---

## Core Principles

### DRY — Don't Repeat Yourself

> Every piece of knowledge must have a single, unambiguous, authoritative representation within a system.

#### What DRY Means

- Extract repeated **logic** into functions
- Centralize repeated **configuration** into constants
- Share repeated **patterns** via components or utilities

#### What DRY Does NOT Mean

- Prematurely abstracting things that look similar but serve different purposes
- Creating complex abstractions to avoid writing similar code twice
- Sacrificing readability for extreme DRY-ness

#### Do ✅

```typescript
// Good: Centralized validation logic
const validateBookingTime = (time: Date, openHours: OpenHours): ValidationResult => {
  if (time < openHours.start) return { valid: false, error: 'Before opening' };
  if (time > openHours.end) return { valid: false, error: 'After closing' };
  return { valid: true };
};

// Used in multiple places
const result1 = validateBookingTime(requestedTime, restaurantHours);
const result2 = validateBookingTime(newTime, updatedHours);
```

#### Don't ❌

```typescript
// Bad: Premature abstraction for superficially similar code
const genericValidator = <T, C>(
  value: T,
  config: C,
  rules: Array<(v: T, c: C) => ValidationResult>,
): ValidationResult => {
  for (const rule of rules) {
    const result = rule(value, config);
    if (!result.valid) return result;
  }
  return { valid: true };
};

// Overly complex for simple validation
const result = genericValidator(time, hours, [beforeOpeningRule, afterClosingRule]);
```

---

### KISS — Keep It Simple, Stupid

> The simplest solution that works is usually the best solution.

#### What KISS Means

- Prefer straightforward, readable code over clever code
- Choose obvious implementations over "elegant" but obscure ones
- Solve the problem at hand, not the generalized problem

#### Do ✅

```typescript
// Good: Simple, obvious implementation
function getBookingStatus(booking: Booking): string {
  if (booking.cancelled_at) return 'cancelled';
  if (booking.checked_out_at) return 'completed';
  if (booking.checked_in_at) return 'seated';
  if (new Date() > booking.datetime) return 'late';
  return 'confirmed';
}
```

#### Don't ❌

```typescript
// Bad: Overly clever state machine for simple status
const statusTransitions = new Map([
  ['initial', { cancelled_at: 'cancelled', checked_in_at: 'seated' }],
  ['seated', { checked_out_at: 'completed' }],
  // ...more complexity
]);

function getBookingStatus(booking: Booking): string {
  return resolveStateFromTransitions(booking, statusTransitions, 'initial');
}
```

---

### YAGNI — You Aren't Gonna Need It

> Don't build features until they're actually needed.

#### What YAGNI Means

- Build only what's required for the current task
- Resist the urge to add "nice to have" features
- Don't design for hypothetical future requirements

#### Do ✅

```typescript
// Good: Solves current need only
interface BookingCreateInput {
  guest_name: string;
  party_size: number;
  datetime: Date;
  restaurant_id: string;
}

async function createBooking(input: BookingCreateInput) {
  return await db.bookings.insert(input);
}
```

#### Don't ❌

## UI Primitives Policy

Use Shadcn UI primitives for all UI. Do not create custom primitives or base components; compose and extend existing Shadcn components instead. Exceptions require maintainer approval and a documented justification in `plan.md`.

---

```typescript
// Bad: Building for imaginary future requirements
interface BookingCreateInput {
  guest_name: string;
  party_size: number;
  datetime: Date;
  restaurant_id: string;
  // "We might need these later"
  recurring?: RecurrencePattern;
  linked_event_id?: string;
  weather_preferences?: WeatherConditions;
  group_booking_id?: string;
  external_system_refs?: Map<string, string>;
}
```

---

## Avoid Over-Engineering

### Signs of Over-Engineering

1. **Abstraction for one use case** — Building a factory when you have one implementation
2. **Configuration for unlikely scenarios** — Adding toggles that will never be used
3. **Defense against phantom requirementss** — "What if we need to support..."
4. **Premature optimization** — Caching before measuring bottlenecks

### Guidelines

| ❌ Over-Engineered                        | ✅ Appropriate            |
| ----------------------------------------- | ------------------------- |
| Factory pattern for single implementation | Direct instantiation      |
| Event bus for two components              | Direct method calls       |
| Custom state machine library              | Switch statement          |
| Retry logic for infallible operations     | Direct execution          |
| Plugin system for core functionality      | Hard-coded implementation |

### Decision Framework

Before adding complexity, ask:

1. **Is this directly requested?** If not, probably skip it.
2. **Would a simpler approach work?** Try the simple thing first.
3. **Are there at least 3 use cases?** [Rule of Three](<https://en.wikipedia.org/wiki/Rule_of_three_(computer_programming)>)
4. **Can we add it later?** If yes, defer until needed.

---

## Validation Guidelines

### Validate at System Boundaries Only

Trust internal invariants and framework guarantees. Validate only when:

- Receiving external input (user input, API requests)
- Calling external services (third-party APIs)
- Reading from untrusted sources (uploaded files, URL params)

#### Do ✅

```typescript
// Good: Validate at API boundary
export async function POST(request: Request) {
  const body = await request.json();

  // Validate here — this is a system boundary
  const parsed = BookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // Internal functions trust the validated data
  return await createBooking(parsed.data);
}

// Internal function — no re-validation needed
async function createBooking(input: BookingCreateInput) {
  // Trust that input is already validated
  return await db.bookings.insert(input);
}
```

#### Don't ❌

```typescript
// Bad: Defensive validation everywhere
async function createBooking(input: BookingCreateInput) {
  // Unnecessary — we validated at the boundary
  if (!input.guest_name) throw new Error('Name required');
  if (!input.restaurant_id) throw new Error('Restaurant required');
  if (input.party_size < 1) throw new Error('Invalid party size');

  // More unnecessary validation
  const restaurant = await getRestaurant(input.restaurant_id);
  if (!restaurant) throw new Error('Invalid restaurant'); // DB will handle this

  return await db.bookings.insert(input);
}
```

---

## Abstraction Guidelines

### When to Create Abstractions

**Create abstractions when:**

- The same pattern appears **3+ times** (Rule of Three)
- The abstraction makes code **more readable**, not just reusable
- The abstraction has a **clear, single responsibility**
- You can give it a **good name** that explains what it does

**Don't create abstractions when:**

- It's only used once
- The "pattern" is superficial similarity
- It requires complex configuration to be reusable
- A simple function would suffice

### Abstraction Ladder

From simplest to most complex, prefer earlier options:

1. **Inline code** — Just write it where you need it
2. **Extract function** — Move logic to named function
3. **Extract module** — Group related functions
4. **Create interface** — Define contract for variations
5. **Build framework** — Only when you're building a platform

---

## Code Review Principles

### When Reviewing Code

Ask these questions:

1. **Does it solve the stated problem?** Not more, not less.
2. **Is it the simplest solution?** Could it be simpler?
3. **Is the complexity justified?** What future does it prepare for?
4. **Does it follow existing patterns?** Consistency over novelty.

### Red Flags in Reviews

- New abstractions with single usage
- Configuration for unused options
- "Extensibility" hooks with no extensions
- Comments explaining what "might" be needed later
- Unused parameters or return values

---

## Decision Checklist

Before writing or approving code, verify:

```text
# Current Need
[ ] Is this directly requested?
[ ] Am I solving a real problem right now?
[ ] Would the simplest approach work?

# Existing Patterns
[ ] Have I checked for existing patterns in the codebase?
[ ] Am I following established conventions?
[ ] Is this consistent with similar code nearby?

# Complexity
[ ] Can I explain why this complexity is needed?
[ ] Are there 3+ use cases for this abstraction?
[ ] Could we add this later if actually needed?

# Validation
[ ] Am I validating only at system boundaries?
[ ] Am I trusting framework/library guarantees?
[ ] Am I avoiding redundant null/undefined checks?
```

---

## Anti-Patterns

### The Speculative Generalization

```typescript
// ❌ Building for imaginary futures
interface DataFetcherPlugin<T, C, R> {
  fetch(config: C): Promise<T>;
  transform(data: T): R;
  cache?: CacheStrategy<R>;
  retry?: RetryPolicy;
}

// ✅ Just fetch the data you need
async function fetchBookings(): Promise<Booking[]> {
  return await db.bookings.findMany();
}
```

### The Configuration Explosion

```typescript
// ❌ Configuration for every possible option
createBookingButton({
  label: 'Book Now',
  variant: 'primary',
  size: 'medium',
  icon: 'calendar',
  iconPosition: 'left',
  loading: false,
  disabled: false,
  fullWidth: false,
  rounded: 'md',
  animation: 'slide',
  tooltipPosition: 'top',
  // ...20 more options
});

// ✅ Sensible defaults, minimal config
<BookingButton onClick={handleBook} />
```

### The Premature Abstraction

```typescript
// ❌ AbstractFactoryBuilderFactory
const notificationService = NotificationServiceFactory.createBuilder()
  .withChannel('email')
  .withTemplate('booking-confirmation')
  .withRetry({ attempts: 3 })
  .build()
  .createService();

// ✅ Just send the email
await sendBookingConfirmation(email, booking);
```

---

## Verification Checklist

```text
# Simplicity
[ ] Could a junior dev understand this in 5 minutes?
[ ] Is the "clever" code actually necessary?
[ ] Are there simpler alternatives?

# Necessity
[ ] Is every abstraction used 3+ times?
[ ] Is every configuration option actually used?
[ ] Is every parameter necessary?

# Consistency
[ ] Does this follow existing patterns?
[ ] Is naming consistent with codebase?
[ ] Are similar problems solved similarly?

# Focus
[ ] Does this PR only address the stated issue?
[ ] Are there any "drive-by" refactors?
[ ] Is the scope appropriate?
```
