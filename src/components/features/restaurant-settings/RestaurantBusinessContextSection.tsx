'use client';

import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useOpsRestaurantBusinessContext,
  useOpsUpdateRestaurantBusinessContext,
} from '@/hooks/ops/useOpsRestaurantBusinessContext';

import { SettingsCard } from './shared/SettingsCard';

import type {
  RestaurantBusinessContextAttribute,
  RestaurantBusinessContextCategory,
  RestaurantBusinessContextServiceArea,
  RestaurantBusinessContextServiceItem,
} from '@/services/ops/restaurants';

type RestaurantBusinessContextSectionProps = {
  restaurantId: string | null;
  embedded?: boolean;
};

type FamilyKey = 'categories' | 'serviceAreas' | 'attributes' | 'serviceItems';
type SeedSource = Record<FamilyKey, 'core' | 'provider' | 'empty'>;
type DirtyState = Record<FamilyKey, boolean>;
type ErrorState = Partial<Record<FamilyKey, string | null>>;

type CategoryEditor = {
  id: string;
  displayName: string;
  categoryCode: string;
  isPrimary: boolean;
  moreHoursTypesJson: string;
};

type ServiceAreaEditor = {
  id: string;
  displayName: string;
  areaType: string;
  regionCode: string;
  placeDataJson: string;
};

type AttributeEditor = {
  id: string;
  attributeGroup: string;
  attributeKey: string;
  attributeName: string;
  attributeId: string;
  displayName: string;
  displayText: string;
  displayTextStandalone: string;
  displayTextNegative: string;
  valueType: string;
  boolValue: 'unset' | 'true' | 'false';
  textValue: string;
  uriValue: string;
  uriValuesText: string;
  enumValuesText: string;
  unsetEnumValuesText: string;
  valueMetadataJson: string;
};

type ServiceItemEditor = {
  id: string;
  itemKey: string;
  itemType: string;
  displayName: string;
  description: string;
  payloadJson: string;
};

const TAB_LABELS: Record<FamilyKey, string> = {
  categories: 'Categories',
  serviceAreas: 'Service Areas',
  attributes: 'Attributes',
  serviceItems: 'Service Items',
};

const SYNC_POSTURE: Record<FamilyKey, string> = {
  categories: 'Core-owned CRUD today. Upstream GBP push remains follow-on work.',
  serviceAreas: 'Core-owned CRUD today. Keep GBP verification on the dedicated snapshot page.',
  attributes: 'Core-owned CRUD today. Provider attributes remain readable on the GBP page.',
  serviceItems: 'Core-owned CRUD today. Stored in canonical tables for future sync-aware flows.',
};

function makeEditorId(prefix: string): string {
  const native = globalThis.crypto?.randomUUID?.();
  return native ? `${prefix}-${native}` : `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeFieldId(family: FamilyKey, rowId: string, field: string): string {
  return `${family}-${rowId}-${field}`;
}

function formatSeedSource(value: SeedSource[FamilyKey], providerCount: number): string {
  if (value === 'core') {
    return 'Editing Nabatable-owned rows';
  }
  if (value === 'provider' && providerCount > 0) {
    return 'Prefilled from the latest GBP snapshot until you save';
  }
  return 'No existing rows yet';
}

function toPrettyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value) && value.length === 0) {
    return '';
  }
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  ) {
    return '';
  }
  return JSON.stringify(value, null, 2);
}

function csvToArray(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonRecord(value: string, label: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON object syntax.`);
  }
}

function parseJsonArray<T>(value: string, label: string): T[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as T[];
  } catch {
    throw new Error(`${label} must be valid JSON array syntax.`);
  }
}

function cloneFamily<T>(core: T[], provider: T[]): { rows: T[]; source: SeedSource[FamilyKey] } {
  if (core.length > 0) {
    return { rows: core, source: 'core' };
  }
  if (provider.length > 0) {
    return { rows: provider, source: 'provider' };
  }
  return { rows: [], source: 'empty' };
}

function toCategoryEditors(input: RestaurantBusinessContextCategory[]): CategoryEditor[] {
  return input.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    categoryCode: row.categoryCode ?? '',
    isPrimary: row.isPrimary,
    moreHoursTypesJson: toPrettyJson(row.moreHoursTypes),
  }));
}

