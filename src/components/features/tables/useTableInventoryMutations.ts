'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { useTableInventoryService, useZoneService } from '@/contexts/ops-services';

import { ALL_ZONES_VALUE, type TableZone } from './tableInventoryModel';

import type { CreateTablePayload, TableInventory, UpdateTablePayload } from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';
import type { Dispatch, SetStateAction } from 'react';

type UseTableInventoryMutationsParams = {
  readonly filterZone: string;
  readonly setEditingTable: Dispatch<SetStateAction<TableInventory | null>>;
  readonly setEditingZone: Dispatch<SetStateAction<TableZone | null>>;
  readonly setFilterZone: Dispatch<SetStateAction<string>>;
  readonly setIsDialogOpen: Dispatch<SetStateAction<boolean>>;
  readonly setIsZoneDialogOpen: Dispatch<SetStateAction<boolean>>;
  readonly setTableDeleteTarget: Dispatch<SetStateAction<TableInventory | null>>;
  readonly setZoneDeleteBlockedMessage: Dispatch<SetStateAction<string | null>>;
  readonly setZoneDeleteTarget: Dispatch<SetStateAction<TableZone | null>>;
  readonly zonesQueryKey: QueryKey;
};

export function useTableInventoryMutations({
  filterZone,
  setEditingTable,
  setEditingZone,
  setFilterZone,
  setIsDialogOpen,
  setIsZoneDialogOpen,
  setTableDeleteTarget,
  setZoneDeleteBlockedMessage,
  setZoneDeleteTarget,
  zonesQueryKey,
}: UseTableInventoryMutationsParams) {
  const tableService = useTableInventoryService();
  const zoneService = useZoneService();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: ({
      restaurantId,
      payload,
    }: {
      restaurantId: string;
      payload: CreateTablePayload;
    }) => tableService.create(restaurantId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ tableId, payload }: { tableId: string; payload: UpdateTablePayload }) =>
      tableService.update(tableId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setIsDialogOpen(false);
      setEditingTable(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ tableId }: { tableId: string }) => tableService.remove(tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setTableDeleteTarget(null);
    },
  });

  const zoneCreateMutation = useMutation({
    mutationFn: ({
      restaurantId,
      name,
      sortOrder,
    }: {
      restaurantId: string;
      name: string;
      sortOrder?: number;
    }) => zoneService.create(restaurantId, name, sortOrder),
    onSuccess: (zone) => {
      queryClient.invalidateQueries({ queryKey: zonesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setIsZoneDialogOpen(false);
      setEditingZone(null);
      setFilterZone(zone.id);
    },
  });

  const zoneUpdateMutation = useMutation<
    Zone,
    unknown,
    { zoneId: string; name?: string; sortOrder?: number; active?: boolean },
    { previousZones?: Zone[] }
  >({
    mutationFn: ({ zoneId, name, sortOrder, active }) =>
      zoneService.update(zoneId, { name, sortOrder, active }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: zonesQueryKey });
      const previousZones = queryClient.getQueryData<Zone[]>(zonesQueryKey);
      if (variables.active !== undefined) {
        queryClient.setQueryData<Zone[]>(zonesQueryKey, (current) =>
          (current ?? []).map((zone) =>
            zone.id === variables.zoneId ? { ...zone, active: variables.active as boolean } : zone,
          ),
        );
      }
      return { previousZones };
    },
    onSuccess: (zone) => {
      queryClient.invalidateQueries({ queryKey: zonesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setIsZoneDialogOpen(false);
      setEditingZone(null);
      setFilterZone((current) => (current === zone.id ? zone.id : current));
    },
    onError: (_error, _variables, context) => {
      if (context?.previousZones) {
        queryClient.setQueryData(zonesQueryKey, context.previousZones);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: zonesQueryKey });
    },
  });

  const zoneDeleteMutation = useMutation({
    mutationFn: ({ zoneId }: { zoneId: string }) => zoneService.remove(zoneId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: zonesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setZoneDeleteTarget(null);
      setZoneDeleteBlockedMessage(null);
      if (filterZone === variables.zoneId) {
        setFilterZone(ALL_ZONES_VALUE);
      }
    },
  });

  return {
    createMutation,
    deleteMutation,
    updateMutation,
    zoneCreateMutation,
    zoneDeleteMutation,
    zoneUpdateMutation,
  };
}
