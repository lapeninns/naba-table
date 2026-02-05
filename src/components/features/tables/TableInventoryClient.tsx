/**
 * Table Inventory Client Component
 * Story 4: Ops Dashboard - Tables Management
 *
 * REVISED: This component has been updated to address several potential issues,
 * including controlled form components, safer delete operations, and improved UI clarity.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { SettingsCard } from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { queryKeys } from '@/lib/query/keys';


import type {
  CreateTablePayload,
  TableInventory,
  UpdateTablePayload,
} from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';

type ZoneStatusFilter = 'all' | 'active' | 'inactive';
type TableStatusFilter = 'all' | 'active' | 'inactive';

export function filterZonesByStatus(zones: Zone[], filter: ZoneStatusFilter): Zone[] {
  if (filter === 'active') return zones.filter((zone) => zone.active);
  if (filter === 'inactive') return zones.filter((zone) => zone.active === false);
  return zones;
}

export function filterTablesByStatus(tables: TableInventory[], filter: TableStatusFilter): TableInventory[] {
  if (filter === 'active') {
    return tables.filter((table) => table.active && table.zoneActive !== false);
  }
  if (filter === 'inactive') {
    return tables.filter((table) => !table.active || table.zoneActive === false);
  }
  return tables;
}


const ALL_ZONES_VALUE = 'all-zones';

// ... (Constants like CATEGORY_OPTIONS, SEATING_TYPE_OPTIONS, etc. remain unchanged)
const CATEGORY_OPTIONS: { value: TableInventory['category']; label: string }[] = [
  { value: 'dining', label: 'Dining' },
  { value: 'patio', label: 'Patio' },
  { value: 'bar', label: 'Bar' },
  { value: 'lounge', label: 'Lounge' },
  { value: 'private', label: 'Private' },
];

const SEATING_TYPE_OPTIONS: { value: TableInventory['seatingType']; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'sofa', label: 'Sofa' },
  { value: 'booth', label: 'Booth' },
  { value: 'high_top', label: 'High-top' },
];

const MOBILITY_OPTIONS: { value: TableInventory['mobility']; label: string }[] = [
  { value: 'movable', label: 'Movable' },
  { value: 'fixed', label: 'Fixed' },
];

const STATUS_OPTIONS: { value: TableInventory['status']; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'out_of_service', label: 'Out of service' },
];


type TableFormState = Omit<CreateTablePayload, 'position'>;

// A separate component for the form to manage its own state cleanly
function TableForm({
  table,
  onClose,
  onSubmit,
  isSaving,
  zones,
  isZonesLoading,
}: {
  table: TableInventory | null;
  onClose: () => void;
  onSubmit: (payload: TableFormState) => void;
  isSaving: boolean;
  zones: { id: string; name: string; active: boolean }[];
  isZonesLoading: boolean;
}) {
  // REVISION: Use controlled components for all form fields to prevent data loss
  const [zoneId, setZoneId] = useState<string | undefined>(table?.zoneId);
  const [category, setCategory] = useState<TableInventory['category']>(table?.category ?? 'dining');
  const [seatingType, setSeatingType] = useState<TableInventory['seatingType']>(table?.seatingType ?? 'standard');
  const [mobility, setMobility] = useState<TableInventory['mobility']>(table?.mobility ?? 'movable');
  const [status, setStatus] = useState<TableInventory['status']>(table?.status ?? 'available');
  const [active, setActive] = useState<boolean>(table?.active ?? true);

  const isZoneSelectDisabled = zones.length === 0;

  useEffect(() => {
    const defaultZone = table?.zoneId ?? zones.find((zone) => zone.active)?.id ?? zones[0]?.id;
    setZoneId(defaultZone);
    setCategory(table?.category ?? 'dining');
    setSeatingType(table?.seatingType ?? 'standard');
    setMobility(table?.mobility ?? 'movable');
    setStatus(table?.status ?? 'available');
    setActive(table?.active ?? true);
  }, [table, zones]);

  const selectedZone = zones.find((zone) => zone.id === zoneId);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const toInteger = (value: FormDataEntryValue | null, fallback: number | null = null) => {
      if (!value) return fallback;
      const parsed = Number.parseInt(String(value), 10);
      return Number.isNaN(parsed) ? fallback : parsed;
    };

    const tableNumber = String(formData.get('tableNumber') ?? '').trim();
    const capacity = toInteger(formData.get('capacity'), 0) ?? 0;

    if (!tableNumber || capacity < 1) {
      return;
    }

    if (!zoneId) {
      return;
    }

    const minPartySize = toInteger(formData.get('minPartySize'), 1) ?? 1;
    const maxPartySize = toInteger(formData.get('maxPartySize'), null);

    if (maxPartySize !== null && maxPartySize < minPartySize) {
      return;
    }

    const payload: TableFormState = {
      tableNumber,
      capacity,
      minPartySize,
      maxPartySize,
      section: (() => {
        const value = String(formData.get('section') ?? '').trim();
        return value.length > 0 ? value : null;
      })(),
      notes: (() => {
        const value = String(formData.get('notes') ?? '').trim();
        return value.length > 0 ? value : null;
      })(),
      // REVISION: Read values from controlled state, not FormData
      zoneId,
      category,
      seatingType,
      mobility,
      status,
      active,
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{table ? 'Edit table' : 'Add new table'}</DialogTitle>
        <DialogDescription>Configure seating capacity and availability for this table.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 max-h-[70vh] overflow-y-auto pr-4">
        {/* ... Other input fields like tableNumber, capacity, party size remain the same ... */}
        <div className="grid gap-2">
          <Label htmlFor="tableNumber">Table number *</Label>
          <Input id="tableNumber" name="tableNumber" defaultValue={table?.tableNumber ?? ''} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="capacity">Capacity *</Label>
          <Input id="capacity" name="capacity" type="number" min={1} max={20} defaultValue={table?.capacity ?? 4} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="minPartySize">Min party size</Label>
            <Input id="minPartySize" name="minPartySize" type="number" min={1} defaultValue={table?.minPartySize ?? 1} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="maxPartySize">Max party size</Label>
            <Input id="maxPartySize" name="maxPartySize" type="number" min={1} defaultValue={table?.maxPartySize ?? ''} placeholder="Same as capacity" />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="section">Section</Label>
          <Input
            id="section"
            name="section"
            defaultValue={table?.section ?? ''}
            placeholder="Main Dining, Patio, Bar"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="zoneId">Zone *</Label>
            <Select
              value={zoneId}
              onValueChange={setZoneId}
              disabled={isZoneSelectDisabled || isZonesLoading}
            >
              <SelectTrigger id="zoneId">
                <SelectValue placeholder="Select a zone" />
              </SelectTrigger>
              <SelectContent>
                {isZonesLoading ? (
                  <SelectLabel>Loading zones...</SelectLabel>
                ) : isZoneSelectDisabled ? (
                  <SelectGroup>
                    <SelectLabel className="text-muted-foreground">No zones configured</SelectLabel>
                  </SelectGroup>
                ) : (
                  zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                      {!zone.active ? ' (inactive)' : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedZone && selectedZone.active === false && (
              <p className="text-xs text-amber-600">Zone is inactive. Reactivate it to bring these tables back into service.</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as TableInventory['category'])}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Choose category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* REVISION: Add helper text for clarity */}
            <p className="text-xs text-muted-foreground">For organizational purposes only. Does not affect allocation.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="seatingType">Seating</Label>
            <Select value={seatingType} onValueChange={(v) => setSeatingType(v as TableInventory['seatingType'])}>
              <SelectTrigger>
                <SelectValue placeholder="Choose seating" />
              </SelectTrigger>
              <SelectContent>
                {SEATING_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mobility">Mobility</Label>
            <Select value={mobility} onValueChange={(v) => setMobility(v as TableInventory['mobility'])}>
              <SelectTrigger>
                <SelectValue placeholder="Choose mobility" />
              </SelectTrigger>
              <SelectContent>
                {MOBILITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TableInventory['status'])}>
              <SelectTrigger>
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* REVISION: Add helper text for clarity on status semantics */}
            <p className="text-xs text-muted-foreground">&apos;Out of service&apos; blocks assignments. Other statuses are informational.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="active">Service status</Label>
            <div className="flex items-center space-x-2 rounded-md border p-3">
              <Switch id="active-switch" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="active-switch" className="flex-grow text-sm text-muted-foreground">
                {active ? 'Active in service' : 'Inactive / Decommissioned'}
              </Label>
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={table?.notes ?? ''}
            placeholder="Optional internal notes about this table"
            rows={3}
          />
        </div>

      </div>

      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || isZoneSelectDisabled}>
          {isSaving ? 'Saving…' : 'Save table'}
        </Button>
      </DialogFooter>
    </form>
  );
}