function toServiceAreaEditors(input: RestaurantBusinessContextServiceArea[]): ServiceAreaEditor[] {
  return input.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    areaType: row.areaType,
    regionCode: row.regionCode ?? '',
    placeDataJson: toPrettyJson(row.placeData),
  }));
}

function toAttributeEditors(input: RestaurantBusinessContextAttribute[]): AttributeEditor[] {
  return input.map((row) => ({
    id: row.id,
    attributeGroup: row.attributeGroup ?? '',
    attributeKey: row.attributeKey,
    attributeName: row.attributeName ?? '',
    attributeId: row.attributeId ?? '',
    displayName: row.displayName ?? '',
    displayText: row.displayText ?? '',
    displayTextStandalone: row.displayTextStandalone ?? '',
    displayTextNegative: row.displayTextNegative ?? '',
    valueType: row.valueType,
    boolValue: row.boolValue === true ? 'true' : row.boolValue === false ? 'false' : 'unset',
    textValue: row.textValue ?? '',
    uriValue: row.uriValue ?? '',
    uriValuesText: row.uriValues.join(', '),
    enumValuesText: row.enumValues.join(', '),
    unsetEnumValuesText: row.unsetEnumValues.join(', '),
    valueMetadataJson: toPrettyJson(row.valueMetadata),
  }));
}

function toServiceItemEditors(input: RestaurantBusinessContextServiceItem[]): ServiceItemEditor[] {
  return input.map((row) => ({
    id: row.id,
    itemKey: row.itemKey,
    itemType: row.itemType ?? '',
    displayName: row.displayName ?? '',
    description: row.description ?? '',
    payloadJson: toPrettyJson(row.payload),
  }));
}

function SummaryBadges({
  coreCount,
  providerCount,
  seedSource,
}: {
  coreCount: number;
  providerCount: number;
  seedSource: SeedSource[FamilyKey];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{coreCount} core row{coreCount === 1 ? '' : 's'}</Badge>
      <Badge variant="outline">{providerCount} GBP row{providerCount === 1 ? '' : 's'}</Badge>
      <Badge variant="secondary">{seedSource === 'provider' ? 'Seeded from GBP' : 'Canonical core'}</Badge>
    </div>
  );
}

