'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AssignmentToolbar } from '@/components/features/dashboard/manual-assignment/AssignmentToolbar';
import { ValidationChecks } from '@/components/features/dashboard/manual-assignment/ValidationChecks';
import { TableFloorPlan } from '@/components/features/dashboard/TableFloorPlan';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBookingService } from '@/contexts/ops-services';
import { useAssignmentContext } from '@/hooks/ops/useAssignmentContext';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';
import { HttpError } from '@/lib/http/errors';

import type { OpsTodayBooking } from '@/types/ops';
import type { ManualSelectionCheck, ManualValidationResult } from '@/services/ops/bookings';

type BookingAssignmentTabContentProps = {
    booking: OpsTodayBooking;
    restaurantId: string;
    date: string;
    onUnassignTable?: (tableId: string) => Promise<unknown>;
    onAssignmentComplete?: () => void;
};

export function BookingAssignmentTabContent({ booking, restaurantId, date, onUnassignTable, onAssignmentComplete }: BookingAssignmentTabContentProps) {
    const { toast } = useToast();
    const bookingService = useBookingService();
    const queryClient = useQueryClient();

    // -- Local State --
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [validationResult, setValidationResult] = useState<ManualValidationResult | null>(null);
    const [onlyAvailable, setOnlyAvailable] = useState(false);
    const [unassignTableId, setUnassignTableId] = useState<string | null>(null);

    // Track previous selection to detect changes
    const prevSelectedTablesRef = useRef<string[]>([]);

    // -- Context --
    const {
        data: assignmentContext,
        isLoading: assignmentContextLoading,
        error: assignmentContextError,
        refetch: refetchAssignmentContext,
    } = useAssignmentContext({
        bookingId: booking.id,
        enabled: true,
    });

    // -- Derived State --
    // Simplified logic for the new direct assignment context
    const validationChecks = useMemo(() => {
        // Validation is now primarily handled by the backend on assignment.
        // This can be used for simple client-side checks if needed in the future.
        return [] as ManualSelectionCheck[];
    }, []);

    const selectedCapacity = useMemo(() => {
        if (!assignmentContext) return 0;
        return selectedTables.reduce((sum, id) => {
            const table = assignmentContext.tables.find(t => t.id === id);
            return sum + (table?.capacity ?? 0);
        }, 0);
    }, [assignmentContext, selectedTables]);

    const tableMap = useMemo(() => {
        if (!assignmentContext) return new Map();
        return new Map(assignmentContext.tables.map(t => [t.id, t]));
    }, [assignmentContext?.tables]);

    const assignedTables = useMemo(() => {
        if (!assignmentContext) return [];
        return assignmentContext.bookingAssignments
            .map(id => tableMap.get(id))
            .filter((t): t is NonNullable<typeof t> => !!t);
    }, [assignmentContext?.bookingAssignments, tableMap]);

    // -- Mutations --
    // SIMPLIFIED: Direct table assignment - single atomic operation
    const directAssignMutation = useMutation({
        mutationFn: async () => {
            return await bookingService.assignTablesDirect({
                bookingId: booking.id,
                tableIds: selectedTables,
                idempotencyKey: generateIdempotencyKey(),
                requireAdjacency: false,
            });
        },
        onSuccess: async () => {
            // Clear local state
            setSelectedTables([]);
            setValidationResult(null);

            // Invalidate all related queries to ensure fresh data
            await Promise.all([
                // Refresh the manual assignment context
                refetchAssignmentContext(),
                // Invalidate the specific booking detail
                queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) }),
                // Invalidate the bookings list
                queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) }),
                // Invalidate ops bookings list
                queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.list({}) }),
            ]);

            // Notify parent component
            onAssignmentComplete?.();

            // Show success message
            toast({
                title: 'Tables assigned',
                description: `Successfully assigned ${selectedTables.length} table(s) to booking.`,
                duration: 3000,
            });
        },
        onError: (error: unknown) => {
            console.error('[BookingAssignmentTabContent] Assignment failed:', error);

            // Handle HttpError with validation details
            if (error instanceof HttpError) {
                if (error.status === 422 && error.details) {
                    const details = error.details as { checks?: Array<{ id: string; passed: boolean; message: string }> };

                    if (details.checks) {
                        // Show validation errors
                        const failedChecks = details.checks.filter((c) => !c.passed);
                        const errorMessages = failedChecks.map((c) => `• ${c.message}`).join('\n');

                        toast({
                            title: 'Cannot assign tables',
                            description: errorMessages || error.message,
                            variant: 'destructive',
                            duration: 8000,
                        });
                        return;
                    }
                }

                // Other HTTP errors
                toast({
                    title: 'Assignment failed',
                    description: error.message,
                    variant: 'destructive',
                });
                return;
            }

            // Generic error handling
            const message = error instanceof Error ? error.message : 'Assignment failed';
            toast({
                title: 'Assignment failed',
                description: message,
                variant: 'destructive',
            });
        },
    });

    // -- Handlers --
    const handleToggleTable = useCallback((tableId: string) => {
        setSelectedTables((prev) => {
            if (prev.includes(tableId)) return prev.filter((id) => id !== tableId);
            return [...prev, tableId];
        });
    }, []);

    // SIMPLIFIED: Single handler for direct assignment
    const handleAssign = useCallback(() => {
        if (selectedTables.length === 0) {
            toast({ title: 'No tables selected', description: 'Please select tables to assign.', variant: 'destructive' });
            return;
        }

        directAssignMutation.mutate();
    }, [selectedTables.length, directAssignMutation, toast]);

    const handleClear = useCallback(() => {
        setSelectedTables([]);
        setValidationResult(null);
        // No holds in direct assignment system - just clear selection
    }, []);

    // No holds in direct assignment system - handleHoldExpired removed

    const handleUnassignConfirm = useCallback(async () => {
        if (!unassignTableId || !onUnassignTable) return;

        try {
            await onUnassignTable(unassignTableId);

            // Invalidate all related queries to ensure fresh data
            await Promise.all([
                refetchAssignmentContext(),
                queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.list({}) }),
            ]);

            // Notify parent component
            onAssignmentComplete?.();

            toast({
                title: 'Table removed',
                description: 'Table unassigned successfully. Data refreshed.',
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to unassign table';
            toast({ title: 'Unassign failed', description: message, variant: 'destructive' });
        } finally {
            setUnassignTableId(null);
        }
    }, [unassignTableId, onUnassignTable, refetchAssignmentContext, queryClient, booking.id, onAssignmentComplete, toast]);

    // Handle removing ALL assigned tables (for merged table groups)
    const handleRemoveAllTables = useCallback(async () => {
        if (assignedTables.length === 0) return;

        const tableIds = assignedTables.map(t => t.id);

        try {
            // Use bulk unassign API
            await bookingService.unassignTablesDirect({
                bookingId: booking.id,
                tableIds,
            });

            // Invalidate all related queries
            await Promise.all([
                refetchAssignmentContext(),
                queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.bookings.list({}) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.list({}) }),
            ]);

            // Notify parent component
            onAssignmentComplete?.();

            toast({
                title: 'All tables removed',
                description: `Successfully removed ${assignedTables.length} table(s). You can now re-assign fresh tables.`,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to remove tables';
            toast({ title: 'Remove failed', description: message, variant: 'destructive' });
        }
    }, [assignedTables, bookingService, booking.id, refetchAssignmentContext, queryClient, onAssignmentComplete, toast]);

    // -- Render Helpers --
    const isPending = assignmentContextLoading || directAssignMutation.isPending;
    const canAssign = selectedTables.length > 0 && !isPending;

    // Clear validation when selection changes
    useEffect(() => {
        const prevSelection = prevSelectedTablesRef.current;
        const selectionChanged =
            prevSelection.length !== selectedTables.length ||
            !prevSelection.every(id => selectedTables.includes(id));

        if (selectionChanged && validationResult) {
            setValidationResult(null);
        }

        prevSelectedTablesRef.current = selectedTables;
    }, [selectedTables, validationResult]);

    // No active holds to sync in direct assignment system

    if (assignmentContextError) {
        const message = assignmentContextError instanceof Error ? assignmentContextError.message : 'Unknown error';
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-xl border bg-destructive/5">
                <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Error loading floor plan</span>
                </div>
                <p className="text-sm text-muted-foreground">{message}</p>
                <Button
                    onClick={() => refetchAssignmentContext()}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Toolbar */}
            <AssignmentToolbar
                selectedCount={selectedTables.length}
                selectedCapacity={selectedCapacity}
                partySize={booking.partySize}
                zoneId={validationResult?.summary?.zoneId}
                validationChecks={validationChecks}
                onAssign={handleAssign}
                onClear={handleClear}
                isPending={isPending}
                isAssigning={directAssignMutation.isPending}
                canAssign={canAssign}
                assignDisabledReason={
                    selectedTables.length === 0
                        ? 'Select tables to assign'
                        : null
                }
                onlyAvailable={onlyAvailable}
                onOnlyAvailableChange={setOnlyAvailable}
            />

            {/* Validation Checks */}
            {validationChecks.length > 0 && <ValidationChecks checks={validationChecks} />}

            {/* Floor Plan */}
            <div
                className="flex-1 overflow-hidden rounded-xl border bg-muted/10 relative min-h-[400px]"
                role="region"
                aria-label="Table floor plan"
            >
                {assignmentContextLoading ? (
                    <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="sr-only">Loading floor plan...</span>
                    </div>
                ) : assignmentContext && assignmentContext.tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                        <div className="text-muted-foreground text-center">
                            <p className="text-lg font-medium">No tables available</p>
                            <p className="text-sm mt-2">There are no tables configured for this restaurant.</p>
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 overflow-auto p-2 sm:p-4">
                        <TableFloorPlan
                            bookingId={booking.id}
                            tables={assignmentContext?.tables ?? []}
                            holds={assignmentContext?.holds ?? []}
                            conflicts={assignmentContext?.conflicts ?? []}
                            bookingAssignments={assignmentContext?.bookingAssignments ?? []}
                            selectedTableIds={selectedTables}
                            onToggle={handleToggleTable}
                            disabled={isPending}
                            onlyAvailable={onlyAvailable}
                            className="min-w-[320px] sm:min-w-[500px] md:min-w-[600px]"
                        />
                    </div>
                )}
            </div>

            {/* Assigned Tables List */}
            {assignedTables.length > 0 && (
                <div className="space-y-2" role="region" aria-label="Currently assigned tables">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Assigned Tables</h4>
                        {/* MERGED TABLES: Show single "Remove All" button */}
                        {assignedTables.length > 1 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={handleRemoveAllTables}
                                aria-label="Remove all assigned tables"
                            >
                                Remove All Tables
                            </Button>
                        )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {assignedTables.map((table) => (
                            <div
                                key={table.id}
                                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 shadow-sm"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">Table {table.tableNumber}</span>
                                    <span className="text-xs text-muted-foreground">{table.capacity} seats</span>
                                </div>
                                {/* SINGLE TABLE: Show individual "Remove" button */}
                                {assignedTables.length === 1 && onUnassignTable && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-destructive hover:text-destructive"
                                        onClick={() => setUnassignTableId(table.id)}
                                        aria-label={`Remove table ${table.tableNumber} from booking`}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                    {/* Helper text for merged tables */}
                    {assignedTables.length > 1 && (
                        <p className="text-xs text-muted-foreground">
                            💡 Merged tables are removed as a group to maintain capacity requirements. Click "Remove All Tables" to unassign and re-select fresh tables.
                        </p>
                    )}
                </div>
            )}

            {/* Unassign Confirmation Dialog */}
            <AlertDialog open={Boolean(unassignTableId)} onOpenChange={(open) => !open && setUnassignTableId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove table assignment?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove this table from the booking? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnassignConfirm} className="bg-destructive hover:bg-destructive/90">
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