export default function TableInventoryClient() {
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const tableService = useTableInventoryService();
  const zoneService = useZoneService();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableInventory | null>(null);
  const [filterZone, setFilterZone] = useState<string>(ALL_ZONES_VALUE);
  const [zoneStatusFilter, setZoneStatusFilter] = useState<ZoneStatusFilter>('active');
  const [tableStatusFilter, setTableStatusFilter] = useState<TableStatusFilter>('active');
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  const canDeleteTables = Boolean(activeMembership && isRestaurantAdminRole(activeMembership.role));

  useEffect(() => {
    setFilterZone(ALL_ZONES_VALUE);
    setZoneStatusFilter('active');
    setTableStatusFilter('active');
    setEditingTable(null);
    setIsDialogOpen(false);
    setEditingZone(null);
    setIsZoneDialogOpen(false);
  }, [activeRestaurantId]);

  const tablesQueryKey = activeRestaurantId
    ? queryKeys.opsTables.list(activeRestaurantId)
    : ['ops', 'tables', 'no-restaurant'] as const;

  const zonesQueryKey = activeRestaurantId
    ? queryKeys.opsTables.zones(activeRestaurantId)
    : ['ops', 'tables', 'no-restaurant', 'zones'] as const;

  const {
    data: tableQueryResult,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: tablesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required to load tables');
      }
      return tableService.list(activeRestaurantId);
    },
    enabled: Boolean(activeRestaurantId),
    staleTime: 30_000,
  });


  const tables = useMemo(() => tableQueryResult?.tables ?? [], [tableQueryResult?.tables]);
  const summary = tableQueryResult?.summary ?? null;

  const {
    data: zonesData,
    isLoading: isLoadingZones,
    isError: isZonesError,
    error: zonesError,
  } = useQuery({
    queryKey: zonesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required to load zones');
      }
      return zoneService.list(activeRestaurantId);
    },
    enabled: Boolean(activeRestaurantId),
    staleTime: 60_000,
  });

  // REVISION: Ensure zones are always sorted consistently
  const zones = useMemo(() => {
    return (zonesData ?? []).slice().sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [zonesData]);

  const filteredZones = useMemo(
    () => filterZonesByStatus(zones, zoneStatusFilter),
    [zones, zoneStatusFilter]
  );

  const zoneOptions = useMemo(() => {
    // REVISION: Base options on the authoritative, sorted `zones` list
    return zones.map((zone) => ({ id: zone.id, name: zone.name, active: zone.active }));
  }, [zones]);

  useGlobalShortcuts([
    {
      key: 'n',
      meta: true,
      ctrl: true,
      preventDefault: true,
      enabled: Boolean(activeRestaurantId),
      handler: () => {
        setEditingTable(null);
        setIsDialogOpen(true);
      },
    },
    {
      key: 'escape',
      preventDefault: false,
      enabled: isDialogOpen || isZoneDialogOpen,
      handler: () => {
        if (isDialogOpen) setIsDialogOpen(false);
        if (isZoneDialogOpen) setIsZoneDialogOpen(false);
      },
    },
  ]);

  const isZoneSelectDisabled = zoneOptions.length === 0;

  const filteredTables = useMemo(() => {
    const zoneFiltered = filterZone === ALL_ZONES_VALUE
      ? tables
      : tables.filter((table) => table.zoneId === filterZone);
    return filterTablesByStatus(zoneFiltered, tableStatusFilter);
  }, [filterZone, tableStatusFilter, tables]);

  // ... (summaryCards useMemo hook remains largely the same)
  const summaryCards = useMemo(() => {
    if (!summary) {
      return null;
    }

    type SummaryCardDescriptor = {
      key: string;
      label: string;
      value: string;
      description?: string;
    };

    const serviceReadyTables = tables.filter((table) => table.active && table.zoneActive).length;
    const inactiveTables = Math.max(summary.totalTables - serviceReadyTables, 0);
    const inactiveZones = summary.zones.filter((zone) => zone.active === false).length;

    const cards: SummaryCardDescriptor[] = [
      {
        key: 'total-tables',
        label: 'Total tables configured',
        value: summary.totalTables.toLocaleString(),
        description: summary.totalTables === 1 ? 'Single seating resource' : `${summary.totalTables.toLocaleString()} entries in inventory`,
      },
      {
        key: 'total-capacity',
        label: 'Total seats planned',
        value: `${summary.totalCapacity.toLocaleString()} seats`,
      },
      {
        key: 'active-tables',
        label: 'Active for service',
        value: `${serviceReadyTables.toLocaleString()} tables`,
        description: inactiveTables > 0 ? `${inactiveTables.toLocaleString()} inactive` : undefined,
      },
      {
        key: 'zones-configured',
        label: 'Zones configured',
        value: summary.zones.length.toLocaleString(),
        description: inactiveZones > 0 ? `${inactiveZones} inactive` : undefined,
      },
    ];

    if (summary.serviceCapacities && summary.serviceCapacities.length > 0) {
      summary.serviceCapacities.forEach((service) => {
        const capacityValue = `${service.capacity.toLocaleString()} covers`;
        const turns = service.turnsPerTable;
        const description = turns > 0
          ? `≈${turns} turns across ${service.tablesConsidered} tables`
          : 'Insufficient window for additional turns';

        cards.push({
          key: `service-${service.key}`,
          label: service.label,
          value: capacityValue,
          description,
        });
      });
    }

    return cards;
  }, [summary, tables]);

  const createMutation = useMutation({
    mutationFn: ({ restaurantId, payload }: { restaurantId: string; payload: CreateTablePayload }) =>
      tableService.create(restaurantId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ tableId, payload }: { tableId: string; payload: UpdateTablePayload; }) =>
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
    },
  });

  // ... (Zone mutations remain the same)
  const zoneCreateMutation = useMutation({
    mutationFn: ({ restaurantId, name, sortOrder }: { restaurantId: string; name: string; sortOrder?: number }) =>
      zoneService.create(restaurantId, name, sortOrder),
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
    mutationFn: ({ zoneId, name, sortOrder, active }) => zoneService.update(zoneId, { name, sortOrder, active }),
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
    onSuccess: (zone, _variables) => {
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
      if (filterZone === variables.zoneId) {
        setFilterZone(ALL_ZONES_VALUE);
      }
    },
  });

  // REVISION: Safer zone delete handler
  const handleZoneDelete = (zone: Zone) => {
    const tablesInZone = tables.filter((table) => table.zoneId === zone.id);
    if (tablesInZone.length > 0) {
      return;
    }

    if (confirm(`Are you sure you want to delete the zone "${zone.name}"? This action cannot be undone.`)) {
      zoneDeleteMutation.mutate({ zoneId: zone.id });
    }
  };

  const handleTableSubmit = (payload: TableFormState) => {
    if (!activeRestaurantId) return;

    if (editingTable) {
      updateMutation.mutate({
        tableId: editingTable.id,
        payload: { ...payload, position: editingTable.position },
      });
    } else {
      createMutation.mutate({
        restaurantId: activeRestaurantId,
        payload: { ...payload, position: null },
      });
    }
  };

  // ... (handleZoneSubmit remains largely the same)
  const handleZoneSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeRestaurantId) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('zoneName') ?? '').trim();
    const sortOrderRaw = formData.get('sortOrder');
    const sortOrder = (() => {
      if (sortOrderRaw === null || sortOrderRaw === '') {
        return undefined;
      }
      const parsed = Number.parseInt(String(sortOrderRaw), 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    })();

    if (name.length === 0) {
      return;
    }

    if (editingZone) {
      zoneUpdateMutation.mutate({ zoneId: editingZone.id, name, sortOrder });
      return;
    }

    zoneCreateMutation.mutate({ restaurantId: activeRestaurantId, name, sortOrder });
  };


  if (memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No restaurant access</AlertTitle>
        <AlertDescription>
          Your account is not linked to any restaurants yet. Ask an owner or manager to invite you before managing tables.
        </AlertDescription>
      </Alert>
    );
  }

  // ... (Loading/Error states for the whole page remain the same)
  if (!activeRestaurantId) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (isError) {
    const message = error instanceof Error ? error.message : 'Unable to load tables right now.';
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load tables</AlertTitle>
        <AlertDescription className="flex items-start justify-between gap-4">
          <span>{message}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* ... (Summary card section remains the same) ... */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards ? (
          summaryCards.map((card) => (
            <SummaryCard
              key={card.key}
              label={card.label}
              value={card.value}
              description={card.description}
            />
          ))
        ) : (
          <>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </>
        )}
      </section>

      {/* ... (Zones section JSX updated to use the safe delete handler) ... */}
      <SettingsCard
        title="Zones"
        description="Group tables by areas of your floor plan. Add or rename zones as your layout changes."
        headerAction={
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="zone-status-filter" className="text-sm text-muted-foreground">
              Show
            </Label>
            <Select
              value={zoneStatusFilter}
              onValueChange={(value) => setZoneStatusFilter(value as ZoneStatusFilter)}
            >
              <SelectTrigger id="zone-status-filter" className="w-[170px]">
                <SelectValue placeholder="All zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active zones</SelectItem>
                <SelectItem value="inactive">Inactive zones</SelectItem>
                <SelectItem value="all">All zones</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingZone(null);
                setIsZoneDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add zone
            </Button>
          </div>
        }
      >
        {isLoadingZones ? (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
        ) : isZonesError ? (
          <Alert variant="destructive">
            <AlertTitle>Zones unavailable</AlertTitle>
            <AlertDescription>
              {zonesError instanceof Error ? zonesError.message : 'Unable to load zones right now.'}
            </AlertDescription>
          </Alert>
        ) : filteredZones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {zones.length === 0
              ? 'No zones configured yet. Create your first zone to start organizing tables.'
              : 'No zones match this filter. Show all to view inactive zones.'}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filteredZones.map((zone) => {
              const isActiveFilter = filterZone === zone.id;
              return (
                <li key={zone.id}>
                  <div
                    className={`flex flex-col gap-2 rounded-md border px-3 py-2 ${zone.active ? 'bg-background' : 'bg-muted/60'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={isActiveFilter ? 'default' : 'ghost'}
                          onClick={() => setFilterZone(isActiveFilter ? ALL_ZONES_VALUE : zone.id)}
                        >
                          {zone.name}
                        </Button>
                        <Badge variant={zone.active ? 'outline' : 'secondary'}>
                          {zone.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">#{zone.sortOrder ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={zone.active}
                          onCheckedChange={(checked) =>
                            zoneUpdateMutation.mutate({ zoneId: zone.id, active: checked })
                          }
                          aria-label={`Toggle ${zone.name} zone availability`}
                          disabled={zoneUpdateMutation.isPending}
                        />
                        <span className="hidden text-xs text-muted-foreground md:inline">Seasonal toggle</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {zone.active
                        ? 'Included in capacity and assignments.'
                        : 'Tables stay visible but are excluded from service until re-enabled.'}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingZone(zone);
                          setIsZoneDialogOpen(true);
                        }}
                        aria-label={`Edit zone ${zone.name}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={zoneDeleteMutation.isPending}
                        onClick={() => handleZoneDelete(zone)}
                        aria-label={`Delete zone ${zone.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      {/* ... (Filter and Add Table section remains the same) ... */}
      <SettingsCard
        title="Table Inventory"
        description="Manage your tables, capacities, and settings."
        headerAction={
          <Button
            onClick={() => {
              setEditingTable(null);
              setIsDialogOpen(true);
            }}
            disabled={isZoneSelectDisabled && !isLoadingZones}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add table
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <div className="flex items-center gap-3">
              <Label htmlFor="table-zone-filter" className="text-sm">Filter by Zone</Label>
              <Select value={filterZone} onValueChange={setFilterZone}>
                <SelectTrigger id="table-zone-filter" className="w-[220px]">
                  <SelectValue placeholder="All zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ZONES_VALUE}>All zones</SelectItem>
                  {zoneOptions.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                      {zone.active ? '' : ' (inactive)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="table-status-filter" className="text-sm">Show</Label>
              <Select
                value={tableStatusFilter}
                onValueChange={(value) => setTableStatusFilter(value as TableStatusFilter)}
              >
                <SelectTrigger id="table-status-filter" className="w-[200px]">
                  <SelectValue placeholder="All tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active tables only</SelectItem>
                  <SelectItem value="inactive">Inactive tables only</SelectItem>
                  <SelectItem value="all">All tables</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Party size</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Seating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isFetching ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading tables…</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      {tables.length === 0
                        ? 'No tables configured yet. Add your first table to get started.'
                        : 'No tables match this filter. Try showing all zones or tables.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTables.map((table) => (
                    <TableRow key={table.id} className={table.zoneActive ? undefined : 'bg-muted/60'}>
                      <TableCell className="font-medium">
                        <span>{table.tableNumber}</span>
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <span>{table.zoneName ?? '—'}</span>
                        {table.zoneActive === false && <Badge variant="secondary">Zone off</Badge>}
                      </TableCell>
                      <TableCell>{table.capacity}</TableCell>
                      <TableCell>
                        {table.minPartySize}
                        {table.maxPartySize ? `–${table.maxPartySize}` : '+'}
                      </TableCell>
                      <TableCell className="capitalize">{table.category}</TableCell>
                      <TableCell className="capitalize">
                        {table.seatingType.replace('_', ' ')}
                        <span className="text-muted-foreground"> · {table.mobility}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={table.status === 'available' ? 'default' : 'secondary'}>
                          {table.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {table.active && table.zoneActive !== false ? (
                          <Badge variant="outline">Active</Badge>
                        ) : table.active ? (
                          <Badge variant="secondary">Blocked by zone</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingTable(table);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit table</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!canDeleteTables || deleteMutation.isPending}
                            onClick={() => {
                              if (confirm(`Delete table ${table.tableNumber}? This action cannot be undone.`)) {
                                deleteMutation.mutate({ tableId: table.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete table</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SettingsCard>

      {/* REVISION: The Dialog now renders the stateful TableForm component */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <TableForm
            table={editingTable}
            zones={zoneOptions}
            isZonesLoading={isLoadingZones}
            onClose={() => setIsDialogOpen(false)}
            onSubmit={handleTableSubmit}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* ... (Zone dialog remains the same) ... */}
      <Dialog
        open={isZoneDialogOpen}
        onOpenChange={(open) => {
          setIsZoneDialogOpen(open);
          if (!open) {
            setEditingZone(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleZoneSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{editingZone ? 'Edit zone' : 'Add zone'}</DialogTitle>
              <DialogDescription>Zones help segment your dining room into manageable sections.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="zoneName">Zone name *</Label>
                <Input
                  id="zoneName"
                  name="zoneName"
                  defaultValue={editingZone?.name ?? ''}
                  placeholder="e.g. Main Dining"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zoneSortOrder">Sort order</Label>
                <Input
                  id="zoneSortOrder"
                  name="sortOrder"
                  type="number"
                  defaultValue={editingZone?.sortOrder ?? 0}
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first in the list. Defaults to 0.
                </p>
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsZoneDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={zoneCreateMutation.isPending || zoneUpdateMutation.isPending}
              >
                {zoneCreateMutation.isPending || zoneUpdateMutation.isPending ? 'Saving…' : 'Save zone'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ... (SummaryCard component remains the same)
function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
