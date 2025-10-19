/**
 * Table Inventory Client Component
 * Story 4: Ops Dashboard - Tables Management
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit, Link2, Loader2, Plus, Trash2 } from 'lucide-react';

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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useTableInventoryService } from '@/contexts/ops-services';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { queryKeys } from '@/lib/query/keys';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import type {
  CreateTablePayload,
  TableInventory,
  UpdateTablePayload,
} from '@/services/ops/tables';
import { getAllowedCapacities } from '@/services/ops/allowedCapacities';
import { useToast } from '@/hooks/use-toast';

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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableInventory | null>(null);
  const [filterZone, setFilterZone] = useState<string>(ALL_ZONES_VALUE);
  const [isAdjacencyDialogOpen, setIsAdjacencyDialogOpen] = useState(false);
  const [adjacencyTarget, setAdjacencyTarget] = useState<TableInventory | null>(null);
  const [adjacencySelection, setAdjacencySelection] = useState<Set<string>>(new Set());

  const canDeleteTables = Boolean(activeMembership && isRestaurantAdminRole(activeMembership.role));

  useEffect(() => {
    setFilterZone(ALL_ZONES_VALUE);
    setEditingTable(null);
    setIsDialogOpen(false);
    setAdjacencyTarget(null);
    setIsAdjacencyDialogOpen(false);
    setAdjacencySelection(new Set());
  }, [activeRestaurantId]);

  const tablesQueryKey = activeRestaurantId
    ? queryKeys.opsTables.list(activeRestaurantId)
    : ['ops', 'tables', 'no-restaurant'] as const;

  const allowedCapacitiesQueryKey = activeRestaurantId
    ? queryKeys.opsCapacity.allowedCapacities(activeRestaurantId)
    : ['ops', 'capacity', 'no-restaurant', 'allowed'] as const;

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
    data: allowedCapacitiesResult,
    isLoading: isLoadingAllowedCapacities,
    isError: isAllowedCapacitiesError,
  } = useQuery({
    queryKey: allowedCapacitiesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required to load capacities');
      }
      return getAllowedCapacities(activeRestaurantId);
    },
    enabled: Boolean(activeRestaurantId),
    staleTime: 60_000,
  });

  const allowedCapacities = allowedCapacitiesResult?.capacities ?? [];

  const zoneOptions = useMemo(() => {
    if (summary?.zones && summary.zones.length > 0) {
      return summary.zones;
    }
    const zones = new Map<string, string>();
    tables.forEach((table) => {
      if (!zones.has(table.zoneId)) {
        zones.set(table.zoneId, table.zoneName ?? 'Zone');
      }
    });
    return Array.from(zones.entries()).map(([id, name]) => ({ id, name }));
  }, [summary?.zones, tables]);

  const filteredTables = useMemo(() => {
    if (filterZone === ALL_ZONES_VALUE) {
      return tables;
    }
    return tables.filter((table) => table.zoneId === filterZone);
  }, [filterZone, tables]);

  const adjacencyCandidates = useMemo(() => {
    if (!adjacencyTarget) {
      return [] as TableInventory[];
    }
    return tables.filter((table) => table.id !== adjacencyTarget.id && table.zoneId === adjacencyTarget.zoneId);
  }, [adjacencyTarget, tables]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdjacency() {
      if (!isAdjacencyDialogOpen || !adjacencyTarget) {
        return;
      }

      try {
        const ids = await tableService.getAdjacency(adjacencyTarget.id);
        if (!cancelled) {
          setAdjacencySelection(new Set(ids));
        }
      } catch (adjacencyError) {
        if (!cancelled) {
          const message = adjacencyError instanceof Error ? adjacencyError.message : 'Unable to load adjacency.';
          toast({ title: 'Adjacency unavailable', description: message, variant: 'destructive' });
        }
      }
    }

    void loadAdjacency();

    return () => {
      cancelled = true;
    };
  }, [isAdjacencyDialogOpen, adjacencyTarget, tableService, toast]);

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

  const adjacencyMutation = useMutation({
    mutationFn: ({ tableId, adjacentIds }: { tableId: string; adjacentIds: string[] }) =>
      tableService.updateAdjacency(tableId, adjacentIds),
    onSuccess: (updatedIds, variables) => {
      setAdjacencySelection(new Set(updatedIds));
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      toast({
        title: 'Adjacency updated',
        description: 'Table adjacency has been saved.',
      });
      if (adjacencyTarget && adjacencyTarget.id === variables.tableId) {
        setAdjacencyTarget({ ...adjacencyTarget });
      }
      setIsAdjacencyDialogOpen(false);
    },
    onError: (mutationError: unknown) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Failed to update adjacency.';
      toast({
        title: 'Unable to update adjacency',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const toggleAdjacencySelection = (tableId: string) => {
    setAdjacencySelection((current) => {
      const next = new Set(current);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const handleAdjacencySave = () => {
    if (!adjacencyTarget) {
      return;
    }
    adjacencyMutation.mutate({
      tableId: adjacencyTarget.id,
      adjacentIds: Array.from(adjacencySelection),
    });
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

    if (isLoadingAllowedCapacities) {
      toast({
        title: 'Please wait',
        description: 'Allowed capacities are still loading. Try again in a moment.',
        variant: 'destructive',
      });
      return;
    }

    if (isAllowedCapacitiesError) {
      toast({
        title: 'Allowed capacities unavailable',
        description: 'Unable to verify permitted capacities. Refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    if (!payload.tableNumber || payload.capacity < 1) {
      toast({
        title: 'Check the table details',
        description: 'Provide a table number and a valid capacity.',
        variant: 'destructive',
      });
      return;
    }

    if (allowedCapacities.length === 0) {
      toast({
        title: 'Configure allowed capacities first',
        description: 'Add at least one permitted table size in capacity settings before creating tables.',
        variant: 'destructive',
      });
      return;
    }

    if (!allowedCapacities.includes(payload.capacity)) {
      toast({
        title: 'Unsupported capacity',
        description: `Capacity must match one of the configured values: ${allowedCapacities.join(', ')}.`,
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
        description: 'Every table must belong to a zone to enable adjacency and merges.',
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
      <section className="grid gap-4 md:grid-cols-3">
        {summary ? (
          <>
            <SummaryCard label="Total tables" value={summary.totalTables} />
            <SummaryCard label="Total capacity" value={`${summary.totalCapacity} seats`} />
            <SummaryCard label="Available now" value={`${summary.availableTables} tables`} />
          </>
        ) : (
          <>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </>
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
              <TableHead>Merge</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || isFetching ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading tables…</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredTables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {tables.length === 0
                    ? 'No tables configured yet. Add your first table to get started.'
                    : 'No tables in this section.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredTables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{table.tableNumber}</span>
                      {table.mergeEligible ? (
                        <Badge variant="secondary" className="text-xs uppercase tracking-wide">
                          Merge ready
                        </Badge>
                      ) : null}
                    </div>
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
                    {table.mergeEligible ? (
                      <Badge variant="outline">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
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
                          setAdjacencyTarget(table);
                          setAdjacencySelection(new Set());
                          setIsAdjacencyDialogOpen(true);
                        }}
                      >
                        <Link2 className="h-4 w-4" />
                        <span className="sr-only">Manage adjacency</span>
                      </Button>
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
                    defaultValue={editingTable?.zoneId ?? (zoneOptions[0]?.id ?? '')}
                  >
                    <SelectTrigger id="zoneId">
                      <SelectValue placeholder="Select a zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zoneOptions.length === 0 ? (
                        <SelectItem value="">No zones configured</SelectItem>
                      ) : (
                        zoneOptions.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
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
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save table'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAdjacencyDialogOpen}
        onOpenChange={(open) => {
          setIsAdjacencyDialogOpen(open);
          if (!open) {
            setAdjacencyTarget(null);
            setAdjacencySelection(new Set());
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set adjacency</DialogTitle>
            <DialogDescription>
              {adjacencyTarget
                ? `Select tables that are physically adjacent to ${adjacencyTarget.tableNumber}.`
                : 'Select tables that can merge or share walkways.'}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
            {adjacencyTarget ? (
              adjacencyCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  There are no other tables in the {adjacencyTarget.zoneName ?? 'selected'} zone yet.
                </p>
              ) : (
                adjacencyCandidates.map((candidate) => (
                  <label
                    key={candidate.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={adjacencySelection.has(candidate.id)}
                        onCheckedChange={() => toggleAdjacencySelection(candidate.id)}
                      />
                      <div>
                        <p className="font-medium">{candidate.tableNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {candidate.capacity}-seat · {candidate.category} · {candidate.seatingType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    {candidate.mergeEligible ? (
                      <Badge variant="outline">Merge ready</Badge>
                    ) : null}
                  </label>
                ))
              )
            ) : (
              <p className="text-sm text-muted-foreground">Choose a table to manage adjacency.</p>
            )}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAdjacencyDialogOpen(false);
                setAdjacencyTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdjacencySave}
              disabled={adjacencyMutation.isPending || !adjacencyTarget}
            >
              {adjacencyMutation.isPending ? 'Saving…' : 'Save adjacency'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
