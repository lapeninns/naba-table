# Design System Document: The Luminous Precision Framework

## 1. Overview & Creative North Star: "The Digital Curator"

This design system moves away from the rigid, boxed-in layouts of traditional mobile apps, opting instead for an editorial, high-end feel defined as **"The Digital Curator."** The aesthetic prioritizes "Base-Luma" logic—where light and clarity aren't just background elements, but active components of the navigation experience.

The core philosophy is **Intentional Asymmetry**. By utilizing generous whitespace (breathing room) and high-contrast typography scales, we create a rhythm that guides the eye naturally. We reject the "template" look. Instead of a flat grid, we treat the mobile screen as a high-end gallery: objects are layered, surfaces are tactile, and interactions feel weighted and premium.

## 2. Colors: Tonal Architecture

We utilize a sophisticated palette that balances a deep, authoritative Indigo against a spectrum of architectural neutrals.

### The "No-Line" Rule

Explicit instruction: Designers are prohibited from using 1px solid borders to define sections. Structure is created through **Tonal Shifting**. A section is defined by moving from `surface` to `surface-container-low`. Boundaries must be felt, not seen.

### Surface Hierarchy & Nesting

Treat the UI as a series of physical layers, like stacked sheets of fine, heavy-weight paper.

- **Base Layer:** `surface` (`#f9f9fc`)
- **Secondary Content:** `surface-container-low` (`#f3f3f6`)
- **Interactive Cards:** `surface-container-lowest` (`#ffffff`)
- **Elevated Overlays:** `surface-bright` (`#f9f9fc`) with backdrop blur

### The "Glass & Gradient" Rule

To prevent a "flat" digital feel, floating elements like the bottom navigation or header must use **Glassmorphism**. Use translucent colors with a `backdrop-blur` of `12px` to `20px`.

- **Signature Texture:** For primary CTAs, use a subtle linear gradient from `primary` (`#0040a1`) to `primary_container` (`#0056d2`) at `135deg`. This adds soul and depth to the interaction point.

## 3. Typography: Editorial Authority

The type system utilizes a high-contrast pairing to establish a clear information hierarchy.

- **Display & Headlines (Manrope):** Use Manrope for all `display` and `headline` tokens. Its geometric yet warm curves provide a modern, bespoke feel. Utilize `display-lg` (`3.5rem`) for hero moments to create an editorial impact.
- **Body & UI (Inter):** Use Inter for all `title`, `body`, and `label` tokens. Inter’s tall x-height ensures maximum readability on mobile screens at small scales.
- **The Hierarchy Goal:** Use dramatic size differences. A `display-sm` headline paired with a `body-md` description creates an intentional "Scale Gap" that feels sophisticated and expensive.

## 4. Elevation & Depth: Tonal Layering

We move beyond the 2010s-era drop shadow. Depth is achieved through **Tonal Layering** and **Ambient Light**.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. This creates a natural, soft lift that is easier on the eyes than a hard shadow.
- **Ambient Shadows:** If an element must float, like a modal or FAB, use a long-tail shadow.
  - Blur: `32px` to `64px`
  - Opacity: `4%` to `6%`
  - Color: use a tinted version of `on_surface` rather than pure grey
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` token at `15%` opacity. High-contrast, fully opaque borders are forbidden.

## 5. Components

### Buttons

- **Primary:** Gradient fill (`primary` to `primary_container`), `on_primary` text, `0.625rem` radius
- **Secondary:** `surface_container_high` fill with `primary` text, no border
- **Tertiary:** Ghost style, no background, `primary` text, bold weight

### Cards & Lists

- **Forbid Divider Lines:** Use vertical white space (`1.5rem` to `2rem`) or subtle background shifts between `surface-container` tiers to separate items.
- **Card Styling:** Use `surface-container-lowest` for cards on a `surface` background. Apply a `0.625rem` (`10px`) border radius.

### Input Fields

- **State:** Default state uses `surface-container-highest` as a subtle background fill.
- **Focus:** Transition the background to `surface-container-lowest` and apply a `2px` ghost border using the `primary` color at `20%` opacity.

### Navigation (Menu)

- **Style:** `default-translucent`. Use `backdrop-filter: blur(15px)`.
- **Accent:** `subtle`. Active states in the navigation should use a small indigo dot or a slight weight increase in the Lucide icon, rather than a heavy background block.

## 6. Do's and Don'ts

### Do

- Use Lucide icons with a `1.5px` or `2px` stroke weight to match the weight of Inter's body text.
- Use intentional asymmetry. Try left-aligning headlines while right-aligning metadata to create visual tension.
- Utilize the `0.625rem` radius consistently across all containers to create a cohesive Base-Luma language.

### Don't

- Do not use `#000000` for text. Always use `on_surface` (`#1a1c1e`) to maintain the Indigo-Neutral tonal balance.
- Do not use dividers. If you feel you need a line, use a `16px` gap instead.
- Do not use standard Material shadows. If it looks like a default shadow, it is too heavy.

## 7. Source Of Truth Rule

For guest-facing Nabatable pages, this document is the visual source of truth for layout, color, typography, elevation, and component treatment. When an older guest style preset, utility, or component conflicts with this document, this design system wins for the redesigned booking journey.
