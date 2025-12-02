'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { getBrowserCsrfToken } from '@/lib/security/csrf';
import { cn } from '@/lib/utils';

type ZoneDraft = {
  id: string;
  name: string;
  areaType: 'indoor' | 'outdoor';
  sortOrder: number;
  active: boolean;
};

type TableDraft = {
  id: string;
  tableNumber: string;
  capacity: number;
  minPartySize: number;
  maxPartySize: number | null;
  zoneId: string;
  category: 'dining' | 'bar' | 'lounge' | 'patio' | 'private';
  seatingType: 'standard' | 'sofa' | 'booth' | 'high_top';
  mobility: 'movable' | 'fixed';
  status: 'available' | 'reserved' | 'occupied' | 'out_of_service';
  active: boolean;
};

type Props = {
  restaurantId: string;
};

const DEFAULT_ZONE = (): ZoneDraft => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10),
  name: 'Main Dining',
  areaType: 'indoor',
  sortOrder: 0,
  active: true,
});

const DEFAULT_TABLE = (zoneId: string): TableDraft => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10),
  tableNumber: 'T1',
  capacity: 2,
  minPartySize: 1,
  maxPartySize: null,
  zoneId,
  category: 'dining',
  seatingType: 'standard',
  mobility: 'movable',
  status: 'available',
  active: true,
});

