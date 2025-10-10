'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOperatingHours,
  useUpdateOperatingHours,
  type OperatingHoursResponse,
} from '@/hooks/owner/useOperatingHours';
import {
  useServicePeriods,
  useUpdateServicePeriods,
  type ServicePeriod,
} from '@/hooks/owner/useServicePeriods';
import {
  useRestaurantDetails,
  useUpdateRestaurantDetails,
  type RestaurantDetails,
} from '@/hooks/owner/useRestaurantDetails';
import { cn } from '@/lib/utils';

export type RestaurantMembershipOption = {
  restaurantId: string;
  restaurantName: string | null;
  role: string;
};

export type ManageRestaurantShellProps = {
  memberships: RestaurantMembershipOption[];
  defaultRestaurantId: string | null;
};

type WeeklyRow = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  notes: string;
};

type WeeklyErrors = Record<number, { opensAt?: string; closesAt?: string }>;

type OverrideRow = {
  id?: string;
  effectiveDate: string;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  notes: string;
};

type OverrideErrors = Array<{ effectiveDate?: string; opensAt?: string; closesAt?: string }>;

type ServicePeriodRow = {
  id?: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: 'lunch' | 'dinner' | 'drinks';
};

type ServicePeriodErrors = Array<{ name?: string; startTime?: string; endTime?: string; bookingOption?: string }>;

type RestaurantDetailsForm = {
  name: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

type RestaurantDetailsErrors = {
  name?: string;
  timezone?: string;
  capacity?: string;
  contactEmail?: string;
  contactPhone?: string;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'All days' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const BOOKING_OPTION_CHOICES: Array<{ value: ServicePeriodRow['bookingOption']; label: string }> = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'drinks', label: 'Drinks & cocktails' },
];

function mapWeekly(response: OperatingHoursResponse | undefined): WeeklyRow[] {
  if (!response) {
    return DAYS.map((_, index) => ({ dayOfWeek: index, opensAt: '', closesAt: '', isClosed: true, notes: '' }));
  }
  return response.weekly.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    opensAt: row.opensAt ?? '',
    closesAt: row.closesAt ?? '',
    isClosed: row.isClosed,
    notes: row.notes ?? '',
  }));
}

function mapOverrides(response: OperatingHoursResponse | undefined): OverrideRow[] {
  if (!response) return [];
  return response.overrides.map((row) => ({
    id: row.id,
    effectiveDate: row.effectiveDate,
    opensAt: row.opensAt ?? '',
    closesAt: row.closesAt ?? '',
    isClosed: row.isClosed,
    notes: row.notes ?? '',
  }));
}

function mapServicePeriods(periods: ServicePeriod[] | undefined): ServicePeriodRow[] {
  if (!periods) return [];
  return periods.map((row) => ({
    id: row.id,
    name: row.name,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    bookingOption: row.bookingOption,
  }));
}

function mapDetails(details: RestaurantDetails | undefined): RestaurantDetailsForm | null {
  if (!details) return null;
  return {
    name: details.name,
    timezone: details.timezone,
    capacity: details.capacity,
    contactEmail: details.contactEmail,
    contactPhone: details.contactPhone,
  };
}

function buildHoursPayload(weekly: WeeklyRow[], overrides: OverrideRow[]) {
  return {
    weekly: weekly.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      opensAt: row.opensAt || null,
      closesAt: row.closesAt || null,
      isClosed: row.isClosed,
      notes: row.notes || null,
    })),
    overrides: overrides.map((row) => ({
      id: row.id,
      effectiveDate: row.effectiveDate,
      opensAt: row.opensAt || null,
      closesAt: row.closesAt || null,
      isClosed: row.isClosed,
      notes: row.notes || null,
    })),
  };
}

function buildServicePeriodsPayload(rows: ServicePeriodRow[]) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    bookingOption: row.bookingOption,
  }));
}

