'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

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
import { Heading, Text } from '@/components/ui/typography';
import { fetchJson } from '@/lib/http/fetchJson';

import { useOnboarding } from './context/OnboardingContext';
import {
  ONBOARDING_STEPS,
  tablesFormSchema,
  type TablesFormValues,
} from './onboardingWizardDomain';
import { OnboardingNavigation } from './ui/OnboardingNavigation';

import type { Zone } from './types';

export function TablesStep({ onComplete }: { onComplete: () => void }) {
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
          <Heading variant="title" as="h3">Zones</Heading>
          <Text variant="caption">Group tables by dining areas.</Text>
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
            totalSteps={ONBOARDING_STEPS.length}
            onBack={() => setStep(4)}
            onNext={save}
            busy={state.loading}
          />
        </FormRoot>
      </Form>
    </div>
  );
}

export function ReviewStep() {
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
        totalSteps={ONBOARDING_STEPS.length}
        onBack={() => setStep(5)}
        onSubmit={complete}
        busy={state.loading}
        nextLabel="Launch"
        backLabel="Back"
      />
    </div>
  );
}
