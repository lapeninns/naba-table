'use client';

import { AlertTriangle, Clock, Info, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
import { Separator } from '@/components/ui/separator';

import type { GbpExactPreviewResponseV1 } from '@/services/ops/dual-sync';

type RiskAcknowledgement =
  | 'external_write'
  | 'outcome_may_be_unknown'
  | 'partial_bundle_failure'
  | 'destructive_full_replacement';

export interface GbpExactPublishConfirmation {
  readonly mode: 'immediate' | 'queued';
  readonly riskAcknowledgements: readonly RiskAcknowledgement[];
}

interface GbpExactPublishDialogProps {
  readonly open: boolean;
  readonly preview: GbpExactPreviewResponseV1 | null;
  readonly isPublishing: boolean;
  readonly now?: Date;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (confirmation: GbpExactPublishConfirmation) => void;
  readonly onRefreshExpired?: () => void;
}

type RiskLevel = GbpExactPreviewResponseV1['groups'][number]['riskLevel'];

const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
  critical: 'Critical risk',
};

const RISK_VARIANT: Record<RiskLevel, 'secondary' | 'status-pending' | 'status-cancelled'> = {
  low: 'secondary',
  medium: 'secondary',
  high: 'status-pending',
  critical: 'status-cancelled',
};

function display(value: unknown): string {
  return JSON.stringify(value) ?? 'null';
}

function formatPreviewTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    parsed,
  );
}

