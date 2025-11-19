'use client';

import { AlertTriangle, CheckCircle2, Loader2, XCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ManualSelectionCheck } from '@/services/ops/bookings';

type AssignmentToolbarProps = {
    selectedCount: number;
    selectedCapacity: number;
    validationChecks: ManualSelectionCheck[];
    onValidate: () => void;
    onConfirm: () => void;
    onClear: () => void;
    isPending: boolean;
    isValidating: boolean;
    isConfirming: boolean;
    canConfirm: boolean;
    confirmDisabledReason?: string | null;
};

export function AssignmentToolbar({
    selectedCount,
    selectedCapacity,
    validationChecks,
    onValidate,
    onConfirm,
    onClear,
    isPending,
    isValidating,
    isConfirming,
    canConfirm,
    confirmDisabledReason,
}: AssignmentToolbarProps) {
    // Determine overall status from checks
    const errorCount = validationChecks.filter((c) => c.status === 'error').length;
    const warnCount = validationChecks.filter((c) => c.status === 'warn').length;

    let statusIcon = null;
    let statusText = 'Ready to check';
    let statusColor = 'text-muted-foreground';

    if (isValidating) {
        statusText = 'Checking...';
        statusIcon = <Loader2 className="h-4 w-4 animate-spin" />;
    } else if (validationChecks.length > 0) {
        if (errorCount > 0) {
            statusText = `${errorCount} Issue${errorCount === 1 ? '' : 's'}`;
            statusIcon = <XCircle className="h-4 w-4" />;
            statusColor = 'text-destructive';
        } else if (warnCount > 0) {
            statusText = `${warnCount} Warning${warnCount === 1 ? '' : 's'}`;
            statusIcon = <AlertTriangle className="h-4 w-4" />;
            statusColor = 'text-amber-600';
        } else {
            statusText = 'Looks good';
            statusIcon = <CheckCircle2 className="h-4 w-4" />;
            statusColor = 'text-emerald-600';
        }
    }

    return (
        <div className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selected</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold tabular-nums">{selectedCount}</span>
                        <span className="text-xs text-muted-foreground">tables</span>
                        <span className="mx-1 text-muted-foreground/40">|</span>
                        <span className="text-sm font-medium tabular-nums">{selectedCapacity}</span>
                        <span className="text-xs text-muted-foreground">seats</span>
                    </div>
                </div>

                {/* Validation Status Indicator */}
                {(validationChecks.length > 0 || isValidating) && (
                    <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5",
                        errorCount > 0 ? "border-destructive/20 bg-destructive/5" :
                            warnCount > 0 ? "border-amber-200 bg-amber-50" :
                                "border-emerald-200 bg-emerald-50"
                    )}>
                        <div className={cn(statusColor)}>{statusIcon}</div>
                        <span className={cn("text-sm font-medium", statusColor)}>{statusText}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClear}
                        disabled={isPending}
                        className="h-9 px-2 text-muted-foreground hover:text-destructive"
                        title="Clear selection"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onValidate}
                    disabled={isPending || selectedCount === 0}
                    className="h-9"
                >
                    {isValidating ? 'Checking...' : 'Validate'}
                </Button>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span tabIndex={0}>
                                <Button
                                    size="sm"
                                    onClick={onConfirm}
                                    disabled={!canConfirm || isPending}
                                    className={cn("h-9 min-w-[100px]", canConfirm ? "bg-primary" : "opacity-50")}
                                >
                                    {isConfirming ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning</>
                                    ) : (
                                        'Assign'
                                    )}
                                </Button>
                            </span>
                        </TooltipTrigger>
                        {confirmDisabledReason && (
                            <TooltipContent>
                                <p>{confirmDisabledReason}</p>
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}
