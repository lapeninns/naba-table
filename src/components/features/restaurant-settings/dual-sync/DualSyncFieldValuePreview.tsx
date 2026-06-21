import { formatDualSyncFieldPreview } from './dualSyncFieldValuePreviewDomain';

export interface DualSyncFieldValuePreviewProps {
  readonly label: string;
  readonly value: unknown;
}

export function DualSyncFieldValuePreview({ label, value }: DualSyncFieldValuePreviewProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="break-words font-mono text-xs">{formatDualSyncFieldPreview(value)}</p>
    </div>
  );
}
