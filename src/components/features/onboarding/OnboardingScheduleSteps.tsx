'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Heading, Text } from '@/components/ui/typography';
import { fetchJson } from '@/lib/http/fetchJson';

import { useOnboarding } from './context/OnboardingContext';
import {
  DEFAULT_BOOKING_OPTIONS,
  ONBOARDING_STEPS,
  servicePeriodsFormSchema,
  timeInputPlaceholder,
} from './onboardingWizardDomain';
import { OnboardingNavigation } from './ui/OnboardingNavigation';

import type { OperatingHour } from './types';
import type { z } from 'zod';

export function HoursStep({ onComplete }: { onComplete: () => void }) {
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
        totalSteps={ONBOARDING_STEPS.length}
        onBack={() => setStep(2)}
        onNext={save}
        busy={state.loading}
      />
    </div>
  );
}

export function ServicePeriodsStep({ onComplete }: { onComplete: () => void }) {
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
            <Heading variant="title" as="h3">
              Service windows
            </Heading>
            <Text variant="caption">Add lunch, dinner, or custom services.</Text>
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
          totalSteps={ONBOARDING_STEPS.length}
          onBack={() => setStep(3)}
          onNext={save}
          busy={state.loading}
        />
      </FormRoot>
    </Form>
  );
}
