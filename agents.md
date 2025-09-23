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




must follow design principles 
- subtle haptics
- space + typography hierarchy
- micro-speed animations

# AGENTS.md - SajiloReserveX Mobile App UI/UX

## Project Overview

This is a mobile-first SajiloReserveX application focused on creating exceptional user experiences through clean, modern design. 

### Design Philosophy
- **Visual Style**: Clean, modern, high-contrast, spacious, content-forward, vibrant
- **User Experience**: Intuitive navigation, seamless interactions, accessibility-first
- **Platform**: Web App , Mobile First Development
- **Layout**: Single-column, bottom tab navigation, modal-driven flows

## Design System & Visual Guidelines

### Typography System
```css
/* Primary Font Family */
font-family: "SajiloReserveX Cereal App", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

/* Type Scale */
--font-screen-title: 700 34px/40px;    /* Bold headings */
--font-section-header: 600 22px/28px;  /* Section titles */
--font-card-title: 600 18px/22px;      /* Card headings */
--font-body: 400 16px/24px;            /* Body text */
--font-label: 400 14px/20px;           /* Labels, captions */
--font-button: 600 16px/20px;          /* Button text */
```

### Color Palette
```css
/* Primary Colors */
--color-primary: #FF385C;              /* SajiloReserveX pink - CTAs, active states */
--color-primary-pressed: #E01D45;      /* Pressed/hover state */
--color-accent: #00A699;               /* Teal accent - badges, highlights */

/* Text Colors */
--color-text-primary: #222222;        /* Main text, headings */
--color-text-secondary: #717171;      /* Secondary text, labels */
--color-on-primary: #FFFFFF;          /* Text on pink backgrounds */

/* Surface Colors */
--color-surface: #FFFFFF;             /* Cards, modals, buttons */
--color-background: #F7F7F7;          /* Screen backgrounds */
--color-border: #DDDDDD;              /* Subtle borders, dividers */
```

### Spacing & Layout System
```css
/* 8px Grid System */
--space-1: 4px;   /* Micro spacing */
--space-2: 8px;   /* Small gaps */
--space-3: 12px;  /* Card internal padding */
--space-4: 16px;  /* Standard gaps */
--space-5: 20px;  /* Medium spacing */
--space-6: 24px;  /* Screen margins, major sections */
--space-8: 32px;  /* Large sections */
--space-10: 40px; /* XL spacing */
--space-12: 48px; /* XXL spacing */

/* Layout Constants */
--screen-margin: 24px;     /* Left/right screen padding */
--card-padding: 12px;      /* Internal card spacing */
--button-height: 48px;     /* Standard button height */
--touch-target: 44px;      /* Minimum touch target */
```

### Border Radius & Shadows
```css
/* Radius Scale */
--radius-sm: 8px;      /* Small buttons, tags */
--radius-md: 12px;     /* Primary buttons, inputs */
--radius-lg: 16px;     /* Cards, modals */
--radius-full: 9999px; /* Pills, avatars */

/* Shadow System */
--shadow-card: 0 4px 12px rgba(0,0,0,0.1);      /* Floating cards */
--shadow-header: 0 2px 4px rgba(0,0,0,0.08);    /* Sticky headers */
--shadow-modal: 0 8px 32px rgba(0,0,0,0.12);    /* Modal overlays */
```

## Component Design Specifications

### PrimaryButton
**Purpose**: Main call-to-action button
```css
.primary-button {
  height: 48px;
  padding: 0 24px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font: var(--font-button);
  box-shadow: none;
  border: none;
}

.primary-button:active {
  background: var(--color-primary-pressed);
  transform: scale(0.98);
}
```
**UX Notes**: Instant feedback on press, no loading spinners inside button text

### SearchBar
**Purpose**: Primary search entry point
```css
.search-bar {
  height: 52px;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  padding: 0 16px;
}
```
**UX Notes**: Pill shape suggests tappability, shadow indicates interactivity

### CategoryTab
**Purpose**: Content filtering tabs
```css
.category-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}

.category-tab__icon {
  width: 24px;
  height: 24px;
}

.category-tab--active {
  border-bottom: 2px solid var(--color-primary);
  color: var(--color-text-primary);
}

.category-tab--inactive {
  color: var(--color-text-secondary);
}
```
**UX Notes**: Visual hierarchy through color and underline, icons provide quick recognition

### ExperienceCard
**Purpose**: Listing preview with booking action
```css
.experience-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.experience-card__image {
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.experience-card__content {
  padding: var(--space-3) var(--space-4);
}

.experience-card__wishlist {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
}
```
**UX Notes**: Entire card is tappable, wishlist heart positioned for thumb accessibility

