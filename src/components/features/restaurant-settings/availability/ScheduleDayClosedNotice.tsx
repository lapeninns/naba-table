import { AlertTriangle } from 'lucide-react';

export function ScheduleDayClosedNotice() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-500/20 bg-slate-500/[0.02] p-4 text-xs text-muted-foreground">
      <AlertTriangle className="size-4 shrink-0 text-slate-400" />
      <span>
        The kitchen is closed on this day. Enable &quot;Open Day&quot; to configure operating hours
        and meal windows.
      </span>
    </div>
  );
}
