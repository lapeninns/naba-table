/**
 * Table Inventory Client Component
 * Story 4: Ops Dashboard - Tables Management
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useToast } from '@/hooks/use-toast';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { queryKeys } from '@/lib/query/keys';

import type {
  CreateTablePayload,
  TableInventory,
  UpdateTablePayload,
} from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';


const ALL_ZONES_VALUE = 'all-zones';

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

type TableFormState = CreateTablePayload;

export default function TableInventoryClient() {
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const tableService = useTableInventoryService();
  const zoneService = useZoneService();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableInventory | null>(null);
  const [filterZone, setFilterZone] = useState<string>(ALL_ZONES_VALUE);
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  const canDeleteTables = Boolean(activeMembership && isRestaurantAdminRole(activeMembership.role));

  useEffect(() => {
    setFilterZone(ALL_ZONES_VALUE);
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

  const tables = tableQueryResult?.tables ?? [];
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

  const zones = zonesData ?? [];

  const zoneOptions = useMemo(() => {
    if (zones.length > 0) {
      return zones.map((zone) => ({ id: zone.id, name: zone.name, sortOrder: zone.sortOrder }));
    }
    if (summary?.zones && summary.zones.length > 0) {
      return summary.zones;
    }
    const derived = new Map<string, string>();
    tables.forEach((table) => {
      if (!derived.has(table.zoneId)) {
        derived.set(table.zoneId, table.zoneName ?? 'Zone');
      }
    });
    return Array.from(derived.entries()).map(([id, name]) => ({ id, name }));
  }, [zones, summary?.zones, tables]);

  const zoneDefaultValue = useMemo(() => {
    if (zoneOptions.length === 0) {
      return undefined;
    }

    if (editingTable?.zoneId && zoneOptions.some((zone) => zone.id === editingTable.zoneId)) {
      return editingTable.zoneId;
    }

    return zoneOptions[0]?.id;
  }, [editingTable?.zoneId, zoneOptions]);

  const isZoneSelectDisabled = zoneOptions.length === 0;

  const filteredTables = useMemo(() => {
    if (filterZone === ALL_ZONES_VALUE) {
      return tables;
    }
    return tables.filter((table) => table.zoneId === filterZone);
  }, [filterZone, tables]);

  useEffect(() => {
    if (filterZone === ALL_ZONES_VALUE) {
      return;
    }
    if (!zoneOptions.some((zone) => zone.id === filterZone)) {
      setFilterZone(ALL_ZONES_VALUE);
    }
  }, [filterZone, zoneOptions]);

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

    const activeTables = tables.filter((table) => table.active).length;
    const inactiveTables = Math.max(summary.totalTables - activeTables, 0);

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
        value: `${activeTables.toLocaleString()} tables`,
        description: inactiveTables > 0 ? `${inactiveTables.toLocaleString()} inactive` : undefined,
      },
      {
        key: 'zones-configured',
        label: 'Zones configured',
        value: summary.zones.length.toLocaleString(),
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

  const zoneCreateMutation = useMutation({
    mutationFn: ({ restaurantId, name, sortOrder }: { restaurantId: string; name: string; sortOrder?: number }) =>
      zoneService.create(restaurantId, name, sortOrder),
    onSuccess: (zone) => {
      queryClient.invalidateQueries({ queryKey: zonesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setIsZoneDialogOpen(false);
      setEditingZone(null);
      setFilterZone(zone.id);
      toast({ title: 'Zone created', description: `${zone.name} is ready for tables.` });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to create zone.';
      toast({ title: 'Unable to create zone', description: message, variant: 'destructive' });
    },
  });

  const zoneUpdateMutation = useMutation({
    mutationFn: ({ zoneId, name, sortOrder }: { zoneId: string; name?: string; sortOrder?: number }) =>
      zoneService.update(zoneId, { name, sortOrder }),
    onSuccess: (zone) => {
      queryClient.invalidateQueries({ queryKey: zonesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setIsZoneDialogOpen(false);
      setEditingZone(null);
      toast({ title: 'Zone updated', description: 'Changes saved.' });
      setFilterZone((current) => (current === zone.id ? zone.id : current));
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update zone.';
      toast({ title: 'Unable to update zone', description: message, variant: 'destructive' });
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
      toast({ title: 'Zone deleted', description: 'The zone has been removed.' });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to delete zone. Make sure no tables use this zone.';
      toast({ title: 'Unable to delete zone', description: message, variant: 'destructive' });
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ restaurantId, payload }: { restaurantId: string; payload: CreateTablePayload }) =>
      tableService.create(restaurantId, payload),
    onSuccess: (_createdTable, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setIsDialogOpen(false);
      toast({
        title: 'Table created',
        description: 'The table has been added successfully.',
      });
      if (variables.restaurantId !== activeRestaurantId) {
        setFilterZone(ALL_ZONES_VALUE);
      }
    },
    onError: (mutationError: unknown) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Failed to create table.';
      toast({
        title: 'Unable to create table',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      tableId,
      payload,
    }: {
      restaurantId: string;
      tableId: string;
      payload: UpdateTablePayload;
    }) => tableService.update(tableId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      setIsDialogOpen(false);
      setEditingTable(null);
      toast({
        title: 'Table updated',
        description: 'The table details have been saved.',
      });
    },
    onError: (mutationError: unknown) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Failed to update table.';
      toast({
        title: 'Unable to update table',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ tableId }: { restaurantId: string; tableId: string }) => tableService.remove(tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      toast({
        title: 'Table deleted',
        description: 'The table has been removed.',
      });
    },
    onError: (mutationError: unknown) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Failed to delete table.';
      toast({
        title: 'Unable to delete table',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const handleZoneSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeRestaurantId) {
      toast({
        title: 'Select a restaurant first',
        description: 'Choose a restaurant to manage its zones.',
        variant: 'destructive',
      });
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
      toast({
        title: 'Zone name required',
        description: 'Provide a short name for the zone.',
        variant: 'destructive',
      });
      return;
    }

    if (editingZone) {
      zoneUpdateMutation.mutate({ zoneId: editingZone.id, name, sortOrder });
      return;
    }

    zoneCreateMutation.mutate({ restaurantId: activeRestaurantId, name, sortOrder });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeRestaurantId) {
      toast({
        title: 'Select a restaurant first',
        description: 'Choose a restaurant to manage its tables.',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const toInteger = (value: FormDataEntryValue | null, fallback: number | null = null) => {
      if (!value) return fallback;
      const parsed = Number.parseInt(String(value), 10);
      return Number.isNaN(parsed) ? fallback : parsed;
    };

    let payload: TableFormState = {
      tableNumber: String(formData.get('tableNumber') ?? '').trim(),
      capacity: toInteger(formData.get('capacity'), 0) ?? 0,
      minPartySize: toInteger(formData.get('minPartySize'), 1) ?? 1,
      maxPartySize: toInteger(formData.get('maxPartySize'), null),
      section: (() => {
        const value = String(formData.get('section') ?? '').trim();
        return value.length > 0 ? value : null;
      })(),
      category: (formData.get('category') as TableFormState['category']) ?? 'dining',
      seatingType: (formData.get('seatingType') as TableFormState['seatingType']) ?? 'standard',
      mobility: (formData.get('mobility') as TableFormState['mobility']) ?? 'movable',
      zoneId: String(formData.get('zoneId') ?? ''),
      status: (formData.get('status') as TableFormState['status']) ?? 'available',
      active: formData.get('active') === 'on' ? true : editingTable?.active ?? true,
      position: null,
      notes: (() => {
        const value = String(formData.get('notes') ?? '').trim();
        return value.length > 0 ? value : null;
      })(),
    };

    if (!payload.tableNumber || payload.capacity < 1) {
      toast({
        title: 'Check the table details',
        description: 'Provide a table number and a valid capacity.',
        variant: 'destructive',
      });
      return;
    }

    const maxPartySize = payload.maxPartySize ?? null;
    payload = { ...payload, maxPartySize };

    if (maxPartySize !== null && maxPartySize < payload.minPartySize) {
      toast({
        title: 'Invalid party size range',
        description: 'Max party size must be greater than or equal to min party size.',
        variant: 'destructive',
      });
      return;
    }

    if (!payload.zoneId) {
      toast({
        title: 'Select a zone',
        description: 'Every table must belong to a zone before you can save it.',
        variant: 'destructive',
      });
      return;
    }

    if (editingTable) {
      updateMutation.mutate({
        restaurantId: activeRestaurantId,
        tableId: editingTable.id,
        payload,
      });
      return;
    }

    createMutation.mutate({
      restaurantId: activeRestaurantId,
      payload,
    });
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

      <section className="rounded-lg border p-4 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Zones</h2>
            <p className="text-sm text-muted-foreground">
              Group tables by areas of your floor plan. Add or rename zones as your layout changes.
            </p>
          </div>
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
        ) : zones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No zones configured yet. Create your first zone to start organizing tables.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {zones.map((zone) => {
              const isActive = filterZone === zone.id;
              return (
                <li key={zone.id}>
                  <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={isActive ? 'default' : 'ghost'}
                      onClick={() => setFilterZone(isActive ? ALL_ZONES_VALUE : zone.id)}
                    >
                      {zone.name}
                    </Button>
                    <span className="text-xs text-muted-foreground">#{zone.sortOrder ?? 0}</span>
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
                        onClick={() => {
                          if (confirm(`Delete zone "${zone.name}"? Tables using this zone will need reassignment.`)) {
                            zoneDeleteMutation.mutate({ zoneId: zone.id });
                          }
                        }}
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
      </section>

      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Label htmlFor="table-zone-filter" className="text-sm">Zone</Label>
          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger id="table-zone-filter" className="w-[220px]">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ZONES_VALUE}>All zones</SelectItem>
              {zoneOptions.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => {
            setEditingTable(null);
            setIsDialogOpen(true);
          }}
          disabled={isZoneSelectDisabled}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add table
        </Button>
      </section>

      <section className="rounded-lg border">
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
                    : 'No tables in this section.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredTables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell className="font-medium">
                    <span>{table.tableNumber}</span>
                  </TableCell>
                  <TableCell>{table.zoneName ?? '—'}</TableCell>
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
                    {table.active ? (
                      <Badge variant="outline">Active</Badge>
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
                          if (!canDeleteTables) {
                            toast({
                              title: 'Admins only',
                              description: 'Only owners or admins can delete tables.',
                              variant: 'destructive',
                            });
                            return;
                          }
                          if (confirm(`Delete table ${table.tableNumber}? This action cannot be undone.`)) {
                            deleteMutation.mutate({ restaurantId: activeRestaurantId, tableId: table.id });
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
      </section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <DialogHeader>
              <DialogTitle>{editingTable ? 'Edit table' : 'Add new table'}</DialogTitle>
              <DialogDescription>Configure seating capacity and availability for this table.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tableNumber">Table number *</Label>
                <Input
                  id="tableNumber"
                  name="tableNumber"
                  defaultValue={editingTable?.tableNumber ?? ''}
                  placeholder="T1, Main-5, Patio-2"
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
                  defaultValue={editingTable?.capacity ?? 4}
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
                    defaultValue={editingTable?.minPartySize ?? 1}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxPartySize">Max party size</Label>
                  <Input
                    id="maxPartySize"
                    name="maxPartySize"
                    type="number"
                    min={1}
                    defaultValue={editingTable?.maxPartySize ?? ''}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  name="section"
                  defaultValue={editingTable?.section ?? ''}
                  placeholder="Main Dining, Patio, Bar"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="zoneId">Zone *</Label>
                  <Select
                    name="zoneId"
                    defaultValue={zoneDefaultValue}
                    disabled={isZoneSelectDisabled}
                  >
                    <SelectTrigger id="zoneId">
                      <SelectValue placeholder="Select a zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {isZoneSelectDisabled ? (
                        <SelectGroup>
                          <SelectLabel className="text-muted-foreground">No zones configured</SelectLabel>
                        </SelectGroup>
                      ) : (
                        zoneOptions.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {isZoneSelectDisabled ? (
                    <p className="text-sm text-muted-foreground">
                      Add a zone to assign tables. Head to Settings → Zones and create one first.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue={editingTable?.category ?? 'dining'}>
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
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="seatingType">Seating</Label>
                  <Select name="seatingType" defaultValue={editingTable?.seatingType ?? 'standard'}>
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
                  <Select name="mobility" defaultValue={editingTable?.mobility ?? 'movable'}>
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
                  <Select name="status" defaultValue={editingTable?.status ?? 'available'}>
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
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="active">Active</Label>
                  <label className="flex items-center gap-3 rounded-md border p-3">
                    <input
                      id="active"
                      name="active"
                      type="checkbox"
                      defaultChecked={editingTable?.active ?? true}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">Toggle off to remove table from allocation roster.</span>
                  </label>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingTable?.notes ?? ''}
                  placeholder="Optional internal notes about this table"
                  rows={3}
                />
              </div>

              {canDeleteTables ? null : (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-yellow-300/80 bg-yellow-50/70 p-3 text-sm text-yellow-900">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Staff can add or edit tables. Only owners or admins can delete tables.
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  isZoneSelectDisabled
                }
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save table'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
