'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { ManualSelectionCheck } from '@/services/ops/bookings';

type StatusKey = ManualSelectionCheck['status'];

const STATUS_CONFIG: Record<StatusKey, { label: string; icon: typeof CheckCircle2 }> = {
  ok: { label: 'Pass', icon: CheckCircle2 },
  warn: { label: 'Warning', icon: AlertTriangle },
  error: { label: 'Error', icon: XCircle },
};

function formatTimestamp(timestamp: number | null): string | null {
  if (!timestamp) {
    return null;
  }
  try {
    return `${formatDistanceToNowStrict(timestamp, { addSuffix: true })}`;
  } catch {
    return null;
  }
}

export type ManualAssignmentValidationPanelProps = {
  checks: ManualSelectionCheck[];
  lastValidatedAt: number | null;
  isPending: boolean;
  hasSelection: boolean;
};

export function ManualAssignmentValidationPanel({ checks, lastValidatedAt, isPending, hasSelection }: ManualAssignmentValidationPanelProps) {
  const timestampLabel = formatTimestamp(lastValidatedAt);
  const hasChecks = checks.length > 0;

  return (
    <Card className="border-border/60 bg-white">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Validation checks</CardTitle>
            <CardDescription>We run policy and capacity checks every time you validate or hold tables.</CardDescription>
          </div>
          {timestampLabel ? (
            <Badge variant="outline" className="text-xs uppercase tracking-wide text-muted-foreground">
              {timestampLabel}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Running checks…
          </div>
        ) : null}

        {hasChecks ? (
          <ul className="space-y-2">
            {checks.map((check) => {
              const config = STATUS_CONFIG[check.status];
              const Icon = config.icon;
              const severityClasses =
                check.status === 'error'
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : check.status === 'warn'
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900';

              return (
                <li
                  key={check.id}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                    severityClasses,
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{check.message}</p>
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        {config.label}
                      </Badge>
                    </div>
                    {check.details ? (
                      <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground">
                        {JSON.stringify(check.details, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {hasSelection
              ? 'No issues detected yet. Confirm if the summary looks good, or revalidate after changing tables.'
              : 'Select tables on the floor plan to see policy checks.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
