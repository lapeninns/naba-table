'use client';

import { AlertTriangle, BarChart3, RefreshCw, Settings2, FlaskConical, TrendingDown } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOpsSession } from '@/contexts/ops-session';
import {
  useOpsRejectionAnalytics,
  useOpsStrategicSettings,
  useUpdateOpsStrategicSettings,
} from '@/hooks';
import { useToast } from '@/hooks/use-toast';
import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';
import { cn } from '@/lib/utils';

import type { OpsStrategicPenaltyKey, OpsStrategicSettings } from '@/types/ops';

type RangePresetKey = '24h' | '7d';

type RangeState = {
  key: RangePresetKey;
  from: string;
  bucket: 'hour' | 'day';
};

const RANGE_PRESETS: Array<{ key: RangePresetKey; label: string; durationMs: number; bucket: 'hour' | 'day' }> = [
  { key: '24h', label: 'Last 24 hours', durationMs: 24 * 60 * 60 * 1000, bucket: 'hour' },
  { key: '7d', label: 'Last 7 days', durationMs: 7 * 24 * 60 * 60 * 1000, bucket: 'day' },
];

const PENALTY_LABELS: Record<OpsStrategicPenaltyKey, string> = {
  slack: 'Slack',
  scarcity: 'Scarcity',
  future_conflict: 'Future conflict',
  structural: 'Structural',
  unknown: 'Unknown',
};

const PENALTY_BADGE_VARIANTS: Record<OpsStrategicPenaltyKey, string> = {
  slack: 'bg-blue-100 text-blue-900',
  scarcity: 'bg-amber-100 text-amber-900',
  future_conflict: 'bg-rose-100 text-rose-900',
  structural: 'bg-purple-100 text-purple-900',
  unknown: 'bg-slate-100 text-slate-900',
};

function computeRangeState(key: RangePresetKey): RangeState {
  const preset = RANGE_PRESETS.find((candidate) => candidate.key === key) ?? RANGE_PRESETS[0];
  const from = new Date(Date.now() - preset.durationMs).toISOString();
  return {
    key: preset.key,
    from,
    bucket: preset.bucket,
  };
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatPenaltyValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  return value.toFixed(2);
}

type StrategicSettingsDialogProps = {
  restaurantName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: OpsStrategicSettings | undefined;
  onSubmit: (weights: OpsStrategicSettings['weights']) => Promise<void>;
  isSubmitting: boolean;
};

