import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Radix Luma typography primitives.
 *
 * These bind directly to the `--pg-*` type tokens (font family, the responsive
 * `--pg-text-*` size steps, leading, tracking) rather than the `.pg-*` utility
 * classes, which are scoped to `[data-theme='guest'|'app']` / `.guest-theme`.
 * Binding to the tokens — which resolve at `:root` and every theme selector —
 * means a `<Heading>` / `<Text>` renders identically on guest, ops, and the
 * design-system preview cards, with no theme wrapper required.
 *
 * The scale mirrors the roles the app already uses (hero/section/card,
 * lead/body/caption/eyebrow) and fills the gaps the `.pg-*` layer left open
 * (`label`, `mono`). Sizes are unchanged from today's rendered look — this is
 * codification, not a restyle.
 */

const headingVariants = cva('text-[color:var(--pg-text)] [text-wrap:balance]', {
  variants: {
    variant: {
      display:
        'font-[family-name:var(--pg-font-display)] text-[length:var(--pg-text-hero)] font-bold leading-[1.1667] tracking-[var(--pg-tracking-display)]',
      section:
        'font-[family-name:var(--pg-font-display)] text-[length:var(--pg-text-section)] font-bold leading-[1.22] tracking-[var(--pg-tracking-tight)]',
      card: 'font-[family-name:var(--pg-font-display)] text-[length:var(--pg-text-card-title)] font-semibold leading-[1.22]',
      title:
        'font-[family-name:var(--pg-font-body)] text-[1.25rem] font-semibold leading-[1.4] [text-wrap:pretty]',
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
      lead: 'text-[color:var(--pg-text-muted)] text-[length:var(--pg-text-lead)] leading-[var(--pg-leading-body)] [text-wrap:pretty]',
      body: 'text-[color:var(--pg-text-muted)] text-[length:var(--pg-text-body)] leading-[var(--pg-leading-body)]',
      caption: 'text-[color:var(--pg-text-subtle)] text-[length:var(--pg-text-caption)] leading-[1.45]',
      eyebrow:
        'text-[color:var(--pg-text-muted)] text-[length:var(--pg-text-kicker)] font-semibold uppercase leading-[1.333] tracking-[var(--pg-tracking-wide)]',
      label:
        'text-[color:var(--pg-text)] text-[length:var(--pg-text-caption)] font-medium leading-[1.45]',
      mono: 'font-[family-name:var(--pg-font-mono)] text-[length:var(--pg-text-caption)] leading-[1.333] tabular-nums',
    },
  },
  defaultVariants: { variant: 'body' },
});

type TextProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof textVariants> & {
    /** Override the rendered element (defaults to <p>; use "span" for inline). */
    as?: 'p' | 'span' | 'div' | 'label' | 'dd' | 'dt' | 'figcaption';
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
