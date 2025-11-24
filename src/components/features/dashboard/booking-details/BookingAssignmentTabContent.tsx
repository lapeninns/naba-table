'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, RefreshCw, LayoutGrid, Users, CheckCircle2, Trash2, X, Info, MapPin } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AssignmentToolbar } from '@/components/features/dashboard/manual-assignment/AssignmentToolbar';
import { ValidationChecks } from '@/components/features/dashboard/manual-assignment/ValidationChecks';
import { TableFloorPlan } from '@/components/features/dashboard/TableFloorPlan';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBookingService } from '@/contexts/ops-services';
import { useAssignmentContext } from '@/hooks/ops/useAssignmentContext';
import { useToast } from '@/hooks/use-toast';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

import type { ManualSelectionCheck, ManualValidationResult } from '@/services/ops/bookings';
import type { OpsTodayBooking } from '@/types/ops';

type BookingAssignmentTabContentProps = {
    booking: OpsTodayBooking;
    restaurantId: string;
    date: string;
    onUnassignTable?: (tableId: string) => Promise<unknown>;
    onAssignmentComplete?: () => void;
};

export function BookingAssignmentTabContent({ booking, restaurantId: _restaurantId, date: _date, onUnassignTable, onAssignmentComplete }: BookingAssignmentTabContentProps) {
    const { toast } = useToast();
    const bookingService = useBookingService();
    const queryClient = useQueryClient();

    // -- Local State --
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [validationResult, setValidationResult] = useState<ManualValidationResult | null>(null);
    const [onlyAvailable, setOnlyAvailable] = useState(true);
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
        return selectedTables.reduce((sum, tableId) => {
            const table = assignmentContext?.tables.find(t => t.id === tableId);
            return sum + (table?.capacity ?? 0);
        }, 0);
    }, [selectedTables, assignmentContext]);

    const tableMap = useMemo(() => {
        if (!assignmentContext) return new Map();
        return new Map(assignmentContext.tables.map(t => [t.id, t]));
    }, [assignmentContext]);

    const assignedTables = useMemo(() => {
        if (!assignmentContext) return [];
        return assignmentContext.bookingAssignments
            .map(id => tableMap.get(id))
            .filter((t): t is NonNullable<typeof t> => !!t);
    }, [assignmentContext, tableMap]);

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
                    <div className="p-6" role="status" aria-live="polite">
                        <div className="grid gap-4 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                            {Array.from({ length: 18 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="aspect-square rounded-xl bg-muted/50 animate-pulse"
                                    style={{ animationDelay: `${i * 30}ms` }}
                                />
                            ))}
                        </div>
                        <span className="sr-only">Loading floor plan...</span>
                    </div>
                ) : assignmentContext && assignmentContext.tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-muted">
                            <LayoutGrid className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                        <div className="text-center space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-foreground">No tables available</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                There are no tables configured for this restaurant. Contact your administrator to set up table inventory.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchAssignmentContext()}
                            className="gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </Button>
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
                <div
                    className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2"
                    role="region"
                    aria-label="Currently assigned tables"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 border-2 border-emerald-200/50 dark:border-emerald-800/50 shadow-sm">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-base font-semibold text-foreground">Assigned Tables</h4>
                                <p className="text-xs text-muted-foreground">
                                    {assignedTables.reduce((sum, t) => sum + t.capacity, 0)} total seats
                                </p>
                            </div>
                            <Badge variant="outline" className="font-mono text-xs px-2 py-1">
                                {assignedTables.length} {assignedTables.length === 1 ? 'table' : 'tables'}
                            </Badge>
                        </div>

                        {/* MERGED TABLES: Show single "Remove All" button */}
                        {assignedTables.length > 1 && (
                            <Button
                                variant="outline"
                                size="default"
                                className="h-10 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 font-medium"
                                onClick={handleRemoveAllTables}
                                aria-label="Remove all assigned tables"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove All
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {assignedTables.map((table, idx) => (
                            <div
                                key={table.id}
                                className="group relative rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 animate-in fade-in-50 slide-in-from-bottom-2"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                {/* Table Icon Badge */}
                                <div className="absolute top-3 right-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                                        <LayoutGrid className="h-5 w-5 text-primary" strokeWidth={2} />
                                    </div>
                                </div>

                                {/* Table Info */}
                                <div className="space-y-3 pr-14">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Table</p>
                                        <p className="text-3xl font-bold text-foreground tabular-nums">{table.tableNumber}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/50">
                                                <Users className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium">{table.capacity} seats</span>
                                        </div>
                                        {table.section && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/50">
                                                    <MapPin className="h-4 w-4" />
                                                </div>
                                                <span className="font-medium">{table.section}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Remove Button (Single Table Only) */}
                                {assignedTables.length === 1 && onUnassignTable && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4 w-full h-9 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 font-medium"
                                        onClick={() => setUnassignTableId(table.id)}
                                        aria-label={`Remove table ${table.tableNumber} from booking`}
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        Remove Table
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Helper Alert for Merged Tables */}
                    {assignedTables.length > 1 && (
                        <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-900/20 dark:to-blue-900/10 dark:border-blue-800/50">
                            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                                💡 <strong>Merged tables:</strong> These tables are combined to meet capacity requirements. Use &quot;Remove All&quot; to unassign and select fresh tables.
                            </AlertDescription>
                        </Alert>
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
