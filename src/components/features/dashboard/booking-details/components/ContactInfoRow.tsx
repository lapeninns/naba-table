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
    <a href={href} className="text-sm text-slate-700 hover:text-blue-600 hover:underline">
      {value}
    </a>
  ) : (
    <span className="text-sm text-slate-700">{value}</span>
  );

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
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
                    {ActionIcon ? <ActionIcon className="h-3.5 w-3.5 mr-1" /> : null}
                    {item.label}
                  </a>
                ) : (
                  <>
                    {ActionIcon ? <ActionIcon className="h-3.5 w-3.5 mr-1" /> : null}
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
