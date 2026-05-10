/**
 * ContactInfoRow Component
 *
 * Single Responsibility: Display an icon + label + value row for contact info
 */

'use client';

import { Button } from '@/components/ui/button';

import { ClickToCopy } from './ClickToCopy';

import type { ElementType } from 'react';

export type ContactInfoRowAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ElementType;
};

export interface ContactInfoRowProps {
  icon: ElementType;
  label: string;
  value: string;
  href?: string;
  copyable?: boolean;
  action?: ContactInfoRowAction;
  actions?: ContactInfoRowAction[];
}

export function ContactInfoRow({
  icon: Icon,
  label,
  value,
  href,
  copyable = false,
  action,
  actions,
}: ContactInfoRowProps) {
  const resolvedActions = actions ?? (action ? [action] : []);
  const content = copyable ? (
    <ClickToCopy text={value} label={label} />
  ) : href ? (
    <Button asChild variant="link" className="h-auto justify-start p-0 text-sm">
      <a href={href}>{value}</a>
    </Button>
  ) : (
    <span className="text-sm text-muted-foreground">{value}</span>
  );

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="size-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {content}
      </div>
      {resolvedActions.length > 0 && (
        <div className="ml-auto flex items-center gap-2">
          {resolvedActions.map((item, index) => {
            const ActionIcon = item.icon;
            return (
              <Button
                key={`${item.label}-${index}`}
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                asChild={Boolean(item.href)}
                onClick={item.href ? undefined : item.onClick}
              >
                {item.href ? (
                  <a href={item.href} aria-label={item.label}>
                    {ActionIcon ? <ActionIcon className="size-3.5 mr-1" /> : null}
                    {item.label}
                  </a>
                ) : (
                  <>
                    {ActionIcon ? <ActionIcon className="size-3.5 mr-1" /> : null}
                    {item.label}
                  </>
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
