---
name: 'Radix Luma'
category: Brands
surface: web
colors:
  background: '#ffffff'
  surface: '#f4f4f5'
  foreground: '#09090b'
  muted-foreground: '#71717b'
  border: '#e4e4e7'
  primary: '#1447e6'
  secondary-foreground: '#18181b'
---

# Radix Luma

> Category: Brands

> Surface: web

_A restrained, cockpit-dense interface system: Zinc neutrals, one cobalt accent._

Radix Luma is the single design system for every Nabatable surface — shadcn components on Radix primitives. Zinc neutrals (hue ~286) form the institutional backbone; a singular cobalt blue (#1447E6) carries every interactive affordance. Light mode is the default, dark mode is a re-tuned second appearance, and two surfaces share one token set: `guest` (public booking pages, Merriweather headings, roomier) and `app` (the ops dashboard, Inter throughout, compact density).

## Color Palette

| Role             | Name                 | Hex       | Usage                                                                                                                                                                                                                                                                        |
| ---------------- | -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| background       | Background           | `#ffffff` | Level-0 canvas; also card and popover fill (source `background`, `card`, `popover`). Dark: #09090b (Zinc-950).                                                                                                                                                               |
| surface          | Surface              | `#f4f4f5` | Tonal layer for secondary regions, secondary-button fill, ghost-button hover and badges (source `secondary` / `muted` / `accent` — one value, three shadcn roles). Cards stay white with a border; this is not a card fill. Sidebar uses the lighter #fafafa. Dark: #27272a. |
| foreground       | Foreground           | `#09090b` | Headings, body copy, table values, outline/ghost button labels. 19.9:1 on Background. Dark: #fafafa.                                                                                                                                                                         |
| muted            | Muted foreground     | `#71717b` | Secondary text, descriptions, placeholders, metadata and eyebrows (source `muted-foreground`, Zinc-500). 4.8:1 on Background but only 4.4:1 on Zinc-100 — on surface fills use it at ≥14px/500 or switch to Foreground. Dark: #9f9fa9 (7.6:1).                               |
| border           | Border               | `#e4e4e7` | Structural 1px lines: dividers, card edges and input borders (source `border` = `input`). Non-text only. Dark: rgba(255,255,255,0.1) borders, #3f3f46 inputs — never translucent in light mode.                                                                              |
| accent           | Primary              | `#1447e6` | The sole accent (source `primary`). Primary CTA fill with #eff6ff label (6.3:1), links (6.8:1 on white), active states, focus rings and chart-4. Interactive only — never decoration or large washes. Hover #1240cf. Dark: #193cb8.                                          |
| accent-secondary | Secondary foreground | `#18181b` | Secondary-foreground: label colour for secondary buttons, badges and accent-hover rows on Zinc-100 (16.1:1). Supporting actions only — the one colour allowed to compete with nothing.                                                                                       |

## Typography

- **Display:** Merriweather — weights 700 — fallbacks: Georgia, Times New Roman, serif (Display 48/56 −0.02em (clamp 32–48px), headline-lg 36/44 −0.01em (clamp 28–36px), headline-md 24/32 (clamp 20–24px). Bold only. Display once per page. Guest surface only — the `app` surface uses Inter for every heading. Never body text or labels. Source fallback list was sans-serif; replaced with a serif stack so a missing webfont does not flip the voice. Self-hosted latin woff2 in fonts/ (fonts/fonts.css), matching the app's next/font weights.)
- **Body:** Inter — weights 400, 500, 600, 700 — fallbacks: system-ui, -apple-system, Segoe UI, Helvetica Neue, Arial, sans-serif (title-lg 20/28 600 · body-lg 18/28 · body-md 16/24 (fixed, never scales, max 65ch) · body-sm 14/20 (tables, helper text, ops default) · label-md 14/20 500 · label-sm 12/16 500 · eyebrow 12/16 600 +0.08em uppercase in muted · button 14/20 600 +0.01em. Four weights system-wide (400/500/600/700), no more than two on one screen.)
- **Mono:** Geist Mono — weights 400 — fallbacks: ui-monospace, SFMono-Regular, Menlo, monospace (12/16. Code, timestamps, IDs and technical values; use tabular numerals for data columns.)

## Voice & Tone

- **Adjectives:** restrained, precise, dense, clinical yet warm, calm
- **Tone:** Calm, direct and competent UK English — never excited or salesy. Restrained and 'clinical yet warm'. Guests: short and friendly, next action first, confirm what happened in plain words. Operators: exact labels, never colour alone, name the external effect of an action, and never present an uncertain outcome as success.

### Messaging pillars

- One accent, used for action. Cobalt marks what can be pressed, what is active and where focus is — nothing else.
- Density with hierarchy. Pack information tightly, but separate it through weight, colour and type scale, never through whitespace alone.
- Aesthetic integrity. Dense dashboards get tight spacing and mono numbers; marketing and guest pages get generous padding and display type. Never swap the moods.
- Feedback, not decoration. Every action produces a visible response; motion is brief and purposeful, and silence is never an answer.
- The user is in charge. Light by default, dark on request (the `d` shortcut, persisted), reduced motion honoured, nothing auto-plays or traps scroll.
- Two surfaces, one system. `guest` and `app` share tokens and components; only the heading face, density and button shape change.

### Vocabulary

- **Use:** Nabatable (product name in new copy), Booking, book (UI, URLs and APIs), 'Reserve' only as a verb in marketing copy, UK spelling and date conventions (Saturday 14 June), sentence-case action verbs (Change booking, Seat table), inline error text that names the field, obvious placeholders instead of real guest data
- **Avoid:** Reservation as a noun (use Booking), Nab a Table in new copy (legacy spelling), excited or salesy phrasing, exclamation marks in interface copy, success wording for an uncertain outcome, colour-only status wording, real guest personal data in examples, emoji as functional icons

## Imagery

- **Style:** Product UI is the imagery: white canvas, Zinc tonal layers, 1px borders, cobalt only on actions, monochrome cobalt charts. Samples are real renders from the naba-table design-system bundle.
- **Subjects:** product UI and dashboards, data visualisation on the chart-1…5 cobalt ramp (#8ec5ff → #193cb8), real venue or product photography on guest pages when the content names it
- **Treatment:** Charts use the monochromatic blue ramp with direct labels or pattern fills so colour is never the only key. Photography, when used, sits in rounded-xl (12px) frames with a 1px border and no overlay tint. Icons are 16px line icons paired with text.
- **Avoid:** gradient washes and colour glows beyond the 15% cobalt button-glow, pure-black shadows, decorative or auto-playing motion, colour-only chart keys, warm greys mixed with Zinc

## Layout

- **Radius:** 8px controls (rounded-DEFAULT); 12px cards; 9999px guest buttons and badges
- **Border weight:** 1px
- **Spacing:** 8px base with 4px half-step — xs 4 · sm 8 · md 16 · lg 24 · xl 40 · 2xl 64 · 3xl 96 · 4xl 128

### Posture rules

- Radius scale (restrained, ceiling 20px): sm 6 · DEFAULT 8 · lg 10 · xl 12 · 2xl 14 · 3xl 16 · 4xl 20 · pill 9999. Controls ≤ 8px, cards ≤ 12px, containers ≤ 16px. Never mix radius profiles within one component category.
- Buttons are 36px tall (xs 24 · sm 32 · default 36 · lg 40) with 12px horizontal padding, Inter 14/600. Guest/marketing buttons are capsules; the ops console uses 8px rounded-md so toolbars align with inputs. Every size keeps a 44×44px hit area with 8px between adjacent targets.
- One filled cobalt primary per view. Secondary = Zinc-100 fill + Zinc-900 text (hover #e8e8ea); outline = white + 1px border; ghost = transparent, Zinc-100 on hover; link = cobalt text, underline on hover; destructive = #fef2f2 fill + #c10007 text and never the primary style.
- Primary hover darkens #1447e6 → #1240cf and adds the button-glow shadow 0 10px 15px -3px rgba(20,71,230,.15). Press: scale(0.98) + 1px translateY. Hover never lightens text.
- Cards: white, 1px border, 12px radius, 24px padding, no resting shadow. Interactive cards gain shadow-md on hover; non-interactive cards never change on hover.
- Inputs: 36px, 8px radius, 1px border, labels above (never floating), Inter 14px, error text below in destructive with an icon. Focus replaces the border with the ring colour plus a 3px halo.
- Focus: every focusable element shows a visible ring. The source's #9f9fa9 ring at 30% opacity is below 3:1 on white — pair it with a 2px cobalt (#1447e6) outline at 2px offset so focus passes WCAG non-text contrast.
- Elevation by tonal layering, not shadow: Level 0 canvas → Level 1 card (border, no shadow) → Level 2 popover (1px border + popover shadow, 8px radius). Shadows are Zinc-950 tinted, never pure black. Floating nav uses 80% background + 24px blur; popovers/modals 90% + 16px blur.
- Layout: 12-column CSS Grid, 16px gutter (24px ≥1024px). Containers 1280 max · 768 narrow · 1536 wide, padding 24 → 48 → 96px. Breakpoints 640/768/1024/1280/1536. Asymmetric 5/7 splits and mixed-span bento grids; no uniform three-equal-card rows.
- Chrome: 48px nav height (floating pill ≤768px wide on guest desktop), 256px sidebar on #fafafa collapsing to a 64px icon rail at md and hidden on mobile. Full-height sections use min-height: 100dvh, never 100vh.
- Type scales with clamp() for display/headline tiers only; body-md stays 16px. Body text ≤ 65ch. Must survive 200% text zoom with no horizontal overflow at any width.
- Motion: default ease cubic-bezier(.25,.1,.25,1) for hover/colour; spring (.22,1,.36,1) for reveals; bounce (.34,1.56,.64,1) only for toasts and badge counts. Durations 150 fast · 250 default · 500 slow · 800 reveal. prefers-reduced-motion reduces everything to opacity fades.
- Colour is never the only signal: errors pair destructive colour with icon and text; active nav pairs cobalt with a weight shift; charts add direct labels or patterns.
- Dark mode is re-tuned, not inverted: background #09090b, card/popover/sidebar #18181b, muted/secondary #27272a, muted text #9f9fa9, input #3f3f46, borders rgba(255,255,255,.1). Filled primary is #193cb8 with #eff6ff label (8.1:1); cobalt that carries text or focus on dark surfaces (links, focus ring, sidebar active) is #2b7fff (5.3:1) — #193cb8 is only 2.3:1 on #09090b. Destructive #ff6467. Light is the default regardless of OS; theme switches without transitions.
- Status colours (repo tokens): success #16a34a, warning #f59e0b, info #0ea5e9, destructive #e7000b. None carries small white text (3.3:1, 2.1:1, 2.9:1). Badges use the tint + deep-text pairs: success #15803d on #f0fdf4 (4.8:1), warning #b45309 on #fffbeb (4.8:1), destructive #c10007 on #fef2f2 (5.9:1). Solid warning takes Zinc-950 text.
