"use client";

import { useQuery } from "@tanstack/react-query";

import { useBookingService } from "@/contexts/ops-services";
import { queryKeys } from "@/lib/query/keys";

import type { AssignmentContext } from "@/services/ops/bookings";

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
        queryFn: async () => bookingService.getAssignmentContext(bookingId),
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
