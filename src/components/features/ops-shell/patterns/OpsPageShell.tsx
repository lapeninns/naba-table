'use client';

import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type OpsPageShellVariant = 'standard' | 'immersive';

export type OpsPageShellProps = {
  /** Container variant. Defaults to 'standard' for list/table pages. */
  variant?: OpsPageShellVariant;
  children: ReactNode;
  className?: string;
  /** Semantic HTML element. Defaults to 'main'. */
  as?: 'main' | 'div' | 'section';
};

const variantClasses: Record<OpsPageShellVariant, string> = {
  // List/table/detail-management pages: bookings, customers, dashboard, rejections, delivery.
  standard: 'mx-auto w-full max-w-[1200px] px-[var(--pg-gutter)] py-[var(--pg-section-y-tight)]',
  // Split-pane/editor-style experiences.
  immersive: 'h-[calc(100vh-3.5rem)] w-full min-w-0 overflow-hidden',
};

/**
 * Canonical ops page container.
 *
 * Wraps page content in a consistent layout shell with standardized
 * width and padding. The shell does NOT enforce internal vertical spacing —
 * pages compose their own rhythm (space-y-*, gap-*, flex/grid gaps) inside.
 *
 * @example
 * ```tsx
 * <OpsPageShell variant="standard">
 *   <OpsPageHeader title="Bookings" />
 *   <div className="space-y-4">
 *     <OpsPageToolbar ... />
 *     <Table>...</Table>
 *   </div>
 * </OpsPageShell>
 * ```
 */
export function OpsPageShell({
  variant = 'standard',
  children,
  className,
  as: Element = 'main',
}: OpsPageShellProps) {
  return (
    <Element
      data-testid="ops-page-shell"
      data-variant={variant}
      className={cn(variantClasses[variant], className)}
    >
      {children}
    </Element>
  );
}