export function TablesClient({ restaurantId }: Props) {
  const router = useRouter();
  const initialZone = useMemo(() => DEFAULT_ZONE(), []);
  const [zones, setZones] = useState<ZoneDraft[]>([initialZone]);
  const [tables, setTables] = useState<TableDraft[]>([DEFAULT_TABLE(initialZone.id)]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const csrf = useMemo(() => getBrowserCsrfToken(), []);

  useEffect(() => {
    let active = true;
    async function loadExisting() {
      setIsLoading(true);
      try {
        const [zonesRes, tablesRes] = await Promise.all([
          fetchJson<{ zones: Array<{ id: string; name: string; area_type: 'indoor' | 'outdoor'; sort_order: number; active: boolean }> }>(
            `/api/onboarding/restaurant/${restaurantId}/zones`,
          ),
          fetchJson<{ tables: Array<{ id: string; table_number: string; capacity: number; min_party_size: number; max_party_size: number | null; category: TableDraft['category']; seating_type: TableDraft['seatingType']; mobility: TableDraft['mobility']; zone_id: string; status: TableDraft['status']; active: boolean | null }> }>(
            `/api/onboarding/restaurant/${restaurantId}/tables`,
          ),
        ]);

        if (!active) return;

        const zoneDrafts = (zonesRes.zones ?? []).map((z, index) => ({
          id: z.id,
          name: z.name ?? `Zone ${index + 1}`,
          areaType: (z.area_type ?? 'indoor') as ZoneDraft['areaType'],
          sortOrder: z.sort_order ?? index,
          active: z.active ?? true,
        }));
        setZones(zoneDrafts.length > 0 ? zoneDrafts : [DEFAULT_ZONE()]);

        const tableDrafts = (tablesRes.tables ?? []).map((t) => ({
          id: t.id,
          tableNumber: t.table_number ?? 'T',
          capacity: t.capacity ?? 2,
          minPartySize: t.min_party_size ?? 1,
          maxPartySize: t.max_party_size ?? null,
          zoneId: t.zone_id,
          category: t.category,
          seatingType: t.seating_type,
          mobility: t.mobility,
          status: t.status,
          active: t.active ?? true,
        }));
        setTables(tableDrafts.length > 0 ? tableDrafts : [DEFAULT_TABLE(zoneDrafts[0]?.id ?? DEFAULT_ZONE().id)]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof HttpError ? err.message : 'Failed to load zones/tables');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadExisting();
    return () => {
      active = false;
    };
  }, [restaurantId]);

  const addZone = () => {
    const zone = DEFAULT_ZONE();
    setZones((current) => [...current, { ...zone, name: `Zone ${current.length + 1}` }]);
  };

  const addTable = () => {
    const zoneId = zones[0]?.id;
    if (!zoneId) return;
    const suffix = tables.length + 1;
    setTables((current) => [
      ...current,
      {
        ...DEFAULT_TABLE(zoneId),
        tableNumber: `T${suffix}`,
      },
    ]);
  };

  const updateZone = (id: string, patch: Partial<ZoneDraft>) => {
    setZones((current) => current.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)));
  };

  const removeZone = (id: string) => {
    setZones((current) => current.filter((zone) => zone.id !== id));
    setTables((current) => current.filter((table) => table.zoneId !== id));
  };

  const updateTable = (id: string, patch: Partial<TableDraft>) => {
    setTables((current) => current.map((table) => (table.id === id ? { ...table, ...patch } : table)));
  };

  const removeTable = (id: string) => {
    setTables((current) => current.filter((table) => table.id !== id));
  };

  const handleSave = async () => {
    if (zones.length === 0 || tables.length === 0) {
      setError('Add at least one zone and one table.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await fetchJson(`/api/onboarding/restaurant/${restaurantId}/zones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify({ zones }),
      });

      await fetchJson(`/api/onboarding/restaurant/${restaurantId}/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify({
          tables: tables.map((table) => ({
            id: table.id,
            tableNumber: table.tableNumber,
            capacity: table.capacity,
            minPartySize: table.minPartySize,
            maxPartySize: table.maxPartySize,
            section: null,
            category: table.category,
            seatingType: table.seatingType,
            mobility: table.mobility,
            zoneId: table.zoneId,
            status: table.status,
            active: table.active,
          })),
        }),
      });

      router.push(`/onboarding/review?rid=${restaurantId}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Failed to save zones and tables');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save tables</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/70 bg-card/90 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Zones</h2>
            <p className="text-sm text-muted-foreground">Group tables by area to keep capacity organized.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addZone}>
            Add zone
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {zones.map((zone, index) => (
            <div key={zone.id} className="space-y-2 rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Zone {index + 1}</Label>
                {zones.length > 1 ? (
                  <Button variant="ghost" size="sm" onClick={() => removeZone(zone.id)}>
                    Remove
                  </Button>
                ) : null}
              </div>
              <Input
                value={zone.name}
                onChange={(event) => updateZone(zone.id, { name: event.target.value })}
                placeholder="e.g., Main Dining"
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Area type</Label>
                <Select
                  value={zone.areaType}
                  onValueChange={(value) => updateZone(zone.id, { areaType: value as ZoneDraft['areaType'] })}
                >
                  <SelectTrigger className="h-9 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-border/70 bg-card/90 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tables</h2>
            <p className="text-sm text-muted-foreground">Add table numbers, capacities, and assign to zones.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addTable}>
            Add table
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell>
                    <Input
                      value={table.tableNumber}
                      onChange={(event) => updateTable(table.id, { tableNumber: event.target.value })}
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={table.capacity}
                        onChange={(event) => updateTable(table.id, { capacity: Number(event.target.value) || 1 })}
                        className="w-20"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={table.minPartySize}
                        onChange={(event) =>
                          updateTable(table.id, { minPartySize: Number(event.target.value) || 1 })
                        }
                        className="w-16"
                        aria-label="Min party size"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={table.maxPartySize ?? ''}
                        onChange={(event) =>
                          updateTable(table.id, {
                            maxPartySize: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                        className="w-16"
                        aria-label="Max party size"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={table.zoneId}
                      onValueChange={(value) => updateTable(table.id, { zoneId: value })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={table.category}
                      onValueChange={(value) => updateTable(table.id, { category: value as TableDraft['category'] })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dining">Dining</SelectItem>
                        <SelectItem value="bar">Bar</SelectItem>
                        <SelectItem value="lounge">Lounge</SelectItem>
                        <SelectItem value="patio">Patio</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={table.status}
                      onValueChange={(value) => updateTable(table.id, { status: value as TableDraft['status'] })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                        <SelectItem value="occupied">Occupied</SelectItem>
                        <SelectItem value="out_of_service">Out of service</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {tables.length > 1 ? (
                      <Button variant="ghost" size="sm" onClick={() => removeTable(table.id)}>
                        Remove
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || isLoading} className={cn((isSaving || isLoading) && 'opacity-70')}>
          {isSaving ? 'Saving…' : isLoading ? 'Loading…' : 'Save & continue'}
        </Button>
      </div>
    </div>
  );
}
