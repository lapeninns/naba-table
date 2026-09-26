'use client';

import { CheckCircle2, Equal, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import { getDualSyncFieldActionAvailability } from '../../dual-sync/dualSyncFieldRowDomain';
import { formatDualSyncFieldPreview } from '../../dual-sync/dualSyncFieldValuePreviewDomain';
import {
  getDualSyncSectionBulkSummary,
  type DualSyncDecisionEntry,
} from '../../dual-sync/dualSyncWorkspaceDecisionDomain';
import { DUAL_SYNC_SECTION_LABEL } from '../../dual-sync/dualSyncWorkspaceDomain';
import {
  describeGbpFieldNotes,
  formatGbpTime,
  isGbpFieldDifferent,
  summarizeGbpReview,
  summarizeGbpSection,
} from '../gbpPageModel';
import { AVAILABILITY_SCHEDULE_HREF, PROFILE_CONTACT_HREF } from '../googleBusinessProfileWorkflow';

import type { DualSyncWorkspace } from '../../dual-sync/hooks/useDualSyncWorkspace';
import type { DualSyncDecisionAction, DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export type GbpReviewTableProps = {
  readonly workspace: Pick<
    DualSyncWorkspace,
    | 'orderedSectionKeys'
    | 'fieldsBySection'
    | 'visibleFields'
    | 'decisions'
    | 'onSelectAction'
    | 'onBulkSelectSection'
    | 'onClearSection'
  >;
  /** Why "Send to Google" is unavailable right now, or null. */
  readonly sendBlockReason: string | null;
  /** A publish, preview or pause is in progress: choices are frozen. */
  readonly choicesLocked: boolean;
  readonly checkedAt: string | null;
  readonly showMatching: boolean;
  readonly onShowMatchingChange: (next: boolean) => void;
};

const CHOICES: ReadonlyArray<{ action: DualSyncDecisionAction; label: string }> = [
  { action: 'export_to_google', label: 'Send to Google' },
  { action: 'import_from_google', label: 'Use Google’s' },
  { action: 'ignore', label: 'Ignore' },
];

const COLUMNS =
  '@4xl:grid-cols-[minmax(170px,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_300px] @4xl:gap-4';

function emptyValueLabel(field: DualSyncFieldSummary, side: 'core' | 'gbp') {
  if (field.sectionKey === 'foodMenus')
    return side === 'core' ? 'Not on your menu' : 'Not on Google';
  return 'Not set';
}

function Value({ field, side }: { field: DualSyncFieldSummary; side: 'core' | 'gbp' }) {
  const value = side === 'core' ? field.coreValue : field.gbpValue;
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <span className="block text-xs text-muted-foreground @4xl:sr-only">
        {side === 'core' ? 'Nabatable' : 'Google'}
      </span>
      {empty ? (
        <span className="italic text-muted-foreground">{emptyValueLabel(field, side)}</span>
      ) : Array.isArray(value) ? (
        value.map((item) => formatDualSyncFieldPreview(item)).join(', ')
      ) : (
        formatDualSyncFieldPreview(value)
      )}
    </div>
  );
}

function FieldRow({
  field,
  selected,
  sendBlocked,
  locked,
  onSelect,
}: {
  field: DualSyncFieldSummary;
  selected: DualSyncDecisionAction | null;
  sendBlocked: boolean;
  locked: boolean;
  onSelect: (next: DualSyncDecisionAction | null) => void;
}) {
  const notes = describeGbpFieldNotes(field);
  const availability = getDualSyncFieldActionAvailability(field);
  const reasons = field.capability.blockedReasons;
  const reasonsId = reasons.length ? `gbp-field-reasons-${field.fieldKey}` : undefined;

  let action;
  if (field.state === null) {
    action = <span className="text-sm text-muted-foreground">Not compared yet</span>;
  } else if (!isGbpFieldDifferent(field)) {
    action = (
      <span className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground">
        <Equal className="size-4" aria-hidden />
        No action needed
      </span>
    );
  } else if (availability.isUnsupported) {
    action = (
      <span className="text-sm text-muted-foreground">
        Nabatable only. Google has no matching field.
      </span>
    );
  } else {
    action = (
      <ToggleGroup
        type="single"
        value={selected ?? ''}
        onValueChange={(next) => onSelect(next ? (next as DualSyncDecisionAction) : null)}
        aria-label={`What to do with ${field.label}`}
        aria-describedby={reasonsId}
        className="flex w-full rounded-lg bg-muted p-0.5"
      >
        {CHOICES.map((choice) => {
          const unavailable =
            (choice.action === 'export_to_google' && (!availability.canExport || sendBlocked)) ||
            (choice.action === 'import_from_google' && !availability.canImport);
          return (
            <ToggleGroupItem
              key={choice.action}
              value={choice.action}
              disabled={locked || unavailable}
              className="h-8 min-h-0 min-w-0 flex-1 px-1.5 text-[13px] data-[state=on]:bg-background data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-sm data-[state=on]:ring-1 data-[state=on]:ring-border [@media(pointer:coarse)]:h-11"
            >
              {choice.label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    );
  }

  return (
    <div
      data-gbp-field={field.fieldKey}
      className={cn(
        'grid grid-cols-1 gap-x-4 gap-y-2 border-t px-4 py-2.5 @md:grid-cols-2 @4xl:items-start',
        COLUMNS,
      )}
    >
      <div className="min-w-0 @md:col-span-2 @4xl:col-span-1">
        <b className="block font-semibold">{field.label}</b>
        <span
          className={cn(
            'mt-0.5 flex items-center gap-1 text-xs text-muted-foreground',
            notes.hot && 'font-semibold text-destructive',
          )}
        >
          {notes.hot ? <TriangleAlert className="size-3" aria-hidden /> : null}
          {notes.text}
        </span>
        {reasons.length && isGbpFieldDifferent(field) ? (
          <span id={reasonsId} className="mt-1 block text-xs text-muted-foreground">
            {reasons.join(' ')}
          </span>
        ) : null}
      </div>
      <Value field={field} side="core" />
      <Value field={field} side="gbp" />
      <div className="min-w-0 @md:col-span-2 @4xl:col-span-1">{action}</div>
    </div>
  );
}

function SectionBulkSelect({
  sectionKey,
  fields,
  decisions,
  sendBlocked,
  locked,
  onBulk,
  onClear,
}: {
  sectionKey: DualSyncSectionKey;
  fields: ReadonlyArray<DualSyncFieldSummary>;
  decisions: Readonly<Record<string, DualSyncDecisionEntry>>;
  sendBlocked: boolean;
  locked: boolean;
  onBulk: (action: DualSyncDecisionAction) => void;
  onClear: () => void;
}) {
  const summary = getDualSyncSectionBulkSummary(fields, decisions);
  const differing = fields.filter(isGbpFieldDifferent).length;
  if (differing < 2) return null;
  const title = DUAL_SYNC_SECTION_LABEL[sectionKey];
  return (
    <Select
      value=""
      disabled={locked}
      onValueChange={(value) => {
        if (value === 'clear') onClear();
        else onBulk(value as DualSyncDecisionAction);
      }}
    >
      <SelectTrigger aria-label={`Set every difference in ${title}`} className="ml-auto h-8 w-auto">
        <SelectValue placeholder={`Set all ${differing}…`} />
      </SelectTrigger>
      <SelectContent align="end">
        {summary.exportable && !sendBlocked ? (
          <SelectItem value="export_to_google">
            Send all to Google ({summary.exportable})
          </SelectItem>
        ) : null}
        {summary.importable ? (
          <SelectItem value="import_from_google">
            Use all of Google’s ({summary.importable})
          </SelectItem>
        ) : null}
        {summary.ignorable ? (
          <SelectItem value="ignore">Ignore all ({summary.ignorable})</SelectItem>
        ) : null}
        <SelectItem value="clear" disabled={summary.selected === 0}>
          Clear choices
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

/**
 * "Review differences": every compared field in one table, sections as bands, with the choice
 * for each difference in a fixed column. Matching fields are hidden unless asked for.
 */
export function GbpReviewTable({
  workspace,
  sendBlockReason,
  choicesLocked,
  checkedAt,
  showMatching,
  onShowMatchingChange,
}: GbpReviewTableProps) {
  const { decisions } = workspace;
  const summary = summarizeGbpReview(workspace.visibleFields, decisions);
  const sendBlocked = Boolean(sendBlockReason);
  const sections = workspace.orderedSectionKeys.map((key) => ({
    key,
    fields: workspace.fieldsBySection.get(key) ?? [],
  }));
  const shown = sections.filter(
    (section) => showMatching || section.fields.some(isGbpFieldDifferent),
  );
  const matchingSections = sections.filter((section) =>
    section.fields.every((field) => field.state === 'in_sync'),
  );

  return (
    <div className="@container flex min-w-0 flex-col gap-3" data-testid="gbp-review">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm" role="status">
          <b className="font-semibold">
            {summary.differences} {summary.differences === 1 ? 'difference' : 'differences'}
          </b>{' '}
          in {summary.sectionsWithDifferences}{' '}
          {summary.sectionsWithDifferences === 1 ? 'section' : 'sections'} · {summary.decided} of{' '}
          {summary.toDecide} decided
        </p>
        {summary.toDecide ? (
          <Progress
            value={Math.round((summary.decided / summary.toDecide) * 100)}
            aria-label={`${summary.decided} of ${summary.toDecide} decided`}
            className="h-1.5 w-[120px]"
          />
        ) : null}
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <Switch
            id="gbp-show-matching"
            checked={showMatching}
            onCheckedChange={onShowMatchingChange}
            className="min-h-0 min-w-0"
          />
          <Label htmlFor="gbp-show-matching" className="font-normal">
            Show matching fields
          </Label>
        </div>
      </div>

      {shown.length ? (
        <div
          role="region"
          aria-label="Nabatable compared with Google"
          className="rounded-lg border bg-background"
        >
          <div
            aria-hidden
            className={cn(
              'sticky top-0 z-10 hidden rounded-t-lg border-b bg-muted px-4 py-2.5 text-xs font-semibold text-muted-foreground @4xl:grid',
              COLUMNS,
            )}
          >
            <span>Field</span>
            <span>Nabatable</span>
            <span>Google · checked {formatGbpTime(checkedAt, 'not yet')}</span>
            <span>What to do</span>
          </div>
          {shown.map(({ key, fields }, index) => {
            const section = summarizeGbpSection(fields);
            const rows = showMatching ? fields : fields.filter(isGbpFieldDifferent);
            const headingId = `gbp-section-${key.replaceAll('.', '-')}`;
            return (
              <section
                key={key}
                aria-labelledby={headingId}
                className={cn(index > 0 && 'border-t')}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-2 pt-4">
                  <h3 id={headingId} className="text-sm font-semibold">
                    {DUAL_SYNC_SECTION_LABEL[key]}
                  </h3>
                  <span className="text-xs text-muted-foreground">{section.label}</span>
                  <SectionBulkSelect
                    sectionKey={key}
                    fields={fields}
                    decisions={decisions}
                    sendBlocked={sendBlocked}
                    locked={choicesLocked}
                    onBulk={(action) => workspace.onBulkSelectSection(fields, action)}
                    onClear={() => workspace.onClearSection(fields)}
                  />
                </div>
                {key === 'foodMenus' && section.differing ? (
                  <p className="mx-4 mb-2 flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <b className="font-semibold">Google replaces its whole menu.</b> Sending any
                      item sends your full Nabatable menu, and items that are only on Google are
                      removed.
                    </span>
                  </p>
                ) : null}
                {rows.map((field) => (
                  <FieldRow
                    key={field.fieldKey}
                    field={field}
                    selected={decisions[field.fieldKey]?.action ?? null}
                    sendBlocked={sendBlocked}
                    locked={choicesLocked}
                    onSelect={(next) => workspace.onSelectAction(field.fieldKey, next)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border px-4 py-7 text-center text-muted-foreground">
          <CheckCircle2 className="size-5" aria-hidden />
          <p>
            <b className="font-semibold text-foreground">Nabatable and Google match.</b> There is
            nothing to review.
          </p>
        </div>
      )}

      {!showMatching && matchingSections.length && shown.length ? (
        <p className="text-sm text-muted-foreground">
          All match: {matchingSections.map(({ key }) => DUAL_SYNC_SECTION_LABEL[key]).join(', ')}.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Public profile fields are edited on{' '}
        <Link href={PROFILE_CONTACT_HREF} className="underline underline-offset-2">
          Restaurant profile
        </Link>
        . Hours and meal windows are edited on{' '}
        <Link href={AVAILABILITY_SCHEDULE_HREF} className="underline underline-offset-2">
          Availability &amp; Booking types
        </Link>
        .
      </p>
    </div>
  );
}