export function GbpExactPublishDialog({
  open,
  preview,
  isPublishing,
  now = new Date(),
  onOpenChange,
  onConfirm,
  onRefreshExpired,
}: GbpExactPublishDialogProps) {
  const [externalAcknowledged, setExternalAcknowledged] = useState(false);
  const [replacementAcknowledged, setReplacementAcknowledged] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      setExternalAcknowledged(false);
      setReplacementAcknowledged(false);
    }
  }, [open]);

  const expired = preview ? new Date(preview.expiresAt).getTime() <= now.getTime() : false;
  const hasFullReplacement = preview?.groups.some((group) => group.fullReplacement) ?? false;
  const confirmDisabled =
    !preview ||
    expired ||
    isPublishing ||
    !externalAcknowledged ||
    (hasFullReplacement && !replacementAcknowledged);

  const confirm = () => {
    if (confirmDisabled) return;
    const acknowledgements: RiskAcknowledgement[] = [
      'external_write',
      'outcome_may_be_unknown',
      'partial_bundle_failure',
    ];
    if (hasFullReplacement) acknowledgements.push('destructive_full_replacement');
    onConfirm({ mode: 'immediate', riskAcknowledgements: acknowledgements });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[86dvh] max-w-3xl overflow-y-auto"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          previouslyFocusedRef.current =
            document.querySelector<HTMLElement>('[data-dual-sync-action="publish"]') ??
            (document.activeElement instanceof HTMLElement ? document.activeElement : null);
          titleRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          previouslyFocusedRef.current?.focus();
        }}
      >
        <DialogHeader className="pr-12 sm:pr-0">
          <DialogTitle ref={titleRef} tabIndex={-1}>
            Confirm exact Google publish
          </DialogTitle>
          <DialogDescription>
            Google receives exactly this plan and nothing else. Check the listing, the before and
            after values and the expiry. The plan can’t be reused after it expires.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <Alert>
            <Info className="size-4" aria-hidden />
            <AlertTitle>No exact preview loaded</AlertTitle>
            <AlertDescription>Close this dialog and create a new preview.</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-4">
            {expired ? (
              <Alert variant="destructive">
                <Clock className="size-4" aria-hidden />
                <AlertTitle>This preview has expired</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <span>
                    Previews are valid for up to 15 minutes. Create a new one so it matches Google
                    now. This plan can’t be published.
                  </span>
                  {onRefreshExpired ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="self-start"
                      onClick={onRefreshExpired}
                    >
                      <RefreshCw data-icon="inline-start" aria-hidden />
                      Refresh and create a new preview
                    </Button>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Listing</dt>
              <dd className="flex min-w-0 flex-col">
                <span className="font-mono text-xs">{preview.listing.locationId}</span>
                <span className="break-all font-mono text-xs text-muted-foreground">
                  {preview.listing.accountId} / {preview.listing.profileId}
                </span>
              </dd>
              <dt className="text-muted-foreground">Connection</dt>
              <dd>
                Generation{' '}
                <span className="font-mono text-xs">{preview.listing.connectionGeneration}</span> ·
                consent epoch{' '}
                <span className="font-mono text-xs">{preview.listing.consentEpoch}</span>
              </dd>
              <dt className="text-muted-foreground">Plan fingerprint</dt>
              <dd className="break-all font-mono text-xs">{preview.planFingerprint}</dd>
              <dt className="text-muted-foreground">Versions</dt>
              <dd className="flex flex-col font-mono text-xs">
                <span>{preview.confirmationVersion}</span>
                <span>{preview.policyVersion}</span>
                <span>{preview.rendererVersion}</span>
              </dd>
              <dt className="text-muted-foreground">Issued</dt>
              <dd className="tabular-nums">{formatPreviewTime(preview.issuedAt)}</dd>
              <dt className="text-muted-foreground">Valid until</dt>
              <dd className="tabular-nums">
                {expired ? (
                  <span className="font-medium text-destructive">Expired</span>
                ) : (
                  formatPreviewTime(preview.expiresAt)
                )}{' '}
                · valid for at most 15 minutes
              </dd>
            </dl>

            <Separator />

            {preview.groups.map((group) => (
              <section
                key={group.groupId}
                aria-label={`Write group ${group.writeGroup}`}
                className="flex min-w-0 flex-col gap-3 rounded-md border border-border/70 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium">{group.writeGroup}</span>
                  <Badge variant="outline" className="font-mono">
                    {group.method}
                  </Badge>
                  <Badge variant={RISK_VARIANT[group.riskLevel]}>
                    {RISK_LABEL[group.riskLevel]}
                  </Badge>
                  {group.fullReplacement ? (
                    <Badge variant="status-cancelled">Full replacement</Badge>
                  ) : null}
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {group.resource}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-xs text-muted-foreground">Update mask</span>
                  {group.updateMasks.map((mask) => (
                    <Badge key={mask} variant="outline" className="font-mono font-normal">
                      {mask}
                    </Badge>
                  ))}
                </div>
                {group.fullReplacement ? (
                  <p className="text-sm">
                    <span className="font-medium">Food menus are replaced in full.</span> Menu items
                    on Google that aren’t in this plan will be removed.
                  </p>
                ) : null}
                {group.fieldKeys.map((fieldKey) => (
                  <div key={fieldKey} className="grid min-w-0 gap-2 text-xs sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="mb-1 font-medium">Before Google · {fieldKey}</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2">
                        {display(group.beforeDisplay.google[fieldKey])}
                      </pre>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 font-medium">After Google · {fieldKey}</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2">
                        {display(group.afterDisplay.google[fieldKey])}
                      </pre>
                    </div>
                  </div>
                ))}
                {group.warnings.map((warning) => (
                  <Alert key={warning} variant="warning">
                    <AlertTriangle className="size-4" aria-hidden />
                    <AlertTitle>Google publish warning</AlertTitle>
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </section>
            ))}

            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <Checkbox
                id="gbp-external-write-ack"
                checked={externalAcknowledged}
                disabled={expired}
                onCheckedChange={(checked) => setExternalAcknowledged(checked === true)}
              />
              <Label htmlFor="gbp-external-write-ack" className="leading-5">
                I understand this changes public Google Business Profile data, and Google’s result
                may be unknown or only partly applied.
              </Label>
            </div>
            {hasFullReplacement ? (
              <div className="flex items-start gap-3 rounded-md border border-destructive/50 p-3">
                <Checkbox
                  id="gbp-foodmenus-replacement-ack"
                  checked={replacementAcknowledged}
                  disabled={expired}
                  onCheckedChange={(checked) => setReplacementAcknowledged(checked === true)}
                />
                <Label htmlFor="gbp-foodmenus-replacement-ack" className="leading-5">
                  I understand Google receives a full replacement of your food menus, including
                  anything not in this plan.
                </Label>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={confirmDisabled}>
            {isPublishing ? 'Publishing…' : 'Publish exact plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