function buildDetailsPayload(form: RestaurantDetailsForm) {
  return {
    name: form.name,
    timezone: form.timezone,
    capacity: form.capacity ?? null,
    contactEmail: form.contactEmail ?? null,
    contactPhone: form.contactPhone ?? null,
  };
}

export function ManageRestaurantShell({ memberships, defaultRestaurantId }: ManageRestaurantShellProps) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(defaultRestaurantId);

  const hoursQuery = useOperatingHours(selectedRestaurantId);
  const servicePeriodsQuery = useServicePeriods(selectedRestaurantId);
  const detailsQuery = useRestaurantDetails(selectedRestaurantId);

  const updateHoursMutation = useUpdateOperatingHours(selectedRestaurantId);
  const updateServicePeriodsMutation = useUpdateServicePeriods(selectedRestaurantId);
  const updateDetailsMutation = useUpdateRestaurantDetails(selectedRestaurantId);

  const [weeklyRows, setWeeklyRows] = useState<WeeklyRow[]>(mapWeekly(undefined));
  const [weeklyErrors, setWeeklyErrors] = useState<WeeklyErrors>({});

  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);
  const [overrideErrors, setOverrideErrors] = useState<OverrideErrors>([]);

  const [servicePeriodRows, setServicePeriodRows] = useState<ServicePeriodRow[]>([]);
  const [servicePeriodErrors, setServicePeriodErrors] = useState<ServicePeriodErrors>([]);

  const [detailsForm, setDetailsForm] = useState<RestaurantDetailsForm | null>(null);
  const [detailsErrors, setDetailsErrors] = useState<RestaurantDetailsErrors>({});

  const [hoursDirty, setHoursDirty] = useState(false);
  const [servicePeriodsDirty, setServicePeriodsDirty] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);

  const membershipOptions = useMemo(() => memberships, [memberships]);

  const isHoursDisabled = updateHoursMutation.isPending || hoursQuery.isLoading || hoursQuery.isFetching;
  const isServicePeriodsDisabled =
    updateServicePeriodsMutation.isPending || servicePeriodsQuery.isLoading || servicePeriodsQuery.isFetching;
  const isDetailsDisabled = updateDetailsMutation.isPending || detailsQuery.isLoading || detailsQuery.isFetching;

  const hoursError = hoursQuery.error ?? updateHoursMutation.error;
  const servicePeriodsError = servicePeriodsQuery.error ?? updateServicePeriodsMutation.error;
  const detailsError = detailsQuery.error ?? updateDetailsMutation.error;

  useEffect(() => {
    if (hoursQuery.data) {
      setWeeklyRows(mapWeekly(hoursQuery.data));
      setOverrideRows(mapOverrides(hoursQuery.data));
      setWeeklyErrors({});
      setOverrideErrors([]);
      setHoursDirty(false);
    }
  }, [hoursQuery.data]);

  useEffect(() => {
    if (servicePeriodsQuery.data) {
      setServicePeriodRows(mapServicePeriods(servicePeriodsQuery.data));
      setServicePeriodErrors([]);
      setServicePeriodsDirty(false);
    }
  }, [servicePeriodsQuery.data]);

  useEffect(() => {
    if (detailsQuery.data) {
      setDetailsForm(mapDetails(detailsQuery.data));
      setDetailsErrors({});
      setDetailsDirty(false);
    }
  }, [detailsQuery.data]);

  useEffect(() => {
    setWeeklyRows(mapWeekly(undefined));
    setOverrideRows([]);
    setServicePeriodRows([]);
    setDetailsForm(null);
    setWeeklyErrors({});
    setOverrideErrors([]);
    setServicePeriodErrors([]);
    setDetailsErrors({});
    setHoursDirty(false);
    setServicePeriodsDirty(false);
    setDetailsDirty(false);
  }, [selectedRestaurantId]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hoursDirty && !servicePeriodsDirty && !detailsDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    if (hoursDirty || servicePeriodsDirty || detailsDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hoursDirty, servicePeriodsDirty, detailsDirty]);

  const handleWeeklyChange = useCallback(
    (index: number, patch: Partial<WeeklyRow>) => {
      setWeeklyRows((current) => current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
      setHoursDirty(true);
      setWeeklyErrors((prev) => {
        const next = { ...prev };
        delete next[weeklyRows[index].dayOfWeek];
        return next;
      });
    },
    [weeklyRows],
  );

  const handleOverrideChange = useCallback((index: number, patch: Partial<OverrideRow>) => {
    setOverrideRows((current) => current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
    setHoursDirty(true);
    setOverrideErrors((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], effectiveDate: undefined, opensAt: undefined, closesAt: undefined };
      return next;
    });
  }, []);

  const addOverride = () => {
    setOverrideRows((current) => [...current, { effectiveDate: new Date().toISOString().slice(0, 10), opensAt: '', closesAt: '', isClosed: true, notes: '' }]);
    setOverrideErrors((current) => [...current, {}]);
    setHoursDirty(true);
  };

  const removeOverride = (index: number) => {
    setOverrideRows((current) => current.filter((_, idx) => idx !== index));
    setOverrideErrors((current) => current.filter((_, idx) => idx !== index));
    setHoursDirty(true);
  };

  const handleServicePeriodChange = useCallback((index: number, patch: Partial<ServicePeriodRow>) => {
    setServicePeriodRows((current) => current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
    setServicePeriodsDirty(true);
    setServicePeriodErrors((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        name: undefined,
        startTime: undefined,
        endTime: undefined,
        bookingOption: undefined,
      };
      return next;
    });
  }, []);

  const addServicePeriod = () => {
    setServicePeriodRows((current) => [
      ...current,
      {
        name: 'New service',
        dayOfWeek: null,
        startTime: '17:00',
        endTime: '21:00',
        bookingOption: 'dinner',
      },
    ]);
    setServicePeriodErrors((current) => [...current, {}]);
    setServicePeriodsDirty(true);
  };

  const removeServicePeriod = (index: number) => {
    setServicePeriodRows((current) => current.filter((_, idx) => idx !== index));
    setServicePeriodErrors((current) => current.filter((_, idx) => idx !== index));
    setServicePeriodsDirty(true);
  };

  const handleDetailsChange = (patch: Partial<RestaurantDetailsForm>) => {
    setDetailsForm((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      setDetailsDirty(true);
      setDetailsErrors((prev) => {
        const updated = { ...prev };
        if (patch.name !== undefined && patch.name.trim()) delete updated.name;
        if (patch.timezone !== undefined && patch.timezone.trim()) delete updated.timezone;
        if (patch.capacity !== undefined && (patch.capacity === null || patch.capacity >= 0)) delete updated.capacity;
        if (patch.contactEmail !== undefined && (!patch.contactEmail || EMAIL_REGEX.test(patch.contactEmail))) delete updated.contactEmail;
        if (patch.contactPhone !== undefined && (!patch.contactPhone || patch.contactPhone.trim().length >= 5)) delete updated.contactPhone;
        return updated;
      });
      return next;
    });
  };

  const resetHours = () => {
    if (!hoursQuery.data) return;
    setWeeklyRows(mapWeekly(hoursQuery.data));
    setOverrideRows(mapOverrides(hoursQuery.data));
    setWeeklyErrors({});
    setOverrideErrors([]);
    setHoursDirty(false);
  };

  const resetServicePeriods = () => {
    if (!servicePeriodsQuery.data) return;
    setServicePeriodRows(mapServicePeriods(servicePeriodsQuery.data));
    setServicePeriodErrors([]);
    setServicePeriodsDirty(false);
  };

  const resetDetails = () => {
    if (!detailsQuery.data) return;
    setDetailsForm(mapDetails(detailsQuery.data));
    setDetailsErrors({});
    setDetailsDirty(false);
  };

  const validateOperatingHours = () => {
    let valid = true;
    const weeklyMap: WeeklyErrors = {};

    weeklyRows.forEach((row) => {
      if (row.isClosed) return;
      const rowError: { opensAt?: string; closesAt?: string } = {};
      if (!row.opensAt) rowError.opensAt = 'Required';
      if (!row.closesAt) rowError.closesAt = 'Required';
      if (!rowError.opensAt && !rowError.closesAt && row.opensAt >= row.closesAt) {
        rowError.closesAt = 'Must be after open';
      }
      if (Object.keys(rowError).length > 0) {
        weeklyMap[row.dayOfWeek] = rowError;
        valid = false;
      }
    });

    const overrideList: OverrideErrors = overrideRows.map(() => ({}));
    const seenDates = new Map<string, number>();

    overrideRows.forEach((row, index) => {
      const errors: { effectiveDate?: string; opensAt?: string; closesAt?: string } = {};
      if (!row.effectiveDate) {
        errors.effectiveDate = 'Required';
      } else if (seenDates.has(row.effectiveDate)) {
        const dupIndex = seenDates.get(row.effectiveDate)!;
        overrideList[dupIndex].effectiveDate = 'Duplicate date';
        errors.effectiveDate = 'Duplicate date';
      } else {
        seenDates.set(row.effectiveDate, index);
      }
      if (!row.isClosed) {
        if (!row.opensAt) errors.opensAt = 'Required';
        if (!row.closesAt) errors.closesAt = 'Required';
        if (!errors.opensAt && !errors.closesAt && row.opensAt >= row.closesAt) {
          errors.closesAt = 'Must be after open';
        }
      }
      overrideList[index] = { ...overrideList[index], ...errors };
      if (Object.keys(errors).length > 0) {
        valid = false;
      }
    });

    setWeeklyErrors(weeklyMap);
    setOverrideErrors(overrideList);
    return valid;
  };

  const validateServicePeriodsState = () => {
    let valid = true;
    const errors: ServicePeriodErrors = servicePeriodRows.map(() => ({}));

    const dayBuckets = new Map<number | null, Array<{ start: string; end: string; index: number }>>();

    servicePeriodRows.forEach((row, index) => {
      const trimmedName = row.name.trim();
      if (!trimmedName) {
        errors[index].name = 'Required';
        valid = false;
      }
      if (!row.bookingOption) {
        errors[index].bookingOption = 'Required';
        valid = false;
      }
      if (!row.startTime) {
        errors[index].startTime = 'Required';
        valid = false;
      }
      if (!row.endTime) {
        errors[index].endTime = 'Required';
        valid = false;
      }
      if (!errors[index].startTime && !errors[index].endTime && row.startTime >= row.endTime) {
        errors[index].endTime = 'Must be after start';
        valid = false;
      }
      const bucketKey = row.dayOfWeek ?? -1;
      const bucket = dayBuckets.get(bucketKey) ?? [];
      bucket.push({ start: row.startTime, end: row.endTime, index });
      dayBuckets.set(bucketKey, bucket);
    });

    dayBuckets.forEach((bucket) => {
      const sorted = bucket.slice().sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const current = sorted[i];
        if (prev.end > current.start) {
          errors[prev.index].endTime = 'Overlaps another period';
          errors[current.index].startTime = 'Overlaps another period';
          valid = false;
        }
      }
    });

    setServicePeriodErrors(errors);
    return valid;
  };

  const validateDetailsState = () => {
    if (!detailsForm) {
      toast.error('Restaurant details are still loading');
      return false;
    }

    const errors: RestaurantDetailsErrors = {};
    if (!detailsForm.name.trim()) errors.name = 'Name is required';
    if (!detailsForm.timezone.trim()) errors.timezone = 'Timezone is required';
    if (detailsForm.capacity !== null && detailsForm.capacity < 0) errors.capacity = 'Capacity must be positive';
    if (detailsForm.contactEmail && !EMAIL_REGEX.test(detailsForm.contactEmail)) errors.contactEmail = 'Invalid email';
    if (detailsForm.contactPhone && detailsForm.contactPhone.trim().length < 5) errors.contactPhone = 'Phone number looks too short';

    setDetailsErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveHours = async () => {
    if (!selectedRestaurantId) return;
    if (!validateOperatingHours()) {
      toast.error('Please resolve errors before saving hours.');
      return;
    }

    try {
      await updateHoursMutation.mutateAsync(buildHoursPayload(weeklyRows, overrideRows));
      setHoursDirty(false);
      toast.success('Operating hours updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update operating hours');
    }
  };

  const handleSaveServicePeriods = async () => {
    if (!selectedRestaurantId) return;
    if (!validateServicePeriodsState()) {
      toast.error('Please resolve service period errors before saving.');
      return;
    }

    try {
      await updateServicePeriodsMutation.mutateAsync(buildServicePeriodsPayload(servicePeriodRows));
      setServicePeriodsDirty(false);
      toast.success('Service periods updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update service periods');
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedRestaurantId || !detailsForm) return;
    if (!validateDetailsState()) {
      toast.error('Please fix the highlighted detail fields before saving.');
      return;
    }

    try {
      await updateDetailsMutation.mutateAsync(buildDetailsPayload(detailsForm));
      setDetailsDirty(false);
      toast.success('Restaurant details updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update restaurant details');
    }
  };

  if (membershipOptions.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant access</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ask an owner or admin to grant you access before managing settings.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Manage restaurant settings</h1>
            <p className="text-sm text-muted-foreground">Keep your restaurant’s hours, schedules, and contact details accurate.</p>
          </div>
        </div>
        <div className="w-full max-w-sm">
          <Label htmlFor="restaurant-selector">Restaurant</Label>
          <select
            id="restaurant-selector"
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            value={selectedRestaurantId ?? ''}
            onChange={(event) => setSelectedRestaurantId(event.target.value || null)}
          >
            {membershipOptions.map((membership) => (
              <option key={membership.restaurantId} value={membership.restaurantId}>
                {membership.restaurantName ?? 'Restaurant'} · {membership.role}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly hours</CardTitle>
            <CardDescription>Define your standard open and close times for each day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hoursQuery.error ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load operating hours</AlertTitle>
                <AlertDescription>{hoursQuery.error.message}</AlertDescription>
              </Alert>
            ) : hoursQuery.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <table className="min-w-full divide-y divide-border" role="grid">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Day</th>
                      <th className="px-4 py-3 text-left">Open</th>
                      <th className="px-4 py-3 text-left">Close</th>
                      <th className="px-4 py-3 text-left">Closed</th>
                      <th className="px-4 py-3 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70 text-sm">
                    {weeklyRows.map((row, index) => {
                      const dayLabel = DAYS[row.dayOfWeek];
                      const errors = weeklyErrors[row.dayOfWeek] ?? {};
                      return (
                        <tr key={row.dayOfWeek} className={cn(row.isClosed ? 'bg-muted/40' : undefined)}>
                          <th scope="row" className="px-4 py-3 font-medium text-foreground">
                            <div className="flex flex-col">
                              <span>{dayLabel}</span>
                              {row.notes ? <span className="text-xs text-muted-foreground">{row.notes}</span> : null}
                            </div>
                          </th>
                          <td className="px-4 py-3">
                            <Input
                              type="time"
                              value={row.opensAt}
                              disabled={hoursQuery.isLoading || updateHoursMutation.isPending || row.isClosed}
                              onChange={(event) => handleWeeklyChange(index, { opensAt: event.target.value })}
                              aria-invalid={Boolean(errors.opensAt)}
                              className={cn(errors.opensAt ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                            />
                            {errors.opensAt ? <p className="text-xs text-destructive">{errors.opensAt}</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="time"
                              value={row.closesAt}
                              disabled={hoursQuery.isLoading || updateHoursMutation.isPending || row.isClosed}
                              onChange={(event) => handleWeeklyChange(index, { closesAt: event.target.value })}
                              aria-invalid={Boolean(errors.closesAt)}
                              className={cn(errors.closesAt ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                            />
                            {errors.closesAt ? <p className="text-xs text-destructive">{errors.closesAt}</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                id={`weekly-${row.dayOfWeek}-closed`}
                                type="checkbox"
                                checked={row.isClosed}
                                onChange={(event) => handleWeeklyChange(index, {
                                  isClosed: event.target.checked,
                                  opensAt: event.target.checked ? '' : row.opensAt || '09:00',
                                  closesAt: event.target.checked ? '' : row.closesAt || '18:00',
                                })}
                                disabled={hoursQuery.isLoading || updateHoursMutation.isPending}
                                className="h-4 w-4"
                              />
                              <Label htmlFor={`weekly-${row.dayOfWeek}-closed`} className="text-sm">
                                Closed all day
                              </Label>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              value={row.notes}
                              placeholder="Optional notes"
                              disabled={hoursQuery.isLoading || updateHoursMutation.isPending}
                              onChange={(event) => handleWeeklyChange(index, { notes: event.target.value })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {hoursQuery.isLoading ? null : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Overrides & holidays</h3>
                  <Button type="button" size="sm" variant="outline" onClick={addOverride} disabled={isHoursDisabled}>
                    Add date override
                  </Button>
                </div>
                {overrideRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No overrides added yet.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <table className="min-w-full divide-y divide-border" role="grid">
                      <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Open</th>
                          <th className="px-4 py-3 text-left">Close</th>
                          <th className="px-4 py-3 text-left">Closed</th>
                          <th className="px-4 py-3 text-left">Notes</th>
                          <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70 text-sm">
                        {overrideRows.map((row, index) => {
                          const errors = overrideErrors[index] ?? {};
                          return (
                            <tr key={row.id ?? `override-${index}`} className={cn(row.isClosed ? 'bg-muted/40' : undefined)}>
                              <td className="px-4 py-3">
                                <Input
                                  type="date"
                                  value={row.effectiveDate}
                                  disabled={isHoursDisabled}
                                  onChange={(event) => handleOverrideChange(index, { effectiveDate: event.target.value })}
                                  aria-invalid={Boolean(errors.effectiveDate)}
                                  className={cn(errors.effectiveDate ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                                />
                                {errors.effectiveDate ? <p className="text-xs text-destructive">{errors.effectiveDate}</p> : null}
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="time"
                                  value={row.opensAt}
                                  disabled={isHoursDisabled || row.isClosed}
                                  onChange={(event) => handleOverrideChange(index, { opensAt: event.target.value })}
                                  aria-invalid={Boolean(errors.opensAt)}
                                  className={cn(errors.opensAt ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                                />
                                {errors.opensAt ? <p className="text-xs text-destructive">{errors.opensAt}</p> : null}
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="time"
                                  value={row.closesAt}
                                  disabled={isHoursDisabled || row.isClosed}
                                  onChange={(event) => handleOverrideChange(index, { closesAt: event.target.value })}
                                  aria-invalid={Boolean(errors.closesAt)}
                                  className={cn(errors.closesAt ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                                />
                                {errors.closesAt ? <p className="text-xs text-destructive">{errors.closesAt}</p> : null}
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  id={`override-${index}-closed`}
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={row.isClosed}
                                  disabled={isHoursDisabled}
                                  onChange={(event) => handleOverrideChange(index, {
                                    isClosed: event.target.checked,
                                    opensAt: event.target.checked ? '' : row.opensAt || '12:00',
                                    closesAt: event.target.checked ? '' : row.closesAt || '21:00',
                                  })}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  value={row.notes}
                                  placeholder="Optional notes"
                                  disabled={isHoursDisabled}
                                  onChange={(event) => handleOverrideChange(index, { notes: event.target.value })}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => removeOverride(index)}
                                  disabled={isHoursDisabled}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={resetHours} disabled={!hoursDirty || isHoursDisabled || !hoursQuery.data}>
              Reset changes
            </Button>
            <Button type="button" variant="secondary" onClick={handleSaveHours} disabled={!hoursDirty || isHoursDisabled}>
              {updateHoursMutation.isPending ? 'Saving…' : 'Save hours'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service periods</CardTitle>
            <CardDescription>Optional windows such as lunch, dinner, or happy hour.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {servicePeriodsError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load service periods</AlertTitle>
                <AlertDescription>{servicePeriodsError.message}</AlertDescription>
              </Alert>
            ) : servicePeriodsQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Leave service periods empty if you don’t have separate seatings.
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={addServicePeriod} disabled={isServicePeriodsDisabled}>
                    Add service period
                  </Button>
                </div>
                {servicePeriodRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No service periods configured.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <table className="min-w-full divide-y divide-border" role="grid">
                      <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-left">Day</th>
                          <th className="px-4 py-3 text-left">Booking option</th>
                          <th className="px-4 py-3 text-left">Start</th>
                          <th className="px-4 py-3 text-left">End</th>
                          <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70 text-sm">
                        {servicePeriodRows.map((row, index) => {
                          const errors = servicePeriodErrors[index] ?? {};
                          return (
                            <tr key={row.id ?? `period-${index}`}>
                              <td className="px-4 py-3">
                                <Input
                                  value={row.name}
                                  disabled={isServicePeriodsDisabled}
                                  onChange={(event) => handleServicePeriodChange(index, { name: event.target.value })}
                                  aria-invalid={Boolean(errors.name)}
                                  className={cn(errors.name ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                                />
                                {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                  value={row.dayOfWeek ?? ''}
                                  disabled={isServicePeriodsDisabled}
                                  onChange={(event) =>
                                    handleServicePeriodChange(index, {
                                      dayOfWeek: event.target.value === '' ? null : Number(event.target.value),
                                    })
                                  }
                                >
                                  {DAY_OPTIONS.map((option) => (
                                    <option key={option.label} value={option.value ?? ''}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  className={cn(
                                    'h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                                    errors.bookingOption ? 'border-destructive focus-visible:ring-destructive/60' : undefined,
                                  )}
                                  value={row.bookingOption}
                                  disabled={isServicePeriodsDisabled}
                                  onChange={(event) =>
                                    handleServicePeriodChange(index, {
                                      bookingOption: event.target.value as ServicePeriodRow['bookingOption'],
                                    })
                                  }
                                >
                                  {BOOKING_OPTION_CHOICES.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                {errors.bookingOption ? (
                                  <p className="text-xs text-destructive">{errors.bookingOption}</p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="time"
                                  value={row.startTime}
                                  disabled={isServicePeriodsDisabled}
                                  onChange={(event) => handleServicePeriodChange(index, { startTime: event.target.value })}
                                  aria-invalid={Boolean(errors.startTime)}
                                  className={cn(errors.startTime ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                                />
                                {errors.startTime ? <p className="text-xs text-destructive">{errors.startTime}</p> : null}
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="time"
                                  value={row.endTime}
                                  disabled={isServicePeriodsDisabled}
                                  onChange={(event) => handleServicePeriodChange(index, { endTime: event.target.value })}
                                  aria-invalid={Boolean(errors.endTime)}
                                  className={cn(errors.endTime ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                                />
                                {errors.endTime ? <p className="text-xs text-destructive">{errors.endTime}</p> : null}
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => removeServicePeriod(index)}
                                  disabled={isServicePeriodsDisabled}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={resetServicePeriods} disabled={!servicePeriodsDirty || isServicePeriodsDisabled || !servicePeriodsQuery.data}>
              Reset changes
            </Button>
            <Button type="button" variant="secondary" onClick={handleSaveServicePeriods} disabled={!servicePeriodsDirty || isServicePeriodsDisabled}>
              {updateServicePeriodsMutation.isPending ? 'Saving…' : 'Save service periods'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restaurant details</CardTitle>
            <CardDescription>Keep your business information up to date.</CardDescription>
          </CardHeader>
          <CardContent>
            {detailsError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load restaurant details</AlertTitle>
                <AlertDescription>{detailsError.message}</AlertDescription>
              </Alert>
            ) : !detailsForm || detailsQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="details-name">Restaurant name</Label>
                    <Input
                      id="details-name"
                      value={detailsForm.name}
                      disabled={isDetailsDisabled}
                      onChange={(event) => handleDetailsChange({ name: event.target.value })}
                      aria-invalid={Boolean(detailsErrors.name)}
                      className={cn(detailsErrors.name ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                    />
                    {detailsErrors.name ? <p className="text-xs text-destructive">{detailsErrors.name}</p> : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="details-timezone">Timezone</Label>
                    <Input
                      id="details-timezone"
                      value={detailsForm.timezone}
                      disabled={isDetailsDisabled}
                      placeholder="e.g. Europe/London"
                      onChange={(event) => handleDetailsChange({ timezone: event.target.value })}
                      aria-invalid={Boolean(detailsErrors.timezone)}
                      className={cn(detailsErrors.timezone ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                    />
                    {detailsErrors.timezone ? <p className="text-xs text-destructive">{detailsErrors.timezone}</p> : null}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="details-capacity">Capacity</Label>
                    <Input
                      id="details-capacity"
                      type="number"
                      min={0}
                      value={detailsForm.capacity ?? ''}
                      disabled={isDetailsDisabled}
                      onChange={(event) =>
                        handleDetailsChange({ capacity: event.target.value === '' ? null : Number(event.target.value) })
                      }
                      aria-invalid={Boolean(detailsErrors.capacity)}
                      className={cn(detailsErrors.capacity ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                    />
                    {detailsErrors.capacity ? <p className="text-xs text-destructive">{detailsErrors.capacity}</p> : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="details-phone">Contact phone</Label>
                    <Input
                      id="details-phone"
                      value={detailsForm.contactPhone ?? ''}
                      disabled={isDetailsDisabled}
                      placeholder="+1 234 567 890"
                      onChange={(event) => handleDetailsChange({ contactPhone: event.target.value })}
                      aria-invalid={Boolean(detailsErrors.contactPhone)}
                      className={cn(detailsErrors.contactPhone ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                    />
                    {detailsErrors.contactPhone ? <p className="text-xs text-destructive">{detailsErrors.contactPhone}</p> : null}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="details-email">Contact email</Label>
                  <Input
                    id="details-email"
                    type="email"
                    value={detailsForm.contactEmail ?? ''}
                    disabled={isDetailsDisabled}
                    placeholder="hello@example.com"
                    onChange={(event) => handleDetailsChange({ contactEmail: event.target.value })}
                    aria-invalid={Boolean(detailsErrors.contactEmail)}
                    className={cn(detailsErrors.contactEmail ? 'border-destructive focus-visible:ring-destructive/60' : undefined)}
                  />
                  {detailsErrors.contactEmail ? <p className="text-xs text-destructive">{detailsErrors.contactEmail}</p> : null}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={resetDetails} disabled={!detailsDirty || isDetailsDisabled || !detailsQuery.data}>
              Reset changes
            </Button>
            <Button type="button" variant="secondary" onClick={handleSaveDetails} disabled={!detailsDirty || isDetailsDisabled}>
              {updateDetailsMutation.isPending ? 'Saving…' : 'Save details'}
            </Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}
