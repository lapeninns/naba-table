import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { GoogleBusinessProfileVerificationBadge } from './GoogleBusinessProfileUiHelpers';
import { SettingsSectionHeader } from './shared';

import type { GoogleBusinessProfileBusinessInfo } from '@/services/ops/restaurants';

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

function AttributeRowsTable({ rows }: { rows: GoogleBusinessProfileBusinessInfo['attributes'] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">Attribute</TableHead>
            <TableHead className="px-4 py-3">Value</TableHead>
            <TableHead className="px-4 py-3">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((attribute) => {
            const detail = getAttributeDetail(attribute);

            return (
              <TableRow key={attribute.id}>
                <TableCell className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">
                      {attribute.displayName ?? attribute.attributeKey}
                    </span>
                    <span className="text-xs text-muted-foreground">{attribute.attributeKey}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  {detail ? (
                    detail.href ? (
                      <a
                        href={detail.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-sm text-primary underline-offset-4 hover:underline"
                      >
                        {detail.text}
                      </a>
                    ) : (
                      <span className="text-sm text-foreground">{detail.text}</span>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">No detail available</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <GoogleBusinessProfileVerificationBadge
                    verification={attribute.verificationStatus}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function GoogleBusinessProfileAttributesSection({
  attributes,
}: {
  attributes: GoogleBusinessProfileBusinessInfo['attributes'];
}) {
  const attributeGroups = groupAttributes(attributes);

  if (attributeGroups.length === 0) {
    return (
      <section className="space-y-6">
        <SettingsSectionHeader
          title="Structured attributes"
          description="GBP attributes grouped for reference and verification."
          className="pb-0"
        />
        <p className="text-sm text-muted-foreground">No additional attributes synced.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SettingsSectionHeader
        title="Structured attributes"
        description="GBP attributes grouped for reference and verification."
        className="pb-0"
      />

      <div className="space-y-5">
        {attributeGroups.map((group) => (
          <div key={group.group} className="space-y-3">
            <SettingsSectionHeader
              title={group.group}
              description={`${group.items.length} synced attribute${group.items.length === 1 ? '' : 's'} in this group.`}
              className="pb-0"
            />
            <AttributeRowsTable rows={group.items} />
          </div>
        ))}
      </div>
    </section>
  );
}
