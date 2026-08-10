import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { DualSyncToolbarTip } from './DualSyncToolbarTip';

import type {
  DualSyncShellHeaderActionButtonModel,
  DualSyncShellHeaderActionIcon,
} from './dualSyncShellHeaderActionButtonDomain';
import type { LucideIcon } from 'lucide-react';

export interface DualSyncShellHeaderActionButtonProps {
  readonly action: DualSyncShellHeaderActionButtonModel;
  readonly icon: LucideIcon;
  readonly onClick: () => void;
}

export function DualSyncShellHeaderActionButton({
  action,
  icon: Icon,
  onClick,
}: DualSyncShellHeaderActionButtonProps) {
  const button = (
    <Button
      variant={action.variant}
      size="sm"
      onClick={onClick}
      disabled={action.disabled}
      aria-disabled={action.ariaDisabled}
      data-dual-sync-action={action.id}
      className={action.className}
    >
      <Icon data-icon="inline-start" className={getActionIconClassName(action.iconMotion)} />
      {action.label}
    </Button>
  );

  if (!action.tooltip) return button;

  return (
    <DualSyncToolbarTip
      enabledHint={action.tooltip.enabledHint}
      disabledHint={action.tooltip.disabledHint}
      disabled={action.disabled}
    >
      {button}
    </DualSyncToolbarTip>
  );
}

function getActionIconClassName(
  motion: DualSyncShellHeaderActionButtonModel['iconMotion'],
): string | undefined {
  return cn(motion === 'spin' && 'animate-spin', motion === 'pulse' && 'animate-pulse');
}

export type { DualSyncShellHeaderActionIcon };
