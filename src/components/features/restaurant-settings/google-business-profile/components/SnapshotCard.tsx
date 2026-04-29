'use client';

import { ExternalLink, Globe, MapPin, Phone, Star } from 'lucide-react';
import { Fragment } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { formatGbpDate } from '../lib/formatters';

import type { GoogleBusinessProfileBusinessInfo } from '@/services/ops/restaurants';
import type { LucideIcon } from 'lucide-react';

type SnapshotCardProps = {
  businessInfo: GoogleBusinessProfileBusinessInfo;
};

function DefinitionList({
  entries,
}: {
  entries: Array<{ label: string; value: string | null | undefined }>;
}) {
  const filtered = entries.filter((entry) => entry.value && entry.value.trim().length > 0);

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground">No details available yet.</p>;
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {filtered.map((entry) => (
        <div key={entry.label} className="space-y-0.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {entry.label}
          </dt>
          <dd className="text-sm text-foreground">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatCoordinate(value: number | null | undefined): string | null {
  return typeof value === 'number' ? value.toFixed(6) : null;
}

function CategoryList({ businessInfo }: { businessInfo: GoogleBusinessProfileBusinessInfo }) {
  if (businessInfo.categories.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Categories
      </p>
      <div className="flex flex-wrap gap-2">
        {businessInfo.categories.map((category) => (
          <Badge
            key={category.id}
            variant={category.isPrimary ? 'default' : 'secondary'}
            className="text-xs"
          >
            {category.displayName}
            {category.isPrimary ? ' · primary' : null}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function AboutPanel({ businessInfo }: { businessInfo: GoogleBusinessProfileBusinessInfo }) {
  const details = businessInfo.details;
  return (
    <div className="space-y-4">
      <DefinitionList
        entries={[
          { label: 'Business name', value: details?.businessName ?? null },
          { label: 'Status', value: details?.businessStatus ?? null },
          { label: 'Language', value: details?.languageCode ?? null },
          { label: 'Opening date', value: formatGbpDate(details?.openingDate ?? null) },
        ]}
      />
      {details?.description ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </p>
          <p className="text-sm text-foreground">{details.description}</p>
        </div>
      ) : null}
      <CategoryList businessInfo={businessInfo} />
    </div>
  );
}

const LINK_ICONS: Record<string, LucideIcon> = {
  website: Globe,
  google_map: MapPin,
  google_review: Star,
};

const LINK_LABELS: Record<string, string> = {
  website: 'Website',
  google_map: 'Google Maps',
  google_review: 'Google reviews',
};

const PHONE_LABELS: Record<string, string> = {
  primary: 'Primary',
  additional: 'Additional',
  mobile: 'Mobile',
};

function formatDisplayUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname}${path}${parsed.search}`.replace(/\/$/, '');
  } catch {
    return raw;
  }
}

function ContactPanel({ businessInfo }: { businessInfo: GoogleBusinessProfileBusinessInfo }) {
  const hasPhones = businessInfo.phoneNumbers.length > 0;
  const hasLinks = businessInfo.links.length > 0;

  if (!hasPhones && !hasLinks) {
    return (
      <p className="text-sm text-muted-foreground">
        No phone numbers or links on this Google Business Profile yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Phone numbers
        </p>
        {hasPhones ? (
          <ul className="space-y-2">
            {businessInfo.phoneNumbers.map((phone) => (
              <li
                key={phone.id}
                className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 space-y-0.5">
                  <a
                    href={`tel:${phone.phoneNumber}`}
                    className="block truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {phone.phoneNumber}
                  </a>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <span>{PHONE_LABELS[phone.phoneKind] ?? phone.phoneKind}</span>
                    {phone.isPrimary ? (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        Primary
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No phone numbers published.</p>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Links</p>
        {hasLinks ? (
          <ul className="space-y-2">
            {businessInfo.links.map((link) => {
              const Icon = LINK_ICONS[link.linkType] ?? ExternalLink;
              const label = link.label ?? LINK_LABELS[link.linkType] ?? link.linkType;
              return (
                <li
                  key={link.id}
                  className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      {link.isPrimary ? (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                          Primary
                        </Badge>
                      ) : null}
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs text-primary underline-offset-2 hover:underline"
                      title={link.url}
                    >
                      {formatDisplayUrl(link.url)}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No website or Google links.</p>
        )}
      </div>
    </div>
  );
}

function LocationPanel({ businessInfo }: { businessInfo: GoogleBusinessProfileBusinessInfo }) {
  if (businessInfo.addresses.length === 0 && businessInfo.serviceAreas.length === 0) {
    return <p className="text-sm text-muted-foreground">No location data available yet.</p>;
  }
  return (
    <div className="space-y-4">
      {businessInfo.addresses.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Addresses
          </p>
          <ul className="space-y-2 text-sm">
            {businessInfo.addresses.map((address) => (
              <li key={address.id} className="space-y-0.5">
                <p className="font-medium text-foreground">
                  {address.formattedAddress ?? address.addressLines.join(', ') ?? 'Unnamed address'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {address.addressType}
                  {address.isPrimary ? ' · primary' : null}
                </p>
                {address.latitude !== null || address.longitude !== null ? (
                  <p className="text-xs text-muted-foreground">
                    Lat/lng: {formatCoordinate(address.latitude) ?? 'unknown'},{' '}
                    {formatCoordinate(address.longitude) ?? 'unknown'}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {businessInfo.serviceAreas.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Service areas
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {businessInfo.serviceAreas.map((area) => (
              <li key={area.id} className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="font-medium text-foreground">{area.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {area.areaType}
                  {area.googlePlaceId ? ` · ${area.googlePlaceId}` : ''}
                </p>
                {area.googlePlaceResourceName ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {area.googlePlaceResourceName}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AttributesPanel({ businessInfo }: { businessInfo: GoogleBusinessProfileBusinessInfo }) {
  if (businessInfo.attributes.length === 0) {
    return <p className="text-sm text-muted-foreground">No structured attributes returned.</p>;
  }

  const grouped = new Map<string, GoogleBusinessProfileBusinessInfo['attributes']>();
  for (const attribute of businessInfo.attributes) {
    const group = attribute.attributeGroup ?? 'Other';
    const current = grouped.get(group) ?? [];
    current.push(attribute);
    grouped.set(group, current);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([group, attributes], index) => (
        <Fragment key={group}>
          {index > 0 ? <Separator /> : null}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {attributes.map((attribute) => (
                <li
                  key={attribute.id}
                  className="flex flex-col rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground">
                    {attribute.displayName ?? attribute.attributeKey}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {attribute.displayText ??
                      attribute.displayTextStandalone ??
                      attribute.textValue ??
                      (attribute.boolValue === null
                        ? 'Not set'
                        : attribute.boolValue
                          ? 'Yes'
                          : 'No')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function SnapshotCard({ businessInfo }: SnapshotCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Google snapshot</CardTitle>
        <CardDescription>
          Raw data cached from Google Business Profile at the last sync. Expand a section to see
          details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="about">
            <AccordionTrigger>About</AccordionTrigger>
            <AccordionContent>
              <AboutPanel businessInfo={businessInfo} />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="contact">
            <AccordionTrigger>Contact</AccordionTrigger>
            <AccordionContent>
              <ContactPanel businessInfo={businessInfo} />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="location">
            <AccordionTrigger>Location</AccordionTrigger>
            <AccordionContent>
              <LocationPanel businessInfo={businessInfo} />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="attributes">
            <AccordionTrigger>Attributes</AccordionTrigger>
            <AccordionContent>
              <AttributesPanel businessInfo={businessInfo} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
