import { Badge } from '@/components/ui/badge';

type DualSyncFailureCodesPanelProps = {
  failureCounts: ReadonlyArray<[string, number]>;
};

export function DualSyncFailureCodesPanel({ failureCounts }: DualSyncFailureCodesPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Failure codes
      </div>
      {failureCounts.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {failureCounts.map(([code, count]) => (
            <Badge key={code} variant="outline" className="font-mono text-[10px]">
              {code}: {count}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No failure codes in this window.</div>
      )}
    </div>
  );
}
