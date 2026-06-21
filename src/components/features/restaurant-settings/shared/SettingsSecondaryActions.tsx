'use client';

import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

type SettingsSecondaryActionsProps = {
  label: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SettingsSecondaryActions({
  label,
  children,
  className,
  contentClassName,
}: SettingsSecondaryActionsProps) {
  return (
    <Collapsible className={cn('flex w-full flex-col gap-2 sm:w-auto', className)}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="group w-fit">
          {label}
          <ChevronDown
            data-icon="inline-end"
            className="transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          'flex flex-col gap-2 rounded-md border border-border/60 bg-background p-2 sm:min-w-52',
          contentClassName,
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
