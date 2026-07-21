import { Text } from '@/components/ui/typography';

import { formatDualSyncFieldPreview } from './dualSyncFieldValuePreviewDomain';

export interface DualSyncFieldValuePreviewProps {
  readonly label: string;
  readonly value: unknown;
}

export function DualSyncFieldValuePreview({ label, value }: DualSyncFieldValuePreviewProps) {
  return (
    <div className="flex flex-col gap-1">
      <Text variant="eyebrow">{label}</Text>
      <Text variant="mono" className="break-words">{formatDualSyncFieldPreview(value)}</Text>
    </div>
  );
}
