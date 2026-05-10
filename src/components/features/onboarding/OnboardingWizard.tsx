'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRoot,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { fetchJson } from '@/lib/http/fetchJson';

import { OnboardingProvider, useOnboarding } from './context/OnboardingContext';
import { OnboardingNavigation } from './ui/OnboardingNavigation';
import { OnboardingShell } from './ui/OnboardingShell';

import type { OnboardingState, OnboardingStep, OperatingHour, Zone } from './types';

const steps = [
  { id: 1 as OnboardingStep, title: 'Account', description: 'Create your owner login' },
  { id: 2 as OnboardingStep, title: 'Profile', description: 'Restaurant basics' },
  { id: 3 as OnboardingStep, title: 'Hours', description: 'Weekly opening times' },
  { id: 4 as OnboardingStep, title: 'Services', description: 'Define service periods' },
  { id: 5 as OnboardingStep, title: 'Tables', description: 'Zones and tables' },
  { id: 6 as OnboardingStep, title: 'Review', description: 'Confirm & launch' },
];

const STEP_PATHS: Record<OnboardingStep, string> = {
  1: '/onboarding',
  2: '/onboarding/profile',
  3: '/onboarding/hours',
  4: '/onboarding/services',
  5: '/onboarding/tables',
  6: '/onboarding/review',
};

function stepFromPathname(pathname: string | null): OnboardingStep {
  switch (pathname) {
    case '/onboarding/profile':
      return 2;
    case '/onboarding/hours':
      return 3;
    case '/onboarding/services':
      return 4;
    case '/onboarding/tables':
      return 5;
    case '/onboarding/review':
      return 6;
    case '/onboarding':
    default:
      return 1;
  }
}

function getMaxAccessibleStep(state: OnboardingState): OnboardingStep {
  if (!state.account) {
    return 1;
  }

  if (!state.restaurantId) {
    return 2;
  }

  return 6;
}

const accountSchema = z
  .object({
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
    mode: z.enum(['password', 'magic_link']),
    password: z.string().min(8, 'Use at least 8 characters').optional(),
  })
  .superRefine((values, ctx) => {
    if (values.mode === 'password' && !values.password) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password is required for password sign-up',
      });
    }
  });

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required'),
  slug: z.string().trim().min(1, 'Slug is required'),
  timezone: z.string().trim().min(1, 'Timezone is required'),
  contactEmail: z.union([z.string().email(), z.literal('')]).optional(),
  contactPhone: z.string().optional(),
  bookingPolicy: z.string().optional(),
});

const DEFAULT_BOOKING_OPTIONS = ['lunch', 'dinner'];

const servicePeriodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  startTime: z.string().min(1, 'Start time required'),
  endTime: z.string().min(1, 'End time required'),
  bookingOption: z.string().min(1, 'Select a booking option'),
});

const servicePeriodsFormSchema = z.object({
  servicePeriods: z.array(servicePeriodSchema),
});

const tableSchema = z.object({
  tableNumber: z.string().trim().min(1, 'Table number required'),
  capacity: z.coerce.number().int().min(1, 'Capacity required'),
  zoneId: z.string().nullish(),
});

const tablesFormSchema = z.object({
  tables: z.array(tableSchema),
});

type TablesFormValues = z.input<typeof tablesFormSchema>;

const timeInputPlaceholder = 'e.g. 17:00';

function AccountStep({ onComplete }: { onComplete: () => void }) {
  const { state, setAccount, setStep, setError, setLoading } = useOnboarding();
  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      email: state.account?.email ?? '',
      mode: state.account?.mode ?? 'magic_link',
      password: state.account?.password ?? '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      await fetchJson('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      track('user_signed_up', { method: values.mode });
      emit('user_signed_up', { method: values.mode });
      setAccount(values);
      setStep(2);
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create account';
      setError(message);
    } finally {
      setLoading(false);
    }
  });

  return (
    <Form {...form}>
      <FormRoot className="space-y-6" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="owner@restaurant.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sign-up method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="magic_link">Magic link</SelectItem>
                    <SelectItem value="password">Email & password</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {form.watch('mode') === 'password' && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <OnboardingNavigation
          step={1}
          totalSteps={steps.length}
          canGoBack={false}
          onNext={onSubmit}
          busy={state.loading}
          nextLabel="Continue"
        />
      </FormRoot>
    </Form>
  );
}

