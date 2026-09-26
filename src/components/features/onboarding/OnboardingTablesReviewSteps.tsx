'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

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
import { Heading, Text } from '@/components/ui/typography';
import { toUserMessage } from '@/lib/http/userMessage';
import { writeBrowserOpsRestaurantCookie } from '@/lib/ops/session';

import { useOnboarding } from './context/OnboardingContext';
import {
  toLayoutVariables,
  useCompleteOnboarding,
  useReplaceOnboardingLayout,
} from './hooks/useOnboardingMutations';
import {
  getMissingRequirements,
  navigateToOpsDashboard,
  REQUIREMENT_STEPS,
} from './onboardingLaunch';
import {
  ONBOARDING_STEPS,
  tablesFormSchema,
  type TablesFormValues,
} from './onboardingWizardDomain';
import { OnboardingNavigation } from './ui/OnboardingNavigation';

import type { OnboardingRequirement, OnboardingStep, TableInventoryItem, Zone } from './types';

const LAYOUT_ERROR_COPY = {
  ONBOARDING_LAYOUT_LOCKED:
    'This restaurant already has bookings, so change its tables from Tables in the dashboard.',
  ONBOARDING_LAYOUT_INVALID: 'Check that zone names and table numbers are unique.',
};

export function TablesStep({ onComplete }: { onComplete: () => void }) {
  const { state, setZones, setTables, setStep, setError } = useOnboarding();
  const replaceLayout = useReplaceOnboardingLayout();
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

  const save = tablesForm.handleSubmit((values) => {
    if (!state.restaurantId) {
      setError('Create your restaurant first');
      return;
    }
    setError(null);
    const draftTables: TableInventoryItem[] = values.tables.map(
      (table: TablesFormValues['tables'][number]) => ({
        tableNumber: table.tableNumber,
        capacity: Number(table.capacity),
        zoneId: table.zoneId ?? null,
      }),
    );
    // One idempotent PUT replaces zones and tables together, so Back/Next or a retry
    // never duplicates rows.
    replaceLayout.mutate(toLayoutVariables(state.restaurantId, zones, draftTables), {
      onSuccess: (layout) => {
        setZones(
          layout.zones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            sortOrder: zone.sortOrder,
            active: zone.active,
          })),
        );
        setTables(
          layout.tables.map((table) => ({
            id: table.id,
            tableNumber: table.tableNumber,
            capacity: table.capacity,
            zoneId: table.zoneId,
          })),
        );
        setStep(6);
        onComplete();
      },
      onError: (error) => {
        setError(
          toUserMessage(error, {
            copy: LAYOUT_ERROR_COPY,
            fallback: "We couldn't save your tables. Try again.",
          }),
        );
      },
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Heading variant="title" as="h3">
            Zones
          </Heading>
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
            busy={replaceLayout.isPending}
          />
        </FormRoot>
      </Form>
    </div>
  );
}

function MissingSetup({
  missing,
  onGoToStep,
}: {
  missing: OnboardingRequirement[];
  onGoToStep: (step: OnboardingStep) => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>A few things are left before you can launch</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1">
          {missing.map((requirement) => {
            const target = REQUIREMENT_STEPS[requirement];
            return (
              <li key={requirement}>
                <a
                  href={target.href}
                  className="font-medium underline underline-offset-4"
                  onClick={(event) => {
                    event.preventDefault();
                    onGoToStep(target.step);
                  }}
                >
                  {target.label}
                </a>
              </li>
            );
          })}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function ReviewStep() {
  const { state, setStep, setError, discardDraft } = useOnboarding();
  const completeOnboarding = useCompleteOnboarding();
  const [missing, setMissing] = useState<OnboardingRequirement[] | null>(null);
  const [launching, setLaunching] = useState(false);
  const summary = useMemo(
    () => [
      { label: 'Restaurant', value: state.profile.name || 'Not set' },
      { label: 'Timezone', value: state.profile.timezone },
      { label: 'Service periods', value: `${state.servicePeriods.length} configured` },
      { label: 'Tables', value: `${state.tables.length} added` },
    ],
    [state.profile.name, state.profile.timezone, state.servicePeriods.length, state.tables.length],
  );

  const complete = () => {
    const restaurantId = state.restaurantId;
    if (!restaurantId) {
      setError('Create your restaurant first');
      return;
    }
    setError(null);
    setMissing(null);
    completeOnboarding.mutate(
      { restaurantId },
      {
        onSuccess: () => {
          setLaunching(true);
          // Open the ops app on this restaurant and forget the wizard draft.
          writeBrowserOpsRestaurantCookie(restaurantId);
          discardDraft();
          navigateToOpsDashboard();
        },
        onError: (error) => {
          const missingRequirements = getMissingRequirements(error);
          if (missingRequirements && missingRequirements.length > 0) {
            setMissing(missingRequirements);
            return;
          }
          setError(
            toUserMessage(error, { fallback: "We couldn't launch your restaurant. Try again." }),
          );
        },
      },
    );
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

      {missing ? <MissingSetup missing={missing} onGoToStep={(step) => setStep(step)} /> : null}

      <OnboardingNavigation
        step={6}
        totalSteps={ONBOARDING_STEPS.length}
        onBack={() => setStep(5)}
        onSubmit={complete}
        busy={completeOnboarding.isPending || launching}
        nextLabel="Launch"
        backLabel="Back"
      />
    </div>
  );
}
