/**
 * Table Inventory Client Component
 * Story 4: Ops Dashboard - Tables Management
 *
 * REVISED: This component has been updated to address several potential issues,
 * including controlled form components, safer delete operations, and improved UI clarity.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ClipboardList,
  Edit,
  LayoutGrid,
  Loader2,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import {
  SETTINGS_COMPACT_FILTER_BAR_CLASS,
  SETTINGS_COMPACT_ROUTE_STACK_CLASS,
  RestaurantSettingsCommandCenter,
  SettingsCard,
  SettingsSecondaryActions,
} from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormRoot } from '@/components/ui/form';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import {
  ALL_ZONES_VALUE,
  CATEGORY_OPTIONS,
  MOBILITY_OPTIONS,
  SEATING_TYPE_OPTIONS,
  STATUS_OPTIONS,
  filterTablesByStatus,
  filterZonesByStatus,
  type TableFormState,
  type TableStatusFilter,
  type TableZone,
  type ZoneStatusFilter,
} from './tableInventoryModel';

import type { CreateTablePayload, TableInventory, UpdateTablePayload } from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';

type TableWorkspace = 'summary' | 'zones' | 'inventory';

// A separate component for the form to manage its own state cleanly
function TableForm({
  table,
  onClose,
  onSubmit,
  isSaving,
  zones,
  isZonesLoading,
  isFirstTable,
}: {
  table: TableInventory | null;
  onClose: () => void;
  onSubmit: (payload: TableFormState) => void;
  isSaving: boolean;
  zones: Pick<TableZone, 'id' | 'name' | 'active'>[];
  isZonesLoading: boolean;
  isFirstTable: boolean;
}) {
  // REVISION: Use controlled components for all form fields to prevent data loss
  const [zoneId, setZoneId] = useState<string | undefined>(table?.zoneId);
  const [category, setCategory] = useState<TableInventory['category']>(table?.category ?? 'dining');
  const [seatingType, setSeatingType] = useState<TableInventory['seatingType']>(
    table?.seatingType ?? 'standard',
  );
  const [mobility, setMobility] = useState<TableInventory['mobility']>(
    table?.mobility ?? 'movable',
  );
  const [status, setStatus] = useState<TableInventory['status']>(table?.status ?? 'available');
  const [active, setActive] = useState<boolean>(table?.active ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const isZoneSelectDisabled = zones.length === 0;

  useEffect(() => {
    const defaultZone = table?.zoneId ?? zones.find((zone) => zone.active)?.id ?? zones[0]?.id;
    setZoneId(defaultZone);
    setCategory(table?.category ?? 'dining');
    setSeatingType(table?.seatingType ?? 'standard');
    setMobility(table?.mobility ?? 'movable');
    setStatus(table?.status ?? 'available');
    setActive(table?.active ?? true);
    setFormError(null);
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

    if (!tableNumber) {
      setFormError('Enter a table number before saving.');
      return;
    }

    if (capacity < 1) {
      setFormError('Capacity must be at least 1 cover.');
      return;
    }

    if (!zoneId) {
      setFormError('Choose a zone before saving this table.');
      return;
    }

    const minPartySize = toInteger(formData.get('minPartySize'), 1) ?? 1;
    const maxPartySize = toInteger(formData.get('maxPartySize'), null);

    if (maxPartySize !== null && maxPartySize < minPartySize) {
      setFormError('Max party size must be greater than or equal to the min party size.');
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
    <FormRoot onSubmit={handleSubmit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{table ? 'Edit table' : 'Add new table'}</DialogTitle>
        <DialogDescription>
          {isFirstTable
            ? 'Start with table number and capacity. You can add more zones and advanced details later.'
            : 'Configure seating capacity and availability for this table.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 max-h-[70vh] overflow-y-auto pr-4">
        <div className="grid gap-2">
          <Label htmlFor="tableNumber">Table number *</Label>
          <Input
            id="tableNumber"
            name="tableNumber"
            defaultValue={table?.tableNumber ?? ''}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="capacity">Capacity *</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={20}
            defaultValue={table?.capacity ?? 4}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="minPartySize">Min party size</Label>
            <Input
              id="minPartySize"
              name="minPartySize"
              type="number"
              min={1}
              defaultValue={table?.minPartySize ?? 1}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="maxPartySize">Max party size</Label>
            <Input
              id="maxPartySize"
              name="maxPartySize"
              type="number"
              min={1}
              defaultValue={table?.maxPartySize ?? ''}
              placeholder="Same as capacity"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="zoneId">Zone</Label>
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
            <p className="text-xs text-primary">
              Zone is inactive. Reactivate it to bring these tables back into service.
            </p>
          )}
          {!selectedZone && (
            <p className="text-xs text-muted-foreground">
              Choose the service area this table belongs to. Add more zones later if needed.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="active">Active</Label>
          <div className="flex items-center gap-2 rounded-md border p-3">
            <Switch id="active-switch" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active-switch" className="flex-grow text-sm text-muted-foreground">
              {active ? 'Active in service' : 'Inactive / decommissioned'}
            </Label>
          </div>
        </div>

        <Collapsible className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium text-foreground">More table details</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Add section, classification, seating type, mobility, status, and notes when
                  needed.
                </span>
              </span>
              <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid gap-4">
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
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as TableInventory['category'])}
                  >
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
                  <p className="text-xs text-muted-foreground">
                    For organizational purposes only. Does not affect allocation.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="seatingType">Seating</Label>
                  <Select
                    value={seatingType}
                    onValueChange={(v) => setSeatingType(v as TableInventory['seatingType'])}
                  >
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
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="mobility">Mobility</Label>
                  <Select
                    value={mobility}
                    onValueChange={(v) => setMobility(v as TableInventory['mobility'])}
                  >
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
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as TableInventory['status'])}
                  >
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
                  <p className="text-xs text-muted-foreground">
                    &apos;Out of service&apos; blocks assignments. Other statuses are informational.
                  </p>
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
          </CollapsibleContent>
        </Collapsible>
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Table was not saved</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || isZoneSelectDisabled}>
          {isSaving ? 'Saving…' : 'Save table'}
        </Button>
      </DialogFooter>
    </FormRoot>
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
  const [activeWorkspace, setActiveWorkspace] = useState<TableWorkspace>('summary');
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<TableZone | null>(null);
  const [tableDeleteTarget, setTableDeleteTarget] = useState<TableInventory | null>(null);
  const [zoneDeleteTarget, setZoneDeleteTarget] = useState<TableZone | null>(null);
  const [zoneDeleteBlockedMessage, setZoneDeleteBlockedMessage] = useState<string | null>(null);

  const canDeleteTables = Boolean(activeMembership && isRestaurantAdminRole(activeMembership.role));

  useEffect(() => {
    setFilterZone(ALL_ZONES_VALUE);
    setZoneStatusFilter('active');
    setTableStatusFilter('active');
    setEditingTable(null);
    setIsDialogOpen(false);
    setEditingZone(null);
    setIsZoneDialogOpen(false);
    setTableDeleteTarget(null);
    setZoneDeleteTarget(null);
    setZoneDeleteBlockedMessage(null);
  }, [activeRestaurantId]);

  const tablesQueryKey = activeRestaurantId
    ? queryKeys.opsTables.list(activeRestaurantId)
    : (['ops', 'tables', 'no-restaurant'] as const);

  const zonesQueryKey = activeRestaurantId
    ? queryKeys.opsTables.zones(activeRestaurantId)
    : (['ops', 'tables', 'no-restaurant', 'zones'] as const);

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

  const summaryZones = useMemo<TableZone[]>(
    () =>
      (summary?.zones ?? []).map((zone) => ({
        id: zone.id,
        name: zone.name,
        active: zone.active,
        sortOrder: zone.sortOrder,
      })),
    [summary?.zones],
  );

  const fallbackZonesQuery = useQuery({
    queryKey: zonesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required to load zones');
      }
      return zoneService.list(activeRestaurantId);
    },
    enabled: Boolean(activeRestaurantId) && !isLoading && !summary,
    staleTime: 60_000,
  });

  const isLoadingZones = !summary && (isLoading || fallbackZonesQuery.isLoading);
  const isZonesError = !summary && fallbackZonesQuery.isError;
  const zonesError = fallbackZonesQuery.error;

  const zones = useMemo(() => {
    // Use zones already embedded in the tables summary to avoid a duplicate initial /api/ops/zones request.
    const source = summary ? summaryZones : (fallbackZonesQuery.data ?? []);
    return source.slice().sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [fallbackZonesQuery.data, summary, summaryZones]);

  const filteredZones = useMemo(
    () => filterZonesByStatus(zones, zoneStatusFilter),
    [zones, zoneStatusFilter],
  );

  const zoneOptions = useMemo(() => {
    // REVISION: Base options on the authoritative, sorted `zones` list
    return zones.map((zone) => ({ id: zone.id, name: zone.name, active: zone.active }));
  }, [zones]);

  const openNewTableDialog = useCallback(() => {
    setEditingTable(null);
    setIsDialogOpen(true);
  }, []);

  const closeOpenDialogs = useCallback(() => {
    if (isDialogOpen) setIsDialogOpen(false);
    if (isZoneDialogOpen) setIsZoneDialogOpen(false);
  }, [isDialogOpen, isZoneDialogOpen]);

  const tableShortcuts = useMemo(
    () => [
      {
        key: 'n',
        metaOrCtrl: true,
        preventDefault: true,
        enabled: Boolean(activeRestaurantId),
        handler: openNewTableDialog,
      },
      {
        key: 'escape',
        preventDefault: false,
        enabled: isDialogOpen || isZoneDialogOpen,
        handler: closeOpenDialogs,
      },
    ],
    [activeRestaurantId, closeOpenDialogs, isDialogOpen, isZoneDialogOpen, openNewTableDialog],
  );

  // Keep the shortcut array stable so useGlobalShortcuts does not rebind window listeners on every render.
  useGlobalShortcuts(tableShortcuts);

  const isZoneSelectDisabled = zoneOptions.length === 0;
  const selectWorkspace = useCallback((workspace: TableWorkspace) => {
    setActiveWorkspace(workspace);
    const hash =
      workspace === 'summary'
        ? 'table-capacity-summary'
        : workspace === 'zones'
          ? 'table-zones'
          : 'table-inventory';
    window.history.replaceState(null, '', `#${hash}`);
  }, []);

  const filteredTables = useMemo(() => {
    const zoneFiltered =
      filterZone === ALL_ZONES_VALUE
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
    const serviceReadyCovers = tables
      .filter((table) => table.active && table.zoneActive)
      .reduce((total, table) => total + table.capacity, 0);
    const inactiveTables = Math.max(summary.totalTables - serviceReadyTables, 0);
    const inactiveZones = summary.zones.filter((zone) => zone.active === false).length;

    const cards: SummaryCardDescriptor[] = [
      {
        key: 'ready-for-bookings',
        label: 'Ready for bookings',
        value: `${serviceReadyTables.toLocaleString()} active tables, ${serviceReadyCovers.toLocaleString()} covers`,
        description:
          serviceReadyTables > 0
            ? 'Active tables in active zones can be booked.'
            : 'Add an active table before guests can book seats.',
      },
      {
        key: 'inventory-total',
        label: 'Inventory total',
        value: `${summary.totalTables.toLocaleString()} tables`,
        description: `${summary.totalCapacity.toLocaleString()} planned covers across all table records`,
      },
      {
        key: 'inactive-tables',
        label: 'Needs attention',
        value: `${inactiveTables.toLocaleString()} tables`,
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
        const description =
          turns > 0
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

  // ... (Zone mutations remain the same)
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
      setZoneDeleteTarget(null);
      setZoneDeleteBlockedMessage(null);
      if (filterZone === variables.zoneId) {
        setFilterZone(ALL_ZONES_VALUE);
      }
    },
  });

  // REVISION: Safer zone delete handler
  const handleZoneDelete = (zone: TableZone) => {
    const tablesInZone = tables.filter((table) => table.zoneId === zone.id);
    if (tablesInZone.length > 0) {
      setZoneDeleteBlockedMessage(
        `${zone.name} still has ${tablesInZone.length} table${
          tablesInZone.length === 1 ? '' : 's'
        }. Move or delete those tables before deleting the zone.`,
      );
      return;
    }

    setZoneDeleteBlockedMessage(null);
    setZoneDeleteTarget(zone);
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
          Your account is not linked to any restaurants yet. Ask an owner or manager to invite you
          before managing tables.
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
    <RestaurantSettingsCommandCenter
      eyebrow="Tables command center"
      title="Tables"
      description="Manage seating zones, table inventory, capacity, party-size rules, and service readiness from one route."
      metrics={[
        {
          label: 'Bookable tables',
          value: summary
            ? `${tables.filter((table) => table.active && table.zoneActive).length} tables`
            : 'Loading',
          description: summary
            ? `${tables
                .filter((table) => table.active && table.zoneActive)
                .reduce((total, table) => total + table.capacity, 0)} covers`
            : 'capacity',
          variant: 'secondary',
          Icon: Table2,
        },
        {
          label: 'Zones',
          value: summary ? summary.zones.length.toLocaleString() : 'Loading',
          description: 'floor-plan groups',
          variant: 'outline',
          Icon: LayoutGrid,
        },
        {
          label: 'Inventory total',
          value: summary ? `${summary.totalTables.toLocaleString()} tables` : 'Loading',
          description: summary ? `${summary.totalCapacity.toLocaleString()} planned covers` : '',
          variant: 'metric',
          Icon: ClipboardList,
        },
      ]}
      railTitle="Tables workflow"
      railDescription="Set up zones first, then add or edit the tables guests can book."
      railItems={[
        {
          label: 'Capacity summary',
          description: 'Readiness, total inventory, inactive tables, and service capacities.',
          href: '#table-capacity-summary',
          Icon: ClipboardList,
          isActive: activeWorkspace === 'summary',
          onSelect: () => selectWorkspace('summary'),
        },
        {
          label: 'Zones',
          description: 'Floor-plan groups, seasonal toggles, and zone sorting.',
          href: '#table-zones',
          Icon: LayoutGrid,
          isActive: activeWorkspace === 'zones',
          onSelect: () => selectWorkspace('zones'),
        },
        {
          label: 'Inventory',
          description: 'Table numbers, covers, party sizes, seating type, and availability.',
          href: '#table-inventory',
          Icon: Table2,
          isActive: activeWorkspace === 'inventory',
          onSelect: () => selectWorkspace('inventory'),
        },
      ]}
      footer="Only active tables in active zones count as service-ready capacity."
    >
      <div className={SETTINGS_COMPACT_ROUTE_STACK_CLASS}>
        {/* ... (Summary card section remains the same) ... */}
        <section
          id="table-capacity-summary"
          hidden={activeWorkspace !== 'summary'}
          className={cn(
            'scroll-mt-28 grid gap-4 sm:grid-cols-2 xl:grid-cols-4',
            activeWorkspace !== 'summary' && 'hidden',
          )}
        >
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
        <div
          id="table-zones"
          hidden={activeWorkspace !== 'zones'}
          className={cn('scroll-mt-28', activeWorkspace !== 'zones' && 'hidden')}
        >
          <SettingsCard
            title="Zones"
            description="Group tables by areas of your floor plan. Add or rename zones as your layout changes."
            headerAction={
              <SettingsSecondaryActions label="Zone options" contentClassName="sm:min-w-80">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="zone-status-filter" className="text-sm text-muted-foreground">
                    Show
                  </Label>
                  <Select
                    value={zoneStatusFilter}
                    onValueChange={(value) => setZoneStatusFilter(value as ZoneStatusFilter)}
                  >
                    <SelectTrigger id="zone-status-filter">
                      <SelectValue placeholder="All zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active zones</SelectItem>
                      <SelectItem value="inactive">Inactive zones</SelectItem>
                      <SelectItem value="all">All zones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingZone(null);
                    setIsZoneDialogOpen(true);
                  }}
                >
                  <Plus data-icon="inline-start" aria-hidden />
                  Add zone
                </Button>
              </SettingsSecondaryActions>
            }
          >
            {zoneDeleteBlockedMessage ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Zone cannot be deleted yet</AlertTitle>
                <AlertDescription>{zoneDeleteBlockedMessage}</AlertDescription>
              </Alert>
            ) : null}
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
                  {zonesError instanceof Error
                    ? zonesError.message
                    : 'Unable to load zones right now.'}
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
                        className={`flex flex-col gap-2 rounded-md border px-3 py-2 ${
                          zone.active ? 'bg-background' : 'bg-muted/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={isActiveFilter ? 'default' : 'ghost'}
                              onClick={() =>
                                setFilterZone(isActiveFilter ? ALL_ZONES_VALUE : zone.id)
                              }
                            >
                              {zone.name}
                            </Button>
                            <Badge variant={zone.active ? 'outline' : 'secondary'}>
                              {zone.active ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              #{zone.sortOrder ?? 0}
                            </span>
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
                            <span className="hidden text-xs text-muted-foreground md:inline">
                              Seasonal toggle
                            </span>
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
                            <Edit aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={zoneDeleteMutation.isPending}
                            onClick={() => handleZoneDelete(zone)}
                            aria-label={`Delete zone ${zone.name}`}
                          >
                            <Trash2 className="text-destructive" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsCard>
        </div>

        {/* ... (Filter and Add Table section remains the same) ... */}
        <div
          id="table-inventory"
          hidden={activeWorkspace !== 'inventory'}
          className={cn('scroll-mt-28', activeWorkspace !== 'inventory' && 'hidden')}
        >
          <SettingsCard
            title="Table inventory"
            description="Tables tell the booking system how many guests you can seat."
            headerAction={
              <Button
                size="sm"
                onClick={() => {
                  openNewTableDialog();
                }}
                disabled={isZoneSelectDisabled && !isLoadingZones}
              >
                <Plus data-icon="inline-start" aria-hidden />
                Add table
              </Button>
            }
          >
            <div className="flex flex-col gap-4">
              <div
                className={cn(
                  SETTINGS_COMPACT_FILTER_BAR_CLASS,
                  'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
                )}
              >
                <div className="flex items-center gap-3">
                  <Label htmlFor="table-zone-filter" className="text-sm">
                    Filter by Zone
                  </Label>
                  <Select value={filterZone} onValueChange={setFilterZone}>
                    <SelectTrigger id="table-zone-filter" className="w-full md:w-[220px]">
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
                  <Label htmlFor="table-status-filter" className="text-sm">
                    Show
                  </Label>
                  <Select
                    value={tableStatusFilter}
                    onValueChange={(value) => setTableStatusFilter(value as TableStatusFilter)}
                  >
                    <SelectTrigger id="table-status-filter" className="w-full md:w-[200px]">
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

              <div className="grid gap-3 md:hidden">
                {isLoading || isFetching ? (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      <span>Loading tables…</span>
                    </div>
                  </div>
                ) : filteredTables.length === 0 ? (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    {tables.length === 0
                      ? 'Add your first tables. Start with table number and capacity; advanced details can come later.'
                      : 'No tables match this filter. Try showing all zones or tables.'}
                  </div>
                ) : (
                  filteredTables.map((table) => (
                    <article
                      key={table.id}
                      className={cn(
                        'rounded-lg border bg-card p-4 shadow-sm',
                        table.zoneActive === false && 'bg-muted/60',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-foreground">
                            Table {table.tableNumber}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {table.zoneName ?? 'No zone'} · {table.capacity} covers
                          </p>
                        </div>
                        <Badge variant={table.status === 'available' ? 'default' : 'secondary'}>
                          {table.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Party size</dt>
                          <dd className="font-medium text-foreground">
                            {table.minPartySize}
                            {table.maxPartySize ? `–${table.maxPartySize}` : '+'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Seating</dt>
                          <dd className="font-medium capitalize text-foreground">
                            {table.seatingType.replace('_', ' ')}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Category</dt>
                          <dd className="font-medium capitalize text-foreground">
                            {table.category}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Availability</dt>
                          <dd className="font-medium text-foreground">
                            {table.active && table.zoneActive !== false
                              ? 'Active'
                              : table.active
                                ? 'Blocked by zone'
                                : 'Inactive'}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-4 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setEditingTable(table);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit data-icon="inline-start" aria-hidden />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-destructive"
                          disabled={!canDeleteTables || deleteMutation.isPending}
                          onClick={() => setTableDeleteTarget(table)}
                        >
                          <Trash2 data-icon="inline-start" aria-hidden />
                          Delete
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="hidden rounded-lg border md:block">
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
                            <Loader2 className="size-4 animate-spin" />
                            <span>Loading tables…</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredTables.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                          {tables.length === 0
                            ? 'Add your first tables. Start with table number and capacity; advanced details can come later.'
                            : 'No tables match this filter. Try showing all zones or tables.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTables.map((table) => (
                        <TableRow
                          key={table.id}
                          className={table.zoneActive ? undefined : 'bg-muted/60'}
                        >
                          <TableCell className="font-medium">
                            <span>{table.tableNumber}</span>
                          </TableCell>
                          <TableCell className="flex items-center gap-2">
                            <span>{table.zoneName ?? '—'}</span>
                            {table.zoneActive === false && (
                              <Badge variant="secondary">Zone off</Badge>
                            )}
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
                                <Edit data-icon="inline-start" aria-hidden />
                                <span className="sr-only">Edit table</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!canDeleteTables || deleteMutation.isPending}
                                onClick={() => setTableDeleteTarget(table)}
                              >
                                <Trash2
                                  data-icon="inline-start"
                                  className="text-destructive"
                                  aria-hidden
                                />
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
        </div>

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
              isFirstTable={!editingTable && tables.length === 0}
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
            <FormRoot onSubmit={handleZoneSubmit} className="flex flex-col gap-5">
              <DialogHeader>
                <DialogTitle>{editingZone ? 'Edit zone' : 'Add zone'}</DialogTitle>
                <DialogDescription>
                  Zones help segment your dining room into manageable sections.
                </DialogDescription>
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
                  {zoneCreateMutation.isPending || zoneUpdateMutation.isPending
                    ? 'Saving…'
                    : 'Save zone'}
                </Button>
              </DialogFooter>
            </FormRoot>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={tableDeleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setTableDeleteTarget(null);
            }
          }}
          title="Delete table?"
          description={
            tableDeleteTarget
              ? `Table ${tableDeleteTarget.tableNumber} will be removed from inventory and can no longer be assigned to bookings. This cannot be undone.`
              : undefined
          }
          confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete table'}
          cancelLabel="Keep table"
          tone="destructive"
          onConfirm={() => {
            if (!tableDeleteTarget || deleteMutation.isPending) {
              return;
            }
            deleteMutation.mutate({ tableId: tableDeleteTarget.id });
          }}
        />

        <ConfirmDialog
          open={zoneDeleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setZoneDeleteTarget(null);
            }
          }}
          title="Delete zone?"
          description={
            zoneDeleteTarget
              ? `${zoneDeleteTarget.name} will be removed from the floor-plan groups. This cannot be undone.`
              : undefined
          }
          confirmLabel={zoneDeleteMutation.isPending ? 'Deleting…' : 'Delete zone'}
          cancelLabel="Keep zone"
          tone="destructive"
          onConfirm={() => {
            if (!zoneDeleteTarget || zoneDeleteMutation.isPending) {
              return;
            }
            zoneDeleteMutation.mutate({ zoneId: zoneDeleteTarget.id });
          }}
        />
      </div>
    </RestaurantSettingsCommandCenter>
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
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}
