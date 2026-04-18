'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { GoogleBusinessProfileCoreAlignmentSections } from './GoogleBusinessProfileCoreAlignmentSections';
import { SettingsCard, SettingsSectionHeader } from './shared';

import type {
  GoogleBusinessProfileBusinessInfo,
  GoogleBusinessProfileFieldVerification,
} from '@/services/ops/restaurants';

type GoogleBusinessProfileBusinessInfoPanelProps = {
  businessName: string | null;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  lastPullAt: string | null;
};

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return value;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return value;
  }

  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const baseHour = hours % 12 || 12;
  const minuteText = String(minutes).padStart(2, '0');
  return `${baseHour}:${minuteText} ${meridiem}`;
}

function formatDay(day: number | null): string | null {
  if (day === null || day < 0 || day >= DAY_LABELS.length) {
    return null;
  }
  return DAY_LABELS[day] ?? null;
}

function formatHoursLabel(entry: GoogleBusinessProfileBusinessInfo['hours'][number]): string {
  if (entry.hoursType === 'special') {
    const start = formatDate(entry.startDate) ?? entry.startDate ?? 'Special date';
    const end = formatDate(entry.endDate) ?? entry.endDate ?? null;
    return end && end !== start ? `${start} to ${end}` : start;
  }

  const openDay = formatDay(entry.openDay) ?? 'Unknown day';
  const closeDay = formatDay(entry.closeDay);
  if (closeDay && closeDay !== openDay) {
    return `${openDay} to ${closeDay}`;
  }
  return openDay;
}

function formatHoursValue(entry: GoogleBusinessProfileBusinessInfo['hours'][number]): string {
  if (entry.isClosed) {
    return 'Closed';
  }

  const openTime = formatTime(entry.openTime) ?? entry.openTime ?? null;
  const closeTime = formatTime(entry.closeTime) ?? entry.closeTime ?? null;
  if (openTime && closeTime) {
    return `${openTime} - ${closeTime}`;
  }
  return 'Hours unavailable';
}

function groupAttributes(attributes: GoogleBusinessProfileBusinessInfo['attributes']): Array<{
  group: string;
  items: GoogleBusinessProfileBusinessInfo['attributes'];
}> {
  const groups = new Map<string, GoogleBusinessProfileBusinessInfo['attributes']>();

  for (const attribute of attributes) {
    const key = attribute.attributeGroup ?? 'Other';
    const existing = groups.get(key) ?? [];
    existing.push(attribute);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([group, items]) => ({
    group,
    items,
  }));
}

function normalizeComparableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function stripPrefixedLabel(value: string, label: string | null): string {
  if (!label) {
    return value;
  }

  const prefix = `${label}:`;
  return value.toLowerCase().startsWith(prefix.toLowerCase())
    ? value.slice(prefix.length).trim()
    : value;
}

function getAttributeDetail(
  attribute: GoogleBusinessProfileBusinessInfo['attributes'][number],
): { text: string; href?: string } | null {
  if (attribute.valueType === 'boolean') {
    if (attribute.boolValue === true) {
      return { text: 'Yes' };
    }

    if (attribute.boolValue === false) {
      return { text: 'No' };
    }
  }

  if (attribute.uriValue) {
    return { text: attribute.uriValue, href: attribute.uriValue };
  }

  if (attribute.enumValues.length > 0) {
    return { text: attribute.enumValues.join(', ') };
  }

  const label = attribute.displayName ?? null;
  const textValue = stripPrefixedLabel(attribute.textValue ?? '', label);
  if (textValue) {
    return { text: textValue };
  }

  const displayText = stripPrefixedLabel(attribute.displayText ?? '', label);
  if (displayText && normalizeComparableText(displayText) !== normalizeComparableText(label)) {
    return { text: displayText };
  }

  return null;
}

function KeyValueList(props: {
  items: Array<{
    label: string;
    value: React.ReactNode;
    verification?: GoogleBusinessProfileFieldVerification | null;
  }>;
}) {
  return (
    <dl className="grid gap-3">
      {props.items.map((item) => (
        <div key={item.label} className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-start">
          <dt className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{item.label}</span>
            <VerificationBadge verification={item.verification} />
          </dt>
          <dd className="text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function VerificationBadge(props: {
  verification?: GoogleBusinessProfileFieldVerification | null;
  className?: string;
}) {
  const verification = props.verification;
  if (!verification) {
    return null;
  }

  const isVerified = verification.isVerified && verification.syncStatus === 'synced';

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide',
        isVerified
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
        props.className,
      )}
    >
      {isVerified ? 'Verified' : 'Drifted'}
    </Badge>
  );
}

