'use client';

import { ChevronDown, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useOpsRestaurantBusinessContext,
  useOpsUpdateRestaurantBusinessContext,
} from '@/hooks/ops/useOpsRestaurantBusinessContext';
import { opsHref } from '@/lib/url/opsHref';

import { SettingsCard } from './shared/SettingsCard';

import type {
  RestaurantBusinessContextAttribute,
  RestaurantBusinessContextCategory,
  RestaurantBusinessContextLink,
  RestaurantBusinessContextMoreHoursType,
  RestaurantBusinessContextServiceArea,
  RestaurantBusinessContextServiceItem,
} from '@/services/ops/restaurants';

type RestaurantBusinessContextSectionProps = {
  restaurantId: string | null;
  embedded?: boolean;
};

type FamilyKey =
  | 'businessDetails'
  | 'links'
  | 'categories'
  | 'serviceAreas'
  | 'attributes'
  | 'serviceItems';
type SeedSource = Record<FamilyKey, 'core' | 'provider' | 'empty'>;
type DirtyState = Record<FamilyKey, boolean>;
type ErrorState = Partial<Record<FamilyKey, string | null>>;

type BusinessDetailsEditor = {
  openingDate: string;
  businessStatus: 'unset' | 'open' | 'closed_permanently' | 'closed_temporarily';
  isServiceAreaBusiness: boolean;
};

type LinkEditor = {
  id: string;
  linkType: string;
  label: string;
  url: string;
  isPrimary: boolean;
};

type CategoryEditor = {
  id: string;
  displayName: string;
  categoryCode: string;
  isPrimary: boolean;
  moreHoursTypes: RestaurantBusinessContextMoreHoursType[];
  moreHoursTypeDraft: string;
};

type ServiceAreaEditor = {
  id: string;
  displayName: string;
  areaType: string;
  regionCode: string;
  googlePlaceId: string;
  googlePlaceResourceName: string;
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
  rawValueJson: string;
  rawEnumValuesJson: string;
  displayValueJson: string;
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
  businessDetails: 'Profile basics',
  links: 'Online links',
  categories: 'Dining categories',
  serviceAreas: 'Where you serve',
  attributes: 'Amenities',
  serviceItems: 'Services',
};

const DISCOVERY_SECTION_ORDER: FamilyKey[] = [
  'businessDetails',
  'categories',
  'serviceAreas',
  'attributes',
  'serviceItems',
  'links',
];
const EMBEDDED_DISCOVERY_PRIMARY_ORDER: FamilyKey[] = ['businessDetails', 'categories', 'links'];

const DISCOVERY_SECTION_DESCRIPTIONS: Record<FamilyKey, string> = {
  businessDetails: 'Opening status and whether this restaurant also serves guests off-site.',
  categories: 'The main dining categories guests and profile providers use to describe the venue.',
  serviceAreas: 'Places or regions this restaurant serves beyond the venue.',
  attributes: 'Useful amenities and profile facts guests may care about.',
  serviceItems: 'Services or offers that help describe what the restaurant provides.',
  links: 'Website, menu, reservation, ordering, chat, and social links guests may use.',
};

const SYNC_POSTURE: Record<FamilyKey, string> = {
  businessDetails: 'These basics support public profile checks and guest-facing listings.',
  links: 'Use these links on public profiles, menus, ordering journeys, and customer messages.',
  categories: 'Categories help guests and profile providers understand what the restaurant offers.',
  serviceAreas: 'Add areas only when the restaurant serves guests beyond the venue.',
  attributes:
    'Use amenities to capture helpful profile details such as accessibility or facilities.',
  serviceItems: 'Use services to describe optional offers beyond the standard reservation flow.',
};

const LINK_TYPE_OPTIONS = [
  { value: 'website', label: 'Website' },
  { value: 'menu_or_services', label: 'Menu / services' },
  { value: 'reservation', label: 'Reservation' },
  { value: 'order', label: 'Order' },
  { value: 'chat', label: 'Chat' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'Twitter / X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
] as const;
const EDITABLE_LINK_TYPES = new Set(LINK_TYPE_OPTIONS.map((option) => option.value));

const EMPTY_BUSINESS_DETAILS: BusinessDetailsEditor = {
  openingDate: '',
  businessStatus: 'unset',
  isServiceAreaBusiness: false,
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
    return 'Showing saved values';
  }
  if (value === 'provider' && providerCount > 0) {
    return 'Pre-filled from Google until you save';
  }
  return 'No values yet';
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

function splitChipDraft(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatCategoryTitle(row: CategoryEditor): string {
  const displayName = row.displayName.trim();
  if (displayName) {
    return displayName;
  }
  return row.isPrimary ? 'Primary category' : 'New category';
}

function formatMoreHoursTypeLabel(row: RestaurantBusinessContextMoreHoursType): string {
  return (
    row.hoursTypeId?.trim() || row.localizedDisplayName?.trim() || row.displayName?.trim() || ''
  );
}

function serializeMoreHoursTypes(
  rows: RestaurantBusinessContextMoreHoursType[],
): RestaurantBusinessContextMoreHoursType[] {
  return rows
    .map((row) => ({
      hoursTypeId: row.hoursTypeId?.trim() || null,
      displayName: row.displayName?.trim() || null,
      localizedDisplayName: row.localizedDisplayName?.trim() || null,
    }))
    .filter(
      (row) =>
        row.hoursTypeId !== null || row.displayName !== null || row.localizedDisplayName !== null,
    );
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
    moreHoursTypes: row.moreHoursTypes.map((moreHoursType) => ({
      hoursTypeId: moreHoursType.hoursTypeId,
      displayName: moreHoursType.displayName,
      localizedDisplayName: moreHoursType.localizedDisplayName,
    })),
    moreHoursTypeDraft: '',
  }));
}

