'use client';

import { AlertCircle, CheckCircle2, MinusCircle, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { TableBookingStatus } from './tableInventoryDisplayDomain';

/** Touch targets grow to 44px on coarse pointers; desktop keeps the compact size. */
export const TABLE_TOUCH_TARGET_CLASS = '[@media(pointer:coarse)]:min-h-11';
const TABLE_ICON_TOUCH_TARGET_CLASS =
  '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

/** The one computed Bookings status: icon and text, never colour alone. */
export function TableBookingStatusLabel({
  status,
  className,
}: {
  status: TableBookingStatus;
  className?: string;
}) {
  const Icon = status.bookable ? CheckCircle2 : MinusCircle;
  return (
    <span
      className={cn(
        'inline-flex items-start gap-1.5 text-sm leading-5',
        status.bookable ? 'text-success-text' : 'text-muted-foreground',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{status.label}</span>
    </span>
  );
}

/** Icon-only row action with a visible tooltip and an accessible name. */
export function TableIconButton({
  label,
  tooltip,
  Icon,
  onClick,
  disabled,
  destructive = false,
}: {
  label: string;
  tooltip: string;
  Icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(TABLE_ICON_TOUCH_TARGET_CLASS, destructive && 'text-destructive')}
        >
          <Icon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** Field error below its input, linked through `aria-describedby`. */
export function TableFieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-xs leading-5 text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
  const value = ids.filter(Boolean).join(' ');
  return value.length > 0 ? value : undefined;
}
