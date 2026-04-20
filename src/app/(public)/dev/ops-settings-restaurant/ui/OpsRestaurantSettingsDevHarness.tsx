'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { RestaurantSettingsPageShell } from '@/components/features/restaurant-settings/RestaurantSettingsPageShell';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OpsUnsavedChangesProvider } from '@/contexts/ops-unsaved-changes';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

import type { RestaurantSettingsView } from '@/components/features/restaurant-settings/types';

const VIEW_OPTIONS: Array<{ value: RestaurantSettingsView; label: string }> = [
  { value: 'profile', label: 'Profile' },
  { value: 'google-business-profile', label: 'Google Business Profile' },
  { value: 'availability', label: 'Availability & occasions' },
  { value: 'team', label: 'Team' },
];

export function OpsRestaurantSettingsDevHarness() {
  const searchParams = useSearchParams();
  const factories = useMemo(() => createOpsDevServiceFactories(), []);
  const requestedView = searchParams.get('view');
  const initialView = VIEW_OPTIONS.some((option) => option.value === requestedView)
    ? (requestedView as RestaurantSettingsView)
    : 'profile';
  const [view, setView] = useState<RestaurantSettingsView>(initialView);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <OpsUnsavedChangesProvider>
        <RestaurantSettingsPageShell
          title="Restaurant"
          description="Dev harness for the restaurant settings shell, subnav, and sections."
          eyebrow="Dev"
        >
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              View selector is local to this harness; the left subnav is rendered for responsive
              layout verification but links to authenticated routes.
            </p>
            <div className="w-full space-y-2 sm:w-[260px]">
              <Label htmlFor="ops-restaurant-settings-view" className="sr-only">
                Select a restaurant settings view
              </Label>
              <Select value={view} onValueChange={(next) => setView(next as RestaurantSettingsView)}>
                <SelectTrigger id="ops-restaurant-settings-view" className="h-11 sm:h-9">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <OpsRestaurantSettingsClient defaultRestaurantId={DEV_RESTAURANT_ID} view={view} />
        </RestaurantSettingsPageShell>
      </OpsUnsavedChangesProvider>
    </OpsDevProviders>
  );
}
