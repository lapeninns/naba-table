'use client';

import { ChevronDown, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import {
  Children,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { opsHref } from '@/lib/url/opsHref';

import {
  AMENITY_ATTRIBUTE_GROUPS,
  AMENITY_ATTRIBUTE_KEYS,
  DISCOVERY_SECTION_DESCRIPTIONS,
  DISCOVERY_SECTION_ORDER,
  LINK_TYPE_OPTIONS,
  SYNC_POSTURE,
  TAB_LABELS,
  formatAttributeTitle,
  formatCategoryTitle,
  formatMoreHoursTypeLabel,
  formatSeedSource,
  formatServiceAreaTitle,
  makeFieldId,
  type AttributeEditor,
  type BusinessDetailsEditor,
  type FamilyKey,
  type SeedSource,
  type ServiceAreaEditor,
  type ServiceItemEditor,
} from './businessContextModel';

import type { RestaurantBusinessContextEditor } from './useRestaurantBusinessContextEditor';

const DISCOVERY_SAVE_BOUNDARIES: Record<FamilyKey, string> = {
  businessDetails: 'This saves profile basics only.',
  links: 'This saves discovery links only.',
  categories: 'This saves dining categories only.',
  serviceAreas: 'This saves service areas only.',
  attributes: 'This saves amenities only.',
  serviceItems: 'This saves services only.',
};

function isDiscoveryFamily(value: string): value is FamilyKey {
  return DISCOVERY_SECTION_ORDER.includes(value as FamilyKey);
}

function formatDiscoveryTriggerLabel(family: FamilyKey, editor: RestaurantBusinessContextEditor) {
  return [
    TAB_LABELS[family],
    editor.dirty[family] ? 'unsaved changes' : null,
    editor.errors[family] ? 'needs attention' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function DiscoveryStatusLine({
  family,
  coreCount,
  providerCount,
  seedSource,
}: {
  family: FamilyKey;
  coreCount: number;
  providerCount: number;
  seedSource: SeedSource[FamilyKey];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-foreground">{SYNC_POSTURE[family]}</p>
      <p className="text-xs text-muted-foreground">
        Saved {coreCount} · Suggested {providerCount} ·{' '}
        {formatSeedSource(seedSource, providerCount)}
      </p>
    </div>
  );
}

function DiscoverySaveBoundary({
  family,
  editor,
}: {
  family: FamilyKey;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {editor.dirty[family] ? <Badge variant="secondary">Dirty</Badge> : null}
      {editor.savedFamily === family ? (
        <Badge variant="outline" role="status">
          Saved
        </Badge>
      ) : null}
      {editor.errors[family] ? <Badge variant="destructive">Error</Badge> : null}
      <span className="text-xs text-muted-foreground">{DISCOVERY_SAVE_BOUNDARIES[family]}</span>
    </div>
  );
}

function FamilyStatus({
  family,
  editor,
}: {
  family: FamilyKey;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <DiscoveryStatusLine
      family={family}
      coreCount={editor.coreCounts[family]}
      providerCount={editor.providerCounts[family]}
      seedSource={editor.seedSource[family]}
    />
  );
}

function FamilyActions({
  family,
  editor,
  saveLabel,
  children,
}: {
  family: FamilyKey;
  editor: RestaurantBusinessContextEditor;
  saveLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <DiscoverySaveBoundary family={family} editor={editor} />
      {children}
      <Button
        type="button"
        variant="outline"
        onClick={() => editor.resetFamily(family)}
        disabled={!editor.dirty[family]}
      >
        <RotateCcw className="size-4" />
        Reset draft
      </Button>
      <Button
        type="button"
        onClick={() => void editor.saveFamily(family)}
        disabled={!editor.dirty[family] || editor.savingFamily === family}
      >
        {saveLabel}
      </Button>
    </div>
  );
}

function FamilyError({
  family,
  editor,
}: {
  family: FamilyKey;
  editor: RestaurantBusinessContextEditor;
}) {
  const message = editor.errors[family];
  // RP-UX-07: announce family save failures so screen readers and live-region
  // listeners can react and operators can recover without re-reading the page.
  return message ? (
    <p
      className="text-sm text-destructive"
      role="alert"
      aria-live="assertive"
      data-discovery-family-error={family}
      tabIndex={-1}
    >
      {message}
    </p>
  ) : null;
}

export function DiscoveryPanelsFrame({
  embedded,
  activeTab,
  onActiveTabChange,
  editor,
  children,
}: {
  embedded: boolean;
  activeTab: FamilyKey | '';
  onActiveTabChange: (value: FamilyKey | '') => void;
  editor: RestaurantBusinessContextEditor;
  children: ReactNode;
}) {
  const childArray = Children.toArray(children);
  const findChild = (family: FamilyKey) =>
    childArray.find(
      (child): child is ReactElement<{ family: FamilyKey }> =>
        isValidElement<{ family: FamilyKey }>(child) && child.props.family === family,
    );

  return (
    <div className={embedded ? 'flex flex-col gap-3' : 'flex flex-col gap-4'}>
      <Accordion
        type="single"
        collapsible
        value={activeTab}
        onValueChange={(value) => {
          if (!value) {
            onActiveTabChange('');
            return;
          }
          if (isDiscoveryFamily(value)) {
            onActiveTabChange(value);
          }
        }}
        className="rounded-lg border border-border/60"
      >
        {DISCOVERY_SECTION_ORDER.map((family) => {
          const child = findChild(family);

          if (!child) {
            return null;
          }

          return (
            <AccordionItem key={family} value={family}>
              <AccordionTrigger
                aria-label={formatDiscoveryTriggerLabel(family, editor)}
                className="px-4 py-4 hover:no-underline"
              >
                <span className="flex min-w-0 flex-col gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground">
                      {TAB_LABELS[family]}
                    </span>
                    {editor.dirty[family] ? (
                      <Badge variant="secondary">Unsaved changes</Badge>
                    ) : null}
                    {editor.errors[family] ? (
                      <Badge variant="destructive">Needs attention</Badge>
                    ) : null}
                  </span>
                  <span className="text-sm font-normal leading-5 text-muted-foreground">
                    {DISCOVERY_SECTION_DESCRIPTIONS[family]}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>{child}</AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <p className="px-1 text-xs text-muted-foreground">
        See “About Google suggestions” above for import details.{' '}
        <Link href={opsHref('/settings/restaurant/google-business-profile')} className="underline">
          GBP workspace
        </Link>
      </p>
    </div>
  );
}

export function DiscoveryFamilyPanel({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

export function BusinessDetailsPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="businessDetails" editor={editor} />

      <div className="space-y-4 rounded-xl border border-border/60 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business-details-opening-date">Opening date</Label>
            <Input
              id="business-details-opening-date"
              type="date"
              value={editor.businessDetails.openingDate}
              onChange={(event) => editor.updateBusinessDetails('openingDate', event.target.value)}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Optional public opening date for the venue.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-details-status">Business status</Label>
            <Select
              value={editor.businessDetails.businessStatus}
              onValueChange={(value) =>
                editor.updateBusinessDetails(
                  'businessStatus',
                  value as BusinessDetailsEditor['businessStatus'],
                )
              }
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
            checked={editor.businessDetails.isServiceAreaBusiness}
            onCheckedChange={(checked) =>
              editor.updateBusinessDetails('isServiceAreaBusiness', checked)
            }
          />
          <div className="space-y-1">
            <Label htmlFor="business-details-service-area-business">Service-area business</Label>
            <p className="text-xs leading-5 text-muted-foreground">
              Mark this when the restaurant serves guests beyond the venue.
            </p>
          </div>
        </div>
      </div>

      <FamilyActions family="businessDetails" editor={editor} saveLabel="Save profile basics" />
      <FamilyError family="businessDetails" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}

export function LinksPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="links" editor={editor} />

      {editor.links.map((row) => (
        <div key={row.id} className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {row.label ||
                  LINK_TYPE_OPTIONS.find((option) => option.value === row.linkType)?.label ||
                  'New link'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${row.label || row.linkType || 'link'}`}
              title="Remove link"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => editor.removeLink(row.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={makeFieldId('links', row.id, 'linkType')}>Link type</Label>
              <Select
                value={row.linkType}
                onValueChange={(value) => editor.updateLink(row.id, 'linkType', value)}
              >
                <SelectTrigger id={makeFieldId('links', row.id, 'linkType')} aria-label="Link type">
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
                onChange={(event) => editor.updateLink(row.id, 'label', event.target.value)}
              />
            </div>
            <div className="flex items-start gap-3 pt-8">
              <Switch
                id={makeFieldId('links', row.id, 'isPrimary')}
                checked={row.isPrimary}
                onCheckedChange={(checked) => editor.updateLink(row.id, 'isPrimary', checked)}
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
              onChange={(event) => editor.updateLink(row.id, 'url', event.target.value)}
            />
          </div>
        </div>
      ))}

      <FamilyActions family="links" editor={editor} saveLabel="Save links">
        <Button type="button" variant="outline" onClick={editor.addLink}>
          <Plus className="size-4" />
          Add link
        </Button>
      </FamilyActions>
      <FamilyError family="links" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}

export function CategoriesPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="categories" editor={editor} />

      {editor.categories.map((row) => (
        <div key={row.id} className="flex flex-col gap-4 rounded-lg border border-border/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {formatCategoryTitle(row)}
                </p>
                {row.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${formatCategoryTitle(row)}`}
              title="Remove category"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => editor.removeCategory(row.id)}
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
                onChange={(event) =>
                  editor.updateCategory(row.id, 'displayName', event.target.value)
                }
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
                onChange={(event) =>
                  editor.updateCategory(row.id, 'categoryCode', event.target.value)
                }
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
              onCheckedChange={(checked) => editor.updateCategory(row.id, 'isPrimary', checked)}
            />
            <div className="space-y-1">
              <Label
                id={makeFieldId('categories', row.id, 'isPrimary-label')}
                htmlFor={makeFieldId('categories', row.id, 'isPrimary')}
              >
                Primary category
              </Label>
              <p className="text-xs leading-5 text-muted-foreground">
                This is the main category guests and profile providers should see first. Only one
                category can be primary.
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${label || 'more-hours type'}`}
                          className="size-5 rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                          onClick={() => editor.removeMoreHoursType(row.id, typeIndex)}
                        >
                          <X className="size-3" />
                        </Button>
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
                      editor.addMoreHoursTypes(row.id, nextValue);
                      return;
                    }
                    editor.updateMoreHoursDraft(row.id, nextValue);
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      editor.addMoreHoursTypes(row.id, event.currentTarget.value);
                    }
                  }}
                  onBlur={() => editor.addMoreHoursTypes(row.id, row.moreHoursTypeDraft)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => editor.addMoreHoursTypes(row.id, row.moreHoursTypeDraft)}
                >
                  <Plus className="size-4" />
                  Add type
                </Button>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Add labels such as kitchen hours or happy hour when this category needs related
                hours.
              </p>
            </div>
          </div>
        </div>
      ))}

      <FamilyActions family="categories" editor={editor} saveLabel="Save categories">
        <Button type="button" variant="outline" onClick={editor.addCategory}>
          <Plus className="size-4" />
          Add category
        </Button>
      </FamilyActions>
      <FamilyError family="categories" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}

export function ServiceAreasPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="serviceAreas" editor={editor} />

      <div className="flex flex-col gap-4 rounded-lg border border-border/60 p-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Service areas</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Add the places or regions guests can reasonably associate with this restaurant.
          </p>
        </div>

        {editor.serviceAreas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {editor.serviceAreas.map((row) => (
              <Badge key={row.id} variant="secondary" className="gap-1.5 rounded-md py-1 pl-2 pr-1">
                <span>{formatServiceAreaTitle(row)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${formatServiceAreaTitle(row)}`}
                  className="size-5 rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() => editor.removeServiceArea(row.id)}
                >
                  <X className="size-3" />
                </Button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No service areas have been added.</p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={editor.serviceAreaDraft}
            placeholder="Add an area, e.g. Cambridge, UK"
            aria-label="New service area"
            onChange={(event) => editor.setServiceAreaDraft(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                editor.addServiceAreaFromDraft();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={editor.addServiceAreaFromDraft}>
            <Plus className="size-4" />
            Add area
          </Button>
        </div>
      </div>

      {editor.serviceAreas.length > 0 ? (
        <Collapsible className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium text-foreground">
                  Advanced service-area details
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Edit provider IDs and structured place data only when needed.
                </span>
              </span>
              <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="flex flex-col gap-4">
              {editor.serviceAreas.map((row) => (
                <ServiceAreaAdvancedRow key={row.id} row={row} editor={editor} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <FamilyActions family="serviceAreas" editor={editor} saveLabel="Save service areas" />
      <FamilyError family="serviceAreas" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}

function ServiceAreaAdvancedRow({
  row,
  editor,
}: {
  row: ServiceAreaEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {formatServiceAreaTitle(row)}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.areaType || 'region'}
            {row.regionCode ? ` · ${row.regionCode}` : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${formatServiceAreaTitle(row)}`}
          title="Remove service area"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => editor.removeServiceArea(row.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('serviceAreas', row.id, 'displayName')}>Area name</Label>
          <Input
            id={makeFieldId('serviceAreas', row.id, 'displayName')}
            value={row.displayName}
            onChange={(event) =>
              editor.updateServiceArea(row.id, 'displayName', event.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('serviceAreas', row.id, 'areaType')}>Area type</Label>
          <Input
            id={makeFieldId('serviceAreas', row.id, 'areaType')}
            value={row.areaType}
            onChange={(event) => editor.updateServiceArea(row.id, 'areaType', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('serviceAreas', row.id, 'regionCode')}>
            Country or region
          </Label>
          <Input
            id={makeFieldId('serviceAreas', row.id, 'regionCode')}
            value={row.regionCode}
            onChange={(event) => editor.updateServiceArea(row.id, 'regionCode', event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('serviceAreas', row.id, 'googlePlaceId')}>
            Google place ID
          </Label>
          <Input
            id={makeFieldId('serviceAreas', row.id, 'googlePlaceId')}
            value={row.googlePlaceId}
            onChange={(event) =>
              editor.updateServiceArea(row.id, 'googlePlaceId', event.target.value)
            }
          />
        </div>
      </div>
      <Collapsible
        defaultOpen={false}
        className="rounded-lg border border-border/60 bg-muted/20 p-3"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                Show provider payload fields
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                Edit raw place resource and structured place data from providers.
              </span>
            </span>
            <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={makeFieldId('serviceAreas', row.id, 'googlePlaceResourceName')}>
                Place resource
              </Label>
              <Input
                id={makeFieldId('serviceAreas', row.id, 'googlePlaceResourceName')}
                value={row.googlePlaceResourceName}
                onChange={(event) =>
                  editor.updateServiceArea(row.id, 'googlePlaceResourceName', event.target.value)
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={makeFieldId('serviceAreas', row.id, 'placeDataJson')}>Place data</Label>
            <Textarea
              id={makeFieldId('serviceAreas', row.id, 'placeDataJson')}
              value={row.placeDataJson}
              rows={4}
              onChange={(event) =>
                editor.updateServiceArea(row.id, 'placeDataJson', event.target.value)
              }
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function AttributesPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="attributes" editor={editor} />

      <div className="grid gap-4 lg:grid-cols-2">
        {AMENITY_ATTRIBUTE_GROUPS.map((group) => {
          const selectedCount = group.keys.filter(
            (definition) =>
              editor.attributes.find((row) => row.attributeKey === definition.key)?.boolValue ===
              'true',
          ).length;

          return (
            <div
              key={group.title}
              className="flex flex-col gap-4 rounded-lg border border-border/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{group.title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{group.description}</p>
                </div>
                <Badge variant="outline">
                  {selectedCount}/{group.keys.length}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.keys.map((definition) => {
                  const row = editor.attributes.find(
                    (item) => item.attributeKey === definition.key,
                  );
                  const checked = row?.boolValue === 'true';

                  return (
                    <Label
                      key={definition.key}
                      htmlFor={makeFieldId('attributes', definition.key, 'amenity')}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border/50 bg-background p-3 transition-colors hover:bg-muted/30"
                    >
                      <Checkbox
                        id={makeFieldId('attributes', definition.key, 'amenity')}
                        checked={checked}
                        onCheckedChange={(value) =>
                          editor.toggleAmenityAttribute(definition, group.title, value === true)
                        }
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm leading-5 text-foreground">
                          {definition.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row
                            ? row.boolValue === 'false'
                              ? 'Saved as no'
                              : 'Saved detail'
                            : 'Not set'}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Collapsible className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Advanced attribute rows</span>
              <span className="text-xs font-normal text-muted-foreground">
                Review provider keys, text values, enum values, and raw payloads.
              </span>
            </span>
            <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          {editor.attributes.length > 0 ? (
            <div className="flex flex-col gap-4">
              {editor.attributes.map((row) => (
                <AttributeAdvancedRow key={row.id} row={row} editor={editor} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No attribute rows yet.</p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <FamilyActions family="attributes" editor={editor} saveLabel="Save attributes">
        <Button type="button" variant="outline" onClick={editor.addAttribute}>
          <Plus className="size-4" />
          Add attribute
        </Button>
      </FamilyActions>
      <FamilyError family="attributes" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}

function AttributeAdvancedRow({
  row,
  editor,
}: {
  row: AttributeEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  const textFields: Array<[string, keyof AttributeEditor]> = [
    ['Group', 'attributeGroup'],
    ['Key', 'attributeKey'],
    ['Name', 'attributeName'],
    ['Reference ID', 'attributeId'],
    ['Display name', 'displayName'],
    ['Value type', 'valueType'],
  ];
  const valueFields: Array<[string, keyof AttributeEditor]> = [
    ['Guest-facing text', 'displayText'],
    ['Standalone text', 'displayTextStandalone'],
    ['Text when unavailable', 'displayTextNegative'],
    ['Link values, comma separated', 'uriValuesText'],
    ['Selected values, comma separated', 'enumValuesText'],
    ['Excluded values, comma separated', 'unsetEnumValuesText'],
  ];
  const jsonFields: Array<[string, keyof AttributeEditor]> = [
    ['Raw value', 'rawValueJson'],
    ['Raw selected values', 'rawEnumValuesJson'],
    ['Display value', 'displayValueJson'],
  ];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {formatAttributeTitle(row)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {AMENITY_ATTRIBUTE_KEYS.has(row.attributeKey)
              ? 'Shown in grouped amenities'
              : row.attributeKey || 'No key set'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.removeAttribute(row.id)}
        >
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {textFields.map(([label, field]) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
            <Input
              id={makeFieldId('attributes', row.id, field)}
              value={row[field] as string}
              onChange={(event) => editor.updateAttribute(row.id, field, event.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('attributes', row.id, 'boolValue')}>Boolean value</Label>
          <Select
            value={row.boolValue}
            onValueChange={(value) =>
              editor.updateAttribute(row.id, 'boolValue', value as AttributeEditor['boolValue'])
            }
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
          <Label htmlFor={makeFieldId('attributes', row.id, 'textValue')}>Text value</Label>
          <Input
            id={makeFieldId('attributes', row.id, 'textValue')}
            value={row.textValue}
            onChange={(event) => editor.updateAttribute(row.id, 'textValue', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('attributes', row.id, 'uriValue')}>Primary URI</Label>
          <Input
            id={makeFieldId('attributes', row.id, 'uriValue')}
            value={row.uriValue}
            onChange={(event) => editor.updateAttribute(row.id, 'uriValue', event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {valueFields.map(([label, field]) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
            <Input
              id={makeFieldId('attributes', row.id, field)}
              value={row[field] as string}
              onChange={(event) => editor.updateAttribute(row.id, field, event.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('attributes', row.id, 'valueMetadataJson')}>
            Value details
          </Label>
          <Textarea
            id={makeFieldId('attributes', row.id, 'valueMetadataJson')}
            value={row.valueMetadataJson}
            rows={5}
            onChange={(event) =>
              editor.updateAttribute(row.id, 'valueMetadataJson', event.target.value)
            }
          />
        </div>
        <Collapsible
          defaultOpen={false}
          className="rounded-md border border-border/50 bg-muted/10 p-2.5"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium text-foreground">
                  Show provider payload fields
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Raw value JSON, enum value JSON, and display value JSON from providers.
                </span>
              </span>
              <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              {jsonFields.map(([label, field]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
                  <Textarea
                    id={makeFieldId('attributes', row.id, field)}
                    value={row[field] as string}
                    rows={5}
                    onChange={(event) => editor.updateAttribute(row.id, field, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

export function ServiceItemsPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="serviceItems" editor={editor} />

      {editor.serviceItems.map((row) => (
        <ServiceItemRow key={row.id} row={row} editor={editor} />
      ))}

      <FamilyActions family="serviceItems" editor={editor} saveLabel="Save service items">
        <Button type="button" variant="outline" onClick={editor.addServiceItem}>
          <Plus className="size-4" />
          Add service item
        </Button>
      </FamilyActions>
      <FamilyError family="serviceItems" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}

function ServiceItemRow({
  row,
  editor,
}: {
  row: ServiceItemEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  const fields: Array<[string, keyof ServiceItemEditor]> = [
    ['Service code', 'itemKey'],
    ['Service type', 'itemType'],
    ['Display name', 'displayName'],
    ['Description', 'description'],
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {row.displayName || row.itemKey || 'New service item'}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.removeServiceItem(row.id)}
        >
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(([label, field]) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('serviceItems', row.id, field)}>{label}</Label>
            <Input
              id={makeFieldId('serviceItems', row.id, field)}
              value={row[field] as string}
              onChange={(event) => editor.updateServiceItem(row.id, field, event.target.value)}
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
              <span className="text-sm font-medium text-foreground">Advanced service data</span>
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
              onChange={(event) =>
                editor.updateServiceItem(row.id, 'payloadJson', event.target.value)
              }
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
