/**
 * Capacity Administration Console
 * Story 5: Ops Dashboard enhancements for capacity management.
 */

'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  FileDown,
  Gauge,
  Layers,
  LineChart,
  Loader2,
  Map,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { useTableInventoryService } from '@/contexts/ops-services';
import { useCapacityService } from '@/contexts/ops-services';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useToast } from '@/hooks/use-toast';
import type { CapacityRule, CapacityOverride, SaveCapacityRulePayload } from '@/services/ops/capacity';
import type { TableInventory } from '@/services/ops/tables';
import { getAllowedCapacities, updateAllowedCapacities } from '@/services/ops/allowedCapacities';

import UtilizationHeatmap from './UtilizationHeatmap';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const OVERRIDE_TYPES = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'event', label: 'Event' },
  { value: 'manual', label: 'Manual Adjustment' },
  { value: 'emergency', label: 'Emergency' },
] as const;

type CapacityTab = 'rules' | 'overrides' | 'live' | 'floor' | 'reports';

type OverrideRange = {
  from: string;
  to: string;
};

const TAB_DEFINITIONS: Array<{ id: CapacityTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'rules', label: 'Service Period Rules', icon: Layers },
  { id: 'overrides', label: 'Overrides & Events', icon: CalendarDays },
  { id: 'live', label: 'Live Utilization', icon: LineChart },
  { id: 'floor', label: 'Floor Plan', icon: Map },
  { id: 'reports', label: 'Reports', icon: FileDown },
];

