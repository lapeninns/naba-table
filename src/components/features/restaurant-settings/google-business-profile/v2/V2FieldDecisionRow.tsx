/**
 * Phase 5 of the GBP Dual-Sync V2 architecture.
 *
 * Decision-first row component. Renders a single diff item with three
 * actions (Import to Nabatable, Export to Google, Ignore). Capability flags
 * from the diff item drive button enablement. Selection is reported up via
 * `onChange`; the row is stateless.
 */

'use client';

import { AlertTriangle, CheckCircle2, CornerDownLeft, Info, Send, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import type {
  SyncV2DecisionAction,
  SyncV2DiffItem,
} from '@/server/google-business-profile-v2/types';

export interface V2FieldDecisionRowProps {
  readonly diffItem: SyncV2DiffItem;
  readonly currentAction: SyncV2DecisionAction | null;
  readonly disabled?: boolean;
  readonly onChange: (action: SyncV2DecisionAction) => void;
}

const FIELD_LABELS: Record<string, string> = {
  address: 'Address',
  businessDescription: 'Business description',
  contactPhone: 'Contact phone',
  googleMapUrl: 'Google Maps link',
  googleReviewUrl: 'Google review link',
  name: 'Business name',
};

const DAY_LABELS: Record<string, string> = {
  friday: 'Friday',
  monday: 'Monday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  thursday: 'Thursday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
};

function sentenceCase(value: string): string {
  const spaced = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return 'Field';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function humanFieldLabel(fieldKey: string): string {
  return FIELD_LABELS[fieldKey] ?? DAY_LABELS[fieldKey] ?? sentenceCase(fieldKey);
}

function labelFromStructuredValue(value: unknown): string | null {
  if (!isPlainRecord(value)) return null;

  if ('name' in value && 'startTime' in value && 'endTime' in value) {
    const name = formatScalar(value.name);
    const time = compactJoin([value.startTime, value.endTime], ' to ');
    return name === 'Not set' ? time : compactJoin([name, time], ': ');
  }

  if ('displayName' in value && typeof value.displayName === 'string') {
    return value.displayName;
  }

  if ('attributeName' in value && typeof value.attributeName === 'string') {
    return value.attributeName;
  }

  if ('attributeKey' in value && typeof value.attributeKey === 'string') {
    return sentenceCase(value.attributeKey);
  }

  if ('itemKey' in value && typeof value.itemKey === 'string') {
    return sentenceCase(value.itemKey);
  }

  return null;
}

function humanFieldLabelForItem(diffItem: SyncV2DiffItem): string {
  if (!diffItem.fieldKey.includes('|')) return humanFieldLabel(diffItem.fieldKey);

  return (
    labelFromStructuredValue(diffItem.normalizedNabatableValue) ??
    labelFromStructuredValue(diffItem.normalizedGoogleValue) ??
    humanFieldLabel(diffItem.fieldKey)
  );
}

function humanKeyLabel(key: string): string {
  return sentenceCase(key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return String(value);
}

function compactJoin(parts: ReadonlyArray<unknown>, separator = ' · '): string {
  return parts
    .map((part) => formatScalar(part))
    .filter((part) => part !== 'Not set')
    .join(separator);
}

function formatObjectSummary(value: Record<string, unknown>): string {
  if ('isClosed' in value || 'opensAt' in value || 'closesAt' in value) {
    if (value.isClosed) return 'Closed';
    return compactJoin(
      [value.opensAt ?? 'Opening time missing', value.closesAt ?? 'Closing time missing'],
      ' to ',
    );
  }

  if ('displayName' in value && 'categoryCode' in value) {
    const primary = value.isPrimary ? 'Primary category' : 'Additional category';
    return compactJoin([value.displayName, primary, value.categoryCode]);
  }

  if ('name' in value && 'startTime' in value && 'endTime' in value) {
    return compactJoin([
      value.name,
      compactJoin([value.startTime, value.endTime], ' to '),
      value.bookingOption,
    ]);
  }

  if ('attributeKey' in value || 'attributeName' in value) {
    const attributeValue =
      value.textValue ??
      value.uriValue ??
      (typeof value.boolValue === 'boolean' ? formatScalar(value.boolValue) : null) ??
      (Array.isArray(value.enumValues) && value.enumValues.length > 0
        ? value.enumValues.join(', ')
        : null) ??
      (Array.isArray(value.uriValues) && value.uriValues.length > 0
        ? value.uriValues.join(', ')
        : null);
    return compactJoin([value.attributeName ?? value.attributeKey, attributeValue]);
  }

  if ('areaType' in value && 'displayName' in value) {
    return compactJoin([value.displayName, value.areaType, value.regionCode]);
  }

  if ('itemKey' in value || 'itemType' in value) {
    return compactJoin([value.displayName ?? value.itemKey, value.itemType, value.description]);
  }

  const entries = Object.entries(value)
    .filter(([, entryValue]) => {
      if (entryValue === null || entryValue === undefined || entryValue === '') return false;
      if (Array.isArray(entryValue) && entryValue.length === 0) return false;
      return true;
    })
    .map(([key, entryValue]) => `${humanKeyLabel(key)}: ${formatValuePreview(entryValue)}`);

  return entries.length > 0 ? entries.join('\n') : 'Not set';
}

function formatValuePreview(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value
      .map((item) => (isPlainRecord(item) ? formatObjectSummary(item) : formatScalar(item)))
      .join('\n');
  }
  if (isPlainRecord(value)) return formatObjectSummary(value);
  return formatScalar(value);
}

function decisionLabel(action: SyncV2DecisionAction | null): string {
  if (action === 'import_from_google') return 'Import selected';
  if (action === 'export_to_google') return 'Export selected';
  if (action === 'ignore') return 'Ignored';
  return 'Needs decision';
}

function decisionTone(action: SyncV2DecisionAction | null): 'default' | 'secondary' | 'outline' {
  if (action === 'import_from_google' || action === 'export_to_google') return 'default';
  if (action === 'ignore') return 'secondary';
  return 'outline';
}

function decisionConsequence(action: SyncV2DecisionAction | null): string {
  if (action === 'import_from_google') {
    return 'Google will replace the Nabatable value for this field.';
  }
  if (action === 'export_to_google') {
    return 'Nabatable will update the public Google Business Profile for this field.';
  }
  if (action === 'ignore') {
    return 'This difference will be left unchanged in both systems.';
  }
  return 'Choose how this difference should be handled before publishing.';
}

function ValuePanel({
  label,
  value,
  selected,
  replaced,
}: {
  readonly label: string;
  readonly value: unknown;
  readonly selected: boolean;
  readonly replaced: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg bg-background p-4 ring-1 transition-[background-color,opacity,box-shadow] duration-200',
        selected ? 'ring-primary/35 bg-primary/5' : 'ring-border/70',
        replaced && 'bg-muted/40 opacity-70',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>{label}</span>
        {selected ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-primary">
            <CheckCircle2 className="size-3" aria-hidden />
            Selected
          </span>
        ) : replaced ? (
          <span className="normal-case tracking-normal">Will be replaced</span>
        ) : null}
      </div>
      <pre
        className={cn(
          'max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground',
          replaced && 'text-muted-foreground line-through decoration-2',
        )}
      >
        {formatValuePreview(value)}
      </pre>
    </div>
  );
}

export function V2FieldDecisionRow({
  diffItem,
  currentAction,
  disabled,
  onChange,
}: V2FieldDecisionRowProps) {
  const { capabilities } = diffItem;
  const fieldLabel = humanFieldLabelForItem(diffItem);
  const blockedReasons = capabilities.blockedReasons ?? [];
  const selectedGoogle = currentAction === 'import_from_google';
  const selectedNabatable = currentAction === 'export_to_google';
  const noDirectPath = !capabilities.canImport && !capabilities.canExport;

  return (
    <article
      className={cn(
        'min-w-0 rounded-xl bg-card p-4 text-sm shadow-sm ring-1 transition-[box-shadow,background-color] duration-200 sm:p-5',
        currentAction && currentAction !== 'ignore' ? 'ring-primary/25' : 'ring-border/70',
      )}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="min-w-0 text-base font-semibold tracking-tight text-foreground">
                {fieldLabel}
              </h4>
              <Badge variant={decisionTone(currentAction)}>{decisionLabel(currentAction)}</Badge>
              {capabilities.googleUpdateMask ? (
                <Badge variant="outline">{sentenceCase(capabilities.googleUpdateMask)}</Badge>
              ) : null}
              {noDirectPath ? <Badge variant="outline">Manual review</Badge> : null}
            </div>
            {diffItem.fieldKey !== fieldLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Field reference: {diffItem.fieldKey}
              </p>
            ) : null}
          </div>

          <ToggleGroup
            type="single"
            value={currentAction ?? ''}
            onValueChange={(value) => {
              if (
                value === 'import_from_google' ||
                value === 'export_to_google' ||
                value === 'ignore'
              ) {
                onChange(value);
              }
            }}
            disabled={disabled}
            className="grid w-full min-w-0 grid-cols-1 items-stretch gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[34rem]"
            aria-label={`Decision for ${fieldLabel}`}
          >
            <ToggleGroupItem
              value="import_from_google"
              disabled={disabled || !capabilities.canImport}
              aria-label="Import Google value to Nabatable"
              className="h-auto min-h-10 justify-start whitespace-normal rounded-lg px-3 py-2 text-left"
            >
              <CornerDownLeft data-icon="inline-start" />
              Import
            </ToggleGroupItem>
            <ToggleGroupItem
              value="export_to_google"
              disabled={disabled || !capabilities.canExport}
              aria-label="Export Nabatable value to Google"
              className="h-auto min-h-10 justify-start whitespace-normal rounded-lg px-3 py-2 text-left"
            >
              <Send data-icon="inline-start" />
              Export
            </ToggleGroupItem>
            <ToggleGroupItem
              value="ignore"
              disabled={disabled || !capabilities.canIgnore}
              aria-label="Ignore this field difference"
              className="h-auto min-h-10 justify-start whitespace-normal rounded-lg px-3 py-2 text-left"
            >
              <ShieldAlert data-icon="inline-start" />
              Ignore
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {blockedReasons.length > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{blockedReasons.join(' ')}</span>
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          <ValuePanel
            label="Nabatable"
            value={diffItem.normalizedNabatableValue}
            selected={selectedNabatable}
            replaced={selectedGoogle}
          />
          <ValuePanel
            label="Google"
            value={diffItem.normalizedGoogleValue}
            selected={selectedGoogle}
            replaced={selectedNabatable}
          />
        </div>

        <div
          className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
            currentAction && currentAction !== 'ignore'
              ? 'bg-primary/5 text-foreground ring-1 ring-primary/15'
              : 'bg-muted/40 text-muted-foreground',
          )}
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{decisionConsequence(currentAction)}</span>
        </div>
      </div>
    </article>
  );
}
