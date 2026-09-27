import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const SETTINGS_DIRTY_BADGE_LABEL = 'Edited';

type SettingsDirtyBadgeProps = {
  className?: string;
  label?: string;
};

/**
 * The single section dirty marker for restaurant settings ("Edited"). Text-labelled so
 * dirty state is never colour-only.
 */
export function SettingsDirtyBadge({
  className,
  label = SETTINGS_DIRTY_BADGE_LABEL,
}: SettingsDirtyBadgeProps) {
  return (
    <Badge variant="status-pending" className={cn('whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
