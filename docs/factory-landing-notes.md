# Factory Landing Notes

## A. Visual & Aesthetic Strategy

From "Generic SaaS" to "Factory Clean": The original design used standard Tailwind colors and scattered styles. The new design strictly adheres to the Factory Design System tokens (Tier 1 Primitives & Tier 2 Semantics).

Color Palette: Shifted from a mix of arbitrary blues and darks to a strict Slate (Neutral) and Brand Blue (#2563EB) hierarchy. The "Gold" luxury accents were removed to align with the clean, technical "Airbnb-style" aesthetic of the Design System.

Typography: Replaced generic font sizing with a standardized Type Scale (heading-xl, heading-lg, text-body) using the Inter font family.

## B. Technical Architecture

Atomic Design Implementation:

Old: Monolithic sections (e.g., HomeHeroSection contained all its own buttons and logic).

New: Composable components. The Hero now uses the shared SearchBar and Badge atoms defined in the design system.

CSS Architecture:

Old: Relied heavily on Tailwind utility classes inline (e.g., bg-blue-500/15).

New: Uses CSS Variables for tokens (var(--brand-blue), var(--radius-xl)). This allows for global theming updates by changing a single value.

Layout Structure:

Old: Standard stacked sections.

New: Bento Grid Layout for the metrics section, providing a more modern, dashboard-like density of information.

## C. User Experience (UX)

Interactive "Live" Elements: Added a simulated Live Feed component using React state to demonstrate the "real-time" value proposition of the product.

Search Prominence: The search bar was elevated from a simple button to a floating, multi-pill search interface (Location, Date, Time, Who) directly in the Hero, encouraging immediate action.
