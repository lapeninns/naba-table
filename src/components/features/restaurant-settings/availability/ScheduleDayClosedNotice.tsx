import { AlertTriangle } from 'lucide-react';

export function ScheduleDayClosedNotice() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
      <AlertTriangle className="size-4 shrink-0 text-muted-foreground" />
      <span>
        The kitchen is closed on this day. Enable &quot;Open Day&quot; to configure operating hours
        and meal windows.
      </span>
    </div>
  );
}
