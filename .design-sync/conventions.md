# Building with the Nabatable Platform DS

Nabatable is a reservations & capacity-management platform for UK pubs. Two surfaces share this
library: a **guest** booking flow (warm, light) and an **ops** "Luma" operator console (cobalt,
dense, mono numerals). The single accent is **cobalt `#1447E6`** (`--primary`) — used only for
interactive affordance (CTAs, links, active states, focus, key numbers), never decoration.

## Setup & wrapping

- **No global provider is required.** Tokens are defined on `:root`, so components render fully
  styled out of the box — import and compose directly.
- **Theme (optional):** wrap a subtree in `[data-theme='app']` for the ops console palette or
  `[data-theme='guest']` / `class="guest-theme"` for the guest surface; add `class="dark"` for dark
  mode. The base `:root` palette already matches the guest/ops light themes.
- **Components that DO need a wrapper:** `Tooltip` → wrap in `<TooltipProvider>`; `Sidebar` → wrap in
  `<SidebarProvider>`; `Form` (react-hook-form) → use `Form` + `FormField` for context.
- **Overlays** (`Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Select`, `Tooltip`, `AlertDialog`,
  `Command`) render through a portal; control with `open` / `defaultOpen`.

## Styling idiom — Tailwind v4 + CSS-variable tokens

Style with **Tailwind utility classes**; the design language lives in semantic token-backed colors —
use these, not raw hex:

- Surfaces: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-secondary`, `bg-accent`
- Text: `text-foreground`, `text-muted-foreground`, `text-primary`, `text-primary-foreground`
- Accent / CTA: `bg-primary text-primary-foreground` (cobalt)
- Status: `text-success`, `text-warning`, `text-info`, `bg-destructive` (or the `destructive` Button/Badge variant)
- Structure: `border`, `border-input`, `ring-ring`, `rounded-md` / `rounded-lg`
- Numerals: `tabular-nums` (the operational-cockpit texture)
- Guest extras: `var(--pg-action)`, `var(--pg-bg)`, `var(--pg-radius-pill)` (pill buttons / chips)

**Prefer component variant props** over ad-hoc classes — they carry the design language:

- `Button` — `variant`: default | secondary | outline | ghost | link | destructive | guest-primary |
  guest-outline | guest-ghost · `size`: default | sm | lg | icon | guest-sm | guest-lg
- `Badge` — `variant`: default | secondary | destructive | outline | metric | guest-chip |
  status-confirmed | status-pending | status-completed | status-cancelled

## Where the truth lives

- Stylesheet: `_ds_bundle.css` (reached from `styles.css`) — every token + utility.
- Per component: its `.prompt.md` (usage) and `.d.ts` (props).
- Brand, voice, motion, spacing: the `guidelines/` cards (esp. `GUEST_FACING_DESIGN_SYSTEM.md`).

## Idiomatic snippet

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from '<lib>';

<Card className="w-80">
  <CardHeader>
    <CardTitle>Table 12 · Dinner</CardTitle>
    <CardDescription>Saturday 8:00 PM · Party of 4</CardDescription>
  </CardHeader>
  <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
    <Badge variant="status-confirmed">Confirmed</Badge>
    <span className="tabular-nums">07700 900123</span>
  </CardContent>
  <CardFooter className="gap-2">
    <Button size="sm">Seat now</Button>
    <Button size="sm" variant="outline">
      Message
    </Button>
  </CardFooter>
</Card>;
```
