'use client';

import { useMutation, useQueryClient, type QueryKey as ReactQueryKey } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { BookingDTO, BookingsPage } from '@/hooks/useBookings';
import type { HttpError } from '@/lib/http/errors';


export type OpsCancelBookingInput = {
  id: string;
};

export type OpsCancelBookingResponse = {
  id: string;
  status: string;
};

export type OpsCancelContext = {
  lists: Array<[ReactQueryKey, BookingsPage | undefined]>;
  detail: BookingDTO | undefined;
};

export function useOpsCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation<OpsCancelBookingResponse, HttpError, OpsCancelBookingInput, OpsCancelContext>({
    mutationFn: ({ id }) =>
      fetchJson<OpsCancelBookingResponse>(`/api/ops/bookings/${id}`, {
        method: 'DELETE',
      }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.opsBookings.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.opsBookings.detail(id) });

      const lists = queryClient.getQueriesData<BookingsPage>({ queryKey: queryKeys.opsBookings.all });
      const detail = queryClient.getQueryData<BookingDTO>(queryKeys.opsBookings.detail(id));

      lists.forEach(([key, data]) => {
        if (!data || !Array.isArray(data.items)) return;
        queryClient.setQueryData<BookingsPage>(key, {
          ...data,
          items: data.items.map((booking) =>
            booking.id === id ? { ...booking, status: 'cancelled' } : booking,
          ),
        });
      });

      if (detail) {
        queryClient.setQueryData(queryKeys.opsBookings.detail(id), {
          ...detail,
          status: 'cancelled',
        });
      }

      return { lists, detail };
    },
    onSuccess: () => {
      toast.success('Booking cancelled');
    },
    onError: (error, variables, context) => {
      toast.error(error.message);
      context?.lists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (context?.detail) {
        queryClient.setQueryData(queryKeys.opsBookings.detail(variables.id), context.detail);
      }
    },
    onSettled: (_result, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(variables.id) });
    },
  });
}
