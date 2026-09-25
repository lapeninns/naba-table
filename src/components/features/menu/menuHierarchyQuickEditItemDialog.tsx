'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';

import { useOptionalGbpDrift } from '@/components/features/restaurant-settings/gbp-drift/useGbpDrift';
import { SettingsDialog } from '@/components/features/restaurant-settings/shared/SettingsDialog';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { NONE_VALUE, primaryLabel } from './menuHierarchyDomain';
import { DialogFooterActions, Field, SwitchField } from './menuHierarchyFormControls';

import type {
  CanonicalRestaurantMenuItem,
  RestaurantMenuItemPatch,
} from '@/server/menu-hierarchy/types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export function QuickEditItemDialog({
  gbpDriftField,
  item,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  gbpDriftField: DualSyncFieldSummary | null;
  item: CanonicalRestaurantMenuItem | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (item: CanonicalRestaurantMenuItem, payload: RestaurantMenuItemPatch) => Promise<void>;
}) {
  const formId = useId();
  const gbpDrift = useOptionalGbpDrift();
  const registerDraftOverride = gbpDrift?.registerDraftOverride;
  const [price, setPrice] = useState('');
  const [currencyCode, setCurrencyCode] = useState('GBP');
  const [active, setActive] = useState(true);
  const [soldOut, setSoldOut] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState(NONE_VALUE);

  useEffect(() => {
    if (!item) return;
    setPrice(
      typeof item.attributes.price?.amount === 'number' ? String(item.attributes.price.amount) : '',
    );
    setCurrencyCode(item.attributes.price?.currencyCode ?? 'GBP');
    setActive(item.active);
    const policy = item.extensions.availabilityPolicy as Record<string, unknown> | undefined;
    setSoldOut(policy?.soldOut === true);
    setAvailabilityStatus(
      typeof policy?.availabilityStatus === 'string' ? policy.availabilityStatus : NONE_VALUE,
    );
  }, [item]);

  useEffect(() => {
    if (!open || !item || !gbpDriftField || !registerDraftOverride) return;
    const amount = price.trim() ? Number(price) : null;
    const baseValue =
      gbpDriftField.coreValue && typeof gbpDriftField.coreValue === 'object'
        ? gbpDriftField.coreValue
        : gbpDriftField.gbpValue && typeof gbpDriftField.gbpValue === 'object'
          ? gbpDriftField.gbpValue
          : {};
    registerDraftOverride(gbpDriftField.fieldKey, {
      ...baseValue,
      basePrice: Number.isFinite(amount) ? amount : null,
      currency: currencyCode.trim() || 'GBP',
    });
    return () => {
      registerDraftOverride(gbpDriftField.fieldKey, null);
    };
  }, [currencyCode, gbpDriftField, item, open, price, registerDraftOverride]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) return;
    const amount = price.trim() ? Number(price) : null;
    await onSubmit(item, {
      active,
      attributes: {
        ...item.attributes,
        price: {
          currencyCode: currencyCode.trim() || 'GBP',
          amount: Number.isFinite(amount) ? amount : null,
        },
      },
      extensions: {
        ...item.extensions,
        availabilityPolicy: {
          ...(item.extensions.availabilityPolicy ?? {}),
          availabilityStatus:
            availabilityStatus === NONE_VALUE
              ? null
              : (availabilityStatus as 'available' | 'unavailable' | 'seasonal'),
          soldOut,
        },
      },
    });
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      testId="menu-quick-edit-dialog"
      title="Quick edit item"
      description={
        item
          ? `Price, visibility and availability for ${primaryLabel(item, 'this item')}. Saves when you select Save quick edit.`
          : 'Price, visibility and availability. Saves when you select Save quick edit.'
      }
      footer={
        <DialogFooterActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending || !item}>
            {pending ? 'Saving…' : 'Save quick edit'}
          </Button>
        </DialogFooterActions>
      }
    >
      <FormRoot id={formId} className="flex flex-col gap-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
          <Field label="Currency">
            <Input value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)} />
          </Field>
          <Field label="Price">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Availability flag">
          <Select value={availabilityStatus} onValueChange={setAvailabilityStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Not set</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
              <SelectItem value="seasonal">Seasonal</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <SwitchField label="Shown on the menu" checked={active} onCheckedChange={setActive} />
          <SwitchField label="Sold out" checked={soldOut} onCheckedChange={setSoldOut} />
        </div>
      </FormRoot>
    </SettingsDialog>
  );
}
