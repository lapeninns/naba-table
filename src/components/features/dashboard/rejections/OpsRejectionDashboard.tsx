'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsRejectionAnalytics } from '@/hooks/ops/useOpsRejectionAnalytics';
import {
  useOpsStrategicSettings,
  useUpdateOpsStrategicSettings,
} from '@/hooks/ops/useOpsStrategicSettings';
import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';
import { cn } from '@/lib/utils';

import { RejectionAnalyticsPanel } from './RejectionAnalyticsPanel';
import {
  computeRangeState,
  RANGE_PRESETS,
  type RangePresetKey,
  type RangeState,
} from './rejectionDashboardDomain';
import { StrategicConfigurationPanel } from './StrategicConfigurationPanel';
import { StrategicSettingsDialog } from './StrategicSettingsDialog';

import type { OpsStrategicSettings } from '@/types/ops';

type SimulationStatus = 'idle' | 'running';

export function OpsRejectionDashboard() {
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

  const activePreset = useMemo(
    () => RANGE_PRESETS.find((preset) => preset.key === range.key) ?? RANGE_PRESETS[0],
    [range.key],
  );

  const handleChangeRange = useCallback((nextKey: RangePresetKey) => {
    setRange(computeRangeState(nextKey));
  }, []);

  const handleRefresh = useCallback(() => {
    setRange((prev) => computeRangeState(prev.key));
    analyticsQuery.refetch();
  }, [analyticsQuery]);

  const handleSaveSettings = useCallback(
    async (weights: OpsStrategicSettings['weights']) => {
      if (!restaurantId) return;
      try {
        await updateSettings.mutateAsync({ restaurantId, weights });
        settingsQuery.refetch();
      } catch (err) {
        console.error('[ops/rejections] unable to update strategic settings', err);
      }
    },
    [restaurantId, updateSettings, settingsQuery],
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

      const response = await fetch('/api/ops/strategies/simulate', {
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

      if (!response.ok) {
        return;
      }
    } catch (error) {
      console.error('[ops/rejections] failed to queue simulation', error);
    } finally {
      setSimulationStatus('idle');
    }
  }, [restaurantId]);

  if (!restaurantId) {
    return (
      <OpsEmptyState
        title="Select a restaurant"
        description="Choose a restaurant to view rejection analytics and strategic settings."
      />
    );
  }

  const analytics = analyticsQuery.data ?? null;
  const loading = analyticsQuery.isPending;
  const error = analyticsQuery.error as Error | null;

  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsPageHeader
        title="Rejections"
        subtitle="Review rejection analytics and strategic settings for your restaurant."
        meta={
          <Badge variant="secondary" className="rounded-md font-medium">
            {restaurantName}
          </Badge>
        }
      />

      <OpsPageToolbar
        sticky
        filters={
          <Select
            value={range.key}
            onValueChange={(value) => handleChangeRange(value as RangePresetKey)}
          >
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
        }
        actions={
          <Button variant="outline" onClick={handleRefresh} disabled={analyticsQuery.isRefetching}>
            <RefreshCw
              className={cn('mr-2 size-4', analyticsQuery.isRefetching && 'animate-spin')}
              aria-hidden
            />
            Refresh
          </Button>
        }
      />

      <RejectionAnalyticsPanel
        activePresetLabel={activePreset.label}
        analytics={analytics}
        error={error}
        isRefetching={analyticsQuery.isRefetching}
        loading={loading}
        restaurantName={restaurantName}
      />

      <StrategicConfigurationPanel
        error={(settingsQuery.error as Error | null) ?? null}
        isLoading={settingsQuery.isLoading}
        isSimulationRunning={simulationStatus === 'running'}
        onEditWeights={() => setSettingsOpen(true)}
        onRunSimulation={handleRunSimulation}
        restaurantName={restaurantName}
        settings={settingsQuery.data}
      />

      <StrategicSettingsDialog
        restaurantName={restaurantName}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settingsQuery.data}
        onSubmit={handleSaveSettings}
        isSubmitting={updateSettings.isPending}
        readOnly
      />
    </OpsPageShell>
  );
}
