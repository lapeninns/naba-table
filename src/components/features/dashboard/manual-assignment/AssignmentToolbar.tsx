'use client';

import { Loader2, Trash2, Users, Eye, EyeOff, LayoutGrid, CheckCircle2, AlertCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { ManualSelectionCheck } from '@/services/ops/bookings';

type AssignmentToolbarProps = {
    selectedCount: number;
    selectedCapacity: number;
    partySize?: number;
    zoneId?: string | null;
    validationChecks: ManualSelectionCheck[];
    onAssign: () => void;
    onClear: () => void;
    isPending: boolean;
    isAssigning: boolean;
    canAssign: boolean;
    assignDisabledReason?: string | null;
    onlyAvailable?: boolean;
    onOnlyAvailableChange?: (value: boolean) => void;
};

export function AssignmentToolbar({
    selectedCount,
    selectedCapacity,
    partySize,
    zoneId,
    validationChecks: _validationChecks,
    onAssign,
    onClear,
    isPending,
    isAssigning,
    canAssign,
    assignDisabledReason,
    onlyAvailable,
    onOnlyAvailableChange,
}: AssignmentToolbarProps) {
    const capacityStatus = partySize
        ? selectedCapacity >= partySize
            ? 'sufficient'
            : 'insufficient'
        : 'unknown';

    const capacityDiff = partySize ? selectedCapacity - partySize : 0;

    return (
        <div className="flex flex-col gap-4">
            {/* Stats Card */}
            <Card className="border-2 shadow-md">
                <CardContent className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {/* Party Size */}
                        {partySize && (
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20 border-2 border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                                    <Users className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Party</p>
                                    <p className="text-3xl font-bold tabular-nums text-foreground">{partySize}</p>
                                </div>
                            </div>
                        )}

                        {/* Selected Tables */}
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20 border-2 border-purple-200/50 dark:border-purple-800/50 shadow-sm">
                                <LayoutGrid className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selected</p>
                                <div className="flex items-baseline gap-1.5">
                                    <p className="text-3xl font-bold tabular-nums text-foreground">{selectedCount}</p>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {selectedCount === 1 ? 'table' : 'tables'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Capacity */}
                        <div className="flex items-center gap-4">
                            <div
                                className={cn(
                                    "flex h-14 w-14 items-center justify-center rounded-xl border-2 shadow-sm transition-colors",
                                    capacityStatus === 'sufficient'
                                        ? 'bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/50'
                                        : capacityStatus === 'insufficient'
                                            ? 'bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/40 dark:to-red-900/20 border-red-200/50 dark:border-red-800/50'
                                            : 'bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800/40 dark:to-gray-800/20 border-gray-200/50 dark:border-gray-700/50'
                                )}
                            >
                                {capacityStatus === 'sufficient' ? (
                                    <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                                ) : capacityStatus === 'insufficient' ? (
                                    <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                                ) : (
                                    <Users className="h-7 w-7 text-gray-600 dark:text-gray-400" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Capacity</p>
                                <div className="flex items-baseline gap-1.5">
                                    <p
                                        className={cn(
                                            "text-3xl font-bold tabular-nums transition-colors",
                                            capacityStatus === 'sufficient' ? 'text-emerald-600 dark:text-emerald-400' :
                                                capacityStatus === 'insufficient' ? 'text-red-600 dark:text-red-400' :
                                                    'text-foreground'
                                        )}
                                    >
                                        {selectedCapacity}
                                    </p>
                                    <p className="text-sm text-muted-foreground font-medium">seats</p>
                                </div>
                                {partySize && capacityDiff !== 0 && (
                                    <p className={cn(
                                        "text-xs font-semibold tabular-nums",
                                        capacityDiff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                    )}>
                                        {capacityDiff > 0 ? '+' : ''}{capacityDiff} {Math.abs(capacityDiff) === 1 ? 'seat' : 'seats'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Zone Badge */}
                    {zoneId && (
                        <div className="mt-4 pt-4 border-t">
                            <Badge variant="outline" className="text-xs font-medium px-3 py-1">
                                🎯 Zone: {zoneId}
                            </Badge>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Actions Bar */}
            <div className="flex items-center justify-between gap-3 p-4 rounded-xl border-2 bg-gradient-to-r from-muted/40 to-muted/20 shadow-sm">
                <div className="flex items-center gap-3">
                    {onOnlyAvailableChange && (
                        <div className="flex items-center gap-2.5">
                            <Switch
                                id="only-available"
                                checked={onlyAvailable ?? false}
                                onCheckedChange={onOnlyAvailableChange}
                                disabled={isPending}
                                aria-label="Show only available tables"
                                className="data-[state=checked]:bg-primary"
                            />
                            <Label
                                htmlFor="only-available"
                                className="text-sm font-medium cursor-pointer flex items-center gap-2 text-foreground select-none"
                            >
                                {onlyAvailable ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                <span>Available only</span>
                            </Label>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                        <Button
                            variant="outline"
                            size="default"
                            onClick={onClear}
                            disabled={isPending}
                            className="h-11 px-4 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 font-medium transition-all"
                            title="Clear selection"
                            aria-label="Clear table selection"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear
                        </Button>
                    )}

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        size="default"
                                        onClick={onAssign}
                                        disabled={!canAssign || isPending}
                                        className={cn(
                                            "h-11 min-w-[150px] font-semibold shadow-md transition-all",
                                            canAssign
                                                ? "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 hover:shadow-lg active:scale-95"
                                                : "opacity-50"
                                        )}
                                        aria-label={canAssign ? 'Assign tables to booking instantly' : assignDisabledReason || 'Cannot assign tables'}
                                    >
                                        {isAssigning ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Assigning...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                                Assign Tables
                                            </>
                                        )}
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            {assignDisabledReason && (
                                <TooltipContent>
                                    <p>{assignDisabledReason}</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
}
