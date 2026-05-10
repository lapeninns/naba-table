import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
} from './compactSettingsClasses';

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
  /** When true, only the content area is rendered (e.g. title lives in an Accordion trigger). */
  suppressHeader?: boolean;
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
  suppressHeader = false,
}: ProfileSectionShellProps) {
  return (
    <Card
      id={id}
      className={cn(
        'scroll-mt-24',
        SETTINGS_COMPACT_CARD_CLASS,
        suppressHeader && 'border-0 bg-transparent shadow-none',
        className,
      )}
    >
      {suppressHeader ? null : (
        <CardHeader
          className={cn(
            'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
            SETTINGS_COMPACT_CARD_HEADER_CLASS,
          )}
        >
          <div className="flex min-w-0 flex-col gap-2">
            {eyebrow ? (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base leading-6">{title}</CardTitle>
              {description ? (
                <CardDescription className="text-xs leading-5">{description}</CardDescription>
              ) : null}
            </div>
            {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      )}
      <CardContent
        className={cn(
          'flex flex-col gap-4',
          SETTINGS_COMPACT_CARD_CONTENT_CLASS,
          suppressHeader && 'pt-0',
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
