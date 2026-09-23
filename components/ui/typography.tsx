import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Radix Luma typography primitives.
 *
 * These bind directly to the `--pg-*` type tokens (font family, the responsive
 * `--pg-text-*` size steps, leading, tracking) rather than the `.pg-*` utility
 * classes, which are scoped to `[data-theme='guest'|'app']` and the guest
 * compatibility class.
 * Binding to the tokens — which resolve at `:root` and every theme selector —
 * means a `<Heading>` / `<Text>` renders identically on guest, ops, and the
 * design-system preview cards, with no theme wrapper required.
 *
 * The scale mirrors the roles the app already uses (hero/section/card,
 * lead/body/caption/eyebrow) and fills the gaps the `.pg-*` layer left open
 * (`label`, `mono`). Sizes, leading and tracking follow the brand type scale
 * in GUEST_FACING_DESIGN_SYSTEM.md (display/headline tiers are fluid via
 * clamp(); body is fixed at 16px).
 */

const headingVariants = cva('text-[color:var(--pg-text)] [text-wrap:balance]', {
  variants: {
    variant: {
      display:
        'font-[family-name:var(--pg-font-display)] text-[length:var(--pg-text-hero)] font-bold leading-[var(--pg-leading-tight)] tracking-[var(--pg-tracking-display)]',
      section:
        'font-[family-name:var(--pg-font-display)] text-[length:var(--pg-text-section)] font-bold leading-[var(--pg-leading-snug)] tracking-[var(--pg-tracking-tight)]',
      card: 'font-[family-name:var(--pg-font-display)] text-[length:var(--pg-text-card-title)] font-bold leading-[var(--pg-leading-heading)]',
      title:
        'font-[family-name:var(--pg-font-body)] text-[length:var(--pg-text-title)] font-semibold leading-[var(--pg-leading-title)] [text-wrap:pretty]',
    },
  },
  defaultVariants: { variant: 'section' },
});

const DEFAULT_HEADING_ELEMENT: Record<
  NonNullable<VariantProps<typeof headingVariants>['variant']>,
  'h1' | 'h2' | 'h3'
> = {
  display: 'h1',
  section: 'h2',
  card: 'h3',
  title: 'h3',
};

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof headingVariants> & {
    /** Override the rendered element (defaults follow the variant's semantic level). */
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  };

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, variant, as, ...props }, ref) => {
    const Comp = as ?? DEFAULT_HEADING_ELEMENT[variant ?? 'section'];
    return (
      <Comp
        ref={ref}
        data-slot="heading"
        className={cn(headingVariants({ variant }), className)}
        {...props}
      />
    );
  },
);
Heading.displayName = 'Heading';

const textVariants = cva('', {
  variants: {
    variant: {
      lead: 'text-[color:var(--pg-text-muted)] text-[length:var(--pg-text-lead)] leading-[var(--pg-leading-lead)] [text-wrap:pretty]',
      body: 'text-[color:var(--pg-text-muted)] text-[length:var(--pg-text-body)] leading-[var(--pg-leading-body)]',
      caption:
        'text-[color:var(--pg-text-subtle)] text-[length:var(--pg-text-caption)] leading-[var(--pg-leading-compact)]',
      eyebrow:
        'text-[color:var(--pg-text-muted)] text-[length:var(--pg-text-kicker)] font-semibold uppercase leading-[var(--pg-leading-heading)] tracking-[var(--pg-tracking-wide)]',
      label:
        'text-[color:var(--pg-text)] text-[length:var(--pg-text-caption)] font-medium leading-[var(--pg-leading-compact)]',
      /** Compact emphasized title — the sans, semibold, foreground role used for
       *  card sub-headers and inline section labels (below the Heading scale). */
      subheading:
        'text-[color:var(--pg-text)] text-[length:var(--pg-text-caption)] font-semibold leading-[var(--pg-leading-compact)]',
      mono: 'font-[family-name:var(--pg-font-mono)] text-[length:var(--pg-text-caption)] leading-[var(--pg-leading-heading)] tabular-nums',
    },
  },
  defaultVariants: { variant: 'body' },
});

type TextProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof textVariants> & {
    /** Override the rendered element (defaults to <p>; use "span" for inline,
     *  or "h3"–"h6" with variant="subheading" for a semantic compact heading). */
    as?: 'p' | 'span' | 'div' | 'label' | 'dd' | 'dt' | 'figcaption' | 'h3' | 'h4' | 'h5' | 'h6';
  };

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ className, variant, as, ...props }, ref) => {
    const Comp = (as ?? 'p') as React.ElementType;
    return (
      <Comp
        ref={ref as React.Ref<HTMLParagraphElement>}
        data-slot="text"
        className={cn(textVariants({ variant }), className)}
        {...props}
      />
    );
  },
);
Text.displayName = 'Text';

export { Heading, headingVariants, Text, textVariants };
export type { HeadingProps, TextProps };
