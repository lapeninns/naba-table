'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { WeeklyHoursForm, type WeeklyHourFormValue } from '@/components/owner/hours/WeeklyHoursForm';
import { OverridesTable, type OverrideFormValue } from '@/components/owner/hours/OverridesTable';
import { ServicePeriodsForm, type ServicePeriodFormValue } from '@/components/owner/hours/ServicePeriodsForm';
import { RestaurantDetailsForm, type RestaurantDetailsFormValue } from '@/components/owner/details/RestaurantDetailsForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOperatingHours,
  useUpdateOperatingHours,
  type OperatingHoursResponse,
  type UpdateOperatingHoursInput,
} from '@/hooks/owner/useOperatingHours';
import {
  useServicePeriods,
  useUpdateServicePeriods,
  type ServicePeriod,
  type UpdateServicePeriodInput,
} from '@/hooks/owner/useServicePeriods';
import {
  useRestaurantDetails,
  useUpdateRestaurantDetails,
  type RestaurantDetails,
  type UpdateRestaurantDetailsInput,
} from '@/hooks/owner/useRestaurantDetails';

export type RestaurantMembershipOption = {
  restaurantId: string;
  restaurantName: string | null;
  role: string;
};

export type ManageRestaurantClientProps = {
  memberships: RestaurantMembershipOption[];
  defaultRestaurantId: string | null;
};

const HOURS_EMPTY_STATE: WeeklyHourFormValue[] = Array.from({ length: 7 }).map((_, index) => ({
  dayOfWeek: index,
  opensAt: '',
  closesAt: '',
  isClosed: true,
  notes: '',
}));

function mapWeeklyHours(weekly: OperatingHoursResponse['weekly']): WeeklyHourFormValue[] {
  return weekly.map((entry) => ({
    dayOfWeek: entry.dayOfWeek,
    opensAt: entry.opensAt ?? '',
    closesAt: entry.closesAt ?? '',
    isClosed: entry.isClosed,
    notes: entry.notes ?? '',
  }));
}

function mapOverrides(overrides: OperatingHoursResponse['overrides']): OverrideFormValue[] {
  return overrides.map((entry) => ({
    id: entry.id,
    effectiveDate: entry.effectiveDate,
    isClosed: entry.isClosed,
    opensAt: entry.opensAt ?? '',
    closesAt: entry.closesAt ?? '',
    notes: entry.notes ?? '',
  }));
}

function mapServicePeriods(periods: ServicePeriod[]): ServicePeriodFormValue[] {
  return periods.map((period) => ({
    id: period.id,
    name: period.name,
    dayOfWeek: period.dayOfWeek,
    startTime: period.startTime,
    endTime: period.endTime,
  }));
}

function mapRestaurantDetails(details: RestaurantDetails): RestaurantDetailsFormValue {
  return {
    name: details.name,
    timezone: details.timezone,
    capacity: details.capacity,
    contactEmail: details.contactEmail,
    contactPhone: details.contactPhone,
  };
}

function buildHoursPayload(weekly: WeeklyHourFormValue[], overrides: OverrideFormValue[]): UpdateOperatingHoursInput {
  return {
    weekly: weekly.map((entry) => ({
      dayOfWeek: entry.dayOfWeek,
      opensAt: entry.opensAt || null,
      closesAt: entry.closesAt || null,
      isClosed: entry.isClosed,
      notes: entry.notes || null,
    })),
    overrides: overrides.map((entry) => ({
      id: entry.id,
      effectiveDate: entry.effectiveDate,
      opensAt: entry.opensAt || null,
      closesAt: entry.closesAt || null,
      isClosed: entry.isClosed,
      notes: entry.notes || null,
    })),
  };
}

function buildServicePeriodsPayload(periods: ServicePeriodFormValue[]): UpdateServicePeriodInput[] {
  return periods.map((period) => ({
    id: period.id,
    name: period.name,
    dayOfWeek: period.dayOfWeek,
    startTime: period.startTime,
    endTime: period.endTime,
  }));
}

function buildDetailsPayload(details: RestaurantDetailsFormValue): UpdateRestaurantDetailsInput {
  return {
    name: details.name,
    timezone: details.timezone,
    capacity: details.capacity ?? null,
    contactEmail: details.contactEmail ?? null,
    contactPhone: details.contactPhone ?? null,
  };
}