function StrategicSettingsDialog({ restaurantName, open, onOpenChange, settings, onSubmit, isSubmitting }: StrategicSettingsDialogProps) {
  const [scarcity, setScarcity] = useState<string>('');
  const [demandMultiplier, setDemandMultiplier] = useState<string>('');
  const [futurePenalty, setFuturePenalty] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        const baseline = settings?.weights ?? { scarcity: 22, demandMultiplier: null, futureConflictPenalty: null };
        setScarcity(baseline.scarcity.toString());
        setDemandMultiplier(baseline.demandMultiplier === null ? '' : baseline.demandMultiplier.toString());
        setFuturePenalty(baseline.futureConflictPenalty === null ? '' : baseline.futureConflictPenalty.toString());
        setError(null);
      }
      onOpenChange(nextOpen);
    },
    [settings?.weights, onOpenChange],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const scarcityValue = Number.parseFloat(scarcity);
      if (!Number.isFinite(scarcityValue) || scarcityValue < 0 || scarcityValue > 1000) {
        setError('Scarcity weight must be between 0 and 1000.');
        return;
      }

      const demandValue = demandMultiplier.trim().length === 0 ? null : Number.parseFloat(demandMultiplier);
      if (demandValue !== null && (!Number.isFinite(demandValue) || demandValue < 0 || demandValue > 10)) {
        setError('Demand multiplier override must be between 0 and 10.');
        return;
      }

      const futureValue = futurePenalty.trim().length === 0 ? null : Number.parseFloat(futurePenalty);
      if (futureValue !== null && (!Number.isFinite(futureValue) || futureValue < 0 || futureValue > 100000)) {
        setError('Future conflict penalty must be between 0 and 100000.');
        return;
      }

      setError(null);
      await onSubmit({
        scarcity: scarcityValue,
        demandMultiplier: demandValue,
        futureConflictPenalty: futureValue,
      });
      onOpenChange(false);
    },
    [scarcity, demandMultiplier, futurePenalty, onSubmit, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust strategic weights</DialogTitle>
          <DialogDescription>
            Tune the selector weights for {restaurantName ?? 'this restaurant'}. Changes apply immediately once saved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scarcity-weight">Scarcity weight</Label>
            <Input
              id="scarcity-weight"
              type="number"
              min={0}
              max={1000}
              step="1"
              value={scarcity}
              onChange={(event) => setScarcity(event.target.value)}
              required
              inputMode="decimal"
            />
            <p className="text-xs text-muted-foreground">Higher scarcity increases preference for freeing rare tables.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="demand-multiplier">Demand multiplier override</Label>
            <Input
              id="demand-multiplier"
              type="number"
              min={0}
              max={10}
              step="0.05"
              value={demandMultiplier}
              onChange={(event) => setDemandMultiplier(event.target.value)}
              inputMode="decimal"
              placeholder="Use fallback profile"
            />
            <p className="text-xs text-muted-foreground">Leave blank to use demand profile rules for this restaurant.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="future-penalty">Future conflict penalty</Label>
            <Input
              id="future-penalty"
              type="number"
              min={0}
              max={100000}
              step="1"
              value={futurePenalty}
              onChange={(event) => setFuturePenalty(event.target.value)}
              inputMode="decimal"
              placeholder="Default"
            />
            <p className="text-xs text-muted-foreground">Penalty applied when a placement creates conflicts with future bookings.</p>
          </div>

          {error ? (
            <Alert variant="destructive" className="border-border/60">
              <AlertTitle>Unable to save settings</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type SimulationStatus = 'idle' | 'running';

export function OpsRejectionDashboard() {
  const { toast } = useToast();
  const { activeMembership } = useOpsSession();
  const restaurantId = activeMembership?.restaurantId ?? null;
  const restaurantName = activeMembership?.restaurantName ?? 'Restaurant';

  const [range, setRange] = useState<RangeState>(() => computeRangeState('24h'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>('idle');

  const analyticsQuery = useOpsRejectionAnalytics({
    restaurantId,
    from: range.from,
    bucket: range.bucket,
  });

  const settingsQuery = useOpsStrategicSettings({ restaurantId, enabled: Boolean(restaurantId) });
  const updateSettings = useUpdateOpsStrategicSettings();

  const activePreset = useMemo(() => RANGE_PRESETS.find((preset) => preset.key === range.key) ?? RANGE_PRESETS[0], [range.key]);

  const handleChangeRange = useCallback(
    (nextKey: RangePresetKey) => {
      setRange(computeRangeState(nextKey));
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    setRange((prev) => computeRangeState(prev.key));
    analyticsQuery.refetch();
  }, [analyticsQuery]);

  const handleSaveSettings = useCallback(
    async (weights: OpsStrategicSettings['weights']) => {
      if (!restaurantId) return;
      await updateSettings.mutateAsync({ restaurantId, weights });
      settingsQuery.refetch();
      toast({
        title: 'Strategic weights updated',
        description: 'New configuration applied to the next table selection run.',
      });
    },
    [restaurantId, updateSettings, settingsQuery, toast],
  );

  const handleRunSimulation = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setSimulationStatus('running');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const csrfToken = getBrowserCsrfToken();
      if (csrfToken) {
        headers[CSRF_HEADER_NAME] = csrfToken;
      }

      const response = await fetch('/api/strategies/simulate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          restaurantId,
          strategies: [
            {
              key: 'aggressive',
              label: 'Strategy A — Aggressive',
              weights: {
                scarcity: 40,
                demandMultiplier: 1.5,
                futureConflictPenalty: 800,
              },
            },
            {
              key: 'balanced',
              label: 'Strategy B — Balanced',
              weights: {
                scarcity: 22,
                demandMultiplier: 1.1,
                futureConflictPenalty: 450,
              },
            },
          ],
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        toast({
          title: 'Unable to queue simulation',
          description: payload?.error ?? 'An unexpected error occurred.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Simulation queued',
        description: 'A placeholder job was accepted. Results will appear once the pipeline is available.',
      });
    } catch (error) {
      console.error('[ops/rejections] failed to queue simulation', error);
      toast({
        title: 'Simulation failed',
        description: 'We could not queue the simulation. Try again later.',
        variant: 'destructive',
      });
    } finally {
      setSimulationStatus('idle');
    }
  }, [restaurantId, toast]);

  if (!restaurantId) {
    return (
      <Alert className="border-border/60">
        <AlertTitle>Select a restaurant</AlertTitle>
        <AlertDescription>Choose a restaurant to view rejection analytics and strategic settings.</AlertDescription>
      </Alert>
    );
  }

  const analytics = analyticsQuery.data ?? null;
  const loading = analyticsQuery.isPending;
  const error = analyticsQuery.error as Error | null;
  const hasData = Boolean(analytics && analytics.summary.total > 0);

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <BarChart3 className="size-5" aria-hidden />
              Rejection analytics
            </CardTitle>
            <CardDescription>
              Understand why bookings were unassigned. Data shown for {restaurantName} ({activePreset.label}).
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={range.key} onValueChange={(value) => handleChangeRange(value as RangePresetKey)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {RANGE_PRESETS.map((preset) => (
                  <SelectItem key={preset.key} value={preset.key}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={analyticsQuery.isRefetching}>
              <RefreshCw className={cn('mr-2 size-4', analyticsQuery.isRefetching && 'animate-spin')} aria-hidden />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive" className="border-border/60">
              <AlertTitle>Unable to load analytics</AlertTitle>
              <AlertDescription>{error.message ?? 'An unexpected error occurred.'}</AlertDescription>
            </Alert>
          ) : hasData && analytics ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Total skipped" value={formatCount(analytics.summary.total)} description="Unassigned bookings" />
              <SummaryCard
                label="Hard rejections"
                value={`${formatCount(analytics.summary.hard.count)} · ${formatPercent(analytics.summary.hard.percent)}`}
                description="Operational blockers"
              />
              <SummaryCard
                label="Strategic rejections"
                value={`${formatCount(analytics.summary.strategic.count)} · ${formatPercent(analytics.summary.strategic.percent)}`}
                description="Scoring/prioritisation"
              />
            </div>
          ) : (
            <Alert className="border-border/60 bg-muted/20">
              <AlertTriangle className="size-4" aria-hidden />
              <AlertTitle>No rejection data available</AlertTitle>
              <AlertDescription>Selector did not reject any bookings for the selected range.</AlertDescription>
            </Alert>
          )}

          {hasData && analytics ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-border/60 lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Trend by {analytics.range.bucket}</CardTitle>
                  <CardDescription>Volume of skipped bookings over the selected window.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analytics.series.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data to plot for this period.</p>
                  ) : (
                    <ul className="space-y-2">
                      {analytics.series.slice(-12).map((point) => {
                        const total = point.hard + point.strategic;
                        const hardPercent = total > 0 ? (point.hard / total) * 100 : 0;
                        const strategicPercent = total > 0 ? (point.strategic / total) * 100 : 0;
                        return (
                          <li key={point.bucket} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatDateTime(point.bucket)}</span>
                              <span>{formatCount(total)} skipped</span>
                            </div>
                            <div className="flex h-2 overflow-hidden rounded-full border border-border/60">
                              <div
                                className="bg-muted/40"
                                style={{ width: `${Math.max(0, Math.min(100, hardPercent))}%` }}
                                aria-hidden
                              />
                              <div
                                className="bg-foreground/70"
                                style={{ width: `${Math.max(0, Math.min(100, strategicPercent))}%` }}
                                aria-hidden
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Top hard rejection reasons</CardTitle>
                  <CardDescription>Operational blockers that prevented immediate seating.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.summary.hard.topReasons.length > 0 ? (
                    <ul className="space-y-2">
                      {analytics.summary.hard.topReasons.map((reason) => (
                        <li key={reason.label} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm">
                          <span className="font-medium text-foreground">{reason.label}</span>
                          <span className="text-muted-foreground">{formatCount(reason.count)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No hard rejection reasons recorded.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Dominant strategic penalties</CardTitle>
                  <CardDescription>Which penalty contributed most when scoring rejected plans.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.summary.strategic.topPenalties.length > 0 ? (
                    <ul className="space-y-2">
                      {analytics.summary.strategic.topPenalties.map((penalty) => (
                        <li key={penalty.penalty} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge className={cn('capitalize', PENALTY_BADGE_VARIANTS[penalty.penalty])}>{PENALTY_LABELS[penalty.penalty]}</Badge>
                          </div>
                          <span className="text-muted-foreground">{formatCount(penalty.count)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No strategic penalties recorded.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {hasData && analytics ? (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <TrendingDown className="size-4" aria-hidden />
                  Recent strategic rejection samples
                </CardTitle>
                <CardDescription>Inspect planner telemetry for the most recent strategic skips.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-hidden rounded-xl border border-border/60">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Penalty</TableHead>
                      <TableHead className="hidden lg:table-cell">Skip reason</TableHead>
                      <TableHead className="text-right">Penalties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.strategicSamples.map((sample) => (
                      <TableRow key={`${sample.bookingId ?? 'unknown'}-${sample.createdAt}`}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDateTime(sample.createdAt)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{sample.bookingId ?? '—'}</TableCell>
                        <TableCell>
                          <Badge className={cn('capitalize', PENALTY_BADGE_VARIANTS[sample.dominantPenalty])}>
                            {PENALTY_LABELS[sample.dominantPenalty]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {sample.skipReason ?? 'Unspecified'}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          slack {formatPenaltyValue(sample.penalties.slack)} · scarcity {formatPenaltyValue(sample.penalties.scarcity)} · future {formatPenaltyValue(sample.penalties.futureConflict)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </CardContent>

        {analytics?.range ? (
          <CardFooter className="flex flex-col gap-1 border-t border-border/60 bg-muted/20 px-6 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Window: {formatDateTime(analytics.range.from)} → {formatDateTime(analytics.range.to)} (bucket: {analytics.range.bucket})
            </span>
            {analyticsQuery.isRefetching ? <span>Refreshing data…</span> : null}
          </CardFooter>
        ) : null}
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Settings2 className="size-5" aria-hidden />
              Strategic configuration
            </CardTitle>
            <CardDescription>
              Current weights for {restaurantName}. Adjust to balance occupancy and revenue outcomes.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(true)} disabled={settingsQuery.isLoading}>
              <Settings2 className="mr-2 size-4" aria-hidden />
              Edit weights
            </Button>
            <Button onClick={handleRunSimulation} disabled={simulationStatus === 'running'}>
              <FlaskConical className={cn('mr-2 size-4', simulationStatus === 'running' && 'animate-spin')} aria-hidden />
              {simulationStatus === 'running' ? 'Queuing…' : 'Run simulation'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : settingsQuery.error ? (
            <Alert variant="destructive" className="border-border/60">
              <AlertTitle>Unable to load settings</AlertTitle>
              <AlertDescription>{(settingsQuery.error as Error).message ?? 'Unknown error.'}</AlertDescription>
            </Alert>
          ) : settingsQuery.data ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <SettingsMetric label="Scarcity" value={formatCount(settingsQuery.data.weights.scarcity)} tooltip="Weight applied to scarcity scoring" />
              <SettingsMetric
                label="Demand multiplier"
                value={settingsQuery.data.weights.demandMultiplier === null ? 'Fallback' : settingsQuery.data.weights.demandMultiplier.toFixed(2)}
                tooltip="Override applied to demand multiplier"
              />
              <SettingsMetric
                label="Future conflict penalty"
                value={settingsQuery.data.weights.futureConflictPenalty === null ? 'Default' : settingsQuery.data.weights.futureConflictPenalty.toFixed(0)}
                tooltip="Penalty applied when seating blocks future bookings"
              />
            </div>
          ) : null}
        </CardContent>
        {settingsQuery.data ? (
          <CardFooter className="border-t border-border/60 bg-muted/20 px-6 py-4 text-xs text-muted-foreground">
            <span>
              Source: {settingsQuery.data.source === 'db' ? 'Supabase overrides' : 'Environment defaults'} · Last updated {formatDateTime(settingsQuery.data.updatedAt)}
            </span>
          </CardFooter>
        ) : null}
      </Card>

      <StrategicSettingsDialog
        restaurantName={restaurantName}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settingsQuery.data}
        onSubmit={handleSaveSettings}
        isSubmitting={updateSettings.isPending}
      />
    </div>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  description: string;
};

function SummaryCard({ label, value, description }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

type SettingsMetricProps = {
  label: string;
  value: string;
  tooltip?: string;
};

function SettingsMetric({ label, value, tooltip }: SettingsMetricProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      {tooltip ? <p className="mt-1 text-xs text-muted-foreground">{tooltip}</p> : null}
    </div>
  );
}
