/**
 * Publish preview confirmation for unified dual-sync.
 *
 * Renders the read-only section-level plan returned by
 * `/dual-sync/publish/preview` before the operator can execute a write.
 */

'use client';

import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type {
  DualSyncPlanWarning,
  DualSyncPublishGroup,
  DualSyncPublishPlan,
} from '@/server/dual-sync/publish/types';

const SECTION_LABEL: Record<string, string> = {
  profile: 'Profile',
  operatingHours: 'Operating hours',
  servicePeriods: 'Service periods',
  'businessContext.categories': 'Categories',
  'businessContext.serviceAreas': 'Service areas',
  'businessContext.attributes': 'Attributes',
  'businessContext.serviceItems': 'Service items',
  foodMenus: 'Food menus',
};

const RISK_VARIANT: Record<
  DualSyncPublishGroup['riskLevel'],
  'status-confirmed' | 'status-pending' | 'status-cancelled' | 'status-completed'
> = {
  low: 'status-confirmed',
  medium: 'status-completed',
  high: 'status-pending',
  critical: 'status-cancelled',
};

function sectionLabel(sectionKey: string): string {
  return SECTION_LABEL[sectionKey] ?? sectionKey;
}

function warningLabel(code: DualSyncPlanWarning['code']): string {
  if (code === 'DESTRUCTIVE_WRITE') return 'Destructive write';
  if (code === 'PREFLIGHT_REQUIRED') return 'Preflight required';
  return 'High risk';
}

function requiresAcknowledgement(plan: DualSyncPublishPlan | null): boolean {
  if (!plan) return false;
  return (
    plan.groups.some(
      (group) =>
        group.requiresManualConfirmation ||
        group.destructiveWritePossible ||
        group.riskLevel === 'high' ||
        group.riskLevel === 'critical',
    ) || plan.warnings.length > 0
  );
}

function fieldLabel(count: number): string {
  return count === 1 ? 'field' : 'fields';
}

export interface DualSyncPublishPreviewDialogProps {
  readonly open: boolean;
  readonly plan: DualSyncPublishPlan | null;
  readonly isPublishing: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

export function DualSyncPublishPreviewDialog({
  open,
  plan,
  isPublishing,
  onOpenChange,
  onConfirm,
}: DualSyncPublishPreviewDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const needsAcknowledgement = useMemo(() => requiresAcknowledgement(plan), [plan]);
  const acceptedCount = plan?.acceptedCount ?? 0;
  const confirmDisabled =
    isPublishing || acceptedCount === 0 || (needsAcknowledgement && !acknowledged);

  useEffect(() => {
    if (open) {
      setAcknowledged(false);
    }
  }, [open, plan]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review publish plan</DialogTitle>
          <DialogDescription>
            This preview was built from fresh Core and Google snapshots before publish.
          </DialogDescription>
        </DialogHeader>

        {plan ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="metric">{plan.acceptedCount} accepted</Badge>
              <Badge variant={plan.rejectedCount > 0 ? 'status-cancelled' : 'status-confirmed'}>
                {plan.rejectedCount} rejected
              </Badge>
              <Badge variant="secondary">{plan.ignoredCount} ignored</Badge>
              <Badge variant="outline">{plan.groups.length} write groups</Badge>
            </div>

            {plan.warnings.length > 0 ? (
              <Alert variant="warning">
                <ShieldAlert className="size-4" />
                <AlertTitle>High-risk publish review</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 flex flex-col gap-2">
                    {plan.warnings.map((warning, index) => (
                      <div key={`${warning.code}-${warning.groupId ?? index}`} className="text-sm">
                        <span className="font-medium">{warningLabel(warning.code)}:</span>{' '}
                        {warning.message}
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {plan.groups.length > 0 ? <PublishGroupsTable groups={plan.groups} /> : null}

            {plan.rejected.length > 0 ? (
              <div className="rounded-md border border-destructive/40 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="size-4" />
                  Rejected decisions
                </div>
                <div className="flex flex-col gap-2">
                  {plan.rejected.map((rejected) => (
                    <div key={`${rejected.fieldKey}-${rejected.action}`} className="text-xs">
                      <span className="font-mono">{rejected.fieldKey}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        / {rejected.failure.code}: {rejected.failure.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {needsAcknowledgement ? (
              <div className="flex items-start gap-2 rounded-md border p-3">
                <Checkbox
                  id="dual-sync-preview-acknowledgement"
                  checked={acknowledged}
                  onCheckedChange={(value) => setAcknowledged(value === true)}
                />
                <Label
                  htmlFor="dual-sync-preview-acknowledgement"
                  className="block text-sm leading-5"
                >
                  I understand this may update public Google Business Profile data.
                </Label>
              </div>
            ) : null}
          </div>
        ) : (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>No publish plan loaded.</AlertTitle>
            <AlertDescription>Close this dialog and generate a new preview.</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={confirmDisabled}>
            {isPublishing ? 'Publishing' : `Publish ${acceptedCount} ${fieldLabel(acceptedCount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishGroupsTable({ groups }: { readonly groups: ReadonlyArray<DualSyncPublishGroup> }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Section</TableHead>
            <TableHead className="w-[112px]">Direction</TableHead>
            <TableHead className="w-[96px]">Risk</TableHead>
            <TableHead className="w-[144px]">Masks</TableHead>
            <TableHead className="w-[96px] text-right">Fields</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.groupId} className="text-xs">
              <TableCell>
                <div className="font-medium">{sectionLabel(group.sectionKey)}</div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {group.writeGroup}
                </div>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                  {group.direction === 'export_to_google' ? (
                    <>
                      <ArrowUpFromLine className="size-3" />
                      Export
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="size-3" />
                      Import
                    </>
                  )}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={RISK_VARIANT[group.riskLevel]} className="font-mono text-[10px]">
                  {group.riskLevel}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-[10px]">
                {group.googleUpdateMasks.length > 0 ? group.googleUpdateMasks.join(', ') : '-'}
              </TableCell>
              <TableCell className="text-right font-mono text-[10px]">
                {group.fields.length}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