## Animation & Interaction Guidelines

### Core Animation Principles
- **Duration**: Keep interactions snappy (< 300ms)
- **Easing**: Use `ease-out` for natural deceleration
- **Feedback**: Provide immediate visual response to all touches
- **Performance**: Animate only `transform` and `opacity` when possible

### Standard Animations
```css
/* Button Press Feedback */
.button-press {
  transition: transform 100ms ease-out, background-color 100ms ease-out;
}
.button-press:active {
  transform: scale(0.98);
}

/* Modal Entry */
.modal-enter {
  animation: slideUp 300ms ease-out;
  transform-origin: bottom;
}
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Screen Transition */
.screen-transition {
  transition: transform 350ms cubic-bezier(0.4, 0.0, 0.2, 1);
}
```

### Interactive States
```css
/* Loading State */
.loading {
  position: relative;
  overflow: hidden;
}
.loading::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: shimmer 1.5s infinite;
}

/* Focus States (for accessibility) */
.focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Gesture Interactions
- **Tap**: Immediate visual feedback with scale animation
- **Scroll**: Smooth momentum with header shadow on scroll
- **Swipe**: Horizontal swipe for image carousels
- **Pull-to-refresh**: Custom loading animation matching brand

## User Experience Patterns

### Navigation Patterns
```css
/* Bottom Tab Bar */
.bottom-tabs {
  height: 83px; /* Include safe area */
  background: var(--color-surface);
  box-shadow: var(--shadow-header);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: var(--touch-target);
}

.tab-item--active {
  color: var(--color-primary);
}
```

### Content Layout Patterns
- **Card Grids**: Consistent spacing, staggered loading
- **List Items**: Left-aligned content, right-aligned actions
- **Headers**: Sticky behavior with subtle shadow on scroll
- **Modals**: Bottom-anchored, swipe-to-dismiss

### Loading & Empty States
```css
/* Skeleton Loading */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

/* Empty States */
.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-6);
}
```

## Accessibility & Usability

### Touch Target Guidelines
- **Minimum Size**: 44x44px for all interactive elements
- **Spacing**: 8px minimum between adjacent touch targets
- **Thumb Zones**: Place primary actions within comfortable thumb reach

### Color & Contrast
- **Primary Text**: 15.85:1 contrast ratio ✅
- **Secondary Text**: 4.63:1 contrast ratio ✅
- **Warning**: Pink primary (#FF385C) on white fails for small text - use only for large UI elements

### Screen Reader Support
```html
<!-- Semantic markup examples -->
<button aria-label="Add to wishlist" class="wishlist-button">
  <HeartIcon aria-hidden="true" />
</button>

<img alt="Cozy apartment in Paris with city view" src="..." />

<nav role="tablist" aria-label="Content categories">
  <button role="tab" aria-selected="true">Homes</button>
</nav>
```

## Responsive & Adaptive Design

### Current Breakpoint
- **Mobile**: 390-393px (iPhone 14 Pro)
- **Layout**: Single column, full-width cards
- **Navigation**: Bottom tabs, modal overlays

### Adaptive Behaviors
- **Text Scaling**: Support iOS Dynamic Type
- **Dark Mode**: Prepare color tokens for future dark theme
- **Reduced Motion**: Respect `prefers-reduced-motion`

## Content & Imagery Guidelines

### Image Requirements
```css
/* Listing Images */
.listing-image {
  aspect-ratio: 1 / 1; /* or 4 / 3 */
  object-fit: cover;
  background: var(--color-background); /* Loading state */
}

/* Avatar Images */
.avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  object-fit: cover;
}
```

### Microcopy Patterns
- **Button Labels**: Action-oriented, 1-3 words ("Show dates", "Reserve")
- **Placeholders**: Contextual and helpful ("Start your search")
- **Error Messages**: Clear, actionable ("Please select a check-in date")
- **Success Messages**: Encouraging and personal ("You're all set!")

## Common UI Patterns

### Modal Flows
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1000;
}

.modal-content {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  min-height: 50vh;
  max-height: 90vh;
}
```

### List & Grid Layouts
- **Card Spacing**: 16px between cards
- **Grid Gutters**: 16px horizontal, 24px vertical
- **List Separators**: 1px border in border-subtle color

### Form Patterns
- **Input Height**: 52px to match search bar
- **Focus States**: Primary color border, no box-shadow
- **Validation**: Inline errors below fields, success states

---

**Design Principles**: Always prioritize user experience over visual complexity. Every interaction should feel immediate and purposeful. Maintain consistency with established patterns while creating delightful moments of interaction.