export function ManageRestaurantClient({ memberships, defaultRestaurantId }: ManageRestaurantClientProps) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(defaultRestaurantId);

  const [weeklyState, setWeeklyState] = useState<WeeklyHourFormValue[]>(HOURS_EMPTY_STATE);
  const [overridesState, setOverridesState] = useState<OverrideFormValue[]>([]);
  const [servicePeriodsState, setServicePeriodsState] = useState<ServicePeriodFormValue[]>([]);
  const [detailsState, setDetailsState] = useState<RestaurantDetailsFormValue | null>(null);

  const [hoursDirty, setHoursDirty] = useState(false);
  const [periodsDirty, setPeriodsDirty] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);

  const hoursQuery = useOperatingHours(selectedRestaurantId);
  const updateHours = useUpdateOperatingHours(selectedRestaurantId);

  const servicePeriodsQuery = useServicePeriods(selectedRestaurantId);
  const updateServicePeriodsMutation = useUpdateServicePeriods(selectedRestaurantId);

  const detailsQuery = useRestaurantDetails(selectedRestaurantId);
  const updateDetailsMutation = useUpdateRestaurantDetails(selectedRestaurantId);

  // Seed local state when data loads
  useEffect(() => {
    if (hoursQuery.data) {
      setWeeklyState(mapWeeklyHours(hoursQuery.data.weekly));
      setOverridesState(mapOverrides(hoursQuery.data.overrides));
      setHoursDirty(false);
    }
  }, [hoursQuery.data]);

  useEffect(() => {
    if (servicePeriodsQuery.data) {
      setServicePeriodsState(mapServicePeriods(servicePeriodsQuery.data));
      setPeriodsDirty(false);
    }
  }, [servicePeriodsQuery.data]);

  useEffect(() => {
    if (detailsQuery.data) {
      setDetailsState(mapRestaurantDetails(detailsQuery.data));
      setDetailsDirty(false);
    }
  }, [detailsQuery.data]);

  // Reset local state when restaurant switches before new data arrives
  useEffect(() => {
    setWeeklyState(HOURS_EMPTY_STATE);
    setOverridesState([]);
    setServicePeriodsState([]);
    setDetailsState(null);
    setHoursDirty(false);
    setPeriodsDirty(false);
    setDetailsDirty(false);
  }, [selectedRestaurantId]);

  const isHoursSaving = updateHours.isPending;
  const isPeriodsSaving = updateServicePeriodsMutation.isPending;
  const isDetailsSaving = updateDetailsMutation.isPending;

  const isHoursDisabled = isHoursSaving || hoursQuery.isLoading || hoursQuery.isFetching;
  const isPeriodsDisabled = isPeriodsSaving || servicePeriodsQuery.isLoading || servicePeriodsQuery.isFetching;
  const isDetailsDisabled = isDetailsSaving || detailsQuery.isLoading || detailsQuery.isFetching;

  const hoursError = hoursQuery.error ?? updateHours.error;
  const servicePeriodsError = servicePeriodsQuery.error ?? updateServicePeriodsMutation.error;
  const detailsError = detailsQuery.error ?? updateDetailsMutation.error;

  const currentTimezone = hoursQuery.data?.timezone ?? detailsQuery.data?.timezone ?? 'Local time';

  const hasPendingChanges = hoursDirty || periodsDirty || detailsDirty;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    if (hasPendingChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasPendingChanges]);

  const handleSaveHours = async () => {
    if (!selectedRestaurantId) return;
    try {
      await updateHours.mutateAsync(buildHoursPayload(weeklyState, overridesState));
      setHoursDirty(false);
      toast.success('Operating hours updated');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Unable to update operating hours');
      }
    }
  };

  const handleSaveServicePeriods = async () => {
    if (!selectedRestaurantId) return;
    try {
      await updateServicePeriodsMutation.mutateAsync(buildServicePeriodsPayload(servicePeriodsState));
      setPeriodsDirty(false);
      toast.success('Service periods updated');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Unable to update service periods');
      }
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedRestaurantId || !detailsState) return;
    try {
      await updateDetailsMutation.mutateAsync(buildDetailsPayload(detailsState));
      setDetailsDirty(false);
      toast.success('Restaurant details updated');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Unable to update restaurant details');
      }
    }
  };

  const membershipsOptions = useMemo(() => memberships, [memberships]);

  if (membershipsOptions.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant access</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an owner or admin to invite you to a restaurant team to manage settings.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Manage restaurant settings</h1>
            <p className="text-sm text-muted-foreground">
              Review operating hours, service periods, and contact information for your venue.
            </p>
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
            {membershipsOptions.map((membership) => (
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
            <CardDescription>Set your default open and close times for each day of the week.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hoursError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load operating hours</AlertTitle>
                <AlertDescription>{hoursError.message}</AlertDescription>
              </Alert>
            ) : hoursQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <WeeklyHoursForm
                timezone={currentTimezone}
                value={weeklyState}
                onChange={(next) => {
                  setWeeklyState(next);
                  setHoursDirty(true);
                }}
                disabled={isHoursDisabled}
              />
            )}
            {hoursQuery.isLoading ? null : (
              <OverridesTable
                value={overridesState}
                onChange={(next) => {
                  setOverridesState(next);
                  setHoursDirty(true);
                }}
                disabled={isHoursDisabled}
              />
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveHours}
              disabled={!hoursDirty || isHoursDisabled}
              className="touch-manipulation"
            >
              {isHoursSaving ? 'Saving…' : 'Save hours'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service periods</CardTitle>
            <CardDescription>Optionally define lunch, dinner, or other service windows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {servicePeriodsError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load service periods</AlertTitle>
                <AlertDescription>{servicePeriodsError.message}</AlertDescription>
              </Alert>
            ) : servicePeriodsQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ServicePeriodsForm
                value={servicePeriodsState}
                onChange={(next) => {
                  setServicePeriodsState(next);
                  setPeriodsDirty(true);
                }}
                disabled={isPeriodsDisabled}
              />
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveServicePeriods}
              disabled={!periodsDirty || isPeriodsDisabled}
              className="touch-manipulation"
            >
              {isPeriodsSaving ? 'Saving…' : 'Save service periods'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restaurant details</CardTitle>
            <CardDescription>Keep contact information and timezone up to date.</CardDescription>
          </CardHeader>
          <CardContent>
            {detailsError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load restaurant details</AlertTitle>
                <AlertDescription>{detailsError.message}</AlertDescription>
              </Alert>
            ) : !detailsState || detailsQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <RestaurantDetailsForm
                value={detailsState}
                onChange={(next) => {
                  setDetailsState(next);
                  setDetailsDirty(true);
                }}
                onSubmit={handleSaveDetails}
                disabled={isDetailsDisabled}
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
