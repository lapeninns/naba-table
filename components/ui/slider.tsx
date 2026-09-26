'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type SliderProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> & {
  value: number;
  onValueChange: (value: number) => void;
};

/**
 * Single-thumb range slider on a native `<input type="range">`, so keyboard,
 * touch and screen-reader behaviour come from the platform. Pass
 * `aria-valuetext` when the raw number is not meaningful (e.g. a time).
 */
function Slider({ className, value, onValueChange, ...props }: SliderProps) {
  return (
    <input
      type="range"
      data-slot="slider"
      value={value}
      onChange={(event) => onValueChange(Number(event.currentTarget.value))}
      className={cn(
        'h-6 w-full min-w-0 cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-50',
        '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border',
        '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-border',
        '[&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm',
        '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background',
        'focus-visible:[&::-webkit-slider-thumb]:ring-[3px] focus-visible:[&::-webkit-slider-thumb]:ring-ring/30',
        className,
      )}
      {...props}
    />
  );
}

export { Slider };
export type { SliderProps };