export function GoogleBusinessProfileBusinessInfoPanel({
  businessName,
  businessInfo,
  lastPullAt,
}: GoogleBusinessProfileBusinessInfoPanelProps) {
  const hasBusinessInfo =
    businessInfo.details !== null ||
    businessInfo.addresses.length > 0 ||
    businessInfo.phoneNumbers.length > 0 ||
    businessInfo.links.length > 0 ||
    businessInfo.categories.length > 0 ||
    businessInfo.serviceAreas.length > 0 ||
    businessInfo.hours.length > 0 ||
    businessInfo.attributes.length > 0;

  if (!hasBusinessInfo) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-5 text-sm text-muted-foreground">
        No GBP business information has been synced into Nabatable yet. Use{' '}
        <span className="font-medium text-foreground">Sync now</span> after linking a location to
        fetch the canonical business-information record.
      </div>
    );
  }

  const groupedHours = [
    {
      label: 'Hours',
      items: businessInfo.hours.filter((entry) => entry.hoursType === 'public'),
    },
    {
      label: 'Special hours',
      items: businessInfo.hours.filter((entry) => entry.hoursType === 'special'),
    },
    {
      label: 'More hours',
      items: businessInfo.hours.filter((entry) => entry.hoursType === 'service'),
    },
  ].filter((group) => group.items.length > 0);

  const attributeGroups = groupAttributes(businessInfo.attributes);
  const coreNormalization = businessInfo.coreNormalization ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">Canonical Nabatable data</Badge>
        {lastPullAt ? <span>Last synced {formatDate(lastPullAt)}</span> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsCard title="About" className="h-full">
          <KeyValueList
            items={[
              {
                label: 'Business name',
                value: businessName ?? 'Not available',
              },
              {
                label: 'Description',
                value: businessInfo.details?.description ?? 'Not available',
                verification: businessInfo.details?.verification?.description,
              },
              {
                label: 'Opening date',
                value: formatDate(businessInfo.details?.openingDate ?? null) ?? 'Not available',
                verification: businessInfo.details?.verification?.openingDate,
              },
              {
                label: 'Business status',
                value: businessInfo.details?.businessStatus ?? 'Not available',
                verification: businessInfo.details?.verification?.businessStatus,
              },
            ]}
          />
        </SettingsCard>

        <SettingsCard title="Contact" className="h-full">
          <KeyValueList
            items={[
              {
                label: 'Phone numbers',
                value:
                  businessInfo.phoneNumbers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {businessInfo.phoneNumbers.map((phone) => (
                        <div key={phone.id} className="flex items-center gap-2">
                          <Badge variant={phone.isPrimary ? 'default' : 'secondary'}>
                            {phone.phoneNumber}
                          </Badge>
                          <VerificationBadge verification={phone.verificationStatus} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    'Not available'
                  ),
              },
              {
                label: 'Links',
                value:
                  businessInfo.links.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {businessInfo.links.map((link) => (
                        <div key={link.id} className="flex flex-wrap items-center gap-2">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline-offset-4 hover:underline"
                          >
                            {link.label ?? link.linkType}: {link.url}
                          </a>
                          <VerificationBadge verification={link.verificationStatus} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    'Not available'
                  ),
              },
            ]}
          />
        </SettingsCard>

        <SettingsCard title="Location" className="h-full">
          <KeyValueList
            items={[
              {
                label: 'Business location',
                value:
                  businessInfo.addresses.length > 0 ? (
                    <div className="space-y-1">
                      {businessInfo.addresses.map((address) => (
                        <div key={address.id} className="flex flex-wrap items-center gap-2">
                          <p>{address.formattedAddress ?? 'Address unavailable'}</p>
                          <VerificationBadge verification={address.verificationStatus} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    'Not available'
                  ),
              },
              {
                label: 'Service area',
                value:
                  businessInfo.serviceAreas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {businessInfo.serviceAreas.map((area) => (
                        <div key={area.id} className="flex items-center gap-2">
                          <Badge variant="outline">{area.displayName}</Badge>
                          <VerificationBadge verification={area.verificationStatus} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    'Not available'
                  ),
              },
            ]}
          />
        </SettingsCard>

        <SettingsCard title="Categories" className="h-full">
          {businessInfo.categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {businessInfo.categories.map((category) => (
                <div key={category.id} className="flex items-center gap-2">
                  <Badge variant={category.isPrimary ? 'default' : 'secondary'}>
                    {category.displayName}
                  </Badge>
                  <VerificationBadge verification={category.verificationStatus} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No categories synced.</p>
          )}
        </SettingsCard>
      </div>

      <SettingsCard
        title="GBP Hours"
        description="Read-only storefront, special, and more-hours data synced from Google Business Profile."
      >
        <div className="space-y-6">
          <SettingsSectionHeader
            title="Raw GBP Hours"
            description="These are the canonical GBP-backed hour rows stored in Nabatable before any comparison to core scheduling tables."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {groupedHours.map((group) => (
              <div key={group.label} className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">{group.label}</h4>
                <div className="space-y-2">
                  {group.items.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-border/60 bg-background/70 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {formatHoursLabel(entry)}
                          </p>
                          <VerificationBadge verification={entry.verificationStatus} />
                        </div>
                        {entry.periodLabel ? (
                          <Badge variant="outline" className="whitespace-nowrap">
                            {entry.periodLabel}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatHoursValue(entry)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SettingsCard>

      <GoogleBusinessProfileCoreAlignmentSections coreNormalization={coreNormalization} />

      <SettingsCard title="More">
        <div className="grid gap-4 lg:grid-cols-2">
          {attributeGroups.map((group) => (
            <div key={group.group} className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">{group.group}</h4>
              <div className="space-y-2">
                {group.items.map((attribute) => (
                  <div
                    key={attribute.id}
                    className="rounded-lg border border-border/60 bg-background/70 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {attribute.displayName ?? attribute.attributeKey}
                      </p>
                      <VerificationBadge verification={attribute.verificationStatus} />
                    </div>
                    {(() => {
                      const detail = getAttributeDetail(attribute);
                      if (!detail) {
                        return null;
                      }

                      return detail.href ? (
                        <a
                          href={detail.href}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {detail.text}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">{detail.text}</p>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
