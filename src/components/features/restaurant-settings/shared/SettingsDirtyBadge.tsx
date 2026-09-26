import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { SETTINGS_SAVE_COPY } from './compactSettingsClasses';

type SettingsDirtyBadgeProps = {
  className?: string;
  label?: string;
};

/**
 * The single "unsaved changes" marker for restaurant settings. Text-labelled so
 * dirty state is never colour-only.
 */
export function SettingsDirtyBadge({
  className,
  label = SETTINGS_SAVE_COPY.dirty,
}: SettingsDirtyBadgeProps) {
  return (
    <Badge variant="status-pending" className={cn('whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
