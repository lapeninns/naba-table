'use client';

import { AlertCircle } from 'lucide-react';

import { SETTINGS_INLINE_LINK_CLASS } from '@/components/features/restaurant-settings/shared';
import { cn } from '@/lib/utils';

import type { SVGProps } from 'react';

/** Resets the shared Button to a plain surface for tiles, rows and inline links. */
export const BARE_BUTTON_CLASS =
  'min-h-0 min-w-0 h-auto justify-start gap-0 whitespace-normal p-0 font-normal tracking-normal shadow-none active:scale-100 active:translate-y-0 has-[>svg]:px-0';
/** Inline text action styled as the shared settings link. */
export const LINK_BUTTON_CLASS = `${BARE_BUTTON_CLASS} min-h-6 ${SETTINGS_INLINE_LINK_CLASS} hover:bg-transparent`;

/** Touch targets grow to 44px on coarse pointers; desktop keeps the compact size. */
export const TABLE_TOUCH_TARGET_CLASS = '[@media(pointer:coarse)]:min-h-11';

/** Select lists stay inside a phone viewport and clear of its edges (RR6). */
export const TABLE_SELECT_COLLISION_PADDING = 16;
export const TABLE_SELECT_CONTENT_CLASS = 'max-w-[calc(100vw-2rem)]';

/** Hatching for seats and tables that can't be booked: never colour alone. Muted, low opacity. */
export const HATCH_BAR_CLASS =
  'bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--color-muted-foreground)_35%,transparent)_0_3px,var(--color-muted)_3px_6px)]';
export const HATCH_TILE_CLASS =
  'bg-[repeating-linear-gradient(135deg,var(--color-background)_0_6px,color-mix(in_oklab,var(--color-muted-foreground)_12%,transparent)_6px_12px)]';
export const HATCH_MINI_CLASS =
  'bg-[repeating-linear-gradient(135deg,var(--color-background)_0_4px,color-mix(in_oklab,var(--color-muted-foreground)_20%,transparent)_4px_8px)]';
/** Party sizes reached only by joining tables: primary stripes beside the solid primary bars. */
export const JOIN_BAR_CLASS =
  'border border-primary bg-[repeating-linear-gradient(135deg,var(--color-primary)_0_2px,var(--color-background)_2px_5px)]';
/** Tables that can join the selected one: a dashed primary outline, beside the solid selection. */
export const JOIN_OUTLINE_CLASS = 'outline-2 outline-offset-1 outline-dashed outline-primary';

function SmallIcon({ children, className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Fixed: always used on its own. */
export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SmallIcon {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </SmallIcon>
  );
}

/** Two tables side by side: joining. */
export function JoinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SmallIcon {...props}>
      <rect x="3" y="7" width="8" height="10" rx="1.5" />
      <rect x="13" y="7" width="8" height="10" rx="1.5" />
    </SmallIcon>
  );
}

export function SeatDots({
  dots,
  overflow = 0,
  muted = false,
  className,
}: {
  dots: ReadonlyArray<boolean>;
  overflow?: number;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn('flex min-w-0 max-w-14 flex-wrap content-start justify-end gap-0.5', className)}
    >
      {dots.map((filled, index) => (
        <i
          key={index}
          className={cn(
            'size-1.5 rounded-full',
            filled
              ? muted
                ? 'bg-muted-foreground'
                : 'bg-foreground'
              : 'bg-transparent shadow-[inset_0_0_0_1px_var(--color-muted-foreground)]',
          )}
        />
      ))}
      {overflow > 0 ? <b className="text-xs leading-none">+{overflow}</b> : null}
    </span>
  );
}

/** Bookable share of seats: solid for bookable, hatched for not bookable. */
export function CapacityBar({
  bookable,
  total,
  className,
  label,
}: {
  bookable: number;
  total: number;
  className?: string;
  /** Accessible summary; the bar is decorative without it. */
  label?: string;
}) {
  const okWidth = total > 0 ? (bookable / total) * 100 : 0;
  const noWidth = total > 0 ? ((total - bookable) / total) * 100 : 0;
  return (
    <span
      className={cn('flex h-2.5 overflow-hidden rounded-full bg-muted', className)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <i className="block h-full bg-primary" style={{ width: `${okWidth}%` }} />
      <i className={cn('block h-full', HATCH_BAR_CLASS)} style={{ width: `${noWidth}%` }} />
    </span>
  );
}

export function LegendSwatch({ kind }: { kind: 'ok' | 'no' | 'join' }) {
  return (
    <i
      aria-hidden
      className={cn(
        'inline-block h-2 w-3 shrink-0 rounded-xs',
        kind === 'ok' && 'bg-primary',
        kind === 'no' && cn('border border-border', HATCH_BAR_CLASS),
        kind === 'join' && JOIN_BAR_CLASS,
      )}
    />
  );
}

/** Small tile swatch for the room key. */
export function MiniTile({ variant }: { variant: 'ok' | 'no' | 'join' }) {
  return (
    <i
      aria-hidden
      className={cn(
        'inline-block h-3.5 w-4.5 shrink-0 rounded border border-border',
        variant === 'no' && HATCH_MINI_CLASS,
        // The dashed outline sits 3px outside the swatch; the margin keeps it off the gutter and
        // clear of its label.
        variant === 'join' && cn(JOIN_OUTLINE_CLASS, 'm-0.75'),
      )}
    />
  );
}

/** Field error below its input, linked through `aria-describedby`. */
export function TableFieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-xs font-semibold leading-5 text-foreground">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
  const value = ids.filter(Boolean).join(' ');
  return value.length > 0 ? value : undefined;
}