function ProfileStep({ onComplete }: { onComplete: () => void }) {
  const { state, setProfile, setRestaurantId, setStep, setError, setLoading } = useOnboarding();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: state.profile.name,
      slug: state.profile.slug,
      timezone: state.profile.timezone,
      contactEmail: state.profile.contactEmail ?? '',
      contactPhone: state.profile.contactPhone ?? '',
      bookingPolicy: state.profile.bookingPolicy ?? '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<{ restaurant: { id: string; name: string; slug: string } }>(
        '/api/onboarding/restaurant',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            slug: values.slug,
            timezone: values.timezone,
            contactEmail: values.contactEmail || null,
            contactPhone: values.contactPhone || null,
            bookingPolicy: values.bookingPolicy || null,
          }),
        },
      );
      setProfile({ ...state.profile, ...values });
      setRestaurantId(response.restaurant.id);
      setStep(3);
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save profile';
      setError(message);
    } finally {
      setLoading(false);
    }
  });

  return (
    <Form {...form}>
      <FormRoot className="space-y-6" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Restaurant name</FormLabel>
                <FormControl>
                  <Input placeholder="Nab a Table" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input placeholder="nabatbl" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {['Europe/London', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney'].map(
                      (tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact email</FormLabel>
                <FormControl>
                  <Input placeholder="reservations@restaurant.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact phone</FormLabel>
                <FormControl>
                  <Input placeholder="+44 20 1234 5678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bookingPolicy"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Booking policy</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="Optional notes shown to guests" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <OnboardingNavigation
          step={2}
          totalSteps={steps.length}
          onBack={() => setStep(1)}
          onNext={onSubmit}
          busy={state.loading}
        />
      </FormRoot>
    </Form>
  );
}

function HoursStep({ onComplete }: { onComplete: () => void }) {
  const { state, setOperatingHours, setStep, setError, setLoading } = useOnboarding();
  const [hours, setHours] = useState<OperatingHour[]>(state.operatingHours);

  const updateHour = (day: number, patch: Partial<OperatingHour>) => {
    setHours((current) =>
      current.map((row) => (row.dayOfWeek === day ? { ...row, ...patch } : row)),
    );
  };

  const save = async () => {
    if (!state.restaurantId) {
      setError('Create your restaurant first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetchJson(`/api/onboarding/restaurant/${state.restaurantId}/hours`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatingHours: hours }),
      });
      setOperatingHours(hours);
      setStep(4);
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save hours';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {hours.map((row) => (
          <Card key={row.dayOfWeek} className="border-border/70">
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Day {row.dayOfWeek}</div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`closed-${row.dayOfWeek}`} className="text-xs">
                    Closed
                  </Label>
                  <Switch
                    id={`closed-${row.dayOfWeek}`}
                    checked={row.isClosed}
                    onCheckedChange={(checked) => updateHour(row.dayOfWeek, { isClosed: checked })}
                  />
                </div>
              </div>
              {!row.isClosed && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Opens at</Label>
                    <Input
                      placeholder={timeInputPlaceholder}
                      value={row.opensAt ?? ''}
                      onChange={(event) =>
                        updateHour(row.dayOfWeek, { opensAt: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Closes at</Label>
                    <Input
                      placeholder={timeInputPlaceholder}
                      value={row.closesAt ?? ''}
                      onChange={(event) =>
                        updateHour(row.dayOfWeek, { closesAt: event.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs">Notes</Label>
                <Input
                  placeholder="Optional"
                  value={row.notes ?? ''}
                  onChange={(event) => updateHour(row.dayOfWeek, { notes: event.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <OnboardingNavigation
        step={3}
        totalSteps={steps.length}
        onBack={() => setStep(2)}
        onNext={save}
        busy={state.loading}
      />
    </div>
  );
}

function ServicePeriodsStep({ onComplete }: { onComplete: () => void }) {
  const { state, setServicePeriods, setStep, setError, setLoading } = useOnboarding();
  const form = useForm<z.infer<typeof servicePeriodsFormSchema>>({
    resolver: zodResolver(servicePeriodsFormSchema),
    defaultValues: { servicePeriods: state.servicePeriods.length ? state.servicePeriods : [] },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'servicePeriods',
  });

  const addPeriod = () =>
    append({
      name: 'Dinner Service',
      dayOfWeek: null,
      startTime: '17:00',
      endTime: '21:00',
      bookingOption: 'dinner',
    });

  const save = form.handleSubmit(async (values) => {
    if (!state.restaurantId) {
      setError('Create your restaurant first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetchJson(`/api/onboarding/restaurant/${state.restaurantId}/service-periods`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicePeriods: values.servicePeriods }),
      });
      setServicePeriods(values.servicePeriods);
      setStep(5);
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save service periods';
      setError(message);
    } finally {
      setLoading(false);
    }
  });

  return (
    <Form {...form}>
      <FormRoot className="space-y-4" onSubmit={save}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Service windows</h3>
            <p className="text-sm text-muted-foreground">Add lunch, dinner, or custom services.</p>
          </div>
          <Button type="button" variant="outline" onClick={addPeriod}>
            <Plus className="size-4" />
            Add period
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <Card key={field.id} className="border-border/70">
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Service {index + 1}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`servicePeriods.${index}.name` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`servicePeriods.${index}.bookingOption` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booking option</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value ?? DEFAULT_BOOKING_OPTIONS[0]}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DEFAULT_BOOKING_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`servicePeriods.${index}.dayOfWeek` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of week</FormLabel>
                        <Select
                          onValueChange={(val) =>
                            field.onChange(val === 'all' ? null : Number(val))
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="All days" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">All days</SelectItem>
                            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                              <SelectItem key={day} value={day.toString()}>
                                Day {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name={`servicePeriods.${index}.startTime` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start</FormLabel>
                          <FormControl>
                            <Input placeholder={timeInputPlaceholder} {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`servicePeriods.${index}.endTime` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End</FormLabel>
                          <FormControl>
                            <Input placeholder={timeInputPlaceholder} {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {fields.length === 0 && (
          <Alert>
            <AlertTitle>No service periods yet</AlertTitle>
            <AlertDescription>
              Start by adding lunch or dinner windows to open booking slots.
            </AlertDescription>
          </Alert>
        )}

        <OnboardingNavigation
          step={4}
          totalSteps={steps.length}
          onBack={() => setStep(3)}
          onNext={save}
          busy={state.loading}
        />
      </FormRoot>
    </Form>
  );
}

function TablesStep({ onComplete }: { onComplete: () => void }) {
  const { state, setZones, setTables, setStep, setError, setLoading } = useOnboarding();
  const [zones, updateZones] = useState<Zone[]>(
    state.zones.length ? state.zones : [{ name: 'Main Dining', areaType: 'indoor' }],
  );
  const tablesForm = useForm<TablesFormValues>({
    resolver: zodResolver(tablesFormSchema),
    defaultValues: {
      tables: state.tables.length ? state.tables : [{ tableNumber: 'T1', capacity: 2 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: tablesForm.control, name: 'tables' });

  const save = tablesForm.handleSubmit(async (values) => {
    if (!state.restaurantId) {
      setError('Create your restaurant first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const zonePayload = zones.map((zone, index) => ({
        name: zone.name,
        sortOrder: zone.sortOrder ?? index,
        active: zone.active ?? true,
      }));
      const zoneResponse = await fetchJson<{ zones: Array<{ id: string; name: string }> }>(
        `/api/onboarding/restaurant/${state.restaurantId}/zones`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zones: zonePayload }),
        },
      );
      setZones(zoneResponse.zones);

      const tablesPayload = values.tables.map((table: TablesFormValues['tables'][number]) => ({
        tableNumber: table.tableNumber,
        capacity: Number(table.capacity),
        zoneId: table.zoneId ?? zoneResponse.zones[0]?.id,
      }));
      const tableResponse = await fetchJson<{ tables: Array<{ id: string }> }>(
        `/api/onboarding/restaurant/${state.restaurantId}/tables`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tables: tablesPayload }),
        },
      );
      setTables(
        values.tables.map((table: TablesFormValues['tables'][number], index: number) => ({
          ...table,
          capacity: Number(table.capacity),
          id: tableResponse.tables[index]?.id,
        })),
      );
      setStep(6);
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save tables';
      setError(message);
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Zones</h3>
          <p className="text-sm text-muted-foreground">Group tables by dining areas.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            updateZones((current) => [...current, { name: `Zone ${current.length + 1}` }])
          }
        >
          Add zone
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {zones.map((zone, index) => (
          <Badge key={`${zone.name}-${index}`} variant="secondary" className="text-sm">
            {zone.name}
          </Badge>
        ))}
      </div>

      <Form {...tablesForm}>
        <FormRoot className="space-y-3" onSubmit={save}>
          {fields.map((field, index) => (
            <Card key={field.id} className="border-border/70">
              <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
                <FormField
                  control={tablesForm.control}
                  name={`tables.${index}.tableNumber` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Table</FormLabel>
                      <FormControl>
                        <Input placeholder="T1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={tablesForm.control}
                  name={`tables.${index}.capacity` as const}
                  render={({ field }) => {
                    const value =
                      typeof field.value === 'number' || typeof field.value === 'string'
                        ? field.value
                        : '';
                    return (
                      <FormItem>
                        <FormLabel>Capacity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            name={field.name}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            value={value}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              field.onChange(nextValue === '' ? '' : Number(nextValue));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label="Remove table"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => append({ tableNumber: `T${fields.length + 1}`, capacity: 2 })}
          >
            <Plus className="size-4" />
            Add table
          </Button>

          <OnboardingNavigation
            step={5}
            totalSteps={steps.length}
            onBack={() => setStep(4)}
            onNext={save}
            busy={state.loading}
          />
        </FormRoot>
      </Form>
    </div>
  );
}

function ReviewStep() {
  const { state, setStep, setError, setLoading } = useOnboarding();
  const summary = useMemo(
    () => [
      { label: 'Restaurant', value: state.profile.name || 'Not set' },
      { label: 'Timezone', value: state.profile.timezone },
      { label: 'Service periods', value: `${state.servicePeriods.length} configured` },
      { label: 'Tables', value: `${state.tables.length} added` },
    ],
    [state.profile.name, state.profile.timezone, state.servicePeriods.length, state.tables.length],
  );

  const complete = async () => {
    if (!state.restaurantId) {
      setError('Create your restaurant first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetchJson(`/api/onboarding/restaurant/${state.restaurantId}/complete`, {
        method: 'POST',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to finish onboarding';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {summary.map((item) => (
          <Card key={item.label} className="border-border/70">
            <CardContent className="space-y-1 pt-4">
              <div className="text-sm text-muted-foreground">{item.label}</div>
              <div className="text-lg font-semibold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <OnboardingNavigation
        step={6}
        totalSteps={steps.length}
        onBack={() => setStep(5)}
        onSubmit={complete}
        busy={state.loading}
        nextLabel="Launch"
        backLabel="Back"
      />
    </div>
  );
}

function StepError() {
  const { state } = useOnboarding();
  if (!state.error) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

function OnboardingContent() {
  const { state, setStep } = useOnboarding();
  const pathname = usePathname();
  const router = useRouter();
  const requestedStep = stepFromPathname(pathname);
  const maxAccessibleStep = getMaxAccessibleStep(state);
  const lastHandledPathRef = useRef<string | null>(null);

  const noop = () => {};

  useEffect(() => {
    if (lastHandledPathRef.current === pathname) {
      return;
    }
    lastHandledPathRef.current = pathname;
    const nextStep = requestedStep > maxAccessibleStep ? maxAccessibleStep : requestedStep;
    if (state.step !== nextStep) {
      setStep(nextStep);
    }
  }, [maxAccessibleStep, pathname, requestedStep, setStep, state.step]);

  useEffect(() => {
    const expectedPath = STEP_PATHS[state.step];
    if (pathname !== expectedPath) {
      router.replace(expectedPath);
    }
  }, [pathname, router, state.step]);

  return (
    <OnboardingShell steps={steps} current={state.step} title="Launch your restaurant in minutes">
      <StepError />
      {state.step === 1 && <AccountStep onComplete={noop} />}
      {state.step === 2 && <ProfileStep onComplete={noop} />}
      {state.step === 3 && <HoursStep onComplete={noop} />}
      {state.step === 4 && <ServicePeriodsStep onComplete={noop} />}
      {state.step === 5 && <TablesStep onComplete={noop} />}
      {state.step === 6 && <ReviewStep />}
    </OnboardingShell>
  );
}

export function OnboardingWizard({ initialState }: { initialState?: Partial<OnboardingState> }) {
  return (
    <OnboardingProvider initialState={initialState}>
      <OnboardingContent />
    </OnboardingProvider>
  );
}
