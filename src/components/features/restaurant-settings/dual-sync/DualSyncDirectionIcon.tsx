import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

import type { DualSyncDirectionIconKey } from './dualSyncDirectionDomain';

interface DualSyncDirectionIconProps {
  readonly iconKey: DualSyncDirectionIconKey;
  readonly className?: string;
}

export function DualSyncDirectionIcon({ iconKey, className }: DualSyncDirectionIconProps) {
  const Icon = iconKey === 'export' ? ArrowUpFromLine : ArrowDownToLine;
  return <Icon className={className} />;
}
