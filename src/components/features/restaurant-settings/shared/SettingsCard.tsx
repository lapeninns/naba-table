import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_FOOTER_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
} from './compactSettingsClasses';

import type { ReactNode } from 'react';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  stickyFooter?: boolean;
}

export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
  headerAction,
  contentClassName,
  headerClassName,
  footerClassName,
  stickyFooter = false,
}: SettingsCardProps) {
  return (
    <Card className={cn('w-full overflow-hidden', SETTINGS_COMPACT_CARD_CLASS, className)}>
      <CardHeader
        className={cn(
          SETTINGS_COMPACT_CARD_HEADER_CLASS,
          'border-b border-border/60 bg-muted/30',
          headerClassName,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="text-base leading-6 text-foreground">{title}</CardTitle>
            {description ? (
              <CardDescription className="text-xs leading-5">{description}</CardDescription>
            ) : null}
          </div>
          {headerAction ? <div className="min-w-0 sm:shrink-0">{headerAction}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn(SETTINGS_COMPACT_CARD_CONTENT_CLASS, contentClassName)}>
        {children}
      </CardContent>
      {footer ? (
        <CardFooter
          className={cn(
            stickyFooter
              ? SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS
              : SETTINGS_COMPACT_CARD_FOOTER_CLASS,
            footerClassName,
          )}
        >
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
