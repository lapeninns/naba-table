'use client';

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

function display(value: unknown): string {
  return JSON.stringify(value) ?? 'null';
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
        className="max-h-[88vh] max-w-4xl overflow-y-auto"
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
            Verify the listing, safe before-and-after values, update masks, and expiry. This exact
            plan cannot be reused after it expires.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <Alert>
            <AlertTitle>No exact preview loaded</AlertTitle>
            <AlertDescription>Close this dialog and create a new preview.</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-4">
            {expired ? (
              <Alert variant="destructive">
                <AlertTitle>Exact preview expired</AlertTitle>
                <AlertDescription>
                  Refresh Google state and create a new preview. This plan cannot be published.
                </AlertDescription>
              </Alert>
            ) : null}

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Listing location</dt>
                <dd className="font-mono">{preview.listing.locationId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account / profile</dt>
                <dd className="font-mono">
                  {preview.listing.accountId} / {preview.listing.profileId}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Connection / consent</dt>
                <dd>
                  Generation {preview.listing.connectionGeneration} · epoch{' '}
                  {preview.listing.consentEpoch}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Versions</dt>
                <dd className="flex flex-col font-mono">
                  <span>{preview.confirmationVersion}</span>
                  <span>{preview.policyVersion}</span>
                  <span>{preview.rendererVersion}</span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Plan fingerprint</dt>
                <dd className="break-all font-mono text-xs">{preview.planFingerprint}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Issued</dt>
                <dd>{preview.issuedAt}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expires</dt>
                <dd>{preview.expiresAt} · valid for at most 15 minutes</dd>
              </div>
            </dl>

            <Separator />

            {preview.groups.map((group) => (
              <section key={group.groupId} className="flex flex-col gap-3 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{group.method}</Badge>
                  <Badge variant={group.riskLevel === 'critical' ? 'destructive' : 'secondary'}>
                    {group.riskLevel}
                  </Badge>
                  <span className="font-mono text-xs">{group.writeGroup}</span>
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {group.resource}
                </p>
                <div className="flex flex-wrap gap-1">
                  {group.updateMasks.map((mask) => (
                    <Badge key={mask} variant="outline" className="font-mono font-normal">
                      {mask}
                    </Badge>
                  ))}
                </div>
                {group.fieldKeys.map((fieldKey) => (
                  <div key={fieldKey} className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <p className="mb-1 font-medium">Before Google · {fieldKey}</p>
                      <pre className="overflow-x-auto rounded-md bg-muted p-2">
                        {display(group.beforeDisplay.google[fieldKey])}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 font-medium">After Google · {fieldKey}</p>
                      <pre className="overflow-x-auto rounded-md bg-muted p-2">
                        {display(group.afterDisplay.google[fieldKey])}
                      </pre>
                    </div>
                  </div>
                ))}
                {group.warnings.map((warning) => (
                  <Alert key={warning} variant="warning">
                    <AlertTitle>Google publish warning</AlertTitle>
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </section>
            ))}

            <div className="flex items-start gap-2">
              <Checkbox
                id="gbp-external-write-ack"
                checked={externalAcknowledged}
                onCheckedChange={(checked) => setExternalAcknowledged(checked === true)}
              />
              <Label htmlFor="gbp-external-write-ack" className="leading-5">
                I understand this changes public Google Business Profile data and the provider
                outcome may be unknown or partially fail.
              </Label>
            </div>
            {hasFullReplacement ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 p-3">
                <Checkbox
                  id="gbp-foodmenus-replacement-ack"
                  checked={replacementAcknowledged}
                  onCheckedChange={(checked) => setReplacementAcknowledged(checked === true)}
                />
                <Label htmlFor="gbp-foodmenus-replacement-ack" className="leading-5">
                  I understand this will fully replace Google FoodMenus, including data not present
                  in this exact plan.
                </Label>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancel
          </Button>
          {expired && onRefreshExpired ? (
            <Button type="button" onClick={onRefreshExpired}>
              Refresh and create new preview
            </Button>
          ) : null}
          <Button type="button" onClick={confirm} disabled={confirmDisabled}>
            {isPublishing ? 'Publishing…' : 'Publish exact plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
