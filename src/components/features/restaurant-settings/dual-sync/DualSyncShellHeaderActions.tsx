import {
  Filter,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Send,
  type LucideIcon,
  Zap,
} from 'lucide-react';

import { DualSyncShellHeaderActionButton } from './DualSyncShellHeaderActionButton';
import { getDualSyncShellHeaderActionButtonModels } from './dualSyncShellHeaderActionButtonDomain';

export type DualSyncShellHeaderActionsProps = Parameters<
  typeof getDualSyncShellHeaderActionButtonModels
>[0] & {
  readonly onToggleDriftOnly: () => void;
  readonly onToggleControl: () => void;
  readonly onRefresh: () => void;
  readonly onAutoExport: () => void;
  readonly onPublish: () => void;
};

export function DualSyncShellHeaderActions({
  onToggleDriftOnly,
  onToggleControl,
  onRefresh,
  onAutoExport,
  onPublish,
  ...actionInput
}: DualSyncShellHeaderActionsProps) {
  const actions = getDualSyncShellHeaderActionButtonModels(actionInput);
  const handlers = {
    drift: onToggleDriftOnly,
    control: onToggleControl,
    refresh: onRefresh,
    autoExport: onAutoExport,
    publish: onPublish,
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
      {actions.map((action) => (
        <DualSyncShellHeaderActionButton
          key={action.id}
          action={action}
          icon={ACTION_ICONS[action.icon]}
          onClick={handlers[action.id]}
        />
      ))}
    </div>
  );
}

type DualSyncShellHeaderActionIcon = ReturnType<
  typeof getDualSyncShellHeaderActionButtonModels
>[number]['icon'];

const ACTION_ICONS: Record<DualSyncShellHeaderActionIcon, LucideIcon> = {
  filter: Filter,
  pause: PauseCircle,
  play: PlayCircle,
  refresh: RefreshCw,
  zap: Zap,
  send: Send,
};
