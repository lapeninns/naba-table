import { forwardRef } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { BookingActionButtonConfig } from './bookingActionButtonDomain';
import type { MouseEvent } from 'react';

export type BookingActionControlButtonProps = {
  'aria-disabled'?: boolean;
  className?: string;
  config: BookingActionButtonConfig;
  disabled: boolean;
  disabledReason: string | null;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onPress: () => void;
  pending: boolean;
};

export const BookingActionControlButton = forwardRef<
  HTMLButtonElement,
  BookingActionControlButtonProps
>(function BookingActionControlButton(
  {
    'aria-disabled': ariaDisabled,
    className,
    config,
    disabled,
    disabledReason,
    onClick,
    onPress,
    pending,
  },
  ref,
) {
  const button = (
    <Button
      ref={ref}
      aria-disabled={ariaDisabled}
      variant={config.variant}
      size="sm"
      className={cn(
        'h-11 w-full touch-manipulation font-semibold sm:w-auto sm:min-w-[140px]',
        className,
      )}
      disabled={disabled}
      onClick={(event) => {
        if (disabled) return;
        if (onClick) {
          onClick(event);
          return;
        }
        onPress();
      }}
    >
      {pending ? `${config.label}…` : config.label}
    </Button>
  );

  if (!disabledReason) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
        {disabledReason}
      </TooltipContent>
    </Tooltip>
  );
});
