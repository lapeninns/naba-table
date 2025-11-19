'use client';

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ManualSelectionCheck } from '@/services/ops/bookings';

type ValidationChecksProps = {
  checks: ManualSelectionCheck[];
  className?: string;
};

const statusConfig = {
  ok: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  warn: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  error: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/5',
    borderColor: 'border-destructive/20',
  },
};

const checkLabels: Record<string, string> = {
  sameZone: 'Zone Compatibility',
  movable: 'Table Movability',
  adjacency: 'Table Adjacency',
  conflict: 'Availability Check',
  capacity: 'Capacity Requirements',
};

export function ValidationChecks({ checks, className }: ValidationChecksProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (checks.length === 0) {
    return null;
  }

  const errorCount = checks.filter((c) => c.status === 'error').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const okCount = checks.filter((c) => c.status === 'ok').length;

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between p-3 h-auto hover:bg-muted/50"
        aria-label={isExpanded ? 'Collapse validation details' : 'Expand validation details'}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Validation Results</span>
          <div className="flex items-center gap-2 ml-2">
            {errorCount > 0 && (
              <span className="text-xs font-medium text-destructive">
                {errorCount} error{errorCount === 1 ? '' : 's'}
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-xs font-medium text-amber-600">
                {warnCount} warning{warnCount === 1 ? '' : 's'}
              </span>
            )}
            {okCount > 0 && errorCount === 0 && warnCount === 0 && (
              <span className="text-xs font-medium text-emerald-600">All checks passed</span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t p-3 space-y-2">
          {checks.map((check, idx) => {
            const config = statusConfig[check.status];
            const Icon = config.icon;
            const label = checkLabels[check.id] || check.id;

            return (
              <div
                key={`${check.id}-${idx}`}
                className={cn(
                  'flex items-start gap-3 rounded-md border p-3',
                  config.bgColor,
                  config.borderColor
                )}
                role="alert"
                aria-live="polite"
              >
                <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-sm font-medium', config.color)}>{label}</span>
                    {check.status === 'ok' && (
                      <span className="text-xs text-muted-foreground">✓</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {check.message}
                  </p>
                  {check.details && Object.keys(check.details).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-current/10">
                      <code className="text-xs text-muted-foreground/80">
                        {JSON.stringify(check.details, null, 2)}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
