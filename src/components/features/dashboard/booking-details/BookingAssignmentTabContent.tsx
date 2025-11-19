'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AssignmentToolbar } from '@/components/features/dashboard/manual-assignment/AssignmentToolbar';
import { TableFloorPlan } from '@/components/features/dashboard/TableFloorPlan';
import { Button } from '@/components/ui/button';
import { useBookingService } from '@/contexts/ops-services';
import { useManualAssignmentContext } from '@/hooks/ops/useManualAssignmentContext';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query/keys';
import { extractManualHoldValidation, isManualHoldValidationError } from '../manualHoldHelpers';

import type { OpsTodayBooking } from '@/types/ops';
import type { ManualSelectionCheck, ManualValidationResult } from '@/services/ops/bookings';

type BookingAssignmentTabContentProps = {
    booking: OpsTodayBooking;
    restaurantId: string;
    date: string;
    onUnassignTable?: (tableId: string) => Promise<unknown>;
};

export function BookingAssignmentTabContent({ booking, restaurantId, date, onUnassignTable }: BookingAssignmentTabContentProps) {
    const { toast } = useToast();
    const bookingService = useBookingService();
    const queryClient = useQueryClient();

    // -- Local State --
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [validationResult, setValidationResult] = useState<ManualValidationResult | null>(null);
    const [onlyAvailable, setOnlyAvailable] = useState(false);

    // -- Context --
    const {
        data: manualContext,
        isLoading: manualContextLoading,
        error: manualContextError,
        refetch: refetchManualContext,
    } = useManualAssignmentContext({
        bookingId: booking.id,
        restaurantId: restaurantId,
        targetDate: date,
        enabled: true,
    });

    // -- Derived State --
    const activeHold = manualContext?.activeHold ?? null;

    // We only have validation checks from the latest operation (validate or hold)
    // If the page reloads, we might lose them, but that's okay for now.
    const validationChecks = useMemo(() => {
        return validationResult?.checks ?? ([] as ManualSelectionCheck[]);
    }, [validationResult]);

    const hasBlockingErrors = useMemo(() => {
        return validationChecks.some((check) => check.status === 'error');
    }, [validationChecks]);

    const selectedCapacity = useMemo(() => {
        if (!manualContext) return 0;
        return selectedTables.reduce((sum, id) => {
            const table = manualContext.tables.find(t => t.id === id);
            return sum + (table?.capacity ?? 0);
        }, 0);
    }, [manualContext, selectedTables]);

    // Map assigned table IDs to table objects
    const assignedTables = useMemo(() => {
        if (!manualContext) return [];
        const tableMap = new Map(manualContext.tables.map(t => [t.id, t]));
        return manualContext.bookingAssignments
            .map(id => tableMap.get(id))
            .filter((t): t is NonNullable<typeof t> => !!t);
    }, [manualContext]);

    // -- Mutations --
    const holdMutation = useMutation({
        mutationFn: async (payload: { bookingId: string; tableIds: string[]; contextVersion: string }) => {
            return bookingService.manualHoldSelection({
                ...payload,
                requireAdjacency: false,
            });
        },
        onSuccess: (data) => {
            void refetchManualContext();
            // The hold response contains 'validation' which is ManualValidationResult
            setValidationResult(data.validation);
            toast({ title: 'Tables held', description: 'Selection is held for 3 minutes.' });
        },
        onError: (error) => {
            if (isManualHoldValidationError(error)) {
                const extracted = extractManualHoldValidation(error);
                if (extracted) {
                    setValidationResult(extracted);
                    toast({ title: 'Validation failed', description: 'Please review the issues.', variant: 'destructive' });
                    return;
                }
            }
            const message = error instanceof Error ? error.message : 'Hold failed';
            toast({ title: 'Hold failed', description: message, variant: 'destructive' });
        },
    });

    const validateMutation = useMutation({
        mutationFn: async (payload: { bookingId: string; tableIds: string[]; requireAdjacency: boolean; excludeHoldId?: string; contextVersion: string }) => {
            return bookingService.manualValidateSelection(payload);
        },
        onSuccess: (data) => {
            setValidationResult(data);
            if (data.checks.some(c => c.status === 'error')) {
                toast({ title: 'Issues found', description: 'Please resolve errors before confirming.', variant: 'destructive' });
            } else {
                toast({ title: 'Validation passed', description: 'Selection looks good.' });
            }
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Validation failed';
            toast({ title: 'Validation error', description: message, variant: 'destructive' });
        },
    });

    const confirmMutation = useMutation({
        mutationFn: async (holdId: string) => {
            const key = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

            return bookingService.manualConfirmHold({
                holdId,
                bookingId: booking.id,
                idempotencyKey: key,
                contextVersion: manualContext?.contextVersion ?? undefined,
            });
        },
        onSuccess: () => {
            toast({ title: 'Tables assigned', description: 'Booking updated successfully.' });
            setSelectedTables([]);
            setValidationResult(null);
            void refetchManualContext();
            void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) });
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Assignment failed';
            toast({ title: 'Assignment failed', description: message, variant: 'destructive' });
        },
    });

    // -- Handlers --
    const handleToggleTable = useCallback((tableId: string) => {
        setSelectedTables((prev) => {
            if (prev.includes(tableId)) return prev.filter((id) => id !== tableId);
            return [...prev, tableId];
        });
    }, []);

    const handleValidate = useCallback(() => {
        validateMutation.mutate({
            bookingId: booking.id,
            tableIds: selectedTables,
            requireAdjacency: false,
            excludeHoldId: activeHold?.id,
            contextVersion: manualContext?.contextVersion ?? '',
        });
    }, [booking.id, selectedTables, activeHold?.id, manualContext?.contextVersion, validateMutation]);

    const handleConfirm = useCallback(() => {
        if (activeHold) {
            confirmMutation.mutate(activeHold.id);
        } else {
            // If no hold, create one first
            holdMutation.mutate({
                bookingId: booking.id,
                tableIds: selectedTables,
                contextVersion: manualContext?.contextVersion ?? '',
            });
        }
    }, [activeHold, confirmMutation, holdMutation, booking.id, selectedTables, manualContext?.contextVersion]);

    const handleClear = useCallback(() => {
        setSelectedTables([]);
        setValidationResult(null);
        if (activeHold) {
            bookingService.manualReleaseHold({ holdId: activeHold.id, bookingId: booking.id }).catch(console.error);
            void refetchManualContext();
        }
    }, [activeHold, bookingService, booking.id, refetchManualContext]);

    // -- Render Helpers --
    const isPending = manualContextLoading || holdMutation.isPending || validateMutation.isPending || confirmMutation.isPending;
    const canConfirm = selectedTables.length > 0 && !hasBlockingErrors && !isPending;

    // Sync selected tables with active hold if we have one and user hasn't changed selection
    useEffect(() => {
        if (activeHold && selectedTables.length === 0) {
            setSelectedTables(activeHold.tableIds);
        }
    }, [activeHold]); // eslint-disable-line react-hooks/exhaustive-deps

    if (manualContextError) {
        const message = manualContextError instanceof Error ? manualContextError.message : 'Unknown error';
        return <div className="p-4 text-destructive">Error loading floor plan: {message}</div>;
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Toolbar */}
            <AssignmentToolbar
                selectedCount={selectedTables.length}
                selectedCapacity={selectedCapacity}
                validationChecks={validationChecks}
                onValidate={handleValidate}
                onConfirm={handleConfirm}
                onClear={handleClear}
                isPending={isPending}
                isValidating={validateMutation.isPending || holdMutation.isPending}
                isConfirming={confirmMutation.isPending}
                canConfirm={canConfirm}
                confirmDisabledReason={hasBlockingErrors ? "Resolve errors first" : null}
            />

            {/* Floor Plan */}
            <div className="flex-1 overflow-hidden rounded-xl border bg-muted/10 relative min-h-[400px]">
                {manualContextLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="absolute inset-0 overflow-auto p-4">
                        <TableFloorPlan
                            bookingId={booking.id}
                            tables={manualContext?.tables ?? []}
                            holds={manualContext?.holds ?? []}
                            conflicts={manualContext?.conflicts ?? []}
                            bookingAssignments={manualContext?.bookingAssignments ?? []}
                            selectedTableIds={selectedTables}
                            onToggle={handleToggleTable}
                            disabled={isPending}
                            onlyAvailable={onlyAvailable}
                            className="min-w-[600px]"
                        />
                    </div>
                )}
            </div>

            {/* Assigned Tables List */}
            {assignedTables.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Assigned Tables</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {assignedTables.map((table) => (
                            <div key={table.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 shadow-sm">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">Table {table.tableNumber}</span>
                                    <span className="text-xs text-muted-foreground">{table.capacity} seats</span>
                                </div>
                                {onUnassignTable && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-destructive hover:text-destructive"
                                        onClick={() => onUnassignTable(table.id).then(() => refetchManualContext())}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
