'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import {
  formatGoogleBusinessProfileDate,
  GoogleBusinessProfileVerificationBadge,
} from './GoogleBusinessProfileUiHelpers';

import type {
  GoogleBusinessProfileBusinessInfo,
  GoogleBusinessProfileFieldVerification,
} from '@/services/ops/restaurants';
import type { ReactNode } from 'react';

type GoogleBusinessProfileBusinessInfoPanelProps = {
  businessName: string | null;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  lastPullAt: string | null;
};

function SnapshotSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-background/95 px-5 py-5 sm:px-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function KeyValueList(props: {
  items: Array<{
    label: string;
    value: ReactNode;
    verification?: GoogleBusinessProfileFieldVerification | null;
  }>;
}) {
  return (
    <dl className="grid gap-4">
      {props.items.map((item) => (
        <div key={item.label} className="grid gap-1 sm:grid-cols-[150px_1fr] sm:items-start">
          <dt className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{item.label}</span>
            <GoogleBusinessProfileVerificationBadge verification={item.verification} />
          </dt>
          <dd className="text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatLastPull(value: string | null): string {
  const formatted = formatGoogleBusinessProfileDate(value);
  return formatted ? `Last synced ${formatted}` : 'Not yet synced';
}

export function GoogleBusinessProfileBusinessInfoPanel({
  businessName,
  businessInfo,
  lastPullAt,
}: GoogleBusinessProfileBusinessInfoPanelProps) {
  const hasSupportingData =
    businessInfo.details !== null ||
    businessInfo.addresses.length > 0 ||
    businessInfo.phoneNumbers.length > 0 ||
    businessInfo.links.length > 0 ||
    businessInfo.categories.length > 0 ||
    businessInfo.serviceAreas.length > 0;

  if (!hasSupportingData) {
    return (
      <SnapshotSection
        title="Business context"
        description="Contact, location, and category details will appear here after the first successful sync."
      >
        <p className="text-sm text-muted-foreground">
          No supporting Google Business Profile data has been synced into Nabatable yet.
        </p>
      </SnapshotSection>
    );
  }

  return (
    <div className="space-y-6">
      <SnapshotSection
        title="Business context"
        description={`${formatLastPull(lastPullAt)}. Reference-only Google context retained alongside core Nabatable data.`}
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <SnapshotSection
              title="About"
              description="High-level Google business details retained for operator context."
            >
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
                    value:
                      formatGoogleBusinessProfileDate(businessInfo.details?.openingDate ?? null) ??
                      'Not available',
                    verification: businessInfo.details?.verification?.openingDate,
                  },
                  {
                    label: 'Business status',
                    value: businessInfo.details?.businessStatus ?? 'Not available',
                    verification: businessInfo.details?.verification?.businessStatus,
                  },
                ]}
              />
            </SnapshotSection>

            <SnapshotSection
              title="Contact"
              description="Google-facing contact details and first-class destination links."
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Phone numbers
                  </p>
                  {businessInfo.phoneNumbers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {businessInfo.phoneNumbers.map((phone) => (
                        <div
                          key={phone.id}
                          className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5"
                        >
                          <Badge variant={phone.isPrimary ? 'default' : 'secondary'}>
                            {phone.phoneNumber}
                          </Badge>
                          <GoogleBusinessProfileVerificationBadge
                            verification={phone.verificationStatus}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No phone numbers synced.</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Links
                  </p>
                  {businessInfo.links.length > 0 ? (
                    <div className="space-y-3">
                      {businessInfo.links.map((link) => (
                        <div
                          key={link.id}
                          className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {link.label ?? link.linkType}
                            </p>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary underline-offset-4 hover:underline break-all"
                            >
                              {link.url}
                            </a>
                          </div>
                          <GoogleBusinessProfileVerificationBadge
                            verification={link.verificationStatus}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No destination links synced.</p>
                  )}
                </div>
              </div>
            </SnapshotSection>
          </div>

          <div className="space-y-6">
            <SnapshotSection
              title="Location"
              description="Storefront and service-area context synced from Google."
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Business location
                  </p>
                  {businessInfo.addresses.length > 0 ? (
                    <div className="space-y-3">
                      {businessInfo.addresses.map((address) => (
                        <div
                          key={address.id}
                          className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <p className="text-sm text-foreground">
                            {address.formattedAddress ?? 'Address unavailable'}
                          </p>
                          <GoogleBusinessProfileVerificationBadge
                            verification={address.verificationStatus}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No addresses synced.</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Service areas
                  </p>
                  {businessInfo.serviceAreas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {businessInfo.serviceAreas.map((area) => (
                        <div key={area.id} className="flex items-center gap-2">
                          <Badge variant="outline">{area.displayName}</Badge>
                          <GoogleBusinessProfileVerificationBadge
                            verification={area.verificationStatus}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No service areas synced.</p>
                  )}
                </div>
              </div>
            </SnapshotSection>

            <SnapshotSection
              title="Categories"
              description="Google discovery categories kept for operator reference."
            >
              {businessInfo.categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {businessInfo.categories.map((category) => (
                    <div key={category.id} className="flex items-center gap-2">
                      <Badge variant={category.isPrimary ? 'default' : 'secondary'}>
                        {category.displayName}
                      </Badge>
                      <GoogleBusinessProfileVerificationBadge
                        verification={category.verificationStatus}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No categories synced.</p>
              )}
            </SnapshotSection>
          </div>
        </div>
      </SnapshotSection>
    </div>
  );
}