function toServiceAreaEditors(input: RestaurantBusinessContextServiceArea[]): ServiceAreaEditor[] {
  return input.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    areaType: row.areaType,
    regionCode: row.regionCode ?? '',
    googlePlaceId: row.googlePlaceId ?? '',
    googlePlaceResourceName: row.googlePlaceResourceName ?? '',
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
    rawValueJson: toPrettyJson(row.rawValue),
    rawEnumValuesJson: toPrettyJson(row.rawEnumValues),
    displayValueJson: toPrettyJson(row.displayValue),
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

function toBusinessDetailsEditor(
  input:
    | {
        openingDate: string | null;
        businessStatus: string | null;
        isServiceAreaBusiness: boolean;
      }
    | null
    | undefined,
): BusinessDetailsEditor {
  if (!input) {
    return EMPTY_BUSINESS_DETAILS;
  }

  return {
    openingDate: input.openingDate ?? '',
    businessStatus:
      input.businessStatus === 'open' ||
      input.businessStatus === 'closed_permanently' ||
      input.businessStatus === 'closed_temporarily'
        ? input.businessStatus
        : 'unset',
    isServiceAreaBusiness: input.isServiceAreaBusiness,
  };
}

function toLinkEditors(input: RestaurantBusinessContextLink[]): LinkEditor[] {
  return input
    .filter((row) =>
      EDITABLE_LINK_TYPES.has(row.linkType as (typeof LINK_TYPE_OPTIONS)[number]['value']),
    )
    .map((row) => ({
      id: row.id,
      linkType: row.linkType,
      label: row.label ?? '',
      url: row.url,
      isPrimary: row.isPrimary,
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
      <Badge variant="outline">
        {coreCount} saved row{coreCount === 1 ? '' : 's'}
      </Badge>
      <Badge variant="outline">
        {providerCount} Google suggestion{providerCount === 1 ? '' : 's'}
      </Badge>
      <Badge variant="secondary">
        {seedSource === 'provider'
          ? 'Pre-filled'
          : seedSource === 'core'
            ? 'Saved'
            : 'Ready to add'}
      </Badge>
    </div>
  );
}

function DiscoveryPanelsFrame({
  embedded,
  activeTab,
  onActiveTabChange,
  children,
}: {
  embedded: boolean;
  activeTab: FamilyKey;
  onActiveTabChange: (value: FamilyKey) => void;
  children: ReactNode;
}) {
  if (embedded) {
    const childArray = Children.toArray(children);
    const findChild = (family: FamilyKey) =>
      childArray.find(
        (child): child is ReactElement<{ family: FamilyKey }> =>
          isValidElement<{ family: FamilyKey }>(child) && child.props.family === family,
      );
    const primaryChildren = EMBEDDED_DISCOVERY_PRIMARY_ORDER.map(findChild).filter(Boolean);

    return (
      <div className="flex flex-col gap-6">
        {primaryChildren}
        <Alert>
          <AlertTitle>Need advanced discovery metadata?</AlertTitle>
          <AlertDescription>
            Service areas, amenities, and provider-level service metadata are available in the{' '}
            <Link href={opsHref('/settings/restaurant/google-business-profile')} className="underline">
              Google Business Profile workspace
            </Link>
            .
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onActiveTabChange(value as FamilyKey)}
      className="space-y-4"
    >
      <TabsList className="grid h-auto w-full grid-cols-2 p-1 lg:grid-cols-6">
        {DISCOVERY_SECTION_ORDER.map((family) => (
          <TabsTrigger key={family} value={family}>
            {TAB_LABELS[family]}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

function DiscoveryFamilyPanel({
  embedded,
  family,
  children,
}: {
  embedded: boolean;
  family: FamilyKey;
  children: ReactNode;
}) {
  if (embedded) {
    return (
      <section
        aria-labelledby={`profile-discovery-${family}`}
        className="flex flex-col gap-4 rounded-xl border border-border/60 p-4"
      >
        <div className="flex flex-col gap-1">
          <h3
            id={`profile-discovery-${family}`}
            className="text-base font-semibold text-foreground"
          >
            {TAB_LABELS[family]}
          </h3>
          <p className="text-sm text-muted-foreground">{DISCOVERY_SECTION_DESCRIPTIONS[family]}</p>
        </div>
        {children}
      </section>
    );
  }

  return (
    <TabsContent value={family} className="space-y-4">
      {children}
    </TabsContent>
  );
}

export function RestaurantBusinessContextSection({
  restaurantId,
  embedded = false,
}: RestaurantBusinessContextSectionProps) {
  const contextQuery = useOpsRestaurantBusinessContext(restaurantId);
  const updateMutation = useOpsUpdateRestaurantBusinessContext(restaurantId);
  const [activeTab, setActiveTab] = useState<FamilyKey>('categories');
  const [businessDetails, setBusinessDetails] =
    useState<BusinessDetailsEditor>(EMPTY_BUSINESS_DETAILS);
  const [links, setLinks] = useState<LinkEditor[]>([]);
  const [categories, setCategories] = useState<CategoryEditor[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaEditor[]>([]);
  const [attributes, setAttributes] = useState<AttributeEditor[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItemEditor[]>([]);
  const [seedSource, setSeedSource] = useState<SeedSource>({
    businessDetails: 'empty',
    links: 'empty',
    categories: 'empty',
    serviceAreas: 'empty',
    attributes: 'empty',
    serviceItems: 'empty',
  });
  const [dirty, setDirty] = useState<DirtyState>({
    businessDetails: false,
    links: false,
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
    const nextBusinessDetailsSource = data.core.businessDetails
      ? 'core'
      : data.providerSnapshot.businessDetails
        ? 'provider'
        : 'empty';
    const nextLinks = cloneFamily(
      (data.core.links ?? []).filter((row) =>
        EDITABLE_LINK_TYPES.has(row.linkType as (typeof LINK_TYPE_OPTIONS)[number]['value']),
      ),
      (data.providerSnapshot.links ?? []).filter((row) =>
        EDITABLE_LINK_TYPES.has(row.linkType as (typeof LINK_TYPE_OPTIONS)[number]['value']),
      ),
    );
    const nextServiceAreas = cloneFamily(
      data.core.serviceAreas,
      data.providerSnapshot.serviceAreas,
    );
    const nextAttributes = cloneFamily(data.core.attributes, data.providerSnapshot.attributes);
    const nextServiceItems = cloneFamily(
      data.core.serviceItems,
      data.providerSnapshot.serviceItems,
    );

    setBusinessDetails(
      toBusinessDetailsEditor(data.core.businessDetails ?? data.providerSnapshot.businessDetails),
    );
    setLinks(toLinkEditors(nextLinks.rows));
    setCategories(toCategoryEditors(nextCategories.rows));
    setServiceAreas(toServiceAreaEditors(nextServiceAreas.rows));
    setAttributes(toAttributeEditors(nextAttributes.rows));
    setServiceItems(toServiceItemEditors(nextServiceItems.rows));
    setSeedSource({
      businessDetails: nextBusinessDetailsSource,
      links: nextLinks.source,
      categories: nextCategories.source,
      serviceAreas: nextServiceAreas.source,
      attributes: nextAttributes.source,
      serviceItems: nextServiceItems.source,
    });
    setDirty({
      businessDetails: false,
      links: false,
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
      businessDetails: snapshot?.businessDetails ? 1 : 0,
      links:
        snapshot?.links?.filter((row) =>
          EDITABLE_LINK_TYPES.has(row.linkType as (typeof LINK_TYPE_OPTIONS)[number]['value']),
        ).length ?? 0,
      categories: snapshot?.categories.length ?? 0,
      serviceAreas: snapshot?.serviceAreas.length ?? 0,
      attributes: snapshot?.attributes.length ?? 0,
      serviceItems: snapshot?.serviceItems.length ?? 0,
    };
  }, [contextQuery.data?.providerSnapshot]);

  const coreCounts = useMemo(() => {
    const core = contextQuery.data?.core;
    return {
      businessDetails: core?.businessDetails ? 1 : 0,
      links:
        core?.links?.filter((row) =>
          EDITABLE_LINK_TYPES.has(row.linkType as (typeof LINK_TYPE_OPTIONS)[number]['value']),
        ).length ?? 0,
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

  const updateMoreHoursDraft = (rowId: string, value: string) => {
    setCategories((current) =>
      current.map((item) => (item.id === rowId ? { ...item, moreHoursTypeDraft: value } : item)),
    );
  };

  const addMoreHoursTypes = (rowId: string, value: string) => {
    const nextValues = splitChipDraft(value);
    if (nextValues.length === 0) {
      updateMoreHoursDraft(rowId, '');
      return;
    }

    setCategories((current) =>
      current.map((item) => {
        if (item.id !== rowId) {
          return item;
        }

        const existing = new Set(
          item.moreHoursTypes
            .map((moreHoursType) => formatMoreHoursTypeLabel(moreHoursType).toLowerCase())
            .filter(Boolean),
        );
        const additions = nextValues
          .filter((nextValue) => !existing.has(nextValue.toLowerCase()))
          .map((nextValue) => ({
            hoursTypeId: nextValue,
            displayName: null,
            localizedDisplayName: null,
          }));

        return {
          ...item,
          moreHoursTypes: [...item.moreHoursTypes, ...additions],
          moreHoursTypeDraft: '',
        };
      }),
    );
    markDirty('categories');
  };

  const removeMoreHoursType = (rowId: string, typeIndex: number) => {
    setCategories((current) =>
      current.map((item) =>
        item.id === rowId
          ? {
              ...item,
              moreHoursTypes: item.moreHoursTypes.filter((_, index) => index !== typeIndex),
            }
          : item,
      ),
    );
    markDirty('categories');
  };

  const resetFamily = (family: FamilyKey) => {
    const data = contextQuery.data;
    if (!data) {
      return;
    }

    if (family === 'businessDetails') {
      setBusinessDetails(
        toBusinessDetailsEditor(data.core.businessDetails ?? data.providerSnapshot.businessDetails),
      );
      setSeedSource((current) => ({
        ...current,
        businessDetails: data.core.businessDetails
          ? 'core'
          : data.providerSnapshot.businessDetails
            ? 'provider'
            : 'empty',
      }));
    }

    if (family === 'links') {
      const source = cloneFamily(
        (data.core.links ?? []).filter((row) =>
          EDITABLE_LINK_TYPES.has(row.linkType as (typeof LINK_TYPE_OPTIONS)[number]['value']),
        ),
        (data.providerSnapshot.links ?? []).filter((row) =>
          EDITABLE_LINK_TYPES.has(row.linkType as (typeof LINK_TYPE_OPTIONS)[number]['value']),
        ),
      );
      setLinks(toLinkEditors(source.rows));
      setSeedSource((current) => ({ ...current, links: source.source }));
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

      if (family === 'businessDetails') {
        await updateMutation.mutateAsync({
          businessDetails: {
            openingDate: businessDetails.openingDate.trim() || null,
            businessStatus:
              businessDetails.businessStatus === 'unset' ? null : businessDetails.businessStatus,
            isServiceAreaBusiness: businessDetails.isServiceAreaBusiness,
          },
        });
      }

      if (family === 'links') {
        await updateMutation.mutateAsync({
          links: links.map((row) => ({
            id: row.id.startsWith('link-') ? undefined : row.id,
            linkType: row.linkType.trim(),
            linkStatus: 'current',
            label: row.label.trim() || null,
            url: row.url.trim(),
            isPrimary: row.isPrimary,
          })),
        });
      }

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
            moreHoursTypes: serializeMoreHoursTypes(row.moreHoursTypes),
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
            googlePlaceId: row.googlePlaceId.trim() || null,
            googlePlaceResourceName: row.googlePlaceResourceName.trim() || null,
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
            rawValue: parseJsonRecord(row.rawValueJson, 'Raw value'),
            rawEnumValues: parseJsonRecord(row.rawEnumValuesJson, 'Raw enum values'),
            displayValue: parseJsonRecord(row.displayValueJson, 'Display value'),
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

      toast.success(`${TAB_LABELS[family]} saved.`);
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
      title: 'Public discovery',
      description:
        'Select a restaurant to manage categories, online links, and public discovery details.',
      children: (
        <p className="text-sm text-muted-foreground">
          Choose a restaurant using the sidebar switcher to manage how guests find and understand
          it.
        </p>
      ),
    });
  }

  if (contextQuery.isLoading && !contextQuery.data) {
    return renderFrame({
      title: 'Public discovery',
      description: 'Loading the public discovery details for this restaurant.',
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
      title: 'Public discovery',
      description:
        'Manage the categories, online links, and public discovery details used to describe this restaurant.',
      children: (
        <Alert variant="destructive">
          <AlertTitle>Unable to load discovery details</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{contextQuery.error.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => contextQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ),
    });
  }

  return renderFrame({
    title: 'Public discovery',
    description:
      'Manage the details that help guests and profile providers describe this restaurant accurately.',
    children: (
      <div className="space-y-6">
        <Alert>
          <AlertTitle>About Google suggestions</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Edits here become this restaurant’s saved profile details. The{' '}
              <Link
                href={opsHref('/settings/restaurant/google-business-profile')}
                className="underline"
              >
                Google Business Profile page
              </Link>{' '}
              shows Google’s latest version when you want to compare or update it.
            </p>
            <p className="text-xs text-muted-foreground">
              When a section has no saved values yet, it may be pre-filled from Google so you can
              review it before saving.
            </p>
          </AlertDescription>
        </Alert>

        <DiscoveryPanelsFrame
          embedded={embedded}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
        >
          <DiscoveryFamilyPanel embedded={embedded} family="businessDetails">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {SYNC_POSTURE.businessDetails}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSeedSource(seedSource.businessDetails, providerCounts.businessDetails)}
                </p>
              </div>
              <SummaryBadges
                coreCount={coreCounts.businessDetails}
                providerCount={providerCounts.businessDetails}
                seedSource={seedSource.businessDetails}
              />
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="business-details-opening-date">Opening date</Label>
                  <Input
                    id="business-details-opening-date"
                    type="date"
                    value={businessDetails.openingDate}
                    onChange={(event) => {
                      setBusinessDetails((current) => ({
                        ...current,
                        openingDate: event.target.value,
                      }));
                      markDirty('businessDetails');
                    }}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Optional public opening date for the venue.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-details-status">Business status</Label>
                  <Select
                    value={businessDetails.businessStatus}
                    onValueChange={(value) => {
                      setBusinessDetails((current) => ({
                        ...current,
                        businessStatus: value as BusinessDetailsEditor['businessStatus'],
                      }));
                      markDirty('businessDetails');
                    }}
                  >
                    <SelectTrigger id="business-details-status" aria-label="Business status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Unset</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed_temporarily">Closed temporarily</SelectItem>
                      <SelectItem value="closed_permanently">Closed permanently</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Optional public status for profile checks and listings.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-border/60 pt-4">
                <Switch
                  id="business-details-service-area-business"
                  checked={businessDetails.isServiceAreaBusiness}
                  onCheckedChange={(checked) => {
                    setBusinessDetails((current) => ({
                      ...current,
                      isServiceAreaBusiness: checked,
                    }));
                    markDirty('businessDetails');
                  }}
                />
                <div className="space-y-1">
                  <Label htmlFor="business-details-service-area-business">
                    Service-area business
                  </Label>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Mark this when the restaurant serves guests beyond the venue.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => resetFamily('businessDetails')}
                disabled={!dirty.businessDetails}
              >
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button
                type="button"
                onClick={() => saveFamily('businessDetails')}
                disabled={!dirty.businessDetails || savingFamily === 'businessDetails'}
              >
                Save profile basics
              </Button>
            </div>
            {errors.businessDetails ? (
              <p className="text-sm text-destructive">{errors.businessDetails}</p>
            ) : null}
          </DiscoveryFamilyPanel>

          <DiscoveryFamilyPanel embedded={embedded} family="links">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{SYNC_POSTURE.links}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSeedSource(seedSource.links, providerCounts.links)}
                </p>
              </div>
              <SummaryBadges
                coreCount={coreCounts.links}
                providerCount={providerCounts.links}
                seedSource={seedSource.links}
              />
            </div>

            {links.map((row) => (
              <div key={row.id} className="space-y-4 rounded-xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {row.label ||
                        LINK_TYPE_OPTIONS.find((option) => option.value === row.linkType)?.label ||
                        'New link'}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Website, menu, ordering, chat, and social links guests may use.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${row.label || row.linkType || 'link'}`}
                    title="Remove link"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setLinks((current) => current.filter((item) => item.id !== row.id));
                      markDirty('links');
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('links', row.id, 'linkType')}>Link type</Label>
                    <Select
                      value={row.linkType}
                      onValueChange={(value) => {
                        setLinks((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, linkType: value } : item,
                          ),
                        );
                        markDirty('links');
                      }}
                    >
                      <SelectTrigger
                        id={makeFieldId('links', row.id, 'linkType')}
                        aria-label="Link type"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LINK_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('links', row.id, 'label')}>Label</Label>
                    <Input
                      id={makeFieldId('links', row.id, 'label')}
                      value={row.label}
                      placeholder="Website"
                      onChange={(event) => {
                        setLinks((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, label: event.target.value } : item,
                          ),
                        );
                        markDirty('links');
                      }}
                    />
                  </div>
                  <div className="flex items-start gap-3 pt-8">
                    <Switch
                      id={makeFieldId('links', row.id, 'isPrimary')}
                      checked={row.isPrimary}
                      onCheckedChange={(checked) => {
                        setLinks((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, isPrimary: checked } : item,
                          ),
                        );
                        markDirty('links');
                      }}
                    />
                    <Label htmlFor={makeFieldId('links', row.id, 'isPrimary')}>Primary</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={makeFieldId('links', row.id, 'url')}>URL</Label>
                  <Input
                    id={makeFieldId('links', row.id, 'url')}
                    type="url"
                    inputMode="url"
                    value={row.url}
                    placeholder="https://example.com"
                    onChange={(event) => {
                      setLinks((current) =>
                        current.map((item) =>
                          item.id === row.id ? { ...item, url: event.target.value } : item,
                        ),
                      );
                      markDirty('links');
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLinks((current) => [
                    ...current,
                    {
                      id: makeEditorId('link'),
                      linkType: 'website',
                      label: '',
                      url: '',
                      isPrimary: false,
                    },
                  ]);
                  markDirty('links');
                }}
              >
                <Plus className="size-4" />
                Add link
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => resetFamily('links')}
                disabled={!dirty.links}
              >
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button
                type="button"
                onClick={() => saveFamily('links')}
                disabled={!dirty.links || savingFamily === 'links'}
              >
                Save links
              </Button>
            </div>
            {errors.links ? <p className="text-sm text-destructive">{errors.links}</p> : null}
          </DiscoveryFamilyPanel>

          <DiscoveryFamilyPanel embedded={embedded} family="categories">
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

            {categories.map((row) => (
              <div key={row.id} className="space-y-5 rounded-lg border border-border/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {formatCategoryTitle(row)}
                      </p>
                      {row.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Categories help guests and Google understand what this restaurant is best
                      known for.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${formatCategoryTitle(row)}`}
                    title="Remove category"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setCategories((current) => current.filter((item) => item.id !== row.id));
                      markDirty('categories');
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('categories', row.id, 'displayName')}>
                      Category name
                    </Label>
                    <Input
                      id={makeFieldId('categories', row.id, 'displayName')}
                      value={row.displayName}
                      placeholder="Restaurant"
                      onChange={(event) => {
                        setCategories((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, displayName: event.target.value }
                              : item,
                          ),
                        );
                        markDirty('categories');
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('categories', row.id, 'categoryCode')}>
                      Category code
                    </Label>
                    <Input
                      id={makeFieldId('categories', row.id, 'categoryCode')}
                      aria-describedby={makeFieldId('categories', row.id, 'categoryCode-help')}
                      value={row.categoryCode}
                      placeholder="restaurant"
                      onChange={(event) => {
                        setCategories((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, categoryCode: event.target.value }
                              : item,
                          ),
                        );
                        markDirty('categories');
                      }}
                    />
                    <p
                      id={makeFieldId('categories', row.id, 'categoryCode-help')}
                      className="text-xs leading-5 text-muted-foreground"
                    >
                      Optional provider identifier. Leave blank if the category name is enough.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 border-t border-border/60 pt-4">
                  <Switch
                    id={makeFieldId('categories', row.id, 'isPrimary')}
                    aria-labelledby={makeFieldId('categories', row.id, 'isPrimary-label')}
                    checked={row.isPrimary}
                    onCheckedChange={(checked) => {
                      setCategories((current) =>
                        current.map((item) =>
                          item.id === row.id ? { ...item, isPrimary: checked } : item,
                        ),
                      );
                      markDirty('categories');
                    }}
                  />
                  <div className="space-y-1">
                    <Label
                      id={makeFieldId('categories', row.id, 'isPrimary-label')}
                      htmlFor={makeFieldId('categories', row.id, 'isPrimary')}
                    >
                      Primary category
                    </Label>
                    <p className="text-xs leading-5 text-muted-foreground">
                      This is the main category guests and profile providers should see first. Only
                      one category can be primary.
                    </p>
                  </div>
                </div>
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <Label htmlFor={makeFieldId('categories', row.id, 'moreHoursTypeDraft')}>
                    More-hours types
                  </Label>
                  <div className="space-y-2">
                    {row.moreHoursTypes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {row.moreHoursTypes.map((moreHoursType, typeIndex) => {
                          const label = formatMoreHoursTypeLabel(moreHoursType);
                          return (
                            <Badge
                              key={`${label || 'more-hours-type'}-${typeIndex}`}
                              variant="secondary"
                              className="gap-1.5 rounded-md py-1 pl-2 pr-1"
                            >
                              <span>{label || 'Unnamed type'}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${label || 'more-hours type'}`}
                                className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => removeMoreHoursType(row.id, typeIndex)}
                              >
                                <X className="size-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs leading-5 text-muted-foreground">
                        No extra hours types are listed for this category.
                      </p>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id={makeFieldId('categories', row.id, 'moreHoursTypeDraft')}
                        value={row.moreHoursTypeDraft}
                        placeholder="Add a type, then press Enter"
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          if (nextValue.includes(',')) {
                            addMoreHoursTypes(row.id, nextValue);
                            return;
                          }
                          updateMoreHoursDraft(row.id, nextValue);
                        }}
                        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                          if (event.key === 'Enter' || event.key === ',') {
                            event.preventDefault();
                            addMoreHoursTypes(row.id, event.currentTarget.value);
                          }
                        }}
                        onBlur={() => addMoreHoursTypes(row.id, row.moreHoursTypeDraft)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addMoreHoursTypes(row.id, row.moreHoursTypeDraft)}
                      >
                        <Plus className="size-4" />
                        Add type
                      </Button>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Add labels such as kitchen hours or happy hour when this category needs
                      related hours.
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCategories((current) => [
                    ...current,
                    {
                      id: makeEditorId('category'),
                      displayName: '',
                      categoryCode: '',
                      isPrimary: false,
                      moreHoursTypes: [],
                      moreHoursTypeDraft: '',
                    },
                  ]);
                  markDirty('categories');
                }}
              >
                <Plus className="size-4" />
                Add category
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => resetFamily('categories')}
                disabled={!dirty.categories}
              >
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button
                type="button"
                onClick={() => saveFamily('categories')}
                disabled={!dirty.categories || savingFamily === 'categories'}
              >
                Save categories
              </Button>
            </div>
            {errors.categories ? (
              <p className="text-sm text-destructive">{errors.categories}</p>
            ) : null}
          </DiscoveryFamilyPanel>

          <DiscoveryFamilyPanel embedded={embedded} family="serviceAreas">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">{SYNC_POSTURE.serviceAreas}</p>
              <p className="text-xs text-muted-foreground">
                {formatSeedSource(seedSource.serviceAreas, providerCounts.serviceAreas)}
              </p>
              <SummaryBadges
                coreCount={coreCounts.serviceAreas}
                providerCount={providerCounts.serviceAreas}
                seedSource={seedSource.serviceAreas}
              />
            </div>

            {serviceAreas.map((row) => (
              <div key={row.id} className="space-y-4 rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {row.displayName || 'New service area'}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setServiceAreas((current) => current.filter((item) => item.id !== row.id));
                      markDirty('serviceAreas');
                    }}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('serviceAreas', row.id, 'displayName')}>
                      Area name
                    </Label>
                    <Input
                      id={makeFieldId('serviceAreas', row.id, 'displayName')}
                      value={row.displayName}
                      onChange={(event) => {
                        setServiceAreas((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, displayName: event.target.value }
                              : item,
                          ),
                        );
                        markDirty('serviceAreas');
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('serviceAreas', row.id, 'areaType')}>
                      Area type
                    </Label>
                    <Input
                      id={makeFieldId('serviceAreas', row.id, 'areaType')}
                      value={row.areaType}
                      onChange={(event) => {
                        setServiceAreas((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, areaType: event.target.value } : item,
                          ),
                        );
                        markDirty('serviceAreas');
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('serviceAreas', row.id, 'regionCode')}>
                      Country or region
                    </Label>
                    <Input
                      id={makeFieldId('serviceAreas', row.id, 'regionCode')}
                      value={row.regionCode}
                      onChange={(event) => {
                        setServiceAreas((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, regionCode: event.target.value } : item,
                          ),
                        );
                        markDirty('serviceAreas');
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setServiceAreas((current) => [
                    ...current,
                    {
                      id: makeEditorId('service-area'),
                      displayName: '',
                      areaType: 'region',
                      regionCode: '',
                      googlePlaceId: '',
                      googlePlaceResourceName: '',
                      placeDataJson: '',
                    },
                  ]);
                  markDirty('serviceAreas');
                }}
              >
                <Plus className="size-4" />
                Add service area
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => resetFamily('serviceAreas')}
                disabled={!dirty.serviceAreas}
              >
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button
                type="button"
                onClick={() => saveFamily('serviceAreas')}
                disabled={!dirty.serviceAreas || savingFamily === 'serviceAreas'}
              >
                Save service areas
              </Button>
            </div>
            {errors.serviceAreas ? (
              <p className="text-sm text-destructive">{errors.serviceAreas}</p>
            ) : null}
          </DiscoveryFamilyPanel>

          <DiscoveryFamilyPanel embedded={embedded} family="attributes">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">{SYNC_POSTURE.attributes}</p>
              <p className="text-xs text-muted-foreground">
                {formatSeedSource(seedSource.attributes, providerCounts.attributes)}
              </p>
              <SummaryBadges
                coreCount={coreCounts.attributes}
                providerCount={providerCounts.attributes}
                seedSource={seedSource.attributes}
              />
            </div>

            {attributes.map((row) => (
              <div key={row.id} className="space-y-4 rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {row.displayName || row.attributeKey || 'New attribute'}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAttributes((current) => current.filter((item) => item.id !== row.id));
                      markDirty('attributes');
                    }}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Group', 'attributeGroup'],
                    ['Key', 'attributeKey'],
                    ['Name', 'attributeName'],
                    ['Reference ID', 'attributeId'],
                    ['Display name', 'displayName'],
                    ['Value type', 'valueType'],
                  ].map(([label, field]) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
                      <Input
                        id={makeFieldId('attributes', row.id, field)}
                        value={row[field as keyof AttributeEditor] as string}
                        onChange={(event) => {
                          setAttributes((current) =>
                            current.map((item) =>
                              item.id === row.id ? { ...item, [field]: event.target.value } : item,
                            ),
                          );
                          markDirty('attributes');
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('attributes', row.id, 'boolValue')}>
                      Boolean value
                    </Label>
                    <Select
                      value={row.boolValue}
                      onValueChange={(value) => {
                        setAttributes((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, boolValue: value as AttributeEditor['boolValue'] }
                              : item,
                          ),
                        );
                        markDirty('attributes');
                      }}
                    >
                      <SelectTrigger
                        id={makeFieldId('attributes', row.id, 'boolValue')}
                        aria-label="Boolean value"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">Unset</SelectItem>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('attributes', row.id, 'textValue')}>
                      Text value
                    </Label>
                    <Input
                      id={makeFieldId('attributes', row.id, 'textValue')}
                      value={row.textValue}
                      onChange={(event) => {
                        setAttributes((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, textValue: event.target.value } : item,
                          ),
                        );
                        markDirty('attributes');
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={makeFieldId('attributes', row.id, 'uriValue')}>
                      Primary URI
                    </Label>
                    <Input
                      id={makeFieldId('attributes', row.id, 'uriValue')}
                      value={row.uriValue}
                      onChange={(event) => {
                        setAttributes((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, uriValue: event.target.value } : item,
                          ),
                        );
                        markDirty('attributes');
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Guest-facing text', 'displayText'],
                    ['Standalone text', 'displayTextStandalone'],
                    ['Text when unavailable', 'displayTextNegative'],
                    ['Link values, comma separated', 'uriValuesText'],
                    ['Selected values, comma separated', 'enumValuesText'],
                    ['Excluded values, comma separated', 'unsetEnumValuesText'],
                  ].map(([label, field]) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
                      <Input
                        id={makeFieldId('attributes', row.id, field)}
                        value={row[field as keyof AttributeEditor] as string}
                        onChange={(event) => {
                          setAttributes((current) =>
                            current.map((item) =>
                              item.id === row.id ? { ...item, [field]: event.target.value } : item,
                            ),
                          );
                          markDirty('attributes');
                        }}
                      />
                    </div>
                  ))}
                </div>
                <Collapsible className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm font-medium text-foreground">Advanced values</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Keep these collapsed unless a profile provider sends structured values.
                        </span>
                      </span>
                      <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={makeFieldId('attributes', row.id, 'valueMetadataJson')}>
                          Value details
                        </Label>
                        <Textarea
                          id={makeFieldId('attributes', row.id, 'valueMetadataJson')}
                          value={row.valueMetadataJson}
                          rows={5}
                          onChange={(event) => {
                            setAttributes((current) =>
                              current.map((item) =>
                                item.id === row.id
                                  ? { ...item, valueMetadataJson: event.target.value }
                                  : item,
                              ),
                            );
                            markDirty('attributes');
                          }}
                        />
                      </div>
                      <div className="grid gap-4 lg:grid-cols-3">
                        {[
                          ['Raw value', 'rawValueJson'],
                          ['Raw selected values', 'rawEnumValuesJson'],
                          ['Display value', 'displayValueJson'],
                        ].map(([label, field]) => (
                          <div key={field} className="space-y-2">
                            <Label htmlFor={makeFieldId('attributes', row.id, field)}>
                              {label}
                            </Label>
                            <Textarea
                              id={makeFieldId('attributes', row.id, field)}
                              value={row[field as keyof AttributeEditor] as string}
                              rows={5}
                              onChange={(event) => {
                                setAttributes((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? { ...item, [field]: event.target.value }
                                      : item,
                                  ),
                                );
                                markDirty('attributes');
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAttributes((current) => [
                    ...current,
                    {
                      id: makeEditorId('attribute'),
                      attributeGroup: '',
                      attributeKey: '',
                      attributeName: '',
                      attributeId: '',
                      displayName: '',
                      displayText: '',
                      displayTextStandalone: '',
                      displayTextNegative: '',
                      valueType: 'text',
                      boolValue: 'unset',
                      textValue: '',
                      uriValue: '',
                      uriValuesText: '',
                      enumValuesText: '',
                      unsetEnumValuesText: '',
                      rawValueJson: '',
                      rawEnumValuesJson: '',
                      displayValueJson: '',
                      valueMetadataJson: '',
                    },
                  ]);
                  markDirty('attributes');
                }}
              >
                <Plus className="size-4" />
                Add attribute
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => resetFamily('attributes')}
                disabled={!dirty.attributes}
              >
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button
                type="button"
                onClick={() => saveFamily('attributes')}
                disabled={!dirty.attributes || savingFamily === 'attributes'}
              >
                Save attributes
              </Button>
            </div>
            {errors.attributes ? (
              <p className="text-sm text-destructive">{errors.attributes}</p>
            ) : null}
          </DiscoveryFamilyPanel>

          <DiscoveryFamilyPanel embedded={embedded} family="serviceItems">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">{SYNC_POSTURE.serviceItems}</p>
              <p className="text-xs text-muted-foreground">
                {formatSeedSource(seedSource.serviceItems, providerCounts.serviceItems)}
              </p>
              <SummaryBadges
                coreCount={coreCounts.serviceItems}
                providerCount={providerCounts.serviceItems}
                seedSource={seedSource.serviceItems}
              />
            </div>

            {serviceItems.map((row) => (
              <div key={row.id} className="space-y-4 rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {row.displayName || row.itemKey || 'New service item'}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setServiceItems((current) => current.filter((item) => item.id !== row.id));
                      markDirty('serviceItems');
                    }}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Service code', 'itemKey'],
                    ['Service type', 'itemType'],
                    ['Display name', 'displayName'],
                    ['Description', 'description'],
                  ].map(([label, field]) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={makeFieldId('serviceItems', row.id, field)}>{label}</Label>
                      <Input
                        id={makeFieldId('serviceItems', row.id, field)}
                        value={row[field as keyof ServiceItemEditor] as string}
                        onChange={(event) => {
                          setServiceItems((current) =>
                            current.map((item) =>
                              item.id === row.id ? { ...item, [field]: event.target.value } : item,
                            ),
                          );
                          markDirty('serviceItems');
                        }}
                      />
                    </div>
                  ))}
                </div>
                <Collapsible className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm font-medium text-foreground">
                          Advanced service data
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Keep this collapsed unless a provider sends extra service details.
                        </span>
                      </span>
                      <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="space-y-2">
                      <Label htmlFor={makeFieldId('serviceItems', row.id, 'payloadJson')}>
                        Service details
                      </Label>
                      <Textarea
                        id={makeFieldId('serviceItems', row.id, 'payloadJson')}
                        value={row.payloadJson}
                        rows={5}
                        onChange={(event) => {
                          setServiceItems((current) =>
                            current.map((item) =>
                              item.id === row.id
                                ? { ...item, payloadJson: event.target.value }
                                : item,
                            ),
                          );
                          markDirty('serviceItems');
                        }}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setServiceItems((current) => [
                    ...current,
                    {
                      id: makeEditorId('service-item'),
                      itemKey: '',
                      itemType: '',
                      displayName: '',
                      description: '',
                      payloadJson: '',
                    },
                  ]);
                  markDirty('serviceItems');
                }}
              >
                <Plus className="size-4" />
                Add service item
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => resetFamily('serviceItems')}
                disabled={!dirty.serviceItems}
              >
                <RotateCcw className="size-4" />
                Reset draft
              </Button>
              <Button
                type="button"
                onClick={() => saveFamily('serviceItems')}
                disabled={!dirty.serviceItems || savingFamily === 'serviceItems'}
              >
                Save service items
              </Button>
            </div>
            {errors.serviceItems ? (
              <p className="text-sm text-destructive">{errors.serviceItems}</p>
            ) : null}
          </DiscoveryFamilyPanel>
        </DiscoveryPanelsFrame>
      </div>
    ),
  });
}
