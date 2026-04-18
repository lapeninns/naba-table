'use client';

import { PencilLine, RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { GoogleBusinessProfilePanel } from '@/components/features/restaurant-settings/GoogleBusinessProfilePanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsUpdateRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';

import type { RestaurantProfile } from '@/services/ops/restaurants';

type GoogleBusinessProfileProfileCrudPanelProps = {
  restaurantId: string;
  profile: RestaurantProfile | null | undefined;
  isLoading?: boolean;
  errorMessage?: string | null;
};

type ProfileFormState = {
  name: string;
  contactPhone: string;
  address: string;
  googleMapUrl: string;
  googleReviewUrl: string;
};

function buildFormState(profile: RestaurantProfile | null | undefined): ProfileFormState {
  return {
    name: profile?.name ?? '',
    contactPhone: profile?.contactPhone ?? '',
    address: profile?.address ?? '',
    googleMapUrl: profile?.googleMapUrl ?? '',
    googleReviewUrl: profile?.googleReviewUrl ?? '',
  };
}

function normalizeNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function GoogleBusinessProfileProfileCrudPanel({
  restaurantId,
  profile,
  isLoading = false,
  errorMessage,
}: GoogleBusinessProfileProfileCrudPanelProps) {
  const updateMutation = useOpsUpdateRestaurantDetails(restaurantId);
  const [form, setForm] = useState<ProfileFormState>(() => buildFormState(profile));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(profile));
    setLocalError(null);
  }, [profile]);

  const initialForm = useMemo(() => buildFormState(profile), [profile]);
  const isDirty =
    form.name !== initialForm.name ||
    form.contactPhone !== initialForm.contactPhone ||
    form.address !== initialForm.address ||
    form.googleMapUrl !== initialForm.googleMapUrl ||
    form.googleReviewUrl !== initialForm.googleReviewUrl;

  const handleChange =
    (field: keyof ProfileFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
      setLocalError(null);
    };

  const handleReset = () => {
    setForm(initialForm);
    setLocalError(null);
  };

  const handleSubmit = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setLocalError('Business name is required.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        name: trimmedName,
        contactPhone: normalizeNullableString(form.contactPhone),
        address: normalizeNullableString(form.address),
        googleMapUrl: normalizeNullableString(form.googleMapUrl),
        googleReviewUrl: normalizeNullableString(form.googleReviewUrl),
      });
      toast.success('Core profile updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update the profile.';
      setLocalError(message);
      toast.error(message);
    }
  };

  if (isLoading && !profile) {
    return (
      <GoogleBusinessProfilePanel
        title="Core profile editor"
        description="Edit the canonical Nabatable profile fields that GBP compares against."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full md:col-span-2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </GoogleBusinessProfilePanel>
    );
  }

  return (
    <GoogleBusinessProfilePanel
      title="Core profile editor"
      description="Create, update, or clear the Nabatable-owned profile fields that this GBP workspace reconciles."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={!isDirty || updateMutation.isPending}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={!isDirty || updateMutation.isPending}>
            <Save className="size-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      }
      contentClassName="space-y-5"
    >
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <PencilLine className="size-4 text-muted-foreground" />
          Blank optional fields are cleared from Nabatable when you save
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          This edits Nabatable&apos;s canonical profile directly. Use the GBP sync controls above to
          import from or push supported fields to Google afterward.
        </p>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load the current profile</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {localError ? (
        <Alert variant="destructive">
          <AlertTitle>Profile update failed</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gbp-core-name">Business name</Label>
          <Input
            id="gbp-core-name"
            value={form.name}
            onChange={handleChange('name')}
            placeholder="Restaurant name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gbp-core-phone">Phone</Label>
          <Input
            id="gbp-core-phone"
            value={form.contactPhone}
            onChange={handleChange('contactPhone')}
            placeholder="+44 20 7946 0000"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="gbp-core-address">Address</Label>
          <Input
            id="gbp-core-address"
            value={form.address}
            onChange={handleChange('address')}
            placeholder="123 Main Street, London"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gbp-core-maps">Google Maps URL</Label>
          <Input
            id="gbp-core-maps"
            type="url"
            value={form.googleMapUrl}
            onChange={handleChange('googleMapUrl')}
            placeholder="https://maps.google.com/..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gbp-core-reviews">Google review URL</Label>
          <Input
            id="gbp-core-reviews"
            type="url"
            value={form.googleReviewUrl}
            onChange={handleChange('googleReviewUrl')}
            placeholder="https://search.google.com/local/writereview?..."
          />
        </div>
      </div>
    </GoogleBusinessProfilePanel>
  );
}
