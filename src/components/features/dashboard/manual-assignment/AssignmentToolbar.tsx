'use client';

import { Loader2, Trash2, Users, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
    validationChecks,
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

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Party Size */}
                    {partySize && (
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Party</span>
                                <span className="text-sm font-bold tabular-nums">{partySize}</span>
                            </div>
                        </div>
                    )}

                    {/* Selected Tables */}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selected</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold tabular-nums">{selectedCount}</span>
                            <span className="text-xs text-muted-foreground">tables</span>
                            <span className="mx-1 text-muted-foreground/40">|</span>
                            <span
                                className={cn(
                                    'text-sm font-medium tabular-nums',
                                    capacityStatus === 'insufficient' && 'text-destructive',
                                    capacityStatus === 'sufficient' && 'text-emerald-600'
                                )}
                            >
                                {selectedCapacity}
                            </span>
                            <span className="text-xs text-muted-foreground">seats</span>
                            {partySize && (
                                <span className="text-xs text-muted-foreground ml-1">
                                    ({selectedCapacity >= partySize ? '+' : ''}{selectedCapacity - partySize})
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Zone Badge */}
                    {zoneId && (
                        <Badge variant="outline" className="text-xs">
                            Zone: {zoneId}
                        </Badge>
                    )}

            </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Only Available Toggle */}
                    {onOnlyAvailableChange && (
                        <div className="flex items-center gap-2">
                            <Switch
                                id="only-available"
                                checked={onlyAvailable ?? false}
                                onCheckedChange={onOnlyAvailableChange}
                                disabled={isPending}
                                aria-label="Show only available tables"
                            />
                            <Label
                                htmlFor="only-available"
                                className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                            >
                                {onlyAvailable ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                Available only
                            </Label>
                        </div>
                    )}

                    {selectedCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClear}
                            disabled={isPending}
                            className="h-9 px-2 text-muted-foreground hover:text-destructive"
                            title="Clear selection"
                            aria-label="Clear table selection"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                    <Button
                                        size="sm"
                                        onClick={onAssign}
                                        disabled={!canAssign || isPending}
                                        className={cn("h-9 min-w-[120px]", canAssign ? "bg-primary hover:bg-primary/90" : "opacity-50")}
                                        aria-label={canAssign ? 'Assign tables to booking instantly' : assignDisabledReason || 'Cannot assign tables'}
                                    >
                                        {isAssigning ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning...</>
                                        ) : (
                                            'Assign Tables'
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
