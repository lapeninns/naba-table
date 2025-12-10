// design-system.tsx
import React from "react";
import cx from "classnames";

/\*\*

- Factory Design System
-
- Single source of truth for:
- - Colors, radii, shadows, and global tokens
- - Typography utilities
- - Core atoms & molecules (Icon, Button, Input, etc.)
- - Complex components (SearchBar, MetricTile, Modal, Toast, StyleGuide)
-
- All application UIs should be composed from these primitives and tokens
- rather than introducing new visual primitives (fonts, colors, shadows, etc.).
  \*/

// 1. GLOBAL STYLES & TOKENS
export function GlobalStyles() {
return (
<style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

      :root {
        /* =========================
           TIER 1 — PRIMITIVES
           ========================= */
        --brand-blue: #2563EB; /* Primary Action */
        --brand-blue-hover: #1D4ED8;
        --brand-blue-subtle: #F0F7FF;

        --slate-950: #020617;
        --slate-900: #0F172A;
        --slate-800: #1E293B;
        --slate-700: #334155;
        --slate-600: #475569;
        --slate-500: #64748B;
        --slate-400: #94A3B8;
        --slate-300: #CBD5E1;
        --slate-200: #E2E8F0;
        --slate-100: #F1F5F9;
        --slate-50:  #F8FAFC;
        --white: #FFFFFF;

        --green-600: #059669;
        --amber-500: #F59E0B;
        --red-500: #EF4444;

        /* =========================
           TIER 2 — SEMANTICS
           ========================= */

        --background: var(--white);
        --foreground: var(--slate-900);

        --card: var(--white);
        --card-foreground: var(--slate-900);

        --primary: var(--brand-blue);
        --primary-foreground: var(--white);

        --muted: var(--slate-50);
        --muted-foreground: var(--slate-500);

        --border: var(--slate-200);
        --input: var(--white);
        --ring: var(--brand-blue);

        /* Airbnb-esque Radii: Softer, friendlier */
        --radius-sm: 0.5rem;    /* 8px */
        --radius-md: 0.75rem;   /* 12px */
        --radius-lg: 1rem;      /* 16px */
        --radius-xl: 1.5rem;    /* 24px */
        --radius-full: 9999px;

        /* Shadows: Soft, diffuse, uplifting */
        --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
        --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -1px rgba(0,0,0,0.03);
        --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04);
        --shadow-float: 0 6px 16px rgba(0,0,0,0.08); /* Airbnb style elevation */
      }

      /* TIER 3 — RESET & GLOBAL UTILITIES */
      *, *::before, *::after {
        box-sizing: border-box;
      }

      body {
        font-family: 'Inter', sans-serif;
        color: var(--foreground);
        background-color: var(--background);
        margin: 0;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }

      button, input {
        font-family: inherit;
      }
      button {
        cursor: pointer;
      }

      /* Typography utilities */
      .heading-xl {
        font-size: 3.5rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
      }
      .heading-lg {
        font-size: 2.25rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 1.2;
      }
      .heading-md {
        font-size: 1.5rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.3;
      }
      .text-body  {
        font-size: 1.0625rem;
        font-weight: 400;
        color: var(--slate-600);
        line-height: 1.6;
      }

      .text-subtle { color: var(--muted-foreground); }
      .text-brand { color: var(--brand-blue); }

      .bg-surface { background-color: var(--background); }

      .shadow-card {
        box-shadow: var(--shadow-sm);
        border: 1px solid var(--border);
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }
      .shadow-card:hover {
        box-shadow: var(--shadow-lg);
        transform: translateY(-2px);
      }

      .fade-in {
        animation: fadeIn 0.4s ease-out;
      }
      .slide-up {
        animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      /* Component-specific base styles */
      .input-base {
        width: 100%;
        border-radius: var(--radius-md);
        background-color: var(--input);
        border: 1px solid var(--border);
        padding: 0.75rem 1rem;
        color: var(--foreground);
        font-size: 0.9375rem;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .input-base:focus {
        outline: none;
        border-color: var(--brand-blue);
        box-shadow: 0 0 0 4px var(--brand-blue-subtle);
      }

      .input-base[data-invalid="true"] {
        border-color: var(--red-500);
        box-shadow: 0 0 0 1px var(--red-500);
      }
      .input-base[data-invalid="true"]::placeholder {
        color: var(--red-500);
      }

      /* Search Pill Specifics */
      .search-pill-container {
        box-shadow: 0 3px 12px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.08);
        border: 1px solid var(--slate-200);
      }
      .search-pill-section:hover {
        background-color: var(--slate-100);
        border-radius: 9999px;
      }

      /* Modal Backdrop */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        z-index: 40;
        backdrop-filter: blur(6px);
      }

      @media (prefers-reduced-motion: reduce) {
        .fade-in,
        .slide-up {
          animation: none;
        }
      }
    `}</style>

);
}

// 2. ATOMS & MOLECULES

export function Icon({ name, className }) {
const common = {
viewBox: "0 0 24 24",
fill: "currentColor",
className: cx("w-5 h-5 inline-block shrink-0", className),
};

const icons = {
menu: <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />,
close: (
<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
),
check: <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />,
arrowRight: (
<path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
),
chart: (
<path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
),
shield: (
<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
),
zap: (
<path
        d="M7 21h10v-9h-5v-6h5v-2h-10v9h5v6z"
        fill="currentColor"
      />
),
search: (
<path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
),
calendar: (
<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
),
user: (
<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
),
clock: (
<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
),
star: (
<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
),
};

return <svg {...common}>{icons[name] || icons.check}</svg>;
}

export function Spinner({ className }) {
return (
<svg
className={cx("animate-spin -ml-1 mr-2 h-4 w-4", className)}
xmlns="http://www.w3.org/2000/svg"
fill="none"
viewBox="0 0 24 24" >
<circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
<path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
</svg>
);
}

// Updated Button: Rounder, friendlier
export function Button({
variant = "primary",
size = "md",
fullWidth,
iconOnly,
loading,
leftIcon,
rightIcon,
children,
className,
...props
}) {
const baseClasses =
"inline-flex items-center justify-center font-semibold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--ring)] disabled:opacity-50 disabled:cursor-not-allowed text-sm rounded-full";

const variants = {
primary:
"bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110 border border-transparent shadow-sm",
secondary:
"bg-[var(--white)] text-[var(--slate-900)] hover:bg-[var(--slate-50)] border border-[var(--border)]",
ghost:
"bg-transparent text-[var(--slate-700)] hover:bg-[var(--slate-100)] border border-transparent",
};

const sizes = {
sm: "px-4 py-2",
md: "px-6 py-3",
lg: "px-8 py-4 text-base",
};
const iconPad = {
sm: "p-2",
md: "p-3",
lg: "p-4",
};

return (
<button
className={cx(
baseClasses,
variants[variant],
iconOnly ? iconPad[size] : sizes[size],
fullWidth ? "w-full" : "",
className
)}
disabled={loading || props.disabled}
{...props} >
{loading ? (
<Spinner />
) : leftIcon ? (
<span className={cx(iconOnly ? "" : "mr-2")}>{leftIcon}</span>
) : null}
{!iconOnly && children}
{!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
</button>
);
}

export function Badge({ tone = "neutral", children }) {
const tones = {
neutral: "bg-[var(--slate-100)] text-[var(--slate-700)]",
success: "bg-[var(--brand-blue-subtle)] text-[var(--brand-blue)]",
warning: "bg-[var(--amber-500)]/10 text-[var(--amber-500)]",
};
return (
<span
className={cx(
"inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold",
tones[tone]
)} >
{children}
</span>
);
}

export function Input({ invalid, className, icon, ...props }) {
return (
<div className="relative">
{icon && (
<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--slate-400)]">
<Icon name={icon} className="h-5 w-5" />
</div>
)}
<input
className={cx("input-base", icon ? "pl-10" : "", className)}
data-invalid={invalid ? "true" : undefined}
{...props}
/>
</div>
);
}

// 3. COMPLEX COMPONENTS

// Airbnb-style Horizontal Search Bar
export function SearchBar({ onSearch }) {
return (
<div className="search-pill-container bg-[var(--card)] rounded-full flex flex-col md:flex-row items-center p-2 max-w-4xl mx-auto relative z-20">
{/_ Location _/}
<div className="search-pill-section w-full md:flex-1 px-6 py-2 cursor-pointer relative group border-b md:border-b-0 border-[var(--slate-100)]">
<label className="block text-xs font-bold text-[var(--slate-900)] mb-0.5">
Where
</label>
<input
          type="text"
          placeholder="Search destinations"
          className="w-full bg-transparent border-none p-0 text-sm text-[var(--slate-600)] placeholder:text-[var(--slate-400)] focus:ring-0 focus:outline-none"
        />
<div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-8 w-[1px] bg-[var(--slate-200)] group-hover:hidden"></div>
</div>

      {/* Date */}
      <div className="search-pill-section w-full md:flex-1 px-6 py-2 cursor-pointer relative group border-b md:border-b-0 border-[var(--slate-100)]">
        <label className="block text-xs font-bold text-[var(--slate-900)] mb-0.5">
          Date
        </label>
        <div className="text-sm text-[var(--slate-600)]">Add dates</div>
        <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-8 w-[1px] bg-[var(--slate-200)] group-hover:hidden"></div>
      </div>

      {/* Time */}
      <div className="search-pill-section w-full md:flex-1 px-6 py-2 cursor-pointer relative group border-b md:border-b-0 border-[var(--slate-100)]">
        <label className="block text-xs font-bold text-[var(--slate-900)] mb-0.5">
          Time
        </label>
        <div className="text-sm text-[var(--slate-600)]">Add time</div>
        <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-8 w-[1px] bg-[var(--slate-200)] group-hover:hidden"></div>
      </div>

      {/* Guests */}
      <div className="search-pill-section w-full md:flex-1 px-6 py-2 cursor-pointer relative group">
        <label className="block text-xs font-bold text-[var(--slate-900)] mb-0.5">
          Who
        </label>
        <div className="text-sm text-[var(--slate-600)]">Add guests</div>
      </div>

      {/* Search Button (Round) */}
      <div className="p-2 w-full md:w-auto">
        <button
          onClick={onSearch}
          className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white p-4 rounded-full transition-all shadow-md hover:scale-105 flex items-center justify-center gap-2 w-full md:w-auto"
        >
          <Icon name="search" className="w-5 h-5 font-bold" />
          <span className="font-semibold pr-1 inline md:hidden lg:inline">
            Search
          </span>
        </button>
      </div>
    </div>

);
}

export function MetricTile({ label, value, detail, icon }) {
return (
<div className="shadow-card rounded-xl p-6 flex flex-col gap-4 bg-[var(--card)] h-full">
<div className="flex justify-between items-start">
<div className="bg-[var(--slate-50)] p-2 rounded-full text-[var(--slate-900)]">
{icon ? icon : <Icon name="chart" />}
</div>
{detail && <Badge tone="success">{detail}</Badge>}
</div>
<div>
<div className="text-[var(--slate-500)] text-sm font-medium mb-1">
{label}
</div>
<div className="text-[var(--slate-900)] text-3xl font-bold tracking-tight">
{value}
</div>
</div>
</div>
);
}

export function Modal({ isOpen, onClose, title, children }) {
if (!isOpen) return null;
return (
<div className="modal-backdrop fade-in" onClick={onClose}>
<div
className="bg-[var(--card)] w-full max-w-md rounded-2xl shadow-2xl slide-up overflow-hidden"
onClick={(e) => e.stopPropagation()} >
<div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
<h3 className="text-lg font-bold text-[var(--slate-900)]">
{title}
</h3>
<Button
variant="ghost"
size="sm"
iconOnly
onClick={onClose}
leftIcon={<Icon name="close" />}
className="rounded-full"
/>
</div>
<div className="p-6">{children}</div>
</div>
</div>
);
}

export function Toast({ tone = "neutral", message, onDismiss }) {
const tones = {
neutral:
"bg-[var(--card)] border border-[var(--border)] text-[var(--slate-900)]",
success: "bg-[var(--slate-900)] text-white border-transparent",
};
return (
<div
className={cx(
"rounded-xl p-4 shadow-float min-w-[320px] flex items-center justify-between slide-up",
tones[tone]
)} >
<span className="text-sm font-medium px-2">{message}</span>
<button onClick={onDismiss} className="opacity-70 hover:opacity-100">
<Icon name="close" className="w-4 h-4" />
</button>
</div>
);
}

// --- STYLE GUIDE PAGE (DOCUMENTATION) ---

export const StyleGuide = () => {
return (
<div className="min-h-screen bg-[var(--slate-50)] pt-24 pb-20 px-6">
<div className="max-w-6xl mx-auto space-y-16">
{/_ Header _/}
<div className="space-y-4">
<h1 className="heading-lg text-[var(--slate-900)]">Design System</h1>
<p className="text-body max-w-2xl">
A collection of foundational tokens and reusable components inspired
by Airbnb&apos;s design principles. Optimized for clarity,
friendliness, and utility.
</p>
</div>

        {/* 1. Colors */}
        <section className="space-y-6">
          <h2 className="heading-md border-b border-[var(--border)] pb-2 text-[var(--slate-900)]">
            1. Color Palette
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-[var(--brand-blue)] shadow-sm"></div>
              <div className="flex justify-between text-xs font-mono text-[var(--slate-500)]">
                <span>Brand Blue</span>
                <span>#2563EB</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-[var(--brand-blue-subtle)] border border-[var(--border)]"></div>
              <div className="flex justify-between text-xs font-mono text-[var(--slate-500)]">
                <span>Blue Subtle</span>
                <span>#F0F7FF</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-[var(--slate-900)] shadow-sm"></div>
              <div className="flex justify-between text-xs font-mono text-[var(--slate-500)]">
                <span>Slate 900</span>
                <span>#0F172A</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-[var(--slate-50)] border border-[var(--border)]"></div>
              <div className="flex justify-between text-xs font-mono text-[var(--slate-500)]">
                <span>Slate 50</span>
                <span>#F8FAFC</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Typography */}
        <section className="space-y-6">
          <h2 className="heading-md border-b border-[var(--border)] pb-2 text-[var(--slate-900)]">
            2. Typography
          </h2>
          <div className="bg-[var(--card)] rounded-2xl p-8 shadow-sm border border-[var(--border)] space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-baseline">
              <span className="text-xs font-mono text-[var(--slate-400)]">
                Heading XL
              </span>
              <h1 className="heading-xl col-span-2 text-[var(--slate-900)]">
                The quick brown fox
              </h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-baseline">
              <span className="text-xs font-mono text-[var(--slate-400)]">
                Heading LG
              </span>
              <h2 className="heading-lg col-span-2 text-[var(--slate-900)]">
                The quick brown fox
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-baseline">
              <span className="text-xs font-mono text-[var(--slate-400)]">
                Heading MD
              </span>
              <h3 className="heading-md col-span-2 text-[var(--slate-900)]">
                The quick brown fox jumps over the lazy dog
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-baseline">
              <span className="text-xs font-mono text-[var(--slate-400)]">
                Body
              </span>
              <p className="text-body col-span-2">
                Factory design system uses Inter, a variable font family
                carefully crafted &amp; designed for computer screens. It
                features a tall x-height to aid in readability of mixed-case and
                lower-case text.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Buttons */}
        <section className="space-y-6">
          <h2 className="heading-md border-b border-[var(--border)] pb-2 text-[var(--slate-900)]">
            3. Buttons
          </h2>
          <div className="bg-[var(--card)] rounded-2xl p-8 shadow-sm border border-[var(--border)] space-y-8">
            <div className="flex flex-wrap gap-4 items-center">
              <Button size="lg">Primary Large</Button>
              <Button>Primary Medium</Button>
              <Button size="sm">Primary Small</Button>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <Button variant="secondary" size="lg">
                Secondary Large
              </Button>
              <Button variant="secondary">Secondary Medium</Button>
              <Button variant="secondary" size="sm">
                Secondary Small
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <Button variant="ghost">Ghost Button</Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
              <Button iconOnly size="md" leftIcon={<Icon name="search" />} />
              <Button
                iconOnly
                variant="secondary"
                size="md"
                leftIcon={<Icon name="menu" />}
              />
            </div>
          </div>
        </section>

        {/* 4. Inputs & Badges */}
        <section className="space-y-6">
          <h2 className="heading-md border-b border-[var(--border)] pb-2 text-[var(--slate-900)]">
            4. Inputs & Utilities
          </h2>
          <div className="bg-[var(--card)] rounded-2xl p-8 shadow-sm border border-[var(--border)] grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-[var(--slate-900)]">
                Inputs
              </h4>
              <Input placeholder="Default Input" />
              <Input placeholder="With Icon" icon="search" />
              <Input
                placeholder="Invalid State"
                invalid
                defaultValue="Invalid Value"
              />
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-[var(--slate-900)]">
                Badges
              </h4>
              <div className="flex gap-2">
                <Badge tone="neutral">Neutral</Badge>
                <Badge tone="success">Success</Badge>
                <Badge tone="warning">Warning</Badge>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Components */}
        <section className="space-y-6">
          <h2 className="heading-md border-b border-[var(--border)] pb-2 text-[var(--slate-900)]">
            5. Components
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <span className="text-xs font-mono text-[var(--slate-400)]">
                Metric Tile
              </span>
              <MetricTile label="Revenue" value="$42,500" detail="+12%" />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-mono text-[var(--slate-400)]">
                Search Bar
              </span>
              <div className="bg-[var(--card)] p-6 rounded-xl border border-[var(--border)]">
                <div className="border rounded-full p-2 flex items-center justify-between shadow-sm">
                  <div className="px-4 text-sm font-bold">Location</div>
                  <div className="bg-[var(--brand-blue)] rounded-full p-2 text-white">
                    <Icon name="search" className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

);
};
