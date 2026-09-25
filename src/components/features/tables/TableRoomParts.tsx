'use client';

import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { SVGProps } from 'react';

/** Resets the shared Button to a plain surface for tiles, rows and inline links. */
export const BARE_BUTTON_CLASS =
  'min-h-0 min-w-0 h-auto justify-start gap-0 whitespace-normal p-0 font-normal tracking-normal shadow-none active:scale-100 active:translate-y-0 has-[>svg]:px-0';
/** Underlined inline action, like the prototype's link buttons. */
export const LINK_BUTTON_CLASS = `${BARE_BUTTON_CLASS} min-h-6 font-medium text-primary underline underline-offset-2 hover:bg-transparent`;

/** The global base style makes every button 44px; switches keep their own size. */
export const SWITCH_SIZE_CLASS = 'min-h-0 min-w-0 data-[state=checked]:bg-foreground';

/** Touch targets grow to 44px on coarse pointers; desktop keeps the compact size. */
export const TABLE_TOUCH_TARGET_CLASS = '[@media(pointer:coarse)]:min-h-11';

/** Hatching for seats and tables that can't be booked: never colour alone. */
export const HATCH_BAR_CLASS =
  'bg-[repeating-linear-gradient(135deg,var(--color-border)_0_3px,var(--color-muted)_3px_6px)]';
export const HATCH_TILE_CLASS =
  'bg-[repeating-linear-gradient(135deg,var(--color-background)_0_6px,var(--color-muted)_6px_12px)]';
export const HATCH_MINI_CLASS =
  'bg-[repeating-linear-gradient(135deg,var(--color-background)_0_4px,var(--color-muted)_4px_8px)]';
export const JOIN_BAR_CLASS =
  'border border-foreground bg-[repeating-linear-gradient(135deg,var(--color-foreground)_0_2px,var(--color-background)_2px_5px)]';

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
      className={cn('flex min-w-0 max-w-[58px] flex-wrap content-start justify-end gap-[3px]', className)}
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
      <i className="block h-full bg-foreground" style={{ width: `${okWidth}%` }} />
      <i className={cn('block h-full', HATCH_BAR_CLASS)} style={{ width: `${noWidth}%` }} />
    </span>
  );
}

export function LegendSwatch({ kind }: { kind: 'ok' | 'no' }) {
  return (
    <i
      aria-hidden
      className={cn(
        'inline-block h-2 w-3 rounded-[2px]',
        kind === 'ok' ? 'bg-foreground' : cn('border border-border', HATCH_BAR_CLASS),
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
        'inline-block h-3.5 w-[18px] shrink-0 rounded border border-border',
        variant === 'no' && HATCH_MINI_CLASS,
        variant === 'join' && 'outline-2 outline-offset-1 outline-dashed outline-foreground',
      )}
    />
  );
}

export function SegmentedButtons<TValue extends string>({
  label,
  value,
  options,
  onChange,
  idPrefix,
}: {
  label: string;
  value: TValue;
  options: ReadonlyArray<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
  idPrefix: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <Button
            key={option.value}
            id={`${idPrefix}-${option.value}`}
            type="button"
            variant="ghost"
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-9 min-h-0 min-w-0 rounded-md border px-3 text-[13px] font-medium tracking-normal motion-reduce:transition-none [@media(pointer:coarse)]:h-11',
              pressed
                ? 'border-foreground bg-foreground text-background hover:bg-foreground hover:text-background'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
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
