'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { useOpsOperatingHours, useOpsUpdateOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { cn } from '@/lib/utils';

import {
  buildOperatingHoursPayload,
  defaultOverrideRow,
  defaultWeeklyRows,
  mapOverridesFromResponse,
  mapWeeklyFromResponse,
  validateHours,
} from './availabilityScheduleManagerUtils';
import {
  deriveOperatingHoursRowComparisons,
  deriveOperatingHoursVerification,
} from './google-business-profile/googleBusinessProfileVerification';
import { GoogleBusinessProfileComparisonBadge } from './GoogleBusinessProfileComparisonBadge';
import { OperatingHoursOverrideDateField } from './OperatingHoursOverrideDateField';
import {
  SETTINGS_COMPACT_HELPER_TEXT_CLASS,
  SettingsCard,
  SettingsSecondaryActions,
  SettingsSectionHeader,
} from './shared';
import { DAYS_OF_WEEK } from './types';

import type { OverrideErrors, OverrideRow, WeeklyErrors, WeeklyRow } from './types';

type OperatingHoursSectionProps = {
  restaurantId: string | null;
};

export function OperatingHoursSection({ restaurantId }: OperatingHoursSectionProps) {
  const { data, error, isLoading } = useOpsOperatingHours(restaurantId);
  const gbpConnectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const updateMutation = useOpsUpdateOperatingHours(restaurantId);

  const [weeklyRows, setWeeklyRows] = useState<WeeklyRow[]>(defaultWeeklyRows);
  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);
  const [weeklyErrors, setWeeklyErrors] = useState<WeeklyErrors>({});
  const [overrideErrors, setOverrideErrors] = useState<OverrideErrors>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setWeeklyRows(mapWeeklyFromResponse(data.weekly));
      setOverrideRows(mapOverridesFromResponse(data.overrides));
      setWeeklyErrors({});
      setOverrideErrors([]);
      setIsDirty(false);
    }
  }, [data]);

  const handleWeeklyChange = useCallback((index: number, patch: Partial<WeeklyRow>) => {
    setWeeklyRows((current) =>
      current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    );
    setIsDirty(true);
    setWeeklyErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const handleOverrideChange = useCallback((index: number, patch: Partial<OverrideRow>) => {
    setOverrideRows((current) =>
      current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    );
    setIsDirty(true);
    setOverrideErrors((prev) => {
      const next = [...prev];
      next[index] = {};
      return next;
    });
  }, []);

  const addOverride = () => {
    setOverrideRows((current) => [...current, defaultOverrideRow()]);
    setOverrideErrors((current) => [...current, {}]);
    setIsDirty(true);
  };

  const removeOverride = (index: number) => {
    setOverrideRows((current) => current.filter((_, idx) => idx !== index));
    setOverrideErrors((current) => current.filter((_, idx) => idx !== index));
    setIsDirty(true);
  };

  const validate = (): boolean => {
    const result = validateHours(weeklyRows, overrideRows);
    setWeeklyErrors(result.weeklyErrors);
    setOverrideErrors(result.overrideErrors);
    return result.isValid;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      await updateMutation.mutateAsync(buildOperatingHoursPayload(weeklyRows, overrideRows));
      setIsDirty(false);
    } catch (error) {
      console.error('[operating-hours] save failed', error);
    }
  };

  const handleReset = () => {
    if (!data) return;
    setWeeklyRows(mapWeeklyFromResponse(data.weekly));
    setOverrideRows(mapOverridesFromResponse(data.overrides));
    setWeeklyErrors({});
    setOverrideErrors([]);
    setIsDirty(false);
  };

  const isDisabled = updateMutation.isPending;
  const gbpVerification = deriveOperatingHoursVerification({
    snapshot: data,
    connection: gbpConnectionQuery.data,
  });
  const rowComparisons = deriveOperatingHoursRowComparisons({
    weekly: weeklyRows,
    overrides: overrideRows.map((row) => ({
      effectiveDate: row.effectiveDate,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      isClosed: row.isClosed,
    })),
    connection: gbpConnectionQuery.data,
  });
  useGlobalShortcuts([
    {
      key: 's',
      metaOrCtrl: true,
      preventDefault: true,
      enabled: !isDisabled && isDirty,
      when: () => true,
      handler: () => {
        if (!isDisabled && isDirty) {
          void handleSave();
        }
      },
    },
  ]);

  if (!restaurantId) {
    return (
      <SettingsCard title="Operating Hours">
        <div className="flex min-h-[200px] items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            Select a restaurant to manage operating hours
          </p>
        </div>
      </SettingsCard>
    );
  }

  if (error) {
    return (
      <SettingsCard title="Operating Hours">
        <Alert variant="destructive">
          <AlertTitle>Unable to load operating hours</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </SettingsCard>
    );
  }

  if (isLoading && !data) {
    return (
      <SettingsCard title="Operating Hours" description="Loading…">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </SettingsCard>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <SettingsCard
        title="Operating Hours"
        description="Configure weekly schedule and holiday overrides"
        headerAction={
          <Button type="button" variant="outline" asChild>
            <a href="/app/settings/restaurant/google-business-profile">Review GBP draft</a>
          </Button>
        }
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className={cn(SETTINGS_COMPACT_HELPER_TEXT_CLASS, 'hidden sm:block')}>
              Changes are saved per restaurant. Remember to keep staff informed about special hours.
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isDisabled || !isDirty}
              >
                Reset
              </Button>
              <Button type="button" onClick={handleSave} disabled={isDisabled || !isDirty}>
                Save changes
              </Button>
            </div>
          </div>
        }
        stickyFooter
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">{gbpVerification.summary}</p>
            <p className={SETTINGS_COMPACT_HELPER_TEXT_CLASS}>
              GBP sync aligns the outer open/close window and holiday overrides. Nabatable keeps
              reservation intervals and slot times as core booking-hour controls.
            </p>
            {isDirty ? (
              <p className={SETTINGS_COMPACT_HELPER_TEXT_CLASS}>
                Save or reset local changes before running a GBP sync for this section.
              </p>
            ) : null}
            {gbpVerification.warnings.map((warning) => (
              <p key={warning} className={SETTINGS_COMPACT_HELPER_TEXT_CLASS}>
                {warning}
              </p>
            ))}
          </div>
          {/* Weekly Schedule */}
          <div className="flex flex-col gap-3">
            <SettingsSectionHeader
              title="Weekly Schedule"
              description="Set default open/close windows for each day. Mark a day closed to block bookings."
            />
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <TableRow>
                    <TableHead className="px-4 py-3 text-left">Day</TableHead>
                    <TableHead className="px-4 py-3 text-left">Open</TableHead>
                    <TableHead className="px-4 py-3 text-left">Close</TableHead>
                    <TableHead className="px-4 py-3 text-left">Interval (min)</TableHead>
                    <TableHead className="px-4 py-3 text-left">Slots (HH:MM)</TableHead>
                    <TableHead className="px-4 py-3 text-left">Closed</TableHead>
                    <TableHead className="px-4 py-3 text-left">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/70 text-sm">
                  {weeklyRows.map((row, index) => {
                    const errors = weeklyErrors[row.dayOfWeek] ?? {};
                    const comparison = rowComparisons.weeklyByDay[row.dayOfWeek];
                    return (
                      <TableRow key={row.dayOfWeek} className={cn(row.isClosed && 'bg-muted/40')}>
                        <TableHead
                          scope="row"
                          className="whitespace-nowrap px-4 py-3 font-medium text-foreground"
                        >
                          <div className="flex flex-col gap-1">
                            <span>{DAYS_OF_WEEK[row.dayOfWeek]}</span>
                            {comparison && comparison.status !== 'unavailable' ? (
                              <GoogleBusinessProfileComparisonBadge
                                status={comparison.status}
                                tooltipTitle={comparison.tooltipTitle}
                                tooltipLines={comparison.tooltipLines}
                                tooltipFooter={comparison.tooltipFooter}
                                ariaLabel={`Show GBP hours for ${DAYS_OF_WEEK[row.dayOfWeek]}`}
                                className="w-fit"
                              />
                            ) : null}
                          </div>
                        </TableHead>
                        <TableCell className="px-4 py-3">
                          <Input
                            type="time"
                            value={row.opensAt}
                            disabled={isDisabled || row.isClosed}
                            onChange={(event) =>
                              handleWeeklyChange(index, { opensAt: event.target.value })
                            }
                            aria-invalid={Boolean(errors.opensAt)}
                            className={cn(
                              'h-9 min-w-[100px]',
                              errors.opensAt && 'border-destructive',
                            )}
                          />
                          {errors.opensAt && (
                            <p className="mt-1 text-xs text-destructive">{errors.opensAt}</p>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Input
                            type="time"
                            value={row.closesAt}
                            disabled={isDisabled || row.isClosed}
                            onChange={(event) =>
                              handleWeeklyChange(index, { closesAt: event.target.value })
                            }
                            aria-invalid={Boolean(errors.closesAt)}
                            className={cn(
                              'h-9 min-w-[100px]',
                              errors.closesAt && 'border-destructive',
                            )}
                          />
                          {errors.closesAt && (
                            <p className="mt-1 text-xs text-destructive">{errors.closesAt}</p>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={RESERVATION_INTERVAL_MIN}
                            max={RESERVATION_INTERVAL_MAX}
                            step={1}
                            value={row.reservationIntervalMinutes}
                            disabled={isDisabled || row.isClosed}
                            onChange={(event) =>
                              handleWeeklyChange(index, {
                                reservationIntervalMinutes: event.target.value,
                              })
                            }
                            aria-invalid={Boolean(errors.reservationIntervalMinutes)}
                            className={cn(
                              'h-9 min-w-[120px]',
                              errors.reservationIntervalMinutes && 'border-destructive',
                            )}
                            placeholder="Default"
                          />
                          {errors.reservationIntervalMinutes && (
                            <p className="mt-1 text-xs text-destructive">
                              {errors.reservationIntervalMinutes}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Input
                            value={row.reservationSlotTimes}
                            placeholder="16:00, 18:00, 20:00"
                            disabled={isDisabled || row.isClosed}
                            onChange={(event) =>
                              handleWeeklyChange(index, {
                                reservationSlotTimes: event.target.value,
                              })
                            }
                            aria-invalid={Boolean(errors.reservationSlotTimes)}
                            className={cn(
                              'h-9 min-w-[180px]',
                              errors.reservationSlotTimes && 'border-destructive',
                            )}
                          />
                          {errors.reservationSlotTimes && (
                            <p className="mt-1 text-xs text-destructive">
                              {errors.reservationSlotTimes}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              id={`weekly-${row.dayOfWeek}-closed`}
                              checked={row.isClosed}
                              disabled={isDisabled}
                              onCheckedChange={(checked) =>
                                handleWeeklyChange(index, {
                                  isClosed: checked === true,
                                  opensAt: checked === true ? '' : row.opensAt || '09:00',
                                  closesAt: checked === true ? '' : row.closesAt || '18:00',
                                })
                              }
                            />
                            <Label htmlFor={`weekly-${row.dayOfWeek}-closed`} className="sr-only">
                              Closed all day
                            </Label>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Input
                            value={row.notes}
                            placeholder="Optional"
                            disabled={isDisabled}
                            onChange={(event) =>
                              handleWeeklyChange(index, { notes: event.target.value })
                            }
                            className="h-9 min-w-[150px]"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <SettingsSecondaryActions
            label={overrideRows.length > 0 ? `Overrides (${overrideRows.length})` : 'Overrides'}
            contentClassName="sm:min-w-full"
          >
            <div className="flex flex-col gap-3">
              <SettingsSectionHeader
                title="Overrides"
                description="Create one-off changes for holidays or events. Overrides apply on their date only."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOverride}
                    disabled={isDisabled}
                  >
                    <Plus data-icon="inline-start" aria-hidden /> Add override
                  </Button>
                }
              />

              {overrideRows.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No overrides configured. Use overrides to adjust hours for special events or
                    holidays.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {overrideRows.map((row, index) => {
                    const errors = overrideErrors[index] ?? {};
                    const comparison = rowComparisons.overridesByDate[row.effectiveDate];
                    return (
                      <div
                        key={row.id ?? index}
                        className="grid gap-3 rounded-lg border border-border/60 p-4 text-sm md:grid-cols-[repeat(7,minmax(0,1fr))_auto]"
                      >
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            {comparison && comparison.status !== 'unavailable' ? (
                              <GoogleBusinessProfileComparisonBadge
                                status={comparison.status}
                                tooltipTitle={comparison.tooltipTitle}
                                tooltipLines={comparison.tooltipLines}
                                tooltipFooter={comparison.tooltipFooter}
                                ariaLabel={`Show GBP special-hours comparison for ${row.effectiveDate}`}
                              />
                            ) : null}
                          </div>
                          <OperatingHoursOverrideDateField
                            value={row.effectiveDate}
                            onChange={(value) =>
                              handleOverrideChange(index, { effectiveDate: value })
                            }
                            disabled={isDisabled}
                            error={errors.effectiveDate}
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            Open
                          </Label>
                          <Input
                            type="time"
                            value={row.opensAt}
                            disabled={isDisabled || row.isClosed}
                            onChange={(event) =>
                              handleOverrideChange(index, { opensAt: event.target.value })
                            }
                            className={cn('mt-1 h-9', errors.opensAt && 'border-destructive')}
                          />
                          {errors.opensAt && (
                            <p className="mt-1 text-xs text-destructive">{errors.opensAt}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            Close
                          </Label>
                          <Input
                            type="time"
                            value={row.closesAt}
                            disabled={isDisabled || row.isClosed}
                            onChange={(event) =>
                              handleOverrideChange(index, { closesAt: event.target.value })
                            }
                            className={cn('mt-1 h-9', errors.closesAt && 'border-destructive')}
                          />
                          {errors.closesAt && (
                            <p className="mt-1 text-xs text-destructive">{errors.closesAt}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            Interval (min)
                          </Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={RESERVATION_INTERVAL_MIN}
                            max={RESERVATION_INTERVAL_MAX}
                            step={1}
                            value={row.reservationIntervalMinutes}
                            disabled={isDisabled || row.isClosed}
                            onChange={(event) =>
                              handleOverrideChange(index, {
                                reservationIntervalMinutes: event.target.value,
                              })
                            }
                            className={cn(
                              'mt-1 h-9',
                              errors.reservationIntervalMinutes && 'border-destructive',
                            )}
                            placeholder="Default"
                          />
                          {errors.reservationIntervalMinutes && (
                            <p className="mt-1 text-xs text-destructive">
                              {errors.reservationIntervalMinutes}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            Slots (HH:MM)
                          </Label>
                          <Input
                            value={row.reservationSlotTimes}
                            placeholder="16:00, 18:00, 20:00"
                            disabled={isDisabled || row.isClosed}
                            onChange={(event) =>
                              handleOverrideChange(index, {
                                reservationSlotTimes: event.target.value,
                              })
                            }
                            className={cn(
                              'mt-1 h-9',
                              errors.reservationSlotTimes && 'border-destructive',
                            )}
                          />
                          {errors.reservationSlotTimes && (
                            <p className="mt-1 text-xs text-destructive">
                              {errors.reservationSlotTimes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col justify-center gap-2">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                              Closed
                            </Label>
                            <HelpTooltip
                              description="Enable to close the restaurant for the entire override date. Leave off to set custom hours."
                              ariaLabel="Override closed help"
                              align="center"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`override-${index}-closed`}
                              checked={row.isClosed}
                              disabled={isDisabled}
                              onCheckedChange={(checked) =>
                                handleOverrideChange(index, {
                                  isClosed: checked === true,
                                  opensAt: checked === true ? '' : row.opensAt || '09:00',
                                  closesAt: checked === true ? '' : row.closesAt || '18:00',
                                })
                              }
                            />
                            <Label htmlFor={`override-${index}-closed`} className="text-sm">
                              Closed all day
                            </Label>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            Notes
                          </Label>
                          <Input
                            value={row.notes}
                            placeholder="Optional"
                            disabled={isDisabled}
                            onChange={(event) =>
                              handleOverrideChange(index, { notes: event.target.value })
                            }
                            className="mt-1 h-9"
                          />
                        </div>
                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOverride(index)}
                            disabled={isDisabled}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 aria-hidden />
                            <span className="sr-only">Remove override</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SettingsSecondaryActions>
        </div>
      </SettingsCard>
    </TooltipProvider>
  );
}