export function RestaurantBusinessContextSection({
  restaurantId,
  embedded = false,
}: RestaurantBusinessContextSectionProps) {
  const contextQuery = useOpsRestaurantBusinessContext(restaurantId);
  const updateMutation = useOpsUpdateRestaurantBusinessContext(restaurantId);
  const [activeTab, setActiveTab] = useState<FamilyKey>('categories');
  const [categories, setCategories] = useState<CategoryEditor[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaEditor[]>([]);
  const [attributes, setAttributes] = useState<AttributeEditor[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItemEditor[]>([]);
  const [seedSource, setSeedSource] = useState<SeedSource>({
    categories: 'empty',
    serviceAreas: 'empty',
    attributes: 'empty',
    serviceItems: 'empty',
  });
  const [dirty, setDirty] = useState<DirtyState>({
    categories: false,
    serviceAreas: false,
    attributes: false,
    serviceItems: false,
  });
  const [errors, setErrors] = useState<ErrorState>({});
  const [savingFamily, setSavingFamily] = useState<FamilyKey | null>(null);

  useEffect(() => {
    const data = contextQuery.data;
    if (!data) {
      return;
    }

    const nextCategories = cloneFamily(data.core.categories, data.providerSnapshot.categories);
    const nextServiceAreas = cloneFamily(data.core.serviceAreas, data.providerSnapshot.serviceAreas);
    const nextAttributes = cloneFamily(data.core.attributes, data.providerSnapshot.attributes);
    const nextServiceItems = cloneFamily(data.core.serviceItems, data.providerSnapshot.serviceItems);

    setCategories(toCategoryEditors(nextCategories.rows));
    setServiceAreas(toServiceAreaEditors(nextServiceAreas.rows));
    setAttributes(toAttributeEditors(nextAttributes.rows));
    setServiceItems(toServiceItemEditors(nextServiceItems.rows));
    setSeedSource({
      categories: nextCategories.source,
      serviceAreas: nextServiceAreas.source,
      attributes: nextAttributes.source,
      serviceItems: nextServiceItems.source,
    });
    setDirty({
      categories: false,
      serviceAreas: false,
      attributes: false,
      serviceItems: false,
    });
    setErrors({});
  }, [contextQuery.data]);

  const providerCounts = useMemo(() => {
    const snapshot = contextQuery.data?.providerSnapshot;
    return {
      categories: snapshot?.categories.length ?? 0,
      serviceAreas: snapshot?.serviceAreas.length ?? 0,
      attributes: snapshot?.attributes.length ?? 0,
      serviceItems: snapshot?.serviceItems.length ?? 0,
    };
  }, [contextQuery.data?.providerSnapshot]);

  const coreCounts = useMemo(() => {
    const core = contextQuery.data?.core;
    return {
      categories: core?.categories.length ?? 0,
      serviceAreas: core?.serviceAreas.length ?? 0,
      attributes: core?.attributes.length ?? 0,
      serviceItems: core?.serviceItems.length ?? 0,
    };
  }, [contextQuery.data?.core]);

  const markDirty = (family: FamilyKey) => {
    setDirty((current) => ({ ...current, [family]: true }));
    setErrors((current) => ({ ...current, [family]: null }));
  };

  const resetFamily = (family: FamilyKey) => {
    const data = contextQuery.data;
    if (!data) {
      return;
    }

    if (family === 'categories') {
      const source = cloneFamily(data.core.categories, data.providerSnapshot.categories);
      setCategories(toCategoryEditors(source.rows));
      setSeedSource((current) => ({ ...current, categories: source.source }));
    }

    if (family === 'serviceAreas') {
      const source = cloneFamily(data.core.serviceAreas, data.providerSnapshot.serviceAreas);
      setServiceAreas(toServiceAreaEditors(source.rows));
      setSeedSource((current) => ({ ...current, serviceAreas: source.source }));
    }

    if (family === 'attributes') {
      const source = cloneFamily(data.core.attributes, data.providerSnapshot.attributes);
      setAttributes(toAttributeEditors(source.rows));
      setSeedSource((current) => ({ ...current, attributes: source.source }));
    }

    if (family === 'serviceItems') {
      const source = cloneFamily(data.core.serviceItems, data.providerSnapshot.serviceItems);
      setServiceItems(toServiceItemEditors(source.rows));
      setSeedSource((current) => ({ ...current, serviceItems: source.source }));
    }

    setDirty((current) => ({ ...current, [family]: false }));
    setErrors((current) => ({ ...current, [family]: null }));
  };

  const saveFamily = async (family: FamilyKey) => {
    try {
      setSavingFamily(family);
      setErrors((current) => ({ ...current, [family]: null }));

      if (family === 'categories') {
        const primaryCount = categories.filter((row) => row.isPrimary).length;
        if (primaryCount > 1) {
          throw new Error('Only one category can be marked as primary.');
        }
        await updateMutation.mutateAsync({
          categories: categories.map((row) => ({
            id: row.id.startsWith('category-') ? undefined : row.id,
            displayName: row.displayName.trim(),
            categoryCode: row.categoryCode.trim() || null,
            isPrimary: row.isPrimary,
            moreHoursTypes: parseJsonArray(row.moreHoursTypesJson, 'More-hours types'),
          })),
        });
      }

      if (family === 'serviceAreas') {
        await updateMutation.mutateAsync({
          serviceAreas: serviceAreas.map((row) => ({
            id: row.id.startsWith('service-area-') ? undefined : row.id,
            displayName: row.displayName.trim(),
            areaType: row.areaType.trim() || 'region',
            regionCode: row.regionCode.trim() || null,
            placeData: parseJsonRecord(row.placeDataJson, 'Place data'),
          })),
        });
      }

      if (family === 'attributes') {
        await updateMutation.mutateAsync({
          attributes: attributes.map((row) => ({
            id: row.id.startsWith('attribute-') ? undefined : row.id,
            attributeGroup: row.attributeGroup.trim() || null,
            attributeKey: row.attributeKey.trim(),
            attributeName: row.attributeName.trim() || null,
            attributeId: row.attributeId.trim() || null,
            displayName: row.displayName.trim() || null,
            displayText: row.displayText.trim() || null,
            displayTextStandalone: row.displayTextStandalone.trim() || null,
            displayTextNegative: row.displayTextNegative.trim() || null,
            valueType: row.valueType.trim(),
            boolValue: row.boolValue === 'unset' ? null : row.boolValue === 'true',
            textValue: row.textValue.trim() || null,
            uriValue: row.uriValue.trim() || null,
            uriValues: csvToArray(row.uriValuesText),
            enumValues: csvToArray(row.enumValuesText),
            unsetEnumValues: csvToArray(row.unsetEnumValuesText),
            valueMetadata: parseJsonArray(row.valueMetadataJson, 'Value metadata'),
          })),
        });
      }

      if (family === 'serviceItems') {
        await updateMutation.mutateAsync({
          serviceItems: serviceItems.map((row) => ({
            id: row.id.startsWith('service-item-') ? undefined : row.id,
            itemKey: row.itemKey.trim(),
            itemType: row.itemType.trim() || null,
            displayName: row.displayName.trim() || null,
            description: row.description.trim() || null,
            payload: parseJsonRecord(row.payloadJson, 'Payload'),
          })),
        });
      }

      toast.success(`${TAB_LABELS[family]} saved to Nabatable core.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save changes.';
      setErrors((current) => ({ ...current, [family]: message }));
      toast.error(message);
    } finally {
      setSavingFamily(null);
    }
  };

  const renderFrame = ({
    title,
    description,
    children,
  }: {
    title: string;
    description: string;
    children: ReactNode;
  }) => {
    if (embedded) {
      return <div className="space-y-6">{children}</div>;
    }

    return (
      <SettingsCard title={title} description={description}>
        {children}
      </SettingsCard>
    );
  };

  if (!restaurantId) {
    return renderFrame({
      title: 'Business Context',
      description:
        'Select a restaurant to manage categories, service areas, attributes, and service items.',
      children: (
        <p className="text-sm text-muted-foreground">
          Choose a restaurant using the sidebar switcher to manage canonical business-context rows.
        </p>
      ),
    });
  }

  if (contextQuery.isLoading && !contextQuery.data) {
    return renderFrame({
      title: 'Business Context',
      description: 'Manage categories, service areas, attributes, and service items stored in core.',
      children: (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
      ),
    });
  }

  if (contextQuery.error) {
    return renderFrame({
      title: 'Business Context',
      description: 'Manage categories, service areas, attributes, and service items stored in core.',
      children: (
        <Alert variant="destructive">
          <AlertTitle>Unable to load business context</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{contextQuery.error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => contextQuery.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ),
    });
  }

  return renderFrame({
    title: 'Business Context',
    description:
      'Manage canonical discovery and context data in Nabatable core while keeping the GBP page verification-only.',
    children: (
      <div className="space-y-6">
        <Alert>
          <AlertTitle>Core editor, separate GBP snapshot</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              This editor writes Nabatable-owned rows in the canonical business-context tables. The
              latest fetched Google snapshot stays read-only on the{' '}
              <Link href="/settings/restaurant/google-business-profile" className="underline">
                Google Business Profile page
              </Link>
              .
            </p>
            <p className="text-xs text-muted-foreground">
              If no core rows exist yet, the editor starts from the latest GBP snapshot so you can
              promote those values into Nabatable intentionally.
            </p>
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FamilyKey)} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 p-1 lg:grid-cols-4">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="serviceAreas">Service areas</TabsTrigger>
            <TabsTrigger value="attributes">Attributes</TabsTrigger>
            <TabsTrigger value="serviceItems">Service items</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{SYNC_POSTURE.categories}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSeedSource(seedSource.categories, providerCounts.categories)}
                </p>
              </div>
              <SummaryBadges
                coreCount={coreCounts.categories}
                providerCount={providerCounts.categories}
                seedSource={seedSource.categories}
              />
            </div>

            {categories.map((row, index) => (
              <div key={row.id} className="space-y-4 rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Category {index + 1}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => {
                    setCategories((current) => current.filter((item) => item.id !== row.id));
                    markDirty('categories');
                  }}>
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('categories', row.id, 'displayName')}>Display name</Label>
                    <Input id={makeFieldId('categories', row.id, 'displayName')} value={row.displayName} onChange={(event) => {
                      setCategories((current) => current.map((item) => item.id === row.id ? { ...item, displayName: event.target.value } : item));
                      markDirty('categories');
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('categories', row.id, 'categoryCode')}>Category code</Label>
                    <Input id={makeFieldId('categories', row.id, 'categoryCode')} value={row.categoryCode} onChange={(event) => {
                      setCategories((current) => current.map((item) => item.id === row.id ? { ...item, categoryCode: event.target.value } : item));
                      markDirty('categories');
                    }} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id={makeFieldId('categories', row.id, 'isPrimary')}
                    aria-labelledby={makeFieldId('categories', row.id, 'isPrimary-label')}
                    checked={row.isPrimary}
                    onCheckedChange={(checked) => {
                      setCategories((current) => current.map((item) => item.id === row.id ? { ...item, isPrimary: checked } : item));
                      markDirty('categories');
                    }}
                  />
                  <Label id={makeFieldId('categories', row.id, 'isPrimary-label')} htmlFor={makeFieldId('categories', row.id, 'isPrimary')}>
                    Primary category
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={makeFieldId('categories', row.id, 'moreHoursTypesJson')}>Supported more-hours types JSON</Label>
                  <Textarea id={makeFieldId('categories', row.id, 'moreHoursTypesJson')} value={row.moreHoursTypesJson} rows={5} onChange={(event) => {
                    setCategories((current) => current.map((item) => item.id === row.id ? { ...item, moreHoursTypesJson: event.target.value } : item));
                    markDirty('categories');
                  }} />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => {
                setCategories((current) => [...current, { id: makeEditorId('category'), displayName: '', categoryCode: '', isPrimary: false, moreHoursTypesJson: '' }]);
                markDirty('categories');
              }}>
                <Plus className="size-4" />
                Add category
              </Button>
              <Button type="button" variant="outline" onClick={() => resetFamily('categories')} disabled={!dirty.categories}>
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button type="button" onClick={() => saveFamily('categories')} disabled={!dirty.categories || savingFamily === 'categories'}>
                Save categories
              </Button>
            </div>
            {errors.categories ? <p className="text-sm text-destructive">{errors.categories}</p> : null}
          </TabsContent>

          <TabsContent value="serviceAreas" className="space-y-4">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">{SYNC_POSTURE.serviceAreas}</p>
              <p className="text-xs text-muted-foreground">
                {formatSeedSource(seedSource.serviceAreas, providerCounts.serviceAreas)}
              </p>
              <SummaryBadges coreCount={coreCounts.serviceAreas} providerCount={providerCounts.serviceAreas} seedSource={seedSource.serviceAreas} />
            </div>

            {serviceAreas.map((row) => (
              <div key={row.id} className="space-y-4 rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{row.displayName || 'New service area'}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => {
                    setServiceAreas((current) => current.filter((item) => item.id !== row.id));
                    markDirty('serviceAreas');
                  }}>
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('serviceAreas', row.id, 'displayName')}>Display name</Label>
                    <Input id={makeFieldId('serviceAreas', row.id, 'displayName')} value={row.displayName} onChange={(event) => {
                      setServiceAreas((current) => current.map((item) => item.id === row.id ? { ...item, displayName: event.target.value } : item));
                      markDirty('serviceAreas');
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('serviceAreas', row.id, 'areaType')}>Area type</Label>
                    <Input id={makeFieldId('serviceAreas', row.id, 'areaType')} value={row.areaType} onChange={(event) => {
                      setServiceAreas((current) => current.map((item) => item.id === row.id ? { ...item, areaType: event.target.value } : item));
                      markDirty('serviceAreas');
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('serviceAreas', row.id, 'regionCode')}>Region code</Label>
                    <Input id={makeFieldId('serviceAreas', row.id, 'regionCode')} value={row.regionCode} onChange={(event) => {
                      setServiceAreas((current) => current.map((item) => item.id === row.id ? { ...item, regionCode: event.target.value } : item));
                      markDirty('serviceAreas');
                    }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={makeFieldId('serviceAreas', row.id, 'placeDataJson')}>Structured place data JSON</Label>
                  <Textarea id={makeFieldId('serviceAreas', row.id, 'placeDataJson')} value={row.placeDataJson} rows={5} onChange={(event) => {
                    setServiceAreas((current) => current.map((item) => item.id === row.id ? { ...item, placeDataJson: event.target.value } : item));
                    markDirty('serviceAreas');
                  }} />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => {
                setServiceAreas((current) => [...current, { id: makeEditorId('service-area'), displayName: '', areaType: 'region', regionCode: '', placeDataJson: '' }]);
                markDirty('serviceAreas');
              }}>
                <Plus className="size-4" />
                Add service area
              </Button>
              <Button type="button" variant="outline" onClick={() => resetFamily('serviceAreas')} disabled={!dirty.serviceAreas}>
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button type="button" onClick={() => saveFamily('serviceAreas')} disabled={!dirty.serviceAreas || savingFamily === 'serviceAreas'}>
                Save service areas
              </Button>
            </div>
            {errors.serviceAreas ? <p className="text-sm text-destructive">{errors.serviceAreas}</p> : null}
          </TabsContent>

          <TabsContent value="attributes" className="space-y-4">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">{SYNC_POSTURE.attributes}</p>
              <p className="text-xs text-muted-foreground">
                {formatSeedSource(seedSource.attributes, providerCounts.attributes)}
              </p>
              <SummaryBadges coreCount={coreCounts.attributes} providerCount={providerCounts.attributes} seedSource={seedSource.attributes} />
            </div>

            {attributes.map((row) => (
              <div key={row.id} className="space-y-4 rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{row.displayName || row.attributeKey || 'New attribute'}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => {
                    setAttributes((current) => current.filter((item) => item.id !== row.id));
                    markDirty('attributes');
                  }}>
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Attribute group', 'attributeGroup'],
                    ['Attribute key', 'attributeKey'],
                    ['Attribute name', 'attributeName'],
                    ['Attribute id', 'attributeId'],
                    ['Display name', 'displayName'],
                    ['Value type', 'valueType'],
                  ].map(([label, field]) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
                      <Input id={makeFieldId('attributes', row.id, field)} value={row[field as keyof AttributeEditor] as string} onChange={(event) => {
                        setAttributes((current) => current.map((item) => item.id === row.id ? { ...item, [field]: event.target.value } : item));
                        markDirty('attributes');
                      }} />
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('attributes', row.id, 'boolValue')}>Boolean value</Label>
                    <Select value={row.boolValue} onValueChange={(value) => {
                      setAttributes((current) => current.map((item) => item.id === row.id ? { ...item, boolValue: value as AttributeEditor['boolValue'] } : item));
                      markDirty('attributes');
                    }}>
                      <SelectTrigger id={makeFieldId('attributes', row.id, 'boolValue')} aria-label="Boolean value"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">Unset</SelectItem>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('attributes', row.id, 'textValue')}>Text value</Label>
                    <Input id={makeFieldId('attributes', row.id, 'textValue')} value={row.textValue} onChange={(event) => {
                      setAttributes((current) => current.map((item) => item.id === row.id ? { ...item, textValue: event.target.value } : item));
                      markDirty('attributes');
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('attributes', row.id, 'uriValue')}>Primary URI</Label>
                    <Input id={makeFieldId('attributes', row.id, 'uriValue')} value={row.uriValue} onChange={(event) => {
                      setAttributes((current) => current.map((item) => item.id === row.id ? { ...item, uriValue: event.target.value } : item));
                      markDirty('attributes');
                    }} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Display text', 'displayText'],
                    ['Standalone text', 'displayTextStandalone'],
                    ['Negative text', 'displayTextNegative'],
                    ['URI values (comma separated)', 'uriValuesText'],
                    ['Enum values (comma separated)', 'enumValuesText'],
                    ['Unset enum values (comma separated)', 'unsetEnumValuesText'],
                  ].map(([label, field]) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
                      <Input id={makeFieldId('attributes', row.id, field)} value={row[field as keyof AttributeEditor] as string} onChange={(event) => {
                        setAttributes((current) => current.map((item) => item.id === row.id ? { ...item, [field]: event.target.value } : item));
                        markDirty('attributes');
                      }} />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={makeFieldId('attributes', row.id, 'valueMetadataJson')}>Value metadata JSON</Label>
                  <Textarea id={makeFieldId('attributes', row.id, 'valueMetadataJson')} value={row.valueMetadataJson} rows={5} onChange={(event) => {
                    setAttributes((current) => current.map((item) => item.id === row.id ? { ...item, valueMetadataJson: event.target.value } : item));
                    markDirty('attributes');
                  }} />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => {
                setAttributes((current) => [...current, { id: makeEditorId('attribute'), attributeGroup: '', attributeKey: '', attributeName: '', attributeId: '', displayName: '', displayText: '', displayTextStandalone: '', displayTextNegative: '', valueType: 'text', boolValue: 'unset', textValue: '', uriValue: '', uriValuesText: '', enumValuesText: '', unsetEnumValuesText: '', valueMetadataJson: '' }]);
                markDirty('attributes');
              }}>
                <Plus className="size-4" />
                Add attribute
              </Button>
              <Button type="button" variant="outline" onClick={() => resetFamily('attributes')} disabled={!dirty.attributes}>
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button type="button" onClick={() => saveFamily('attributes')} disabled={!dirty.attributes || savingFamily === 'attributes'}>
                Save attributes
              </Button>
            </div>
            {errors.attributes ? <p className="text-sm text-destructive">{errors.attributes}</p> : null}
          </TabsContent>

          <TabsContent value="serviceItems" className="space-y-4">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">{SYNC_POSTURE.serviceItems}</p>
              <p className="text-xs text-muted-foreground">
                {formatSeedSource(seedSource.serviceItems, providerCounts.serviceItems)}
              </p>
              <SummaryBadges coreCount={coreCounts.serviceItems} providerCount={providerCounts.serviceItems} seedSource={seedSource.serviceItems} />
            </div>

            {serviceItems.map((row) => (
              <div key={row.id} className="space-y-4 rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{row.displayName || row.itemKey || 'New service item'}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => {
                    setServiceItems((current) => current.filter((item) => item.id !== row.id));
                    markDirty('serviceItems');
                  }}>
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Item key', 'itemKey'],
                    ['Item type', 'itemType'],
                    ['Display name', 'displayName'],
                    ['Description', 'description'],
                  ].map(([label, field]) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={makeFieldId('serviceItems', row.id, field)}>{label}</Label>
                      <Input id={makeFieldId('serviceItems', row.id, field)} value={row[field as keyof ServiceItemEditor] as string} onChange={(event) => {
                        setServiceItems((current) => current.map((item) => item.id === row.id ? { ...item, [field]: event.target.value } : item));
                        markDirty('serviceItems');
                      }} />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={makeFieldId('serviceItems', row.id, 'payloadJson')}>Payload JSON</Label>
                  <Textarea id={makeFieldId('serviceItems', row.id, 'payloadJson')} value={row.payloadJson} rows={5} onChange={(event) => {
                    setServiceItems((current) => current.map((item) => item.id === row.id ? { ...item, payloadJson: event.target.value } : item));
                    markDirty('serviceItems');
                  }} />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => {
                setServiceItems((current) => [...current, { id: makeEditorId('service-item'), itemKey: '', itemType: '', displayName: '', description: '', payloadJson: '' }]);
                markDirty('serviceItems');
              }}>
                <Plus className="size-4" />
                Add service item
              </Button>
              <Button type="button" variant="outline" onClick={() => resetFamily('serviceItems')} disabled={!dirty.serviceItems}>
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button type="button" onClick={() => saveFamily('serviceItems')} disabled={!dirty.serviceItems || savingFamily === 'serviceItems'}>
                Save service items
              </Button>
            </div>
            {errors.serviceItems ? <p className="text-sm text-destructive">{errors.serviceItems}</p> : null}
          </TabsContent>
        </Tabs>
      </div>
    ),
  });
}