function formatDateInput(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function addDays(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(base.getDate() + days);
  return formatDateInput(next);
}

export default function CapacityConfigClient() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const capacityService = useCapacityService();
  const tableService = useTableInventoryService();

  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();

  const [activeTab, setActiveTab] = useState<CapacityTab>('rules');
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  const today = useMemo(() => formatDateInput(new Date()), []);

  const [overrideRange, setOverrideRange] = useState<OverrideRange>({
    from: addDays(new Date(), -30),
    to: addDays(new Date(), 60),
  });

  const [reportRange, setReportRange] = useState<OverrideRange>({
    from: addDays(new Date(), -30),
    to: today,
  });

  const [liveDate, setLiveDate] = useState<string>(today);
  const [livePartySize, setLivePartySize] = useState<number>(2);
  const [newCapacityInput, setNewCapacityInput] = useState<string>('');

  const canManageCapacity =
    Boolean(activeMembership) && ['owner', 'admin'].includes(activeMembership!.role ?? '');

  const servicePeriodsQuery = useOpsServicePeriods(activeRestaurantId);
  const servicePeriods = servicePeriodsQuery.data ?? [];

  const rulesQueryKey = activeRestaurantId
    ? queryKeys.opsCapacity.rules(activeRestaurantId)
    : ['ops', 'capacity', 'rules', 'none'] as const;

  const allowedCapacitiesQueryKey = activeRestaurantId
    ? queryKeys.opsCapacity.allowedCapacities(activeRestaurantId)
    : ['ops', 'capacity', 'allowed', 'none'] as const;

  const rulesQuery = useQuery({
    queryKey: rulesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required');
      }
      return capacityService.list(activeRestaurantId);
    },
    enabled: Boolean(activeRestaurantId),
    staleTime: 30_000,
  });

  const allRules = rulesQuery.data?.rules ?? [];
  const baseRules = allRules.filter((rule) => !rule.effectiveDate);

  const overridesQueryKey = activeRestaurantId
    ? queryKeys.opsCapacity.overrides(activeRestaurantId, overrideRange)
    : ['ops', 'capacity', 'overrides', 'none'] as const;

  const overridesQuery = useQuery({
    queryKey: overridesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required');
      }
      return capacityService.listOverrides(activeRestaurantId, overrideRange);
    },
    enabled: Boolean(activeRestaurantId),
    staleTime: 60_000,
  });

  const tablesQueryKey = activeRestaurantId
    ? queryKeys.opsTables.list(activeRestaurantId, { includePosition: true })
    : ['ops', 'tables', 'no-restaurant'] as const;

  const allowedCapacitiesQuery = useQuery({
    queryKey: allowedCapacitiesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required');
      }
      return getAllowedCapacities(activeRestaurantId);
    },
    enabled: Boolean(activeRestaurantId),
    retry: false,
    staleTime: 60_000,
  });

  const floorPlanQuery = useQuery({
    queryKey: tablesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required');
      }
      const result = await tableService.list(activeRestaurantId);
      return result.tables;
    },
    enabled: Boolean(activeRestaurantId && activeTab === 'floor'),
    staleTime: 60_000,
  });

  const allowedCapacities = allowedCapacitiesQuery.data?.capacities ?? [];
  const allowedCapacitiesError = allowedCapacitiesQuery.error as unknown;
  const allowedCapacitiesFeatureDisabled =
    allowedCapacitiesError instanceof HttpError && allowedCapacitiesError.status === 404;

  const updateRuleMutation = useMutation({
    mutationFn: async (payload: { restaurantId: string; rule: SaveCapacityRulePayload }) =>
      capacityService.save(payload.restaurantId, payload.rule),
    onSuccess: (_rule, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opsCapacity.rules(variables.restaurantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.opsCapacity.overrides(variables.restaurantId, overrideRange) });
      setEditingPeriodId(null);
      toast({
        title: 'Capacity rule saved',
        description: 'Updates will take effect immediately for new bookings.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Unable to save capacity rule',
        description: error instanceof Error ? error.message : 'Unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });

  const createOverrideMutation = useMutation({
    mutationFn: async (payload: { restaurantId: string; rule: SaveCapacityRulePayload }) =>
      capacityService.save(payload.restaurantId, payload.rule),
    onSuccess: (_rule, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opsCapacity.overrides(variables.restaurantId, overrideRange) });
      queryClient.invalidateQueries({ queryKey: queryKeys.opsCapacity.rules(variables.restaurantId) });
      setOverrideDialogOpen(false);
      toast({
        title: 'Override saved',
        description: 'Special date capacity has been updated.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Unable to save override',
        description: error instanceof Error ? error.message : 'Unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (params: { ruleId: string; restaurantId: string }) => capacityService.delete(params.ruleId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opsCapacity.overrides(variables.restaurantId, overrideRange) });
      queryClient.invalidateQueries({ queryKey: queryKeys.opsCapacity.rules(variables.restaurantId) });
      toast({ title: 'Capacity rule deleted' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Unable to delete capacity rule',
        description: error instanceof Error ? error.message : 'Unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });

  const exportReportMutation = useMutation({
    mutationFn: async (params: { restaurantId: string; from: string; to: string }) => {
      const blob = await capacityService.exportOverbookingReport(params.restaurantId, {
        from: params.from,
        to: params.to,
      });
      return blob;
    },
    onError: (error: unknown) => {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Could not generate report.',
        variant: 'destructive',
      });
    },
  });

  const updateAllowedCapacitiesMutation = useMutation({
    mutationFn: async (nextCapacities: number[]) => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required');
      }
      return updateAllowedCapacities(activeRestaurantId, nextCapacities);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(allowedCapacitiesQueryKey, data);
      queryClient.invalidateQueries({ queryKey: allowedCapacitiesQueryKey });
      toast({
        title: 'Allowed capacities updated',
        description: 'New table sizes are now available to your team.',
      });
      setNewCapacityInput('');
    },
    onError: (error: unknown) => {
      toast({
        title: 'Unable to update allowed capacities',
        description: error instanceof Error ? error.message : 'Unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });

  const isInitialLoading =
    (servicePeriodsQuery.isLoading || rulesQuery.isLoading) && baseRules.length === 0 && servicePeriods.length === 0;

  const handleAddCapacity = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canManageCapacity) {
      toast({
        title: 'Read-only access',
        description: 'Only owners or admins can update allowed capacities.',
        variant: 'destructive',
      });
      return;
    }

    if (allowedCapacitiesFeatureDisabled || allowedCapacitiesQuery.isLoading) {
      return;
    }

    const trimmed = newCapacityInput.trim();
    const parsed = Number.parseInt(trimmed, 10);

    if (!trimmed || Number.isNaN(parsed)) {
      toast({
        title: 'Enter a capacity value',
        description: 'Provide a whole number between 1 and 20.',
        variant: 'destructive',
      });
      return;
    }

    if (parsed < 1 || parsed > 20) {
      toast({
        title: 'Unsupported capacity',
        description: 'Capacity must be between 1 and 20 seats.',
        variant: 'destructive',
      });
      return;
    }

    if (allowedCapacities.includes(parsed)) {
      toast({
        title: 'Capacity already enabled',
        description: `A ${parsed}-top is already available.`,
      });
      return;
    }

    if (allowedCapacities.length >= 12) {
      toast({
        title: 'Too many capacities',
        description: 'Reduce the list before adding new table sizes (limit of 12).',
        variant: 'destructive',
      });
      return;
    }

    const next = [...allowedCapacities, parsed].sort((a, b) => a - b);
    updateAllowedCapacitiesMutation.mutate(next);
  };

  const handleRemoveCapacity = (capacity: number) => {
    if (!canManageCapacity) {
      toast({
        title: 'Read-only access',
        description: 'Only owners or admins can update allowed capacities.',
        variant: 'destructive',
      });
      return;
    }

    if (allowedCapacitiesFeatureDisabled || allowedCapacitiesQuery.isLoading) {
      return;
    }

    if (allowedCapacities.length <= 1) {
      toast({
        title: 'Keep at least one capacity',
        description: 'Your venue must support at least one table size.',
        variant: 'destructive',
      });
      return;
    }

    const next = allowedCapacities.filter((value) => value !== capacity);
    updateAllowedCapacitiesMutation.mutate(next);
  };

  const isUpdatingAllowedCapacities = updateAllowedCapacitiesMutation.isPending;

  if (memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No restaurant access</AlertTitle>
        <AlertDescription>
          Your account is not linked to any restaurants yet. Ask an owner or manager to invite you before configuring
          capacity.
        </AlertDescription>
      </Alert>
    );
  }

  if (!activeRestaurantId) {
    return (
      <Skeleton className="h-64 w-full rounded-lg" />
    );
  }

  return (
    <div className="space-y-6">
      <Alert variant="info">
        <Gauge className="h-4 w-4" />
        <AlertDescription>
          Configure capacity for each service period, apply special overrides for events or holidays, and monitor
          real-time utilization to prevent overbooking.
        </AlertDescription>
      </Alert>

      {!canManageCapacity ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have read-only access. Contact an owner or admin to adjust capacity limits or download reports.
          </AlertDescription>
        </Alert>
      ) : null}

      {!allowedCapacitiesFeatureDisabled ? (
        <Card className="border border-white/60 bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle>Allowed table capacities</CardTitle>
            <CardDescription>
              Manage which table sizes your team can create and assign. Changes apply immediately across the ops tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allowedCapacitiesQuery.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : allowedCapacitiesQuery.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load capacities</AlertTitle>
                <AlertDescription>
                  {allowedCapacitiesError instanceof Error ? allowedCapacitiesError.message : 'Please try again later.'}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {allowedCapacities.length > 0 ? (
                    allowedCapacities.map((capacity) => (
                      <Badge
                        key={capacity}
                        variant="secondary"
                        className="flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                      >
                        <span>{capacity}-top</span>
                        {canManageCapacity ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-slate-500 hover:text-slate-900"
                            onClick={() => handleRemoveCapacity(capacity)}
                            disabled={isUpdatingAllowedCapacities}
                          >
                            <X className="h-3 w-3" aria-hidden />
                            <span className="sr-only">Remove {capacity}-top</span>
                          </Button>
                        ) : null}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No capacities configured yet.</p>
                  )}
                </div>

                {canManageCapacity ? (
                  <form onSubmit={handleAddCapacity} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={newCapacityInput}
                      onChange={(event) => setNewCapacityInput(event.target.value)}
                      placeholder="Add capacity (e.g. 3)"
                      className="w-full sm:w-48"
                    />
                    <Button type="submit" size="sm" disabled={isUpdatingAllowedCapacities}>
                      {isUpdatingAllowedCapacities ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        'Add capacity'
                      )}
                    </Button>
                  </form>
                ) : (
                  <p className="text-xs text-slate-500">You need edit access to update allowed capacities.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <nav className="flex flex-wrap gap-2">
        {TAB_DEFINITIONS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={cn('gap-2', isActive ? 'shadow-sm' : 'bg-background')}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </nav>

      {activeTab === 'rules' ? (
        <RulesPanel
          servicePeriods={servicePeriods}
          rules={baseRules}
          canManage={canManageCapacity}
          isLoading={isInitialLoading}
          editingPeriodId={editingPeriodId}
          setEditingPeriodId={setEditingPeriodId}
          onSubmit={(periodId, formData) => {
            if (!activeRestaurantId) return;
            const payload = extractRulePayload(formData);
            updateRuleMutation.mutate({
              restaurantId: activeRestaurantId,
              rule: {
                ...payload,
                servicePeriodId: periodId,
              },
            });
          }}
          mutationPending={updateRuleMutation.isPending}
        />
      ) : null}

      {activeTab === 'overrides' ? (
        <OverridesPanel
          overrides={overridesQuery.data ?? []}
          range={overrideRange}
          setRange={setOverrideRange}
          isLoading={overridesQuery.isLoading}
          canManage={canManageCapacity}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: overridesQueryKey })}
          onDelete={(ruleId) => {
            if (!activeRestaurantId) return;
            deleteRuleMutation.mutate({ ruleId, restaurantId: activeRestaurantId });
          }}
          onOpenCreate={() => setOverrideDialogOpen(true)}
        />
      ) : null}

      {activeTab === 'live' ? (
        <LiveUtilizationPanel
          restaurantId={activeRestaurantId}
          date={liveDate}
          onDateChange={setLiveDate}
          partySize={livePartySize}
          onPartySizeChange={setLivePartySize}
        />
      ) : null}

      {activeTab === 'floor' ? (
        <FloorPlanPanel
          tables={floorPlanQuery.data ?? []}
          isLoading={floorPlanQuery.isLoading}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: tablesQueryKey })}
        />
      ) : null}

      {activeTab === 'reports' ? (
        <ReportsPanel
          range={reportRange}
          setRange={setReportRange}
          isExporting={exportReportMutation.isPending}
          onExport={async () => {
            if (!activeRestaurantId) return;
            const blob = await exportReportMutation.mutateAsync({
              restaurantId: activeRestaurantId,
              from: reportRange.from,
              to: reportRange.to,
            });
            if (!blob) {
              return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `capacity-overbooking-${reportRange.from}-to-${reportRange.to}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({
              title: 'Export ready',
              description: 'Overbooking report downloaded.',
            });
          }}
        />
      ) : null}

      <OverrideDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        canManage={canManageCapacity}
        servicePeriods={servicePeriods}
        onSubmit={(formData) => {
          if (!activeRestaurantId) return;
          const payload = extractRulePayload(formData);
          if (!payload.effectiveDate) {
            toast({
              title: 'Effective date required',
              description: 'Overrides must include a specific date.',
              variant: 'destructive',
            });
            return;
          }
          createOverrideMutation.mutate({
            restaurantId: activeRestaurantId,
            rule: payload,
          });
        }}
        isSubmitting={createOverrideMutation.isPending}
      />
    </div>
  );
}

type RulesPanelProps = {
  servicePeriods: ReturnType<typeof useOpsServicePeriods>['data'] extends Array<infer T> ? Array<T> : any[];
  rules: CapacityRule[];
  canManage: boolean;
  isLoading: boolean;
  editingPeriodId: string | null;
  setEditingPeriodId: (id: string | null) => void;
  onSubmit: (periodId: string, formData: FormData) => void;
  mutationPending: boolean;
};

function RulesPanel({
  servicePeriods,
  rules,
  canManage,
  isLoading,
  editingPeriodId,
  setEditingPeriodId,
  onSubmit,
  mutationPending,
}: RulesPanelProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Capacity by service period</h2>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={`capacity-skeleton-${index}`} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : servicePeriods.length === 0 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No service periods found. Configure service periods in restaurant settings before setting capacity limits.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {servicePeriods.map((period) => {
            if (!period?.id) return null;
            const rule = rules.find((item) => item.servicePeriodId === period.id);
            const isEditing = editingPeriodId === period.id;
            return (
              <RuleCard
                key={period.id}
                period={period}
                rule={rule}
                canManage={canManage}
                isEditing={isEditing}
                onEdit={() => setEditingPeriodId(period.id)}
                onCancel={() => setEditingPeriodId(null)}
                onSubmit={(formData) => onSubmit(period.id, formData)}
                mutationPending={mutationPending}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

type RuleCardProps = {
  period: {
    id?: string;
    name: string;
    dayOfWeek: number | null;
    startTime: string;
    endTime: string;
  };
  rule?: CapacityRule;
  canManage: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (formData: FormData) => void;
  mutationPending: boolean;
};

function RuleCard({ period, rule, canManage, isEditing, onEdit, onCancel, onSubmit, mutationPending }: RuleCardProps) {
  const timeRange = useMemo(() => {
    const start = (period.startTime ?? '').slice(0, 5);
    const end = (period.endTime ?? '').slice(0, 5);
    return `${start} – ${end}`;
  }, [period.endTime, period.startTime]);

  const dayLabel =
    period.dayOfWeek !== null && period.dayOfWeek !== undefined
      ? WEEKDAY_NAMES[period.dayOfWeek]
      : 'All days';

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground">{period.name}</CardTitle>
          <CardDescription>
            {dayLabel} • {timeRange}
          </CardDescription>
        </div>
        {canManage ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            {rule ? 'Edit limits' : 'Configure'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(new FormData(event.currentTarget));
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormNumberField
                label="Max covers (total guests)"
                inputName="maxCovers"
                defaultValue={rule?.maxCovers ?? ''}
                description="Leave empty for unlimited covers."
              />
              <FormNumberField
                label="Max parties (bookings)"
                inputName="maxParties"
                defaultValue={rule?.maxParties ?? ''}
                description="Leave empty for unlimited bookings."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`label-${period.id}`}>Label (optional)</Label>
                <Input
                  id={`label-${period.id}`}
                  name="label"
                  defaultValue={rule?.label ?? ''}
                  placeholder="e.g., Dinner Service"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`notes-${period.id}`}>Notes (optional)</Label>
                <Textarea
                  id={`notes-${period.id}`}
                  name="notes"
                  defaultValue={rule?.notes ?? ''}
                  placeholder="Internal notes about this configuration"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutationPending}>
                <Save className="mr-2 h-4 w-4" />
                {mutationPending ? 'Saving…' : 'Save configuration'}
              </Button>
            </div>
          </form>
        ) : (
          <RuleSummary rule={rule} canManage={canManage} />
        )}
      </CardContent>
    </Card>
  );
}

function FormNumberField({
  label,
  inputName,
  defaultValue,
  description,
}: {
  label: string;
  inputName: string;
  defaultValue: string | number;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={inputName}>{label}</Label>
      <Input id={inputName} name={inputName} type="number" min={0} max={9999} defaultValue={defaultValue} />
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function RuleSummary({ rule, canManage }: { rule?: CapacityRule; canManage: boolean }) {
  if (!rule) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span>No capacity limits configured.</span>
        {!canManage ? (
          <span className="text-xs text-muted-foreground/80">Admins can set limits.</span>
        ) : (
          <span className="text-xs text-muted-foreground/80">Bookings are unlimited for now.</span>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-xs uppercase text-muted-foreground">Max covers</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{rule.maxCovers ?? 'Unlimited'}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-muted-foreground">Max parties</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{rule.maxParties ?? 'Unlimited'}</p>
      </div>
      {rule.label ? (
        <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">Label: </span>
          {rule.label}
        </div>
      ) : null}
      {rule.notes ? (
        <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {rule.notes}
        </div>
      ) : null}
    </div>
  );
}

type OverridesPanelProps = {
  overrides: CapacityOverride[];
  range: OverrideRange;
  setRange: (range: OverrideRange) => void;
  isLoading: boolean;
  canManage: boolean;
  onRefresh: () => void;
  onDelete: (ruleId: string) => void;
  onOpenCreate: () => void;
};

function OverridesPanel({
  overrides,
  range,
  setRange,
  isLoading,
  canManage,
  onRefresh,
  onDelete,
  onOpenCreate,
}: OverridesPanelProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label htmlFor="override-from">From</Label>
            <Input
              id="override-from"
              type="date"
              value={range.from}
              onChange={(event) => setRange({ ...range, from: event.target.value })}
              className="w-[180px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="override-to">To</Label>
            <Input
              id="override-to"
              type="date"
              value={range.to}
              onChange={(event) => setRange({ ...range, to: event.target.value })}
              className="w-[180px]"
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="self-end" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        {canManage ? (
          <Button type="button" size="sm" className="self-start sm:self-auto" onClick={onOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add override
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : overrides.length === 0 ? (
        <Alert>
          <AlertTitle>No overrides found</AlertTitle>
          <AlertDescription>
            There are no date-specific capacity overrides in this range. Add one for upcoming events or holidays.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Label</th>
                <th className="px-4 py-3 text-left font-medium">Service period</th>
                <th className="px-4 py-3 text-left font-medium">Limits</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {overrides.map((override) => (
                <tr key={override.id}>
                  <td className="px-4 py-3">{override.effectiveDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{override.label ?? 'Override'}</span>
                      {override.notes ? (
                        <span className="text-xs text-muted-foreground">{override.notes}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {override.servicePeriod ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{override.servicePeriod.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {override.servicePeriod.startTime.slice(0, 5)} – {override.servicePeriod.endTime.slice(0, 5)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">All periods</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span>Max covers: {override.maxCovers ?? 'Unlimited'}</span>
                      <span>Max parties: {override.maxParties ?? 'Unlimited'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {override.overrideType ? (
                      <Badge variant="secondary" className="capitalize">
                        {override.overrideType}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(override.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete override</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type LiveUtilizationPanelProps = {
  restaurantId: string;
  date: string;
  onDateChange: (date: string) => void;
  partySize: number;
  onPartySizeChange: (size: number) => void;
};

function LiveUtilizationPanel({
  restaurantId,
  date,
  onDateChange,
  partySize,
  onPartySizeChange,
}: LiveUtilizationPanelProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="live-date">Date</Label>
          <Input id="live-date" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="live-party-size">Party size</Label>
          <Input
            id="live-party-size"
            type="number"
            min={1}
            max={20}
            value={partySize}
            onChange={(event) => onPartySizeChange(Number(event.target.value) || 1)}
            className="w-[120px]"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live slot utilization</CardTitle>
          <CardDescription>Hover each slot to see booked vs max covers.</CardDescription>
        </CardHeader>
        <CardContent>
          <UtilizationHeatmap restaurantId={restaurantId} date={date} partySize={partySize} showCounts />
        </CardContent>
      </Card>
    </section>
  );
}

type FloorPlanPanelProps = {
  tables: TableInventory[];
  isLoading: boolean;
  onRefresh: () => void;
};

function FloorPlanPanel({ tables, isLoading, onRefresh }: FloorPlanPanelProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Table layout</h2>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Floor plan visualization</CardTitle>
          <CardDescription>
            Positions use the table inventory coordinates. Tables without coordinates are auto-arranged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-80 w-full rounded-lg" />
          ) : tables.length === 0 ? (
            <Alert>
              <AlertTitle>No tables configured</AlertTitle>
              <AlertDescription>
                Add tables in the inventory section to view them on the floor plan.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="relative h-80 flex-1 rounded-lg border bg-muted/40">
                {tables.map((table, index) => {
                  const position = normalizeTablePosition(table, index);
                  return (
                    <div
                      key={table.id}
                      className={cn(
                        'absolute flex size-12 translate-x-[-50%] translate-y-[-50%] items-center justify-center rounded-full border border-border bg-background text-xs font-semibold shadow-sm transition hover:scale-105',
                        table.status !== 'available' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      )}
                      style={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                        transform: `translate(-50%, -50%) rotate(${position.rotation ?? 0}deg)`,
                      }}
                    >
                      {table.tableNumber}
                    </div>
                  );
                })}
              </div>
              <div className="flex-1 space-y-3 rounded-lg border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">Table details</h3>
                <div className="grid gap-2 text-sm">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      className="flex flex-wrap items-center justify-between rounded-md bg-background px-3 py-2 shadow-sm"
                    >
                      <div>
                        <span className="font-semibold text-foreground">{table.tableNumber}</span>{' '}
                        <span className="text-muted-foreground">({table.capacity} seats)</span>
                        {table.section ? (
                          <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {table.section}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{table.status}</span>
                        <span>
                          Min {table.minPartySize}
                          {table.maxPartySize ? `–${table.maxPartySize}` : '+'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function normalizeTablePosition(table: TableInventory, index: number): { x: number; y: number; rotation?: number } {
  const position = table.position as { x?: number; y?: number; rotation?: number } | null;
  if (position && typeof position.x === 'number' && typeof position.y === 'number') {
    return {
      x: clamp(position.x, 5, 95),
      y: clamp(position.y, 5, 95),
      rotation: position.rotation ?? 0,
    };
  }

  // fallback grid
  const columns = 5;
  const row = Math.floor(index / columns);
  const col = index % columns;
  const cellWidth = 100 / (columns + 1);
  const cellHeight = 100 / (Math.ceil((index + 1) / columns) + 1);
  return {
    x: cellWidth + col * cellWidth,
    y: cellHeight + row * cellHeight,
    rotation: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type ReportsPanelProps = {
  range: OverrideRange;
  setRange: (range: OverrideRange) => void;
  isExporting: boolean;
  onExport: () => Promise<void>;
};

function ReportsPanel({ range, setRange, isExporting, onExport }: ReportsPanelProps) {
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Overbooking reports</CardTitle>
          <CardDescription>Export incidents where bookings exceeded configured limits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="report-from">From</Label>
              <Input
                id="report-from"
                type="date"
                value={range.from}
                max={range.to}
                onChange={(event) => setRange({ ...range, from: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-to">To</Label>
              <Input
                id="report-to"
                type="date"
                value={range.to}
                min={range.from}
                onChange={(event) => setRange({ ...range, to: event.target.value })}
              />
            </div>
          </div>
          <Button type="button" onClick={onExport} disabled={isExporting}>
            <FileDown className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting…' : 'Download CSV'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Reports are limited to 90-day ranges to keep exports fast. Data includes overbooked periods, utilization, and
            booking references.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

type OverrideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  servicePeriods: ReturnType<typeof useOpsServicePeriods>['data'] extends Array<infer T> ? Array<T> : any[];
  onSubmit: (formData: FormData) => void;
  isSubmitting: boolean;
};

function OverrideDialog({ open, onOpenChange, canManage, servicePeriods, onSubmit, isSubmitting }: OverrideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canManage) return;
            onSubmit(new FormData(event.currentTarget));
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Add capacity override</DialogTitle>
            <DialogDescription>Specify a date-specific adjustment for holidays or special events.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="override-date">Date *</Label>
              <Input id="override-date" name="effectiveDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-type">Type</Label>
              <Select name="overrideType" defaultValue="manual">
                <SelectTrigger id="override-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OVERRIDE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="override-label">Label *</Label>
            <Input id="override-label" name="label" placeholder="e.g., New Year’s Eve Dinner" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="override-service-period">Service period (optional)</Label>
            <Select name="servicePeriodId">
              <SelectTrigger id="override-service-period">
                <SelectValue placeholder="All service periods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All service periods</SelectItem>
                {servicePeriods
                  .filter((period) => Boolean(period?.id))
                  .map((period) => (
                    <SelectItem key={period!.id!} value={period!.id!}>
                      {period!.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormNumberField label="Max covers" inputName="maxCovers" defaultValue="" description="Leave blank for unlimited covers." />
            <FormNumberField label="Max parties" inputName="maxParties" defaultValue="" description="Leave blank for unlimited bookings." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="override-notes">Notes</Label>
            <Textarea id="override-notes" name="notes" placeholder="Internal notes for this override" rows={2} />
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !canManage}>
              {isSubmitting ? 'Saving…' : 'Save override'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function extractRulePayload(formData: FormData): SaveCapacityRulePayload {
  const parseNumber = (value: FormDataEntryValue | null) => {
    if (value === null) return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const servicePeriodIdRaw = formData.get('servicePeriodId');
  const effectiveDateRaw = formData.get('effectiveDate');
  const dayOfWeekRaw = formData.get('dayOfWeek');

  const payload: SaveCapacityRulePayload = {
    servicePeriodId: servicePeriodIdRaw ? String(servicePeriodIdRaw) : undefined,
    effectiveDate: effectiveDateRaw ? String(effectiveDateRaw) : undefined,
    dayOfWeek: dayOfWeekRaw ? Number.parseInt(String(dayOfWeekRaw), 10) : undefined,
    maxCovers: parseNumber(formData.get('maxCovers')),
    maxParties: parseNumber(formData.get('maxParties')),
    notes: sanitizeTextField(formData.get('notes')),
    label: sanitizeTextField(formData.get('label')),
    overrideType: sanitizeOverrideType(formData.get('overrideType')),
  };

  return payload;
}

function sanitizeTextField(value: FormDataEntryValue | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeOverrideType(value: FormDataEntryValue | null): SaveCapacityRulePayload['overrideType'] {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return OVERRIDE_TYPES.some((type) => type.value === normalized)
    ? (normalized as SaveCapacityRulePayload['overrideType'])
    : null;
}
