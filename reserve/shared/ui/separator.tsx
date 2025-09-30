'use client';

import * as SeparatorPrimitive from '@radix-ui/react-separator';

import { cn } from '@shared/lib/cn';

const Separator = ({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: SeparatorPrimitive.SeparatorProps) => {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-srx-border-subtle',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
};

Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
