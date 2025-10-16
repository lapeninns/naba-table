/**
 * Table Inventory Client Component
 * Story 4: Ops Dashboard - Tables Management
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit, Loader2, Plus, Trash2 } from 'lucide-react';

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
import { useTableInventoryService } from '@/contexts/ops-services';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { queryKeys } from '@/lib/query/keys';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import type {
  CreateTablePayload,
  TableInventory,
  UpdateTablePayload,
} from '@/services/ops/tables';
import { useToast } from '@/hooks/use-toast';

const UNASSIGNED_SECTION_VALUE = '__unassigned__';

type TableFormState = CreateTablePayload;

export default function TableInventoryClient() {
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const tableService = useTableInventoryService();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableInventory | null>(null);
  const [filterSection, setFilterSection] = useState<string>('all');

  const canDeleteTables = Boolean(activeMembership && isRestaurantAdminRole(activeMembership.role));

  useEffect(() => {
    setFilterSection('all');
    setEditingTable(null);
    setIsDialogOpen(false);
  }, [activeRestaurantId]);

  const tablesQueryKey = activeRestaurantId
    ? queryKeys.opsTables.list(activeRestaurantId)
    : ['ops', 'tables', 'no-restaurant'] as const;

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

  const sectionOptions = useMemo(() => {
    const options = new Set<string>();
    (summary?.sections ?? []).forEach((section) => {
      if (section) {
        options.add(section);
      }
    });
    if (tables.some((table) => !table.section)) {
      options.add(UNASSIGNED_SECTION_VALUE);
    }
    return Array.from(options);
  }, [summary?.sections, tables]);

  const filteredTables = useMemo(() => {
    if (filterSection === 'all') {
      return tables;
    }
    if (filterSection === UNASSIGNED_SECTION_VALUE) {
      return tables.filter((table) => !table.section);
    }
    return tables.filter((table) => table.section === filterSection);
  }, [filterSection, tables]);

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
        setFilterSection('all');
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

    const payload: TableFormState = {
      tableNumber: String(formData.get('tableNumber') ?? '').trim(),
      capacity: toInteger(formData.get('capacity'), 0) ?? 0,
      minPartySize: toInteger(formData.get('minPartySize'), 1) ?? 1,
      maxPartySize: toInteger(formData.get('maxPartySize'), null),
      section: (() => {
        const value = String(formData.get('section') ?? '').trim();
        return value.length > 0 ? value : null;
      })(),
      seatingType: (formData.get('seatingType') as TableFormState['seatingType']) ?? 'indoor',
      status: (formData.get('status') as TableFormState['status']) ?? 'available',
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

    if (payload.maxPartySize !== null && payload.maxPartySize < payload.minPartySize) {
      toast({
        title: 'Invalid party size range',
        description: 'Max party size must be greater than or equal to min party size.',
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
          <Label htmlFor="table-section-filter" className="text-sm">Section</Label>
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger id="table-section-filter" className="w-[200px]">
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {sectionOptions.map((section) => (
                <SelectItem key={section} value={section}>
                  {section === UNASSIGNED_SECTION_VALUE ? 'Unassigned' : section}
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
              <TableHead>Table #</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Party size</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
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
                  <TableCell className="font-medium">{table.tableNumber}</TableCell>
                  <TableCell>{table.capacity} seats</TableCell>
                  <TableCell>
                    {table.minPartySize}
                    {table.maxPartySize ? `–${table.maxPartySize}` : '+'}
                  </TableCell>
                  <TableCell>{table.section ?? 'Unassigned'}</TableCell>
                  <TableCell className="capitalize">{table.seatingType.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <Badge variant={table.status === 'available' ? 'default' : 'secondary'}>
                      {table.status.replace('_', ' ')}
                    </Badge>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="seatingType">Seating type</Label>
                  <Select
                    name="seatingType"
                    defaultValue={editingTable?.seatingType ?? 'indoor'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose seating type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indoor">Indoor</SelectItem>
                      <SelectItem value="outdoor">Outdoor</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="patio">Patio</SelectItem>
                      <SelectItem value="private_room">Private room</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={editingTable?.status ?? 'available'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Set status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="out_of_service">Out of service</SelectItem>
                    </SelectContent>
                  </Select>
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
