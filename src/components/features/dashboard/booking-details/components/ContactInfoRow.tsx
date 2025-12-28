/**
 * ContactInfoRow Component
 *
 * Single Responsibility: Display an icon + label + value row for contact info
 */

'use client';

import { Button } from '@/components/ui/button';

import { ClickToCopy } from './ClickToCopy';

import type { ElementType } from 'react';

export interface ContactInfoRowProps {
  icon: ElementType;
  label: string;
  value: string;
  href?: string;
  copyable?: boolean;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: ElementType;
  };
}

export function ContactInfoRow({
  icon: Icon,
  label,
  value,
  href,
  copyable = false,
  action,
}: ContactInfoRowProps) {
  const ActionIcon = action?.icon;
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
      {action && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-8"
          asChild={Boolean(action.href)}
          onClick={action.href ? undefined : action.onClick}
        >
          {action.href ? (
            <a href={action.href} aria-label={action.label}>
              {ActionIcon ? <ActionIcon className="h-3.5 w-3.5 mr-1" /> : null}
              {action.label}
            </a>
          ) : (
            <>
              {ActionIcon ? <ActionIcon className="h-3.5 w-3.5 mr-1" /> : null}
              {action.label}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
