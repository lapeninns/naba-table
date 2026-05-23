'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

export function useTableAssignmentMutations({
  bookingId,
  date,
  onAssignmentComplete,
  refetch,
  restaurantId,
  resetSelectedTables,
}: {
  bookingId: string;
  date: string | null | undefined;
  onAssignmentComplete: (() => void) | undefined;
  refetch: () => void;
  restaurantId: string;
  resetSelectedTables: () => void;
}) {
  const queryClient = useQueryClient();
  const bookingService = useBookingService();

  const invalidateAssignmentCaches = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(bookingId) });
    queryClient.invalidateQueries({
      queryKey: queryKeys.opsDashboard.summary(restaurantId, date ?? null),
      refetchType: 'active',
    });
    onAssignmentComplete?.();
  };

  const assignMutation = useMutation({
    mutationFn: async (tableIds: string[]) => {
      return bookingService.assignTablesDirect({
        bookingId,
        tableIds,
        idempotencyKey: generateIdempotencyKey(),
        requireAdjacency: false,
      });
    },
    onSuccess: () => {
      resetSelectedTables();
      invalidateAssignmentCaches();
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (tableIds: string[]) => {
      return bookingService.unassignTablesDirect({ bookingId, tableIds });
    },
    onSuccess: invalidateAssignmentCaches,
  });

  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      const quoteResult = await bookingService.autoQuoteTables({
        bookingId,
        requireAdjacency: false,
      });

      if (
        !quoteResult.candidate ||
        !quoteResult.candidate.tableIds ||
        quoteResult.candidate.tableIds.length === 0
      ) {
        throw new Error(quoteResult.reason || 'No suitable tables found for this booking');
      }

      if (!quoteResult.holdId) {
        throw new Error('Smart assign could not reserve the suggested tables. Please try again.');
      }

      return bookingService.confirmHoldAssignment({
        bookingId,
        holdId: quoteResult.holdId,
        idempotencyKey: generateIdempotencyKey(),
        requireAdjacency: false,
      });
    },
    onSuccess: () => {
      resetSelectedTables();
      invalidateAssignmentCaches();
    },
  });

  return {
    assignMutation,
    autoAssignMutation,
    isPending:
      assignMutation.isPending || unassignMutation.isPending || autoAssignMutation.isPending,
    unassignMutation,
  };
}

export type TableAssignmentMutations = ReturnType<typeof useTableAssignmentMutations>;
