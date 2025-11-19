"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useBookingService } from "@/contexts/ops-services";

import type { ManualAssignmentTable, ManualAssignmentConflict, ManualAssignmentContextHold } from "@/services/ops/bookings";

// Simplified context type based on the new API endpoint's response
export interface AssignmentContext {
    booking: { id: string; status: string; party_size: number; };
    tables: ManualAssignmentTable[];
    conflicts: ManualAssignmentConflict[];
    holds: ManualAssignmentContextHold[];
    bookingAssignments: string[];
    window: { startAt: string; endAt: string; };
    serverNow: string;
}

type UseAssignmentContextOptions = {
    bookingId: string;
    enabled?: boolean;
};

/**
 * A simplified hook to fetch the necessary context for the table assignment UI.
 * This replaces the legacy `useManualAssignmentContext`.
 */
export function useAssignmentContext({ bookingId, enabled = true }: UseAssignmentContextOptions) {
    const bookingService = useBookingService();

    const query = useQuery<AssignmentContext, Error>({
        queryKey: queryKeys.opsBookings.assignmentContext(bookingId),
        queryFn: async () => {
            // This method needs to be added to the booking service
            const response = await fetch(`/api/ops/bookings/${bookingId}/assignment-context`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch assignment context");
            }
            return response.json();
        },
        enabled: enabled && !!bookingId,
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: true,
    });

    return {
        data: query.data,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    };
}
