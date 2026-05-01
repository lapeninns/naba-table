/**
 * Phase 3c of the unified dual-sync engine.
 *
 * Per-field row for the dual-sync workspace. Renders the label, state
 * badge, side-by-side Core vs Google preview, and an action picker that
 * the parent shell aggregates into a `decisions[]` payload for publish.
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import { DualSyncFreshnessChip } from './DualSyncFreshnessChip';
import { DualSyncStateBadge } from './DualSyncStateBadge';

import type { DualSyncDecisionAction } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export interface DualSyncFieldRowProps {
  readonly field: DualSyncFieldSummary;
  readonly selectedAction: DualSyncDecisionAction | null;
  readonly onChangeAction: (next: DualSyncDecisionAction | null) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

function formatPreview(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length === 0 ? '—' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function DualSyncFieldRow({
  field,
  selectedAction,
  onChangeAction,
  disabled = false,
  className,
}: DualSyncFieldRowProps) {
  const isUnsupported = field.conflictPolicy === 'unsupported';
  const canImport = field.capability.canImport && !isUnsupported;
  const canExport = field.capability.canExport && !isUnsupported;

  return (
    <Card className={cn('border-border/60', className)}>
      <CardContent className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">{field.label}</Label>
              <DualSyncStateBadge state={field.state} />
              {field.openCandidate ? (
                <Badge variant="outline" className="text-xs">
                  Pending export queued
                </Badge>
              ) : null}
            </div>
            {field.helpText ? (
              <p className="text-muted-foreground text-xs leading-snug">{field.helpText}</p>
            ) : null}
          </div>
          <FieldFreshness field={field} />
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Nabatable
            </p>
            <p className="break-words font-mono text-xs">{formatPreview(field.coreValue)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Google
            </p>
            <p className="break-words font-mono text-xs">{formatPreview(field.gbpValue)}</p>
          </div>
        </div>

        {isUnsupported ? (
          <p className="text-muted-foreground text-xs">
            This field is Nabatable-only. Google has no counterpart.
          </p>
        ) : (
          <ToggleGroup
            type="single"
            value={selectedAction ?? ''}
            onValueChange={(value) => {
              if (!value) {
                onChangeAction(null);
                return;
              }
              onChangeAction(value as DualSyncDecisionAction);
            }}
            className="justify-start gap-2"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem
              value="import_from_google"
              disabled={!canImport || disabled}
              aria-label="Import from Google"
            >
              Import from Google
            </ToggleGroupItem>
            <ToggleGroupItem
              value="export_to_google"
              disabled={!canExport || disabled}
              aria-label="Export to Google"
            >
              Export to Google
            </ToggleGroupItem>
            <ToggleGroupItem value="ignore" disabled={disabled} aria-label="Ignore field">
              Ignore
            </ToggleGroupItem>
          </ToggleGroup>
        )}

        {field.capability.blockedReasons.length > 0 ? (
          <ul className="text-muted-foreground space-y-0.5 text-[11px]">
            {field.capability.blockedReasons.map((reason) => (
              <li key={reason}>· {reason}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FieldFreshness({ field }: { field: DualSyncFieldSummary }) {
  // Pick the most informative timestamp + label for the field's current
  // state. For in_sync we show how long the field has been verified; for
  // drift / conflict / failure states we show how long the divergence
  // has existed.
  switch (field.state) {
    case 'in_sync':
      return field.lastInSyncAt ? (
        <DualSyncFreshnessChip
          timestamp={field.lastInSyncAt}
          prefix="In sync"
          neverLabel="Never verified"
        />
      ) : null;
    case 'core_dirty':
    case 'gbp_dirty':
    case 'drifted': {
      const t = field.lastCoreChangeAt ?? field.lastGbpChangeAt ?? field.lastInSyncAt;
      return t ? (
        <DualSyncFreshnessChip timestamp={t} prefix="Drifted" neverLabel="No history" />
      ) : null;
    }
    case 'conflict': {
      const t = field.lastCoreChangeAt ?? field.lastGbpChangeAt ?? field.lastInSyncAt;
      return t ? (
        <DualSyncFreshnessChip timestamp={t} prefix="In conflict" neverLabel="No history" />
      ) : null;
    }
    case 'pending_import':
    case 'pending_export': {
      const t = field.lastCoreChangeAt ?? field.lastGbpChangeAt ?? field.lastInSyncAt;
      return t ? (
        <DualSyncFreshnessChip timestamp={t} prefix="Pending" neverLabel="No history" />
      ) : null;
    }
    case 'import_failed':
    case 'export_failed': {
      const t = field.lastCoreChangeAt ?? field.lastGbpChangeAt ?? field.lastInSyncAt;
      return t ? (
        <DualSyncFreshnessChip timestamp={t} prefix="Failed" neverLabel="No history" />
      ) : null;
    }
    case null:
    case 'ignored':
    case 'unsupported':
    default:
      return field.lastInSyncAt ? (
        <DualSyncFreshnessChip
          timestamp={field.lastInSyncAt}
          prefix="Last sync"
          neverLabel="Never verified"
        />
      ) : null;
  }
}
