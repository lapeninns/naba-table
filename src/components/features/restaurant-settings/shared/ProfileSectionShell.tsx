import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

type ProfileSectionShellProps = {
  id?: string;
  title: string;
  description?: string;
  eyebrow?: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ProfileSectionShell({
  id,
  title,
  description,
  eyebrow,
  meta,
  action,
  children,
  className,
  contentClassName,
}: ProfileSectionShellProps) {
  return (
    <Card id={id} className={cn('scroll-mt-28 border-border/70 shadow-none', className)}>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className={cn('flex flex-col gap-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
