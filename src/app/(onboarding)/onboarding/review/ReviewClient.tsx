'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { getBrowserCsrfToken } from '@/lib/security/csrf';
import { cn } from '@/lib/utils';

type ReviewClientProps = {
  restaurantId: string;
  restaurant: Record<string, unknown> | null;
  hours: Array<{ day_of_week: number | null; opens_at: string | null; closes_at: string | null; is_closed: boolean | null }>;
  periods: Array<{ name: string | null; day_of_week: number | null; start_time: string | null; end_time: string | null; booking_option: string | null }>;
  zones: Array<{ id: string; name: string | null; area_type: string | null; active: boolean | null }>;
  tables: Array<{
    id: string;
    table_number: string | null;
    capacity: number | null;
    min_party_size: number | null;
    max_party_size: number | null;
    category: string | null;
    seating_type: string | null;
    mobility: string | null;
    zone_id: string | null;
    status: string | null;
    active: boolean | null;
  }>;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ReviewClient({ restaurantId, restaurant, hours, periods, zones, tables }: ReviewClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const csrf = useMemo(() => getBrowserCsrfToken(), []);

  const summary = useMemo(() => {
    const openDays = hours.filter((h) => !h.is_closed).length;
    return {
      hoursSummary: `${openDays}/7 days configured`,
      periodsSummary: `${periods.length} service periods`,
      zonesSummary: `${zones.length} zone${zones.length === 1 ? '' : 's'}`,
      tablesSummary: `${tables.length} table${tables.length === 1 ? '' : 's'}`,
    };
  }, [hours, periods, zones, tables]);

  const handleLaunch = async () => {
    setSaving(true);
    setError(null);
    try {
      await fetchJson(`/api/onboarding/restaurant/${restaurantId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
      });
      router.push('/app/dashboard');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Unable to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not complete onboarding</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{(restaurant?.name as string) ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-xs">{(restaurant?.slug as string) ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timezone</span>
              <span className="font-medium">{(restaurant?.timezone as string) ?? '—'}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline">{summary.hoursSummary}</Badge>
              <Badge variant="outline">{summary.periodsSummary}</Badge>
              <Badge variant="outline">{summary.zonesSummary}</Badge>
              <Badge variant="outline">{summary.tablesSummary}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>Operating hours</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push(`/onboarding/hours?rid=${restaurantId}`)}>
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {hours.length === 0 ? (
              <p className="text-muted-foreground">No hours configured.</p>
            ) : (
              hours.map((row) => (
                <div key={row.day_of_week ?? Math.random()} className="flex items-center justify-between">
                  <span>{DAYS[row.day_of_week ?? 0]}</span>
                  {row.is_closed ? (
                    <Badge variant="secondary">Closed</Badge>
                  ) : (
                    <span className="font-mono text-xs">
                      {row.opens_at ?? '—'} – {row.closes_at ?? '—'}
                    </span>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/90">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Service periods</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => router.push(`/onboarding/services?rid=${restaurantId}`)}>
            Edit
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {periods.length === 0 ? (
            <p className="text-muted-foreground">No service periods configured.</p>
          ) : (
            periods.map((period, index) => (
              <div key={`${period.name}-${index}`} className="rounded-lg border border-border/60 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{period.name ?? 'Service'}</p>
                  <Badge variant="outline">{(period.booking_option ?? '').toString().toUpperCase()}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {period.day_of_week === null ? 'All days' : DAYS[period.day_of_week ?? 0]} · {period.start_time} – {period.end_time}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Zones & tables</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => router.push(`/onboarding/tables?rid=${restaurantId}`)}>
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => (
              <Badge key={zone.id} variant="outline" className={cn(!zone.active && 'opacity-70')}>
                {zone.name ?? 'Zone'} · {zone.area_type ?? 'indoor'}
              </Badge>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Table</th>
                  <th className="px-3 py-2">Cap</th>
                  <th className="px-3 py-2">Zone</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {tables.map((table) => {
                  const zoneName = zones.find((z) => z.id === table.zone_id)?.name ?? '—';
                  return (
                    <tr key={table.id}>
                      <td className="px-3 py-2 font-medium">{table.table_number}</td>
                      <td className="px-3 py-2">{table.capacity}</td>
                      <td className="px-3 py-2">{zoneName}</td>
                      <td className="px-3 py-2">{table.category}</td>
                      <td className="px-3 py-2">{table.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
          <span>Everything looks good. Launch to activate your restaurant.</span>
        </div>
        <Button onClick={handleLaunch} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Launch restaurant
        </Button>
      </div>
    </div>
  );
}
