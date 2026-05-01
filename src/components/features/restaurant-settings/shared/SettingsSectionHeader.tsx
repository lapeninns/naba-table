import { cn } from '@/lib/utils';

import { SETTINGS_COMPACT_SECTION_HEADER_CLASS } from './compactSettingsClasses';

import type { ReactNode } from 'react';

interface SettingsSectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SettingsSectionHeader({
  title,
  description,
  action,
  className,
}: SettingsSectionHeaderProps) {
  return (
    <div className={cn(SETTINGS_COMPACT_SECTION_HEADER_CLASS, className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-medium leading-6 tracking-tight">{title}</h3>
        {action}
      </div>
      {description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
