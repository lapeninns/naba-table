import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { SettingsSectionHeader } from './shared';

import type { ReactNode } from 'react';

type GoogleBusinessProfilePanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function GoogleBusinessProfilePanel({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: GoogleBusinessProfilePanelProps) {
  return (
    <section className={cn('rounded-2xl border border-border/60 bg-background/95', className)}>
      <div className="px-5 py-5 sm:px-6">
        <SettingsSectionHeader
          title={title}
          description={description}
          action={action ? <div className="shrink-0">{action}</div> : null}
          className="pb-0"
        />
      </div>
      <Separator />
      <div className={cn('px-5 py-5 sm:px-6', contentClassName)}>{children}</div>
    </section>
  );
}